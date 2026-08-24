import { and, desc, eq, inArray, sql } from "drizzle-orm";
import type { Database } from "../db/client.js";
import {
	issueStatusHistory,
	issueAssignments,
	issues,
	project,
	projectMember,
	user,
} from "../db/schema/index.js";
import { AppError, NotFoundError } from "../lib/errors.js";

export type IssueStatus =
	| "backlog"
	| "in_progress"
	| "in_qa"
	| "verified"
	| "rejected";
export type IssueSeverity = "low" | "medium" | "high" | "critical";
export type ChangeSource = "web" | "mcp" | "import";
type DbTransaction = Parameters<Parameters<Database["transaction"]>[0]>[0];

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
	developerAssigneeIds?: string[];
	qaAssigneeIds?: string[];
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
	developerAssigneeIds?: string[];
	qaAssigneeIds?: string[];
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

export type IssueWithAssignments = typeof issues.$inferSelect & {
	developerAssigneeIds: string[];
	qaAssigneeIds: string[];
};

export interface MemberRef {
	id: string;
	name: string;
	image: string | null;
}

export type IssueWithProjection = IssueWithAssignments & {
	reporter: MemberRef | null;
	developerAssignees: MemberRef[];
	qaAssignees: MemberRef[];
};

export async function getProjectMemberDirectory(
	db: Database,
	projectId: string,
): Promise<Map<string, MemberRef>> {
	const rows = await db
		.select({ id: projectMember.userId, name: user.name, image: user.image })
		.from(projectMember)
		.innerJoin(user, eq(user.id, projectMember.userId))
		.where(eq(projectMember.projectId, projectId));
	return new Map(rows.map((row) => [row.id, row]));
}

export function withMemberProjection(
	membersById: Map<string, MemberRef>,
	issue: IssueWithAssignments,
): IssueWithProjection {
	const ref = (id: string): MemberRef =>
		membersById.get(id) ?? { id, name: "Unknown member", image: null };
	return {
		...issue,
		reporter: issue.reporterId ? ref(issue.reporterId) : null,
		developerAssignees: issue.developerAssigneeIds.map(ref),
		qaAssignees: issue.qaAssigneeIds.map(ref),
	};
}

