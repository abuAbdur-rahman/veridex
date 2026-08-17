import { describe, expect, it } from "vitest";
import type { MeResponse } from "@/api/session";
import { applyOnboardingResult } from "@/queries/session";

const mockMe: MeResponse = {
	session: { id: "session_1", expiresAt: "2099-01-01T00:00:00.000Z", userId: "user_1" },
	user: {
		id: "user_1",
		name: "Alice Example",
		email: "alice@example.com",
		image: null,
		username: null,
		defaultRole: "dev",
	},
	hasPersonalTeam: false,
	teams: [],
};

describe("applyOnboardingResult", () => {
	it("updates the cached user and adds the personal team", () => {
		const result = applyOnboardingResult(mockMe, {
			user: { username: "alice" },
			team: { id: "team_1", name: "Alice", slug: "alice", isPersonal: true },
			project: { id: "project_1", teamId: "team_1", name: "My Project", slug: "my-project" },
		});

		expect(result).toMatchObject({
			user: { username: "alice" },
			hasPersonalTeam: true,
			teams: [{ id: "team_1", teamRole: "owner", isPersonal: true }],
		});
	});
});
