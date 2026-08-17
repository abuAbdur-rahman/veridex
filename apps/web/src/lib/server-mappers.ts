import type { ServerIssue, ServerIssueHistory } from "@/api/issues";
import type { ServerProject, ServerProjectMember } from "@/api/projects";
import type { MeUser } from "@/api/session";
import type { Issue, IssueAssignee, IssueHistoryEntry } from "@/lib/veridex-types";

function person(
	id: string | null | undefined,
	fallback: MeUser,
	members: ServerProjectMember[],
): IssueAssignee | undefined {
	if (!id) return undefined;
	const member = members.find((item) => item.id === id);
	const name = member?.name ?? (id === fallback.id ? fallback.name : "Unknown member");
	const initials = name
		.split(/\s+/)
		.slice(0, 2)
		.map((part) => part[0]?.toUpperCase() ?? "")
		.join("")
		.slice(0, 2);
	return {
		id,
		name,
		initials,
		gradient: "linear-gradient(135deg, #5FC9C9, #7FA0E0)",
		avatarUrl: member?.image ?? undefined,
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
export function mapServerIssue(
	value: ServerIssue,
	user: MeUser,
	members: ServerProjectMember[] = [],
): Issue {
	return {
		id: value.id,
		projectId: value.projectId,
		ticketRef: value.ticketRef,
		title: value.title,
		status: value.status,
		severity: value.severity,
		description: value.description ?? undefined,
		environment: environment(value.environment),
		stepsToReproduce: value.stepsToReproduce?.split("\n").filter(Boolean),
		reporter: person(value.reporterId, user, members)!,
		assignee: person(value.assigneeId, user, members),
		qaOwner: person(value.qaAssigneeId, user, members),
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