function isUniqueConflict(error: unknown, constraintName: string) {
	return (
		typeof error === "object" &&
		error !== null &&
		"code" in error &&
		error.code === "23505" &&
		("constraint_name" in error || "constraint" in error) &&
		("constraint_name" in error
				? error.constraint_name
				: error.constraint) === constraintName
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

function distinctIds(ids: string[]) {
	return [...new Set(ids)];
}

async function verifyAssignmentRoles(
	db: Database,
	projectId: string,
	developerAssigneeIds: string[],
	qaAssigneeIds: string[],
): Promise<void> {
	const assigneeIds = distinctIds([...developerAssigneeIds, ...qaAssigneeIds]);
	if (assigneeIds.length === 0) return;

	const members = await db
		.select({ userId: projectMember.userId, role: projectMember.role })
		.from(projectMember)
		.where(
			and(
				eq(projectMember.projectId, projectId),
				inArray(projectMember.userId, assigneeIds),
			),
		);
	const rolesByUserId = new Map(members.map((member) => [member.userId, member.role]));

	for (const userId of developerAssigneeIds) {
		if (rolesByUserId.get(userId) !== "dev") {
			throw new AppError("NOT_PROJECT_MEMBER", "Assignee must be a project developer", 409);
		}
	}
	for (const userId of qaAssigneeIds) {
		if (rolesByUserId.get(userId) !== "qa") {
			throw new AppError("NOT_PROJECT_MEMBER", "QA assignee must be a project QA member", 409);
		}
	}
}

async function replaceAssignments(
	tx: DbTransaction,
	issueId: string,
	developerAssigneeIds: string[],
	qaAssigneeIds: string[],
): Promise<void> {
	await tx.delete(issueAssignments).where(eq(issueAssignments.issueId, issueId));
	const assignments = [
		...developerAssigneeIds.map((userId) => ({ issueId, userId, role: "dev" as const })),
		...qaAssigneeIds.map((userId) => ({ issueId, userId, role: "qa" as const })),
	];
	if (assignments.length > 0) await tx.insert(issueAssignments).values(assignments);
}

async function getAssignmentIds(
	db: Database,
	issueIds: string[],
): Promise<Map<string, { developerAssigneeIds: string[]; qaAssigneeIds: string[] }>> {
	const result = new Map<string, { developerAssigneeIds: string[]; qaAssigneeIds: string[] }>();
	if (issueIds.length === 0) return result;

	const rows = await db
		.select({ issueId: issueAssignments.issueId, userId: issueAssignments.userId, role: issueAssignments.role })
		.from(issueAssignments)
		.where(inArray(issueAssignments.issueId, issueIds));

	for (const row of rows) {
		let assignments = result.get(row.issueId);
		if (!assignments) {
			assignments = { developerAssigneeIds: [], qaAssigneeIds: [] };
			result.set(row.issueId, assignments);
		}
		if (row.role === "dev") assignments.developerAssigneeIds.push(row.userId);
		if (row.role === "qa") assignments.qaAssigneeIds.push(row.userId);
	}
	return result;
}

function withAssignments(
	issue: typeof issues.$inferSelect,
	assignmentMap: Map<string, { developerAssigneeIds: string[]; qaAssigneeIds: string[] }>,
): IssueWithAssignments {
	const assignments = assignmentMap.get(issue.id) ?? {
		developerAssigneeIds: issue.assigneeId ? [issue.assigneeId] : [],
		qaAssigneeIds: issue.qaAssigneeId ? [issue.qaAssigneeId] : [],
	};
	return { ...issue, ...assignments };
}

export async function createIssue(
	db: Database,
	projectId: string,
	reporterId: string,
	input: CreateIssueInput,
): Promise<IssueWithAssignments> {
	await verifyProjectMembership(db, projectId, reporterId);
	let developerAssigneeIds = distinctIds(
		input.developerAssigneeIds ?? (input.assigneeId ? [input.assigneeId] : []),
	);
	const qaAssigneeIds = distinctIds(
		input.qaAssigneeIds ?? (input.qaAssigneeId ? [input.qaAssigneeId] : []),
	);
	if (developerAssigneeIds.length === 0 && qaAssigneeIds.length === 0) {
		const members = await db
			.select({ userId: projectMember.userId, role: projectMember.role })
			.from(projectMember)
			.where(eq(projectMember.projectId, projectId))
			.limit(2);
		if (members.length === 1 && members[0].role === "dev") {
			developerAssigneeIds = [members[0].userId];
		}
	} else {
		await verifyAssignmentRoles(db, projectId, developerAssigneeIds, qaAssigneeIds);
	}

	return db.transaction(async (tx) => {
		const duplicate = await tx
			.select({ id: issues.id })
			.from(issues)
			.where(
				and(
					eq(issues.projectId, projectId),
					sql`lower(${issues.title}) = lower(${input.title.trim()})`,
				),
			)
			.limit(1);
		if (duplicate.length > 0) {
			throw new AppError("DUPLICATE_ISSUE", "Duplicate issue", 409);
		}

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
					title: input.title.trim(),
					description: input.description,
					severity: input.severity ?? "medium",
					status: "backlog",
					environment: input.environment ?? null,
					stepsToReproduce: input.stepsToReproduce ?? null,
					expectedResult: input.expectedResult ?? null,
					actualResult: input.actualResult ?? null,
					imageUrl: input.imageUrl ?? null,
					assigneeId: developerAssigneeIds[0] ?? null,
					qaAssigneeId: qaAssigneeIds[0] ?? null,
					testCaseId: input.testCaseId ?? null,
				})
				.returning();

			await replaceAssignments(tx, issue.id, developerAssigneeIds, qaAssigneeIds);

			await tx.insert(issueStatusHistory).values({
				issueId: issue.id,
				changedBy: reporterId,
				fromStatus: null,
				toStatus: "backlog",
				source: "web",
			});

			return { ...issue, developerAssigneeIds, qaAssigneeIds };
		} catch (error) {
			if (isUniqueConflict(error, "issues_project_ticket_ref_unique")) {
				throw new AppError(
					"TICKET_REF_CONFLICT",
					"Ticket reference collision, please retry",
					409,
				);
			}
			if (isUniqueConflict(error, "issues_project_title_lower_unique")) {
				throw new AppError("DUPLICATE_ISSUE", "Duplicate issue", 409);
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
): Promise<IssueWithAssignments | null> {
	await verifyProjectMembership(db, projectId, userId);

	const rows = await db
		.select()
		.from(issues)
		.where(and(eq(issues.id, issueId), eq(issues.projectId, projectId)))
		.limit(1);
	if (!rows[0]) return null;
	return withAssignments(rows[0], await getAssignmentIds(db, [rows[0].id]));
}

export async function listIssues(
	db: Database,
	projectId: string,
	userId: string,
	filters: ListIssuesFilters = {},
): Promise<IssueWithAssignments[]> {
	await verifyProjectMembership(db, projectId, userId);

	const conditions = [eq(issues.projectId, projectId)];

	if (filters.status) {
		conditions.push(eq(issues.status, filters.status));
	}
	if (filters.assigneeId) {
		conditions.push(
			sql`(${issues.assigneeId} = ${filters.assigneeId} OR EXISTS (
				SELECT 1 FROM ${issueAssignments}
				WHERE ${issueAssignments.issueId} = ${issues.id}
					AND ${issueAssignments.userId} = ${filters.assigneeId}
					AND ${issueAssignments.role} = 'dev'
			))`,
		);
	}
	if (filters.qaAssigneeId) {
		conditions.push(
			sql`(${issues.qaAssigneeId} = ${filters.qaAssigneeId} OR EXISTS (
				SELECT 1 FROM ${issueAssignments}
				WHERE ${issueAssignments.issueId} = ${issues.id}
					AND ${issueAssignments.userId} = ${filters.qaAssigneeId}
					AND ${issueAssignments.role} = 'qa'
			))`,
		);
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

	const rows = await db
		.select()
		.from(issues)
		.where(and(...conditions))
		.orderBy(desc(issues.createdAt))
		.limit(limit)
		.offset(offset);
	const assignmentMap = await getAssignmentIds(db, rows.map((issue) => issue.id));
	return rows.map((issue) => withAssignments(issue, assignmentMap));
}

export async function updateIssue(
	db: Database,
	projectId: string,
	issueId: string,
	userId: string,
	input: UpdateIssueInput,
): Promise<IssueWithAssignments> {
	await verifyProjectMembership(db, projectId, userId);
	const developerAssigneeIds = input.developerAssigneeIds;
	const qaAssigneeIds = input.qaAssigneeIds;
	const issueAssignmentsById = await getAssignmentIds(db, [issueId]);
	const currentAssignments = issueAssignmentsById.get(issueId) ?? {
		developerAssigneeIds: [],
		qaAssigneeIds: [],
	};
	const nextDeveloperAssigneeIds = distinctIds(
		developerAssigneeIds ??
			(input.assigneeId !== undefined
				? input.assigneeId ? [input.assigneeId] : []
				: currentAssignments.developerAssigneeIds),
	);
	const nextQaAssigneeIds = distinctIds(
		qaAssigneeIds ??
			(input.qaAssigneeId !== undefined
				? input.qaAssigneeId ? [input.qaAssigneeId] : []
				: currentAssignments.qaAssigneeIds),
	);
	const assignmentsChanged =
		developerAssigneeIds !== undefined ||
		qaAssigneeIds !== undefined ||
		input.assigneeId !== undefined ||
		input.qaAssigneeId !== undefined;
	if (assignmentsChanged) {
		await verifyAssignmentRoles(db, projectId, nextDeveloperAssigneeIds, nextQaAssigneeIds);
	}
	const issueFields: Omit<
		UpdateIssueInput,
		"developerAssigneeIds" | "qaAssigneeIds" | "assigneeId" | "qaAssigneeId"
	> = { ...input };
	delete (issueFields as Partial<UpdateIssueInput>).developerAssigneeIds;
	delete (issueFields as Partial<UpdateIssueInput>).qaAssigneeIds;
	delete (issueFields as Partial<UpdateIssueInput>).assigneeId;
	delete (issueFields as Partial<UpdateIssueInput>).qaAssigneeId;

	try {
		return await db.transaction(async (tx) => {
			const [issue] = await tx
				.update(issues)
				.set({
					...issueFields,
					...(developerAssigneeIds !== undefined || input.assigneeId !== undefined
						? { assigneeId: nextDeveloperAssigneeIds[0] ?? null }
						: {}),
					...(qaAssigneeIds !== undefined || input.qaAssigneeId !== undefined
						? { qaAssigneeId: nextQaAssigneeIds[0] ?? null }
						: {}),
					updatedAt: new Date(),
				})
				.where(and(eq(issues.id, issueId), eq(issues.projectId, projectId)))
				.returning();

			if (!issue) throw new NotFoundError("Issue");
			if (assignmentsChanged) {
				await replaceAssignments(tx, issueId, nextDeveloperAssigneeIds, nextQaAssigneeIds);
			}
			return withAssignments(issue, new Map([[issue.id, {
				developerAssigneeIds: nextDeveloperAssigneeIds,
				qaAssigneeIds: nextQaAssigneeIds,
			}]]));
		});
	} catch (error) {
		if (isUniqueConflict(error, "issues_project_title_lower_unique")) {
			throw new AppError("DUPLICATE_ISSUE", "Duplicate issue", 409);
		}
		throw error;
	}
}

export type ProjectRole = "dev" | "qa" | "tester" | "admin";

export async function updateStatus(
	db: Database,
	projectId: string,
	issueId: string,
	changedBy: string,
	toStatus: IssueStatus,
	source: ChangeSource,
	note?: string,
	role?: ProjectRole,
): Promise<IssueWithAssignments> {
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
		in_qa: ["in_progress", "verified", "rejected"],
		verified: ["in_qa"],
		rejected: ["backlog"],
	};

	if (!validTransitions[fromStatus]?.includes(toStatus)) {
		throw new AppError(
			"INVALID_STATUS_TRANSITION",
			`Cannot transition from ${fromStatus} to ${toStatus}`,
			409,
		);
	}

	let effectiveStatus = toStatus;
	if (toStatus === "rejected" && role !== "dev") {
		effectiveStatus = "backlog";
	}

	if (effectiveStatus === "backlog" || effectiveStatus === "in_progress") {
		if (!note?.trim()) {
			throw new AppError(
				"NOTE_REQUIRED",
				"An audit note is required for backward transitions",
				409,
			);
		}
	}

	const result = await db.transaction(async (tx) => {
		const [updated] = await tx
			.update(issues)
			.set({
				status: effectiveStatus,
				...(effectiveStatus === "rejected"
					? { assigneeId: null, qaAssigneeId: null }
					: {}),
				updatedAt: new Date(),
				closedAt: effectiveStatus === "verified" ? new Date() : null,
			})
			.where(
				and(eq(issues.id, issueId), eq(issues.projectId, projectId)),
			)
			.returning();
		if (!updated) throw new NotFoundError("Issue");

		if (effectiveStatus === "rejected") {
			await tx.delete(issueAssignments).where(eq(issueAssignments.issueId, issueId));
			updated.assigneeId = null;
			updated.qaAssigneeId = null;
		}

		await tx.insert(issueStatusHistory).values({
			issueId,
			changedBy,
			fromStatus,
			toStatus: effectiveStatus,
			note: note?.trim() ?? null,
			source,
		});

		return updated;
	});
	const assignments = await getAssignmentIds(db, [issueId]);
	return {
		...result,
		...(assignments.get(issueId) ?? {
			developerAssigneeIds: [],
			qaAssigneeIds: [],
		}),
	};
}

export async function assignIssue(
	db: Database,
	projectId: string,
	issueId: string,
	changedBy: string,
	developerAssigneeIds: string[] | undefined,
	qaAssigneeIds: string[] | undefined,
	_source: ChangeSource,
): Promise<IssueWithAssignments> {
	await verifyProjectMembership(db, projectId, changedBy);
	const assignmentMap = await getAssignmentIds(db, [issueId]);
	const current = assignmentMap.get(issueId) ?? {
		developerAssigneeIds: [],
		qaAssigneeIds: [],
	};
	const developers = distinctIds(developerAssigneeIds ?? current.developerAssigneeIds);
	const qaAssignees = distinctIds(qaAssigneeIds ?? current.qaAssigneeIds);
	await verifyAssignmentRoles(db, projectId, developers, qaAssignees);

	return db.transaction(async (tx) => {
		const [updated] = await tx
			.update(issues)
			.set({
				assigneeId: developers[0] ?? null,
				qaAssigneeId: qaAssignees[0] ?? null,
				updatedAt: new Date(),
			})
			.where(and(eq(issues.id, issueId), eq(issues.projectId, projectId)))
			.returning();

		if (!updated) throw new NotFoundError("Issue");
		await replaceAssignments(tx, issueId, developers, qaAssignees);
		return { ...updated, developerAssigneeIds: developers, qaAssigneeIds: qaAssignees };
	});
}

export async function getIssueStatusHistory(
	db: Database,
	projectId: string,
	issueId: string,
	userId: string,
): Promise<typeof issueStatusHistory.$inferSelect[]> {
	await verifyProjectMembership(db, projectId, userId);
	const issueRows = await db
		.select({ id: issues.id })
		.from(issues)
		.where(and(eq(issues.id, issueId), eq(issues.projectId, projectId)))
		.limit(1);
	if (issueRows.length === 0) throw new NotFoundError("Issue");

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
