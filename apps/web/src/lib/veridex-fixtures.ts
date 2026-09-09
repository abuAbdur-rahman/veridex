import type {
	ImportColumnMapping,
	ImportErrorRow,
	Issue,
	IssueComment,
	IssueHistoryEntry,
	McpActivity,
	McpProjectAccess,
	McpToken,
	McpTool,
	PendingInvite,
	Project,
	ProjectMember,
	RowColorMapping,
	Team,
	TeamMember,
} from "@/lib/veridex-types";

export const currentUser = {
	id: "usr_sarah",
	name: "Sarah Chen",
	username: "sarahchen",
	initials: "SC",
	gradient: "linear-gradient(135deg, #7FA0E0, #B29DF0)",
	email: "sarah@acme.com",
};

export const avatars = {
	dev: {
		id: "usr_marcus",
		name: "Marcus Lee",
		initials: "ML",
		gradient: "linear-gradient(135deg, #5FC9C9, #7FA0E0)",
	},
	qa: {
		id: "usr_dana",
		name: "Dana Okafor",
		initials: "DO",
		gradient: "linear-gradient(135deg, #7FA0E0, #B29DF0)",
	},
	tester: {
		id: "usr_priya",
		name: "Priya Patel",
		initials: "PP",
		gradient: "linear-gradient(135deg, #B29DF0, #E491AC)",
	},
	admin: {
		id: "usr_sarah",
		name: "Sarah Chen",
		initials: "SC",
		gradient: "linear-gradient(135deg, #E491AC, #F0B27A)",
	},
} as const;

export const teams: Team[] = [
	{ id: "team_acme", name: "Acme QA" },
	{ id: "team_sarahchen", name: "Sarah Chen" },
];

export const projects: Project[] = [
	{ id: "proj_1", teamId: "team_acme", name: "Acme QA", role: "admin", openIssueCount: 34 },
	{ id: "proj_2", teamId: "team_sarahchen", name: "My Project", role: "dev", openIssueCount: 12 },
];

