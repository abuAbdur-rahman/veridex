import { afterEach, describe, expect, it, vi } from "vitest";
import { ApiError } from "@/api/client";
import {
	checkUsernameAvailability,
	completeOnboarding,
	deriveUsername,
	isValidUsername,
	normalizeUsername,
} from "@/api/onboarding";

describe("username utilities", () => {
	it("normalizes to trimmed lowercase", () => {
		expect(normalizeUsername("  Alice_1  ")).toBe("alice_1");
		expect(normalizeUsername("BOB")).toBe("bob");
	});

	it("enforces the server username pattern", () => {
		expect(isValidUsername("alice")).toBe(true);
		expect(isValidUsername("Alice_1")).toBe(true);
		expect(isValidUsername("ab")).toBe(false);
		expect(isValidUsername("_alice")).toBe(false);
		expect(isValidUsername("alice.bob")).toBe(false);
		expect(isValidUsername("alice bob")).toBe(false);
		expect(isValidUsername("a".repeat(31))).toBe(false);
	});

	it("derives a username from provider data", () => {
		expect(deriveUsername("Sarah.Chen@acme.com")).toBe("sarahchen");
		expect(deriveUsername("user_name@acme.com")).toBe("user_name");
		expect(deriveUsername(undefined, "Priya Patel")).toBe("priya");
		expect(deriveUsername(undefined, undefined)).toBe("");
		expect(deriveUsername(".@acme.com")).toBe("");
	});
});

describe("onboarding API", () => {
	afterEach(() => {
		vi.unstubAllGlobals();
	});

	it("rejects malformed successful availability responses", async () => {
		vi.stubGlobal(
			"fetch",
			vi.fn().mockResolvedValue(
				new Response(JSON.stringify({ available: "yes" }), {
					status: 200,
					headers: { "Content-Type": "application/json" },
				}),
			),
		);

		await expect(checkUsernameAvailability("alice")).rejects.toMatchObject({
			code: "INVALID_RESPONSE",
			status: 200,
		} satisfies Partial<ApiError>);
	});

	it("posts onboarding input using the session cookie", async () => {
		const result = {
			user: { username: "alice" },
			team: { id: "team_1", name: "Alice", slug: "alice", isPersonal: true },
			project: { id: "project_1", teamId: "team_1", name: "My Project", slug: "my-project" },
		};
		const fetchMock = vi.fn().mockResolvedValue(
			new Response(JSON.stringify(result), {
				status: 201,
				headers: { "Content-Type": "application/json" },
			}),
		);
		vi.stubGlobal("fetch", fetchMock);

		await expect(completeOnboarding("alice")).resolves.toEqual(result);
		expect(fetchMock).toHaveBeenCalledWith(
			"/api/onboarding/complete",
			expect.objectContaining({
				method: "POST",
				credentials: "include",
				body: JSON.stringify({ username: "alice" }),
			}),
		);
	});
});
