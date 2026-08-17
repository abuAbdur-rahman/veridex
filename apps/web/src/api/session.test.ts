import { afterEach, describe, expect, it, vi } from "vitest";
import { deriveProfile, fetchMe, initialsFor, type MeUser } from "@/api/session";

describe("session API", () => {
	afterEach(() => {
		vi.unstubAllGlobals();
	});

	it("returns null when /api/me rejects an absent session", async () => {
		const fetchMock = vi
			.fn()
			.mockResolvedValue(
				new Response(
					JSON.stringify({ error: { code: "UNAUTHORIZED", message: "Session required" } }),
					{ status: 401, headers: { "Content-Type": "application/json" } },
				),
			);
		vi.stubGlobal("fetch", fetchMock);

		await expect(fetchMe()).resolves.toBeNull();
		expect(fetchMock).toHaveBeenCalledWith(
			"/api/me",
			expect.objectContaining({
				credentials: "include",
			}),
		);
	});
});

describe("session profile helpers", () => {
	const user: MeUser = {
		id: "usr_abc",
		name: "Sarah Chen",
		email: "sarah@acme.com",
		image: "https://example.com/avatar.png",
		username: "sarahchen",
		defaultRole: "dev",
	};

	it("derives initials from the first two words", () => {
		expect(initialsFor("Sarah Chen")).toBe("SC");
		expect(initialsFor("Sarah Grace Chen")).toBe("SG");
		expect(initialsFor("Alex")).toBe("A");
	});

	it("maps user fields and derives stable profile values", () => {
		const profile = deriveProfile(user);
		expect(profile).toMatchObject({
			id: "usr_abc",
			name: "Sarah Chen",
			username: "sarahchen",
			email: "sarah@acme.com",
			initials: "SC",
			avatarUrl: "https://example.com/avatar.png",
		});
		expect(deriveProfile({ ...user, name: "Different Name" }).gradient).toBe(profile.gradient);
		expect(deriveProfile({ ...user, id: "usr_xyz" }).gradient).not.toBe(profile.gradient);
	});

	it("falls back when optional profile fields are null", () => {
		const profile = deriveProfile({ ...user, username: null, image: null });
		expect(profile.username).toBe("");
		expect(profile.avatarUrl).toBeUndefined();
	});
});
