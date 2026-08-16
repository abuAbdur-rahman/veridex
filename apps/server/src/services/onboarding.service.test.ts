import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Database } from "../db/client.js";
import {
	completeOnboarding,
	isUsernameAvailable,
	normalizeUsername,
} from "./onboarding.service.js";

type TestState = {
	username: string | null;
	teams: Array<Record<string, unknown>>;
	teamMembers: Array<Record<string, unknown>>;
	projects: Array<Record<string, unknown>>;
	projectMembers: Array<Record<string, unknown>>;
};

function createServiceDatabase(
	initialUsername: string | null = null,
	failAt?: "team-member" | "project-member" | "unique",
) {
	const state: TestState = {
		username: initialUsername,
		teams: [],
		teamMembers: [],
		projects: [],
		projectMembers: [],
	};

	function transactionClient(draft: TestState) {
		let insertCount = 0;
		return {
			select: vi.fn(() => ({
				from: vi.fn(() => ({
					where: vi.fn(() => ({
						for: vi.fn(() => ({
							limit: vi.fn(async () => [{ username: draft.username }]),
						})),
					})),
				})),
			})),
			update: vi.fn(() => ({
				set: vi.fn(({ username }: { username: string }) => ({
					where: vi.fn(() => ({
						returning: vi.fn(async () => {
							if (failAt === "unique") {
								throw Object.assign(new Error("duplicate"), {
									code: "23505",
									constraint_name: "user_username_unique",
								});
							}
							draft.username = username;
							return [{ username }];
						}),
					})),
				})),
			})),
			insert: vi.fn(() => {
				insertCount += 1;
				return {
					values: vi.fn((values: Record<string, unknown>) => {
						if (insertCount === 1) {
							const created = { id: "team-1", ...values };
							draft.teams.push(created);
							return { returning: vi.fn(async () => [created]) };
						}
						if (insertCount === 2) {
							if (failAt === "team-member") throw new Error("team member failed");
							draft.teamMembers.push(values);
							return Promise.resolve();
						}
						if (insertCount === 3) {
							const created = { id: "project-1", ...values };
							draft.projects.push(created);
							return { returning: vi.fn(async () => [created]) };
						}
						if (failAt === "project-member") throw new Error("project member failed");
						draft.projectMembers.push(values);
						return Promise.resolve();
					}),
				};
			}),
		};
	}

	const db = {
		transaction: vi.fn(async (callback: (tx: unknown) => Promise<unknown>) => {
			const draft = structuredClone(state);
			const result = await callback(transactionClient(draft));
			Object.assign(state, draft);
			return result;
		}),
	} as unknown as Database;

	return { db, state };
}

function createAvailabilityDatabase(
	existingUserId?: string,
	existingTeam = false,
) {
	let selectCount = 0;
	return {
		select: vi.fn(() => ({
			from: vi.fn(() => ({
				where: vi.fn(() => ({
					limit: vi.fn(async () => {
						selectCount += 1;
						if (selectCount === 1) {
							return existingUserId ? [{ id: existingUserId }] : [];
						}
						return existingTeam ? [{ id: "team-1" }] : [];
					}),
				})),
			})),
		})),
	} as unknown as Database;
}

beforeEach(() => {
	vi.restoreAllMocks();
});

describe("onboarding service", () => {
	it("normalizes usernames and provisions the complete personal workspace", async () => {
		const { db, state } = createServiceDatabase();

		const result = await completeOnboarding(db, "user-1", "  Alice_1  ");

		expect(result.user.username).toBe("alice_1");
		expect(state.username).toBe("alice_1");
		expect(state.teams).toEqual([
			expect.objectContaining({
				id: "team-1",
				name: "alice_1",
				slug: "alice_1",
				ownerId: "user-1",
				isPersonal: true,
			}),
		]);
		expect(state.teamMembers).toEqual([
			{ teamId: "team-1", userId: "user-1", teamRole: "owner" },
		]);
		expect(state.projects).toEqual([
			expect.objectContaining({
				id: "project-1",
				teamId: "team-1",
				name: "My Project",
				slug: "my-project",
				createdBy: "user-1",
			}),
		]);
		expect(state.projectMembers).toEqual([
			{ projectId: "project-1", userId: "user-1", role: "admin" },
		]);
	});

	it("rejects repeat onboarding without creating duplicate records", async () => {
		const { db, state } = createServiceDatabase("alice");

		await expect(completeOnboarding(db, "user-1", "alice")).rejects.toMatchObject({
			code: "ONBOARDING_COMPLETED",
			statusCode: 409,
		});
		expect(state.teams).toHaveLength(0);
		expect(state.projects).toHaveLength(0);
	});

	it.each(["team-member", "project-member"] as const)(
		"rolls back every write when %s provisioning fails",
		async (failAt) => {
			const { db, state } = createServiceDatabase(null, failAt);

			await expect(completeOnboarding(db, "user-1", "alice")).rejects.toThrow();
			expect(state).toEqual({
				username: null,
				teams: [],
				teamMembers: [],
				projects: [],
				projectMembers: [],
			});
		},
	);

	it("maps a concurrent username uniqueness violation to a public conflict", async () => {
		const { db } = createServiceDatabase(null, "unique");

		await expect(completeOnboarding(db, "user-1", "alice")).rejects.toMatchObject({
			code: "USERNAME_TAKEN",
			message: "Username is unavailable",
			statusCode: 409,
		});
	});

	it("reports normalized valid usernames as available only when unused", async () => {
		await expect(
			isUsernameAvailable(createAvailabilityDatabase(), " Alice_1 ", "user-1"),
		).resolves.toBe(true);
		await expect(
			isUsernameAvailable(
				createAvailabilityDatabase("user-2"),
				"alice_1",
				"user-1",
			),
		).resolves.toBe(false);
		await expect(
			isUsernameAvailable(
				createAvailabilityDatabase(undefined, true),
				"alice_1",
				"user-1",
			),
		).resolves.toBe(false);
		expect(normalizeUsername(" Alice_1 ")).toBe("alice_1");
	});

	it("rejects malformed usernames without querying the database", async () => {
		const db = createAvailabilityDatabase();

		await expect(isUsernameAvailable(db, "no spaces", "user-1")).resolves.toBe(
			false,
		);
		expect(db.select).not.toHaveBeenCalled();
	});
});
