import { beforeEach, describe, expect, it } from "vitest";

import { createDemoStore, DEMO_STORE_KEY } from "@/stores/demo-store";

function createMemoryStorage() {
	const values = new Map<string, string>();

	return {
		getItem: (key: string) => values.get(key) ?? null,
		removeItem: (key: string) => values.delete(key),
		setItem: (key: string, value: string) => values.set(key, value),
	};
}

describe("demo store", () => {
	const storage = createMemoryStorage();

	beforeEach(() => {
		storage.removeItem(DEMO_STORE_KEY);
	});

	it("validates lifecycle transitions and records a web history entry atomically", () => {
		const store = createDemoStore(storage);
		const issue = store.getState().issues.find(({ status }) => status === "in_qa");
		expect(issue).toBeDefined();
		if (!issue) return;

		const originalHistory = store.getState().issueHistory[issue.id] ?? [];
		const invalid = store.getState().changeIssueStatus(issue.id, "backlog");
		expect(invalid).toEqual({ ok: false, error: "Invalid status transition" });
		expect(store.getState().issues.find(({ id }) => id === issue.id)?.status).toBe("in_qa");
		expect(store.getState().issueHistory[issue.id] ?? []).toHaveLength(originalHistory.length);

		const missingNote = store.getState().changeIssueStatus(issue.id, "in_progress", "   ");
		expect(missingNote).toEqual({ ok: false, error: "A note is required when moving an issue backward" });

		const valid = store
			.getState()
			.changeIssueStatus(issue.id, "in_progress", "  Still broken on Safari  ");
		expect(valid.ok).toBe(true);
		expect(store.getState().issues.find(({ id }) => id === issue.id)?.status).toBe(
			"in_progress",
		);
		expect(store.getState().issueHistory[issue.id]).toHaveLength(originalHistory.length + 1);
		expect(store.getState().issueHistory[issue.id]?.at(-1)).toMatchObject({
			issueId: issue.id,
			projectId: issue.projectId,
			fromStatus: "in_qa",
			toStatus: "in_progress",
			note: "Still broken on Safari",
			source: "web",
		});
	});

	it("accepts the complete forward lifecycle", () => {
		const store = createDemoStore(storage);
		const project = store.getState().projects[0];
		expect(project).toBeDefined();
		if (!project) return;

		const created = store.getState().createIssue({
			projectId: project.id,
			title: "Lifecycle issue",
			severity: "medium",
		});
		expect(created.ok).toBe(true);
		if (!created.ok) return;

		for (const status of ["in_progress", "in_qa", "verified"] as const) {
			expect(store.getState().changeIssueStatus(created.value.id, status).ok).toBe(true);
		}
		expect(store.getState().issues.find(({ id }) => id === created.value.id)?.status).toBe("verified");
		expect(store.getState().issueHistory[created.value.id]).toHaveLength(4);
	});

	it("generates project-scoped ticket references", () => {
		const store = createDemoStore(storage);
		const firstProject = store.getState().projects[0];
		const createdProject = store.getState().createProject({ name: "  Mobile App  " });
		expect(createdProject.ok).toBe(true);
		if (!firstProject || !createdProject.ok) return;

		const first = store.getState().createIssue({
			projectId: firstProject.id,
			title: "  Existing project issue  ",
			severity: "high",
		});
		const second = store.getState().createIssue({
			projectId: createdProject.value.id,
			title: "  New project issue  ",
			severity: "medium",
		});

		expect(first.ok && first.value.ticketRef).toBe("VER-043");
		expect(second.ok && second.value.ticketRef).toBe("VER-001");
		expect(second.ok && second.value.title).toBe("New project issue");
	});

	it("trims inputs and rejects blank issue titles and comments", () => {
		const store = createDemoStore(storage);
		const project = store.getState().projects[0];
		const issue = store.getState().issues[0];
		expect(project).toBeDefined();
		expect(issue).toBeDefined();
		if (!project || !issue) return;

		expect(
			store.getState().createIssue({ projectId: project.id, title: "  ", severity: "low" }),
		).toEqual({ ok: false, error: "Issue title is required" });
		expect(store.getState().addComment(issue.id, "  ")).toEqual({
			ok: false,
			error: "Comment is required",
		});

		const comment = store.getState().addComment(issue.id, "  Retested successfully  ");
		expect(comment.ok && comment.value.body).toBe("Retested successfully");
	});

	it("resets to a fresh deep clone of fixture state", () => {
		const store = createDemoStore(storage);
		const fixtureTitle = store.getState().issues[0]?.title;
		const issueId = store.getState().issues[0]?.id;
		expect(issueId).toBeDefined();
		if (!issueId) return;

		store.getState().updateIssue(issueId, { title: "Changed" });
		store.getState().reset();
		expect(store.getState().issues[0]?.title).toBe(fixtureTitle);
		expect(store.getState().issues).not.toBe(store.getInitialState().issues);
	});

	it("returns raw MCP token once without storing or persisting it", () => {
		const store = createDemoStore(storage);
		const result = store.getState().createToken("  CI Agent  ");
		expect(result.ok).toBe(true);
		if (!result.ok) return;

		expect(result.value.rawToken).toMatch(/^vdx_demo_/);
		expect(store.getState().mcpTokens.at(-1)?.name).toBe("CI Agent");
		expect(JSON.stringify(store.getState())).not.toContain(result.value.rawToken);
		expect(storage.getItem(DEMO_STORE_KEY)).not.toContain(result.value.rawToken);
	});

	it("rejects duplicate members and saves validated profile settings", () => {
		const store = createDemoStore(storage);
		const existing = store.getState().projectMembers[0];
		expect(existing).toBeDefined();
		if (!existing) return;

		expect(store.getState().addProjectMember({
			projectId: existing.projectId,
			name: existing.name.toUpperCase(),
			role: "dev",
		})).toEqual({ ok: false, error: "Member already belongs to this project" });
		expect(store.getState().saveProfile({ username: "x" }).ok).toBe(false);
		expect(store.getState().saveProfile({ username: "  sarah_qa  " })).toMatchObject({
			ok: true,
			value: { username: "sarah_qa" },
		});
		expect(store.getState().saveSettings({ defaultRole: "qa" })).toMatchObject({
			ok: true,
			value: { defaultRole: "qa" },
		});
	});

	it("applies import status mappings and source metadata", () => {
		const store = createDemoStore(storage);
		const project = store.getState().projects[0];
		expect(project).toBeDefined();
		if (!project) return;

		const result = store.getState().importDemoIssues(project.id, {
			fileName: "issues.csv",
			targetStatuses: ["in_qa"],
		});
		expect(result.ok).toBe(true);
		if (!result.ok) return;
		expect(result.value.every((issue) => issue.status === "in_qa")).toBe(true);
		expect(result.value.every((issue) => store.getState().issueHistory[issue.id]?.[0]?.source === "import")).toBe(true);
	});

	it("supports moving a verified issue backward into QA", () => {
		const store = createDemoStore(storage);
		const issue = store.getState().issues.find(({ status }) => status === "verified");
		expect(issue).toBeDefined();
		if (!issue) return;

		expect(store.getState().changeIssueStatus(issue.id, "in_qa").ok).toBe(false);
		expect(store.getState().changeIssueStatus(issue.id, "in_qa", "Verification needs another pass").ok).toBe(true);
		expect(store.getState().issues.find(({ id }) => id === issue.id)?.status).toBe("in_qa");
	});
});
