import { relations } from "drizzle-orm";
import { team, teamMember } from "./team.js";
import { invites } from "./invites.js";
import { project, projectMember } from "./project.js";
import { issues, issueStatusHistory } from "./issues.js";
import { comments } from "./comments.js";
import { testCases } from "./test-cases.js";
import { tags, issueTags } from "./tags.js";
import { importJobs } from "./imports.js";

export const teamRelations = relations(team, ({ many }) => ({
	members: many(teamMember),
	projects: many(project),
	invites: many(invites),
}));

export const teamMemberRelations = relations(teamMember, ({ one }) => ({
	team: one(team, {
		fields: [teamMember.teamId],
		references: [team.id],
	}),
}));

export const invitesRelations = relations(invites, ({ one }) => ({
	team: one(team, {
		fields: [invites.teamId],
		references: [team.id],
	}),
}));

export const projectRelations = relations(project, ({ one, many }) => ({
	team: one(team, {
		fields: [project.teamId],
		references: [team.id],
	}),
	members: many(projectMember),
	issues: many(issues),
	testCases: many(testCases),
	tags: many(tags),
	importJobs: many(importJobs),
}));

export const projectMemberRelations = relations(projectMember, ({ one }) => ({
	project: one(project, {
		fields: [projectMember.projectId],
		references: [project.id],
	}),
}));

export const issuesRelations = relations(issues, ({ one, many }) => ({
	project: one(project, {
		fields: [issues.projectId],
		references: [project.id],
	}),
	testCase: one(testCases, {
		fields: [issues.testCaseId],
		references: [testCases.id],
	}),
	importJob: one(importJobs, {
		fields: [issues.importJobId],
		references: [importJobs.id],
	}),
	statusHistory: many(issueStatusHistory),
	comments: many(comments),
	issueTags: many(issueTags),
}));

export const issueStatusHistoryRelations = relations(
	issueStatusHistory,
	({ one }) => ({
		issue: one(issues, {
			fields: [issueStatusHistory.issueId],
			references: [issues.id],
		}),
	}),
);

export const commentsRelations = relations(comments, ({ one }) => ({
	issue: one(issues, {
		fields: [comments.issueId],
		references: [issues.id],
	}),
}));

export const testCasesRelations = relations(testCases, ({ one, many }) => ({
	project: one(project, {
		fields: [testCases.projectId],
		references: [project.id],
	}),
	issues: many(issues),
}));

export const tagsRelations = relations(tags, ({ one, many }) => ({
	project: one(project, {
		fields: [tags.projectId],
		references: [project.id],
	}),
	issueTags: many(issueTags),
}));

export const issueTagsRelations = relations(issueTags, ({ one }) => ({
	issue: one(issues, {
		fields: [issueTags.issueId],
		references: [issues.id],
	}),
	tag: one(tags, {
		fields: [issueTags.tagId],
		references: [tags.id],
	}),
}));

export const importJobsRelations = relations(importJobs, ({ one, many }) => ({
	project: one(project, {
		fields: [importJobs.projectId],
		references: [project.id],
	}),
	issues: many(issues),
}));