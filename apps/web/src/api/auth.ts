import { ApiError, isRecord, readErrorText } from "@/api/client";
import { apiUrl } from "@/lib/api-url";

export type SocialProvider = "google" | "github";

export async function signInWithProvider(provider: SocialProvider, callbackPath = "/dashboard") {
	const safeCallbackPath =
		callbackPath.startsWith("/") && !callbackPath.startsWith("//") ? callbackPath : "/dashboard";
	const callbackURL = `${window.location.origin}${safeCallbackPath}`;
	const response = await fetch(apiUrl("/api/auth/sign-in/social"), {
		method: "POST",
		credentials: "include",
		headers: { "Content-Type": "application/json" },
		body: JSON.stringify({ provider, callbackURL }),
	});
	const body = (await response.json().catch(() => null)) as unknown;
	const result = isRecord(body) ? body : {};
	if (!response.ok || typeof result.url !== "string" || !result.url) {
		const message =
			readErrorText(result.error) ??
			readErrorText(result.message) ??
			"Could not start sign-in flow";
		throw new ApiError("SIGN_IN_FAILED", message, response.status);
	}
	window.location.assign(result.url);
}
