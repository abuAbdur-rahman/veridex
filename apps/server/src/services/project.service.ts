import { and, eq } from "drizzle-orm";
import type { Database } from "../db/client.js";
import {
	project,
	projectMember,
	teamMember,
	user,
} from "../db/schema/index.js";
import { AppError, NotFoundError } from "../lib/errors.js";

export type ProjectRole = "dev" | "qa" | "tester" | "admin";

function isProjectSlugConflict(error: unknown) {
	return (
		typeof error === "object" &&
		error !== null &&
		"code" in error &&
		error.code === "23505" &&
		("constraint_name" in error || "constraint" in error) &&
		("constraint_name" in error ? error.constraint_name : error.constraint) ===
			"project_team_slug_unique"
	);
}

export async function listProjects(
	db: Database,
	teamId: string,
	userId: string,
) {
	return db
		.select({
			id: project.id,
			name: project.name,
			slug: project.slug,
			description: project.description,
			projectRole: projectMember.role,
		})
		.from(projectMember)
		.innerJoin(project, eq(project.id, projectMember.projectId))
		.where(and(eq(projectMember.userId, userId), eq(project.teamId, teamId)));
}

export async function getProject(db: Database, projectId: string) {
	const rows = await db
		.select()
		.from(project)
		.where(eq(project.id, projectId))
		.limit(1);
	return rows[0] ?? null;
}

export async function updateProjectName(
	db: Database,
	projectId: string,
	name: string,
) {
	const ref = await getProjectRef(db, projectId);
	if (!ref) throw new NotFoundError("Project");

	const [updatedProject] = await db
		.update(project)
		.set({ name })
		.where(eq(project.id, projectId))
		.returning({ id: project.id, name: project.name });

	if (!updatedProject) throw new NotFoundError("Project");
	return updatedProject;
}

export async function deleteProject(db: Database, projectId: string) {
	const ref = await getProjectRef(db, projectId);
	if (!ref) throw new NotFoundError("Project");

	const [deletedProject] = await db
		.delete(project)
		.where(eq(project.id, projectId))
		.returning({ id: project.id });

	if (!deletedProject) throw new NotFoundError("Project");
}

export async function createProject(
	db: Database,
	teamId: string,
	userId: string,
	input: { name: string; slug: string; description?: string },
) {
	try {
		return await db.transaction(async (tx) => {
			const [createdProject] = await tx
				.insert(project)
				.values({
					teamId,
					name: input.name,
					slug: input.slug,
					description: input.description,
					createdBy: userId,
				})
				.returning({
					id: project.id,
					name: project.name,
					slug: project.slug,
					description: project.description,
					teamId: project.teamId,
				});

			if (!createdProject) {
				throw new AppError(
					"PROJECT_CREATE_FAILED",
					"Could not create project",
					500,
				);
			}

			await tx.insert(projectMember).values({
				projectId: createdProject.id,
				userId,
				role: "admin",
			});

			return { ...createdProject, projectRole: "admin" as const };
		});
	} catch (error) {
		if (error instanceof AppError) throw error;
		if (isProjectSlugConflict(error)) {
			throw new AppError(
				"PROJECT_SLUG_TAKEN",
				"Project slug is unavailable in this team",
				409,
			);
		}
		throw error;
	}
}

export async function listProjectMembers(db: Database, projectId: string) {
	return db
		.select({
			id: user.id,
			name: user.name,
			email: user.email,
			image: user.image,
			username: user.username,
			role: projectMember.role,
			addedAt: projectMember.addedAt,
		})
		.from(projectMember)
		.innerJoin(user, eq(user.id, projectMember.userId))
		.where(eq(projectMember.projectId, projectId));
}

async function getProjectRef(db: Database, projectId: string) {
	const rows = await db
		.select({ teamId: project.teamId, createdBy: project.createdBy })
		.from(project)
		.where(eq(project.id, projectId))
		.limit(1);
	return rows[0] ?? null;
}

export async function addProjectMember(
	db: Database,
	projectId: string,
	input: { userId: string; role: ProjectRole },
) {
	const ref = await getProjectRef(db, projectId);
	if (!ref) throw new NotFoundError("Project");

	const membership = await db
		.select({ userId: teamMember.userId })
		.from(teamMember)
		.where(
			and(
				eq(teamMember.teamId, ref.teamId),
				eq(teamMember.userId, input.userId),
			),
		)
		.limit(1);

	if (membership.length === 0) {
		throw new AppError(
			"USER_NOT_TEAM_MEMBER",
			"User is not a member of this project's team",
			409,
		);
	}

	const existing = await db
		.select({ userId: projectMember.userId })
		.from(projectMember)
		.where(
			and(
				eq(projectMember.projectId, projectId),
				eq(projectMember.userId, input.userId),
			),
		)
		.limit(1);

	if (existing.length > 0) {
		throw new AppError(
			"MEMBER_ALREADY_EXISTS",
			"User is already a member of this project",
			409,
		);
	}

	const [member] = await db
		.insert(projectMember)
		.values({
			projectId,
			userId: input.userId,
			role: input.role,
		})
		.returning({
			projectId: projectMember.projectId,
			userId: projectMember.userId,
			role: projectMember.role,
			addedAt: projectMember.addedAt,
		});

	return member;
}

export async function updateProjectMemberRole(
	db: Database,
	projectId: string,
	userId: string,
	role: ProjectRole,
) {
	const ref = await getProjectRef(db, projectId);
	if (!ref) throw new NotFoundError("Project");

	if (userId === ref.createdBy) {
		throw new AppError(
			"CREATOR_PROTECTED",
			"The project creator cannot be demoted",
			409,
		);
	}

	const [member] = await db
		.update(projectMember)
		.set({ role })
		.where(
			and(
				eq(projectMember.projectId, projectId),
				eq(projectMember.userId, userId),
			),
		)
		.returning({ userId: projectMember.userId });

	if (!member) throw new NotFoundError("Project member");
}

export async function removeProjectMember(
	db: Database,
	projectId: string,
	userId: string,
) {
	const ref = await getProjectRef(db, projectId);
	if (!ref) throw new NotFoundError("Project");

	if (userId === ref.createdBy) {
		throw new AppError(
			"CREATOR_PROTECTED",
			"The project creator cannot be removed",
			409,
		);
	}

	const [member] = await db
		.delete(projectMember)
		.where(
			and(
				eq(projectMember.projectId, projectId),
				eq(projectMember.userId, userId),
			),
		)
		.returning({ userId: projectMember.userId });

	if (!member) throw new NotFoundError("Project member");
}