export const issues: Issue[] = [
	{
		id: "iss_042",
		projectId: "proj_1",
		ticketRef: "VER-042",
		title: "Login button unresponsive on mobile Safari",
		status: "in_progress",
		severity: "critical",
		environment: "Chrome 128 · macOS 14 · Desktop",
		stepsToReproduce: [
			"Open the login page on an iPhone 14 running iOS 17",
			"Tap the submit button with valid credentials",
			"Observe no navigation and no error state",
		],
		description:
			"Reproduces on every attempt in Safari. Works as expected in Chrome for iOS, so it is isolated to Safari's rendering.",
		testCaseRef: "TC-118",
		developerAssignees: [avatars.dev],
		qaAssignees: [avatars.qa],
		reporter: avatars.tester,
		createdAt: "2 days ago",
		updatedAt: "2 days ago",
		tags: ["mobile", "safari"],
	},
	{
		id: "iss_039",
		projectId: "proj_1",
		ticketRef: "VER-039",
		title: "Search filter resets when navigating back",
		status: "in_qa",
		severity: "high",
		environment: "Chrome 126 · Windows 11 · Desktop",
		stepsToReproduce: [
			"Run a search with the status filter set to In QA",
			"Open any result",
			"Press Back",
		],
		description: "The applied filter is lost on back navigation.",
		developerAssignees: [avatars.dev],
		qaAssignees: [avatars.qa],
		reporter: avatars.tester,
		createdAt: "1 day ago",
		updatedAt: "6 hours ago",
		tags: ["search"],
	},
	{
		id: "iss_031",
		projectId: "proj_1",
		ticketRef: "VER-031",
		title: "Typo in footer newsletter label",
		status: "in_qa",
		severity: "medium",
		environment: "Firefox 129 · Ubuntu 24 · Desktop",
		description: "The footer label reads \u201cSibscribe\u201d instead of \u201cSubscribe\u201d.",
		developerAssignees: [avatars.dev],
		qaAssignees: [avatars.qa],
		reporter: avatars.tester,
		createdAt: "3 days ago",
		updatedAt: "2 days ago",
	},
	{
		id: "iss_038",
		projectId: "proj_1",
		ticketRef: "VER-038",
		title: "Export to CSV drops empty cells",
		status: "backlog",
		severity: "low",
		environment: "Chrome 127 · macOS 14 · Desktop",
		description: "Trailing empty cells are omitted from the exported file.",
		developerAssignees: [],
		qaAssignees: [],
		reporter: avatars.tester,
		createdAt: "1 hour ago",
		updatedAt: "1 hour ago",
	},
	{
		id: "iss_041",
		projectId: "proj_1",
		ticketRef: "VER-041",
		title: "Avatar upload preview is squashed",
		status: "backlog",
		severity: "high",
		environment: "Safari 17 · iOS 17 · Mobile",
		description: "The preview does not preserve the aspect ratio of the source image.",
		developerAssignees: [],
		qaAssignees: [],
		reporter: avatars.tester,
		createdAt: "5 days ago",
		updatedAt: "5 days ago",
	},
	{
		id: "iss_034",
		projectId: "proj_1",
		ticketRef: "VER-034",
		title: "Keyboard shortcut conflicts with browser tab switch",
		status: "verified",
		severity: "medium",
		environment: "Chrome 128 · Windows 11 · Desktop",
		description: "The global shortcut is already bound by the browser.",
		developerAssignees: [avatars.dev],
		qaAssignees: [avatars.qa],
		reporter: avatars.tester,
		createdAt: "1 week ago",
		updatedAt: "1 day ago",
	},
	{
		id: "iss_035",
		projectId: "proj_1",
		ticketRef: "VER-035",
		title: "Invite link expires before the email arrives",
		status: "verified",
		severity: "medium",
		environment: "All",
		description: "Short expiry window leads to failed first-time logins.",
		developerAssignees: [avatars.dev],
		qaAssignees: [avatars.qa],
		reporter: avatars.tester,
		createdAt: "2 weeks ago",
		updatedAt: "1 week ago",
	},
];

export const issueHistory: IssueHistoryEntry[] = [
	{
		id: "hist_1",
		issueId: "iss_042",
		projectId: "proj_1",
		fromStatus: null,
		toStatus: "backlog",
		by: "Priya Patel",
		at: "3 days ago",
	},
	{
		id: "hist_2",
		issueId: "iss_042",
		projectId: "proj_1",
		fromStatus: "backlog",
		toStatus: "in_progress",
		by: "Marcus Lee",
		at: "2 days ago",
	},
	{
		id: "hist_3",
		issueId: "iss_042",
		projectId: "proj_1",
		fromStatus: "in_progress",
		toStatus: "in_qa",
		by: "Marcus Lee",
		at: "1 day ago",
	},
	{
		id: "hist_4",
		issueId: "iss_042",
		projectId: "proj_1",
		fromStatus: "in_qa",
		toStatus: "in_progress",
		by: "Dana Okafor",
		at: "6 hours ago",
		note: "Still reproduces on Safari 17",
	},
];

export const issueComments: IssueComment[] = [
	{
		id: "cmt_1",
		issueId: "iss_042",
		projectId: "proj_1",
		author: avatars.qa,
		body: "Confirmed on Safari 17. The submit handler never fires.",
		at: "6 hours ago",
	},
	{
		id: "cmt_2",
		issueId: "iss_042",
		projectId: "proj_1",
		author: avatars.dev,
		body: "Found it \u2014 a `preventDefault` was being swallowed. Patching now.",
		at: "4 hours ago",
	},
];

