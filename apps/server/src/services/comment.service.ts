import { and, asc, eq, isNull } from "drizzle-orm";
import type { Database } from "../db/client.js";
import { comments, issues, projectMember } from "../db/schema/index.js";
import { ForbiddenError, NotFoundError } from "../lib/errors.js";
import type { ProjectRole } from "../lib/auth.js";

async function verifyIssueAccess(db: Database, projectId: string, issueId: string, userId: string) {
	const [row] = await db
		.select({ issueId: issues.id, role: projectMember.role })
		.from(issues)
		.innerJoin(projectMember, eq(projectMember.projectId, issues.projectId))
		.where(
			and(
				eq(issues.id, issueId),
				eq(issues.projectId, projectId),
				eq(projectMember.userId, userId),
			),
		)
		.limit(1);
	if (!row) throw new NotFoundError("Issue");
	return row.role;
}

export async function listComments(db: Database, projectId: string, issueId: string, userId: string) {
	await verifyIssueAccess(db, projectId, issueId, userId);
	return db
		.select()
		.from(comments)
		.where(and(eq(comments.issueId, issueId), isNull(comments.deletedAt)))
		.orderBy(asc(comments.createdAt));
}

export async function createComment(
	db: Database,
	projectId: string,
	issueId: string,
	authorId: string,
	body: string,
) {
	await verifyIssueAccess(db, projectId, issueId, authorId);
	const [comment] = await db.insert(comments).values({ issueId, authorId, body }).returning();
	if (!comment) throw new Error("Comment creation returned no row");
	return comment;
}

export async function updateComment(
	db: Database,
	projectId: string,
	commentId: string,
	userId: string,
	body: string,
) {
	const role = await verifyCommentAccess(db, projectId, commentId, userId);
	const [existing] = await db
		.select({ authorId: comments.authorId })
		.from(comments)
		.where(and(eq(comments.id, commentId), isNull(comments.deletedAt)))
		.limit(1);
	if (!existing) throw new NotFoundError("Comment");
	if (existing.authorId !== userId && role !== "admin") throw new ForbiddenError();

	const [comment] = await db
		.update(comments)
		.set({ body, updatedAt: new Date() })
		.where(and(eq(comments.id, commentId), isNull(comments.deletedAt)))
		.returning();
	if (!comment) throw new NotFoundError("Comment");
	return comment;
}

export async function deleteComment(db: Database, projectId: string, commentId: string, userId: string) {
	const role = await verifyCommentAccess(db, projectId, commentId, userId);
	const [comment] = await db
		.select({ authorId: comments.authorId })
		.from(comments)
		.where(and(eq(comments.id, commentId), isNull(comments.deletedAt)))
		.limit(1);
	if (!comment) throw new NotFoundError("Comment");
	if (comment.authorId !== userId && role !== "admin") throw new ForbiddenError();
	await db.update(comments).set({ deletedAt: new Date(), updatedAt: new Date() }).where(eq(comments.id, commentId));
}

async function verifyCommentAccess(db: Database, projectId: string, commentId: string, userId: string): Promise<ProjectRole> {
	const [row] = await db
		.select({ role: projectMember.role })
		.from(comments)
		.innerJoin(issues, eq(issues.id, comments.issueId))
		.innerJoin(projectMember, eq(projectMember.projectId, issues.projectId))
		.where(and(eq(comments.id, commentId), eq(issues.projectId, projectId), eq(projectMember.userId, userId)))
		.limit(1);
	if (!row) throw new NotFoundError("Comment");
	return row.role;
}
