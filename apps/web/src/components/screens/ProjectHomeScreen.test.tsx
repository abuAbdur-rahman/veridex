import { render, screen } from "@testing-library/react";
import { QueryClientProvider } from "@tanstack/react-query";
import { RouterProvider, createMemoryHistory } from "@tanstack/react-router";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { router } from "@/router";
import { queryClient } from "@/lib/query-client";
import { meQueryKey } from "@/queries/session";
import type { MeResponse } from "@/api/session";

const mockProject = {
	id: "proj_1",
	teamId: "team_acme",
	name: "Veridex",
	slug: "ver",
	description: "QA tracker",
	nextTicketNumber: 42,
	createdBy: "usr_sarah",
};
const mockMember = {
	id: "usr_sarah",
	name: "Sarah Chen",
	email: "sarah@acme.com",
	image: null,
	username: "sarahchen",
	role: "admin",
	addedAt: "2099-01-01T00:00:00.000Z",
};
const mockIssue = {
	id: "issue_1",
	ticketRef: "VER-042",
	title: "Checkout fails",
	description: null,
	severity: "high",
	status: "backlog",
	environment: null,
	stepsToReproduce: null,
	expectedResult: null,
	actualResult: null,
	imageUrl: null,
	projectId: "proj_1",
	reporterId: "usr_sarah",
	assigneeId: null,
	qaAssigneeId: null,
	developerAssigneeIds: [],
	qaAssigneeIds: [],
	testCaseId: null,
	importJobId: null,
	createdAt: "2099-01-01T00:00:00.000Z",
	updatedAt: "2099-01-01T00:00:00.000Z",
	closedAt: null,
};
const mockMe: MeResponse = {
	session: {
		id: "test-session",
		expiresAt: "2099-01-01T00:00:00.000Z",
		userId: "usr_sarah",
	},
	user: {
		id: "usr_sarah",
		name: "Sarah Chen",
		email: "sarah@acme.com",
		image: null,
		username: "sarahchen",
		defaultRole: "dev",
	},
	hasPersonalTeam: true,
	teams: [
		{
			id: "team_acme",
			name: "Acme QA",
			slug: "acme-qa",
			isPersonal: false,
			teamRole: "owner",
		},
		{
			id: "team_sarahchen",
			name: "Sarah Chen",
			slug: "sarahchen",
			isPersonal: true,
			teamRole: "owner",
		},
	],
};

describe("ProjectHomeScreen", () => {
	beforeEach(() => {
		queryClient.setQueryData(meQueryKey, mockMe);
		vi.stubGlobal(
			"fetch",
			vi.fn((input: RequestInfo | URL) => {
				const path = String(input);
				if (path.includes("/api/teams/team_acme/projects"))
					return Promise.resolve(Response.json([mockProject]));
				if (path.includes("/api/projects/proj_1/members"))
					return Promise.resolve(Response.json([mockMember]));
				if (path.includes("/api/projects/proj_1/issues/issue_1/history"))
					return Promise.resolve(Response.json([]));
				if (path.includes("/api/projects/proj_1/issues/issue_1"))
					return Promise.resolve(Response.json(mockIssue));
				if (path.includes("/api/projects/proj_1/issues"))
					return Promise.resolve(Response.json([mockIssue]));
				if (path.includes("/api/projects/proj_1"))
					return Promise.resolve(Response.json(mockProject));
				return Promise.resolve(Response.json([]));
			}),
		);
	});

	afterEach(() => {
		vi.unstubAllGlobals();
		queryClient.clear();
	});

	it("renders the server-backed board without subscription loops", async () => {
		router.update({
			history: createMemoryHistory({ initialEntries: ["/projects/proj_1"] }),
			context: { queryClient },
		});
		render(
			<QueryClientProvider client={queryClient}>
				<RouterProvider router={router} />
			</QueryClientProvider>,
		);

		expect(
			await screen.findByRole("heading", { name: "All issues" }, { timeout: 5_000 }),
		).toBeInTheDocument();
		expect(screen.getByText("VER-042")).toBeInTheDocument();
	}, 15_000);
});
