import { and, desc, eq, sql } from "drizzle-orm";
import type { Database } from "../db/client.js";
import {
	issueStatusHistory,
	issues,
	project,
	projectMember,
} from "../db/schema/index.js";
import { AppError, NotFoundError } from "../lib/errors.js";

export type IssueStatus =
	| "backlog"
	| "in_progress"
	| "in_qa"
	| "verified";
export type IssueSeverity = "low" | "medium" | "high" | "critical";
export type ChangeSource = "web" | "mcp" | "import";

export interface CreateIssueInput {
	title: string;
	description?: string;
	severity?: IssueSeverity;
	environment?: {
		browser?: string;
		os?: string;
		device?: string;
		version?: string;
		page?: string;
	};
	stepsToReproduce?: string;
	expectedResult?: string;
	actualResult?: string;
	imageUrl?: string;
	assigneeId?: string;
	qaAssigneeId?: string;
	testCaseId?: string;
}

export interface UpdateIssueInput {
	title?: string;
	description?: string | null;
	severity?: IssueSeverity;
	environment?: {
		browser?: string;
		os?: string;
		device?: string;
		version?: string;
		page?: string;
	} | null;
	stepsToReproduce?: string;
	expectedResult?: string;
	actualResult?: string;
	imageUrl?: string | null;
	assigneeId?: string | null;
	qaAssigneeId?: string | null;
	testCaseId?: string | null;
}

export interface ListIssuesFilters {
	status?: IssueStatus;
	assigneeId?: string;
	qaAssigneeId?: string;
	severity?: IssueSeverity;
	search?: string;
	limit?: number;
	offset?: number;
}

function isTicketRefConflict(error: unknown) {
	return (
		typeof error === "object" &&
		error !== null &&
		"code" in error &&
		error.code === "23505" &&
		("constraint_name" in error || "constraint" in error) &&
		("constraint_name" in error
			? error.constraint_name
			: error.constraint) === "issues_project_ticket_ref_unique"
	);
}

async function getProjectSlug(db: Database, projectId: string): Promise<string> {
	const rows = await db
		.select({ slug: project.slug })
		.from(project)
		.where(eq(project.id, projectId))
		.limit(1);
	if (rows.length === 0) throw new NotFoundError("Project");
	return rows[0].slug;
}

async function verifyProjectMembership(
	db: Database,
	projectId: string,
	userId: string,
): Promise<void> {
	const rows = await db
		.select({ userId: projectMember.userId })
		.from(projectMember)
		.where(
			and(
				eq(projectMember.projectId, projectId),
				eq(projectMember.userId, userId),
			),
		)
		.limit(1);
	if (rows.length === 0) {
		throw new AppError(
			"FORBIDDEN",
			"Not a member of this project",
			403,
		);
	}
}

export async function createIssue(
	db: Database,
	projectId: string,
	reporterId: string,
	input: CreateIssueInput,
): Promise<typeof issues.$inferSelect> {
	await verifyProjectMembership(db, projectId, reporterId);

	return db.transaction(async (tx) => {
		const [projectRow] = await tx
			.update(project)
			.set({ nextTicketNumber: sql`${project.nextTicketNumber} + 1` })
			.where(eq(project.id, projectId))
			.returning({
				nextTicketNumber: project.nextTicketNumber,
				slug: project.slug,
			});

		if (!projectRow) throw new NotFoundError("Project");

		const ticketRef = `${projectRow.slug
			.slice(0, 3)
			.toUpperCase()}-${String(projectRow.nextTicketNumber).padStart(3, "0")}`;

		try {
			const [issue] = await tx
				.insert(issues)
				.values({
					projectId,
					reporterId,
					ticketRef,
					title: input.title,
					description: input.description,
					severity: input.severity ?? "medium",
					status: "backlog",
					environment: input.environment ?? null,
					stepsToReproduce: input.stepsToReproduce ?? null,
					expectedResult: input.expectedResult ?? null,
					actualResult: input.actualResult ?? null,
					imageUrl: input.imageUrl ?? null,
					assigneeId: input.assigneeId ?? null,
					qaAssigneeId: input.qaAssigneeId ?? null,
					testCaseId: input.testCaseId ?? null,
				})
				.returning();

			await tx.insert(issueStatusHistory).values({
				issueId: issue.id,
				changedBy: reporterId,
				fromStatus: null,
				toStatus: "backlog",
				source: "web",
			});

			return issue;
		} catch (error) {
			if (isTicketRefConflict(error)) {
				throw new AppError(
					"TICKET_REF_CONFLICT",
					"Ticket reference collision, please retry",
					409,
				);
			}
			throw error;
		}
	});
}

export async function getIssue(
	db: Database,
	projectId: string,
	issueId: string,
	userId: string,
): Promise<typeof issues.$inferSelect | null> {
	await verifyProjectMembership(db, projectId, userId);

	const rows = await db
		.select()
		.from(issues)
		.where(and(eq(issues.id, issueId), eq(issues.projectId, projectId)))
		.limit(1);
	return rows[0] ?? null;
}

