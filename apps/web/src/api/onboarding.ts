import { apiRequest, isRecord } from "@/api/client";

export interface UsernameAvailability {
	username: string;
	available: boolean;
}

export interface OnboardingResult {
	user: { username: string };
	team: {
		id: string;
		name: string;
		slug: string;
		isPersonal: boolean;
	};
	project: {
		id: string;
		teamId: string;
		name: string;
		slug: string;
	};
}

export const USERNAME_PATTERN = /^[a-z0-9][a-z0-9_-]{2,29}$/;

export function normalizeUsername(username: string) {
	return username.trim().toLowerCase();
}

export function isValidUsername(username: string) {
	return USERNAME_PATTERN.test(normalizeUsername(username));
}

export function deriveUsername(email: string | undefined, name?: string) {
	let raw = "";
	if (email && email.includes("@")) {
		raw = email.split("@")[0];
	} else if (name) {
		raw = name.split(/\s+/)[0];
	}
	const cleaned = raw.toLowerCase().replace(/[^a-z0-9_-]+/g, "");
	if (!cleaned || !/^[a-z0-9]/.test(cleaned)) return "";
	const candidate = cleaned.slice(0, 30);
	return candidate.length >= 3 ? candidate : "";
}

function isUsernameAvailability(value: unknown): value is UsernameAvailability {
	return (
		isRecord(value) &&
		typeof value.username === "string" &&
		typeof value.available === "boolean"
	);
}

function isOnboardingResult(value: unknown): value is OnboardingResult {
	return (
		isRecord(value) &&
		isRecord(value.user) &&
		typeof value.user.username === "string" &&
		isRecord(value.team) &&
		typeof value.team.id === "string" &&
		typeof value.team.name === "string" &&
		typeof value.team.slug === "string" &&
		typeof value.team.isPersonal === "boolean" &&
		isRecord(value.project) &&
		typeof value.project.id === "string" &&
		typeof value.project.teamId === "string" &&
		typeof value.project.name === "string" &&
		typeof value.project.slug === "string"
	);
}

export function checkUsernameAvailability(query: string) {
	return apiRequest(
		`/api/users/check-username?q=${encodeURIComponent(query)}`,
		isUsernameAvailability,
	);
}

export function completeOnboarding(username: string) {
	return apiRequest("/api/onboarding/complete", isOnboardingResult, {
		method: "POST",
		body: JSON.stringify({ username }),
	});
}
