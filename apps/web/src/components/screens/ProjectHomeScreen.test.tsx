import { render, screen } from "@testing-library/react";
import { QueryClientProvider } from "@tanstack/react-query";
import { RouterProvider, createMemoryHistory } from "@tanstack/react-router";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { router } from "@/router";
import { queryClient } from "@/lib/query-client";
import { meQueryKey } from "@/queries/session";
import type { MeResponse } from "@/api/session";

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
	});

	afterEach(() => {
		queryClient.clear();
	});

	it("renders the fixture-backed board without subscription loops", async () => {
		router.update({
			history: createMemoryHistory({ initialEntries: ["/projects/proj_1"] }),
			context: { queryClient },
		});
		render(
			<QueryClientProvider client={queryClient}>
				<RouterProvider router={router} />
			</QueryClientProvider>,
		);

		expect(await screen.findByRole("heading", { name: "All issues" })).toBeInTheDocument();
		expect(screen.getByText("VER-042")).toBeInTheDocument();
	});
});
