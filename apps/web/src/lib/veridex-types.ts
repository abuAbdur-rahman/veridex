export const ISSUE_STATUSES = ["backlog", "in_progress", "in_qa", "verified", "rejected"] as const;

export type IssueStatus = (typeof ISSUE_STATUSES)[number];

export const SEVERITIES = ["low", "medium", "high", "critical"] as const;

export type Severity = (typeof SEVERITIES)[number];

export const PROJECT_ROLES = ["dev", "qa", "tester", "admin"] as const;

export type ProjectRole = (typeof PROJECT_ROLES)[number];

export const TEAM_ROLES = ["owner", "admin", "member"] as const;

export type TeamRole = (typeof TEAM_ROLES)[number];

export interface IssueAssignee {
	id?: string;
	name: string;
	initials: string;
	gradient: string;
	avatarUrl?: string;
}

export interface Issue {
	id: string;
	projectId: string;
	ticketRef: string;
	title: string;
	summary?: string;
	status: IssueStatus;
	severity: Severity;
	environment?: string;
	stepsToReproduce?: string[];
	description?: string;
	imageUrl?: string;
	testCaseRef?: string;
	developerAssignees: IssueAssignee[];
	qaAssignees: IssueAssignee[];
	reporter?: IssueAssignee;
	createdAt: string;
	updatedAt: string;
	tags?: string[];
}

export interface IssueHistoryEntry {
	id: string;
	issueId: string;
	projectId?: string;
	fromStatus: IssueStatus | null;
	toStatus: IssueStatus;
	by: string;
	at: string;
	note?: string;
	source?: "web" | "mcp" | "import";
}

export interface IssueComment {
	id: string;
	issueId: string;
	projectId: string;
	author: IssueAssignee;
	body: string;
	at: string;
}

export interface Project {
	id: string;
	teamId: string;
	name: string;
	role: ProjectRole;
	openIssueCount: number;
}

export interface Team {
	id: string;
	name: string;
}

export interface TeamMember {
	id: string;
	teamId: string;
	name: string;
	email?: string;
	role: TeamRole;
}

export interface ProjectMember {
	id: string;
	projectId: string;
	name: string;
	initials: string;
	role: ProjectRole;
	gradient: string;
}

export interface PendingInvite {
	id: string;
	teamId: string;
	email: string;
	role: TeamRole;
	expiresInDays: number;
}

export interface ImportErrorRow {
	row: number;
	message: string;
}

export interface ImportColumnMapping {
	spreadsheetColumn: string;
	targetField: string;
}

export interface RowColorMapping {
	color: string;
	hex: string;
	rows: number;
	targetStatus: IssueStatus;
}

export interface McpToken {
	id: string;
	name: string;
	createdAt: string;
	lastUsed?: string;
	revokedAt?: string;
}

export interface McpProjectAccess {
	project: string;
	role: ProjectRole;
	toolsAvailable: string;
}

export interface McpTool {
	name: string;
	minRole: ProjectRole | "tester+";
	kind: "read" | "write";
}

export interface McpActivity {
	id: string;
	tokenId?: string;
	projectId?: string;
	action: string;
	at: string;
}

export interface UserProfile {
	id: string;
	name: string;
	username: string;
	initials: string;
	gradient: string;
	email: string;
}

export interface UserSettings {
	theme: "light" | "dark" | "system";
	defaultRole: Exclude<ProjectRole, "admin">;
	compactIssues: boolean;
	emailUpdates: boolean;
}

export interface ImportRecord {
	id: string;
	projectId: string;
	fileName: string;
	importedCount: number;
	createdAt: string;
}

export interface DemoImportOptions {
	fileName: string;
	targetStatuses: IssueStatus[];
}

export type RoleView = "dev" | "qa" | "tester" | "all";

export const ROLE_VIEWS: readonly RoleView[] = ["dev", "qa", "tester", "all"];

export function isRoleView(value: unknown): value is RoleView {
	return typeof value === "string" && (ROLE_VIEWS as readonly string[]).includes(value);
}

const STATUS_ORDER: Record<IssueStatus, number> = {
	backlog: 0,
	in_progress: 1,
	in_qa: 2,
	verified: 3,
	rejected: 4,
};

/** Mirrors the server rule: backward transitions need an audit note; moving to
 * "rejected" is always treated as forward by the server. */
export function requiresAuditNote(fromStatus: IssueStatus, toStatus: IssueStatus): boolean {
	if (toStatus === "rejected") return false;
	return STATUS_ORDER[fromStatus] >= STATUS_ORDER[toStatus];
}
