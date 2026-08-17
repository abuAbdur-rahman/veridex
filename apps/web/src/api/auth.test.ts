import { afterEach, describe, expect, it, vi } from "vitest";
import { ApiError } from "@/api/client";
import { signInWithProvider } from "@/api/auth";

describe("social sign-in API", () => {
	afterEach(() => {
		vi.unstubAllGlobals();
	});

	it("rejects a malformed successful response with a typed API error", async () => {
		const fetchMock = vi.fn().mockResolvedValue(
			new Response("null", {
				status: 200,
				headers: { "Content-Type": "application/json" },
			}),
		);
		vi.stubGlobal(
			"fetch",
			fetchMock,
		);

		await expect(signInWithProvider("github", "/join/team/invite-token")).rejects.toMatchObject({
			code: "SIGN_IN_FAILED",
			status: 200,
		} satisfies Partial<ApiError>);
		expect(fetchMock).toHaveBeenCalledWith(
			"/api/auth/sign-in/social",
			expect.objectContaining({
				body: JSON.stringify({
					provider: "github",
					callbackURL: `${window.location.origin}/join/team/invite-token`,
				}),
			}),
		);
	});
});
