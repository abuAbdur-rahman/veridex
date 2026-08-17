import { eq } from "drizzle-orm";
import type { Database } from "../db/client.js";
import { team, teamMember, user } from "../db/schema/index.js";
import { AppError } from "../lib/errors.js";

function isTeamSlugConflict(error: unknown) {
	return (
		typeof error === "object" &&
		error !== null &&
		"code" in error &&
		error.code === "23505" &&
		("constraint_name" in error || "constraint" in error) &&
		("constraint_name" in error ? error.constraint_name : error.constraint) ===
			"team_slug_unique"
	);
}

export async function listTeams(db: Database, userId: string) {
	return db
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
}

export async function createTeam(
	db: Database,
	userId: string,
	input: { name: string; slug: string },
) {
	try {
		return await db.transaction(async (tx) => {
			const [createdTeam] = await tx
				.insert(team)
				.values({
					name: input.name,
					slug: input.slug,
					ownerId: userId,
					isPersonal: false,
				})
				.returning({
					id: team.id,
					name: team.name,
					slug: team.slug,
					isPersonal: team.isPersonal,
				});

			if (!createdTeam) {
				throw new AppError("TEAM_CREATE_FAILED", "Could not create team", 500);
			}

			await tx.insert(teamMember).values({
				teamId: createdTeam.id,
				userId,
				teamRole: "owner",
				invitedBy: null,
			});

			return { ...createdTeam, teamRole: "owner" as const };
		});
	} catch (error) {
		if (error instanceof AppError) throw error;
		if (isTeamSlugConflict(error)) {
			throw new AppError("TEAM_SLUG_TAKEN", "Team slug is unavailable", 409);
		}
		throw error;
	}
}

export async function listTeamMembers(db: Database, teamId: string) {
	return db
		.select({
			id: user.id,
			name: user.name,
			email: user.email,
			image: user.image,
			username: user.username,
			teamRole: teamMember.teamRole,
			invitedBy: teamMember.invitedBy,
			joinedAt: teamMember.joinedAt,
		})
		.from(teamMember)
		.innerJoin(user, eq(user.id, teamMember.userId))
		.where(eq(teamMember.teamId, teamId));
}
