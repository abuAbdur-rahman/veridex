import { and, eq, ne } from "drizzle-orm";
import type { Database } from "../db/client.js";
import {
	project,
	projectMember,
	team,
	teamMember,
	user,
} from "../db/schema/index.js";
import { AppError, NotFoundError } from "../lib/errors.js";

export const usernamePattern = /^[a-z0-9][a-z0-9_-]{2,29}$/;

export function normalizeUsername(username: string) {
	return username.trim().toLowerCase();
}

function isUsernameConflict(error: unknown) {
	if (
		typeof error !== "object" ||
		error === null ||
		!("code" in error) ||
		error.code !== "23505" ||
		!("constraint_name" in error || "constraint" in error)
	) {
		return false;
	}

	const constraint =
		"constraint_name" in error ? error.constraint_name : error.constraint;
	return (
		constraint === "user_username_unique" || constraint === "team_slug_unique"
	);
}

export async function getCurrentUser(db: Database, userId: string) {
	const [currentUser] = await db
		.select({
			id: user.id,
			name: user.name,
			email: user.email,
			image: user.image,
			username: user.username,
			defaultRole: user.defaultRole,
		})
		.from(user)
		.where(eq(user.id, userId))
		.limit(1);

	if (!currentUser) throw new NotFoundError("User");

	const teams = await db
		.select({
			id: team.id,
			name: team.name,
			slug: team.slug,
			isPersonal: team.isPersonal,
			teamRole: teamMember.teamRole,
		})
		.from(teamMember)
		.innerJoin(team, eq(team.id, teamMember.teamId))
		.where(eq(teamMember.userId, userId));

	return {
		user: currentUser,
		hasPersonalTeam: teams.some((membership) => membership.isPersonal),
		teams,
	};
}

export async function isUsernameAvailable(
	db: Database,
	username: string,
	userId: string,
) {
	const normalizedUsername = normalizeUsername(username);
	if (!usernamePattern.test(normalizedUsername)) return false;

	const [existingUsers, existingTeams] = await Promise.all([
		db
			.select({ id: user.id })
			.from(user)
			.where(
				and(eq(user.username, normalizedUsername), ne(user.id, userId)),
			)
			.limit(1),
		db
			.select({ id: team.id })
			.from(team)
			.where(eq(team.slug, normalizedUsername))
			.limit(1),
	]);

	return existingUsers.length === 0 && existingTeams.length === 0;
}

export async function completeOnboarding(
	db: Database,
	userId: string,
	username: string,
) {
	const normalizedUsername = normalizeUsername(username);

	try {
		return await db.transaction(async (tx) => {
			const [currentUser] = await tx
				.select({ username: user.username })
				.from(user)
				.where(eq(user.id, userId))
				.for("update")
				.limit(1);

			if (!currentUser) throw new NotFoundError("User");
			if (currentUser.username) {
				throw new AppError(
					"ONBOARDING_COMPLETED",
					"Onboarding has already been completed",
					409,
				);
			}

			const [updatedUser] = await tx
				.update(user)
				.set({ username: normalizedUsername })
				.where(eq(user.id, userId))
				.returning({ username: user.username });

			if (!updatedUser) throw new NotFoundError("User");

			const [personalTeam] = await tx
				.insert(team)
				.values({
					name: normalizedUsername,
					slug: normalizedUsername,
					ownerId: userId,
					isPersonal: true,
				})
				.returning({
					id: team.id,
					name: team.name,
					slug: team.slug,
					isPersonal: team.isPersonal,
				});

			if (!personalTeam) {
				throw new AppError(
					"PROVISIONING_FAILED",
					"Could not create personal team",
					500,
				);
			}

			await tx.insert(teamMember).values({
				teamId: personalTeam.id,
				userId,
				teamRole: "owner",
			});

			const [defaultProject] = await tx
				.insert(project)
				.values({
					teamId: personalTeam.id,
					name: "My Project",
					slug: "my-project",
					createdBy: userId,
				})
				.returning({
					id: project.id,
					teamId: project.teamId,
					name: project.name,
					slug: project.slug,
				});

			if (!defaultProject) {
				throw new AppError(
					"PROVISIONING_FAILED",
					"Could not create default project",
					500,
				);
			}

			await tx.insert(projectMember).values({
				projectId: defaultProject.id,
				userId,
				role: "admin",
			});

			return {
				user: { username: updatedUser.username },
				team: personalTeam,
				project: defaultProject,
			};
		});
	} catch (error) {
		if (error instanceof AppError) throw error;
		if (isUsernameConflict(error)) {
			throw new AppError("USERNAME_TAKEN", "Username is unavailable", 409);
		}
		throw error;
	}
}