export async function listIssues(
	db: Database,
	projectId: string,
	userId: string,
	filters: ListIssuesFilters = {},
): Promise<typeof issues.$inferSelect[]> {
	await verifyProjectMembership(db, projectId, userId);

	const conditions = [eq(issues.projectId, projectId)];

	if (filters.status) {
		conditions.push(eq(issues.status, filters.status));
	}
	if (filters.assigneeId) {
		conditions.push(eq(issues.assigneeId, filters.assigneeId));
	}
	if (filters.qaAssigneeId) {
		conditions.push(eq(issues.qaAssigneeId, filters.qaAssigneeId));
	}
	if (filters.severity) {
		conditions.push(eq(issues.severity, filters.severity));
	}
	if (filters.search) {
		conditions.push(
			sql`(${issues.title} ILIKE ${`%${filters.search}%`} OR ${issues.ticketRef} ILIKE ${`%${filters.search}%`})`,
		);
	}

	const limit = filters.limit ?? 50;
	const offset = filters.offset ?? 0;

	return db
		.select()
		.from(issues)
		.where(and(...conditions))
		.orderBy(desc(issues.createdAt))
		.limit(limit)
		.offset(offset);
}

export async function updateIssue(
	db: Database,
	projectId: string,
	issueId: string,
	userId: string,
	input: UpdateIssueInput,
): Promise<typeof issues.$inferSelect> {
	await verifyProjectMembership(db, projectId, userId);

	const [issue] = await db
		.update(issues)
		.set({
			...input,
			updatedAt: new Date(),
		})
		.where(and(eq(issues.id, issueId), eq(issues.projectId, projectId)))
		.returning();

	if (!issue) throw new NotFoundError("Issue");
	return issue;
}

export async function updateStatus(
	db: Database,
	projectId: string,
	issueId: string,
	changedBy: string,
	toStatus: IssueStatus,
	source: ChangeSource,
	note?: string,
): Promise<typeof issues.$inferSelect> {
	await verifyProjectMembership(db, projectId, changedBy);

	const current = await db
		.select({ status: issues.status })
		.from(issues)
		.where(and(eq(issues.id, issueId), eq(issues.projectId, projectId)))
		.limit(1);

	if (current.length === 0) throw new NotFoundError("Issue");

	const fromStatus = current[0].status;
	if (fromStatus === toStatus) {
		throw new AppError(
			"STATUS_UNCHANGED",
			"Issue is already in that status",
			409,
		);
	}

	const validTransitions: Record<IssueStatus, IssueStatus[]> = {
		backlog: ["in_progress"],
		in_progress: ["backlog", "in_qa"],
		in_qa: ["in_progress", "verified"],
		verified: ["in_qa"],
	};

	if (!validTransitions[fromStatus]?.includes(toStatus)) {
		throw new AppError(
			"INVALID_STATUS_TRANSITION",
			`Cannot transition from ${fromStatus} to ${toStatus}`,
			409,
		);
	}

	if (toStatus === "backlog" || toStatus === "in_progress") {
		if (!note?.trim()) {
			throw new AppError(
				"NOTE_REQUIRED",
				"An audit note is required for backward transitions",
				409,
			);
		}
	}

	return db.transaction(async (tx) => {
		const [updated] = await tx
			.update(issues)
			.set({
				status: toStatus,
				updatedAt: new Date(),
				closedAt: toStatus === "verified" ? new Date() : null,
			})
			.where(
				and(eq(issues.id, issueId), eq(issues.projectId, projectId)),
			)
			.returning();

		await tx.insert(issueStatusHistory).values({
			issueId,
			changedBy,
			fromStatus,
			toStatus,
			note: note?.trim() ?? null,
			source,
		});

		return updated;
	});
}

export async function assignIssue(
	db: Database,
	projectId: string,
	issueId: string,
	changedBy: string,
	assigneeId: string | null,
	qaAssigneeId: string | null,
	source: ChangeSource,
): Promise<typeof issues.$inferSelect> {
	await verifyProjectMembership(db, projectId, changedBy);

	if (assigneeId !== null) {
		const member = await db
			.select({ userId: projectMember.userId })
			.from(projectMember)
			.where(
				and(
					eq(projectMember.projectId, projectId),
					eq(projectMember.userId, assigneeId),
				),
			)
			.limit(1);
		if (member.length === 0) {
			throw new AppError(
				"NOT_PROJECT_MEMBER",
				"Assignee must be a project member",
				409,
			);
		}
	}

	if (qaAssigneeId !== null) {
		const member = await db
			.select({ userId: projectMember.userId })
			.from(projectMember)
			.where(
				and(
					eq(projectMember.projectId, projectId),
					eq(projectMember.userId, qaAssigneeId),
				),
			)
			.limit(1);
		if (member.length === 0) {
			throw new AppError(
				"NOT_PROJECT_MEMBER",
				"QA assignee must be a project member",
				409,
			);
		}
	}

	const [updated] = await db
		.update(issues)
		.set({
			assigneeId,
			qaAssigneeId,
			updatedAt: new Date(),
		})
		.where(and(eq(issues.id, issueId), eq(issues.projectId, projectId)))
		.returning();

	if (!updated) throw new NotFoundError("Issue");
	return updated;
}

export async function getIssueStatusHistory(
	db: Database,
	projectId: string,
	issueId: string,
	userId: string,
): Promise<typeof issueStatusHistory.$inferSelect[]> {
	await verifyProjectMembership(db, projectId, userId);

	return db
		.select()
		.from(issueStatusHistory)
		.where(eq(issueStatusHistory.issueId, issueId))
		.orderBy(issueStatusHistory.changedAt);
}

export async function deleteIssue(
	db: Database,
	projectId: string,
	issueId: string,
	userId: string,
): Promise<void> {
	await verifyProjectMembership(db, projectId, userId);

	const result = await db
		.delete(issues)
		.where(and(eq(issues.id, issueId), eq(issues.projectId, projectId)));

	if (result.count === 0) throw new NotFoundError("Issue");
}
