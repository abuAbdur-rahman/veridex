import type { ServerIssue, ServerIssueHistory, ServerMemberRef } from "@/api/issues";
import type { ServerProject, ServerProjectMember } from "@/api/projects";
import type { Issue, IssueAssignee, IssueHistoryEntry } from "@/lib/veridex-types";

function assignee(ref: ServerMemberRef): IssueAssignee {
	const initials = ref.name
		.split(/\s+/)
		.slice(0, 2)
		.map((part) => part[0]?.toUpperCase() ?? "")
		.join("")
		.slice(0, 2);
	return {
		id: ref.id,
		name: ref.name,
		initials,
		gradient: "linear-gradient(135deg, #5FC9C9, #7FA0E0)",
		avatarUrl: ref.image ?? undefined,
	};
}
function environment(value: ServerIssue["environment"]) {
	if (!value) return undefined;
	return (
		Object.values(value)
			.filter((part): part is string => Boolean(part))
			.join(" / ") || undefined
	);
}
export function mapServerIssue(value: ServerIssue): Issue {
	return {
		id: value.id,
		projectId: value.projectId,
		ticketRef: value.ticketRef,
		title: value.title,
		status: value.status,
		severity: value.severity,
		description: value.description ?? undefined,
		imageUrl: value.imageUrl ?? undefined,
		environment: environment(value.environment),
		stepsToReproduce: value.stepsToReproduce?.split("\n").filter(Boolean),
		reporter: value.reporter ? assignee(value.reporter) : undefined,
		developerAssignees: (value.developerAssignees ?? []).map(assignee),
		qaAssignees: (value.qaAssignees ?? []).map(assignee),
		createdAt: value.createdAt ?? new Date(0).toISOString(),
		updatedAt: value.updatedAt ?? new Date(0).toISOString(),
	};
}
export function mapServerHistory(
	value: ServerIssueHistory,
	members: ServerProjectMember[] = [],
): IssueHistoryEntry {
	return {
		id: value.id,
		issueId: value.issueId,
		fromStatus: value.fromStatus,
		toStatus: value.toStatus,
		by: members.find((member) => member.id === value.changedBy)?.name ?? "Unknown member",
		at: value.changedAt ?? new Date(0).toISOString(),
		note: value.note ?? undefined,
		source: value.source,
	};
}
export function projectRole(project: ServerProject | undefined) {
	return project?.projectRole === "admin" ? "all" : (project?.projectRole ?? "dev");
}
