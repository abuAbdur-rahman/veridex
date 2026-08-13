export const compareBad = [
	"No status history — a cell just changes, silently",
	"No clear ownership between dev, QA, and tester",
	"Repro steps buried in a comment, if they exist at all",
	"Version conflicts when two people edit at once",
	"No link between a bug and the test case that caught it",
] as const;

export const compareGood = [
	"Every status change logged, with who and when",
	"One ticket, role-based views for dev / QA / tester",
	"Structured fields: severity, environment, steps to reproduce",
	"One source of truth, live for the whole team",
	"Test case linkage built into the ticket model",
] as const;

export const features = [
	{
		index: "01",
		title: "Structured ticket fields",
		body: "Severity, environment, steps to reproduce, and a link to the test case that caught it — not a free-text cell.",
	},
	{
		index: "02",
		title: "Spreadsheet import",
		body: "Upload the existing tracking sheet and Veridex maps messy column headers into structured tickets automatically.",
	},
	{
		index: "03",
		title: "Role-based views",
		body: "Dev, QA, and tester each see their own lens on the same underlying data — no separate tools to reconcile.",
	},
	{
		index: "04",
		title: "Full status history",
		body: "Every transition is logged with who made it and when. Nothing is lost to an overwritten cell.",
	},
	{
		index: "05",
		title: "MCP tools",
		body: "Create, read, update, and close tickets from an AI agent — the board stays in sync either way.",
	},
	{
		index: "06",
		title: "Flexible enough for solo use",
		body: "Skip the QA-specific fields and it works as a straightforward personal task board too.",
	},
] as const;

export const boardColumns = [
	{
		title: "Backlog",
		count: 6,
		cards: [
			{
				id: "TICKET-051",
				title: "Export button misaligned on mobile",
				chip: "LOW",
				kind: "pending",
			},
			{
				id: "TICKET-052",
				title: "Password reset email delayed",
				chip: "MEDIUM",
				kind: "pending",
			},
		],
	},
	{
		title: "In Progress",
		count: 3,
		cards: [
			{
				id: "TICKET-049",
				title: "Session expires early on refresh",
				chip: "DEV",
				kind: "dev",
			},
		],
	},
	{
		title: "In QA",
		count: 2,
		cards: [
			{
				id: "TICKET-047",
				title: "Login button unresponsive on Safari",
				chip: "HIGH",
				kind: "pending",
			},
		],
	},
	{
		title: "Verified",
		count: 11,
		cards: [
			{
				id: "TICKET-041",
				title: "PDF export missing footer",
				chip: "CLOSED",
				kind: "pass",
			},
		],
	},
] as const;