export const teamMembers: TeamMember[] = [
	{
		id: "usr_sarah",
		teamId: "team_acme",
		name: "Sarah Chen",
		email: "sarah@acme.com",
		role: "owner",
	},
	{
		id: "usr_marcus",
		teamId: "team_acme",
		name: "Marcus Lee",
		email: "marcus@acme.com",
		role: "member",
	},
	{
		id: "usr_dana",
		teamId: "team_acme",
		name: "Dana Okafor",
		email: "dana@acme.com",
		role: "member",
	},
];

export const pendingInvites: PendingInvite[] = [
	{ id: "inv_1", teamId: "team_acme", email: "dana@acme.com", role: "member", expiresInDays: 5 },
	{ id: "inv_2", teamId: "team_acme", email: "pranav@acme.com", role: "member", expiresInDays: 2 },
];

export const projectMembers: ProjectMember[] = [
	{
		id: "pm_1",
		projectId: "proj_1",
		name: "Sarah Chen",
		initials: "SC",
		role: "admin",
		gradient: "linear-gradient(135deg, #E491AC, #F0B27A)",
	},
	{
		id: "pm_2",
		projectId: "proj_1",
		name: "Marcus Lee",
		initials: "ML",
		role: "dev",
		gradient: "linear-gradient(135deg, #5FC9C9, #7FA0E0)",
	},
	{
		id: "pm_3",
		projectId: "proj_1",
		name: "Dana Okafor",
		initials: "DO",
		role: "qa",
		gradient: "linear-gradient(135deg, #7FA0E0, #B29DF0)",
	},
	{
		id: "pm_4",
		projectId: "proj_1",
		name: "Priya Patel",
		initials: "PP",
		role: "tester",
		gradient: "linear-gradient(135deg, #B29DF0, #E491AC)",
	},
];

export const importColumns: ImportColumnMapping[] = [
	{ spreadsheetColumn: "Issue description", targetField: "Title" },
	{ spreadsheetColumn: "Severity", targetField: "Severity" },
	{ spreadsheetColumn: "Category", targetField: "Tags" },
	{ spreadsheetColumn: "Device", targetField: "Environment.device" },
];

export const importRowColors: RowColorMapping[] = [
	{ color: "Orange", hex: "#FB923C", rows: 43, targetStatus: "in_progress" },
	{ color: "Yellow", hex: "#E3A75C", rows: 12, targetStatus: "in_qa" },
	{ color: "Green", hex: "#4FCBA3", rows: 8, targetStatus: "verified" },
	{ color: "No fill", hex: "#12161B", rows: 2, targetStatus: "backlog" },
];

export const importErrors: ImportErrorRow[] = [
	{ row: 12, message: "Missing required title" },
	{ row: 47, message: "Unknown severity value \u201cUrgent\u201d" },
];

export const mcpTokens: McpToken[] = [
	{
		id: "tok_1",
		name: "Claude Code - MacBook",
		createdAt: "2026-08-01T09:00:00.000Z",
		lastUsed: "2 hours ago",
	},
];

export const mcpProjectAccess: McpProjectAccess[] = [
	{ project: "Acme QA", role: "dev", toolsAvailable: "5 of 6 tools" },
	{ project: "My Project", role: "admin", toolsAvailable: "6 of 6 tools" },
];

export const mcpTools: McpTool[] = [
	{ name: "list_issues", minRole: "tester+", kind: "read" },
	{ name: "get_issue", minRole: "tester+", kind: "read" },
	{ name: "create_issue", minRole: "tester+", kind: "write" },
	{ name: "update_issue", minRole: "dev", kind: "write" },
	{ name: "change_status", minRole: "dev", kind: "write" },
	{ name: "assign_issue", minRole: "qa", kind: "write" },
];

export const mcpActivity: McpActivity[] = [
	{
		id: "act_1",
		tokenId: "tok_1",
		projectId: "proj_1",
		action: "VER-042 status \u2192 in_qa",
		at: "3 min ago",
	},
	{
		id: "act_2",
		tokenId: "tok_1",
		projectId: "proj_1",
		action: "VER-038 created",
		at: "1 hour ago",
	},
];
