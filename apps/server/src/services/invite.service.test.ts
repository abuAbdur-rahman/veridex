import { createHash } from "node:crypto";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Database } from "../db/client.js";
import { acceptInvite, createInvite, validateInvite } from "./invite.service.js";

function createInviteDatabase(teamResult?: { id: string; isPersonal: boolean }) {
	let inserted: Record<string, unknown> | undefined;
	const db = {
		select: vi.fn(() => ({
			from: vi.fn(() => ({
				where: vi.fn(() => ({
					limit: vi.fn(async () => (teamResult ? [teamResult] : [])),
				})),
			})),
		})),
		insert: vi.fn(() => ({
			values: vi.fn((values: Record<string, unknown>) => {
				inserted = values;
				return {
					returning: vi.fn(async () => [
						{
							id: "invite-1",
							tokenPrefix: values.tokenPrefix,
							teamId: values.teamId,
							email: values.email,
							teamRole: values.teamRole,
							expiresAt: values.expiresAt,
							createdAt: new Date("2026-08-16T00:00:00.000Z"),
						},
					]),
				};
			}),
		})),
	} as unknown as Database;
	return { db, getInserted: () => inserted };
}

function createValidationDatabase(invite?: Record<string, unknown>) {
	return {
		select: vi.fn(() => ({
			from: vi.fn(() => ({
				innerJoin: vi.fn(() => ({
					where: vi.fn(() => ({
						limit: vi.fn(async () => (invite ? [invite] : [])),
					})),
				})),
			})),
		})),
	} as unknown as Database;
}

type AcceptanceState = {
	members: Array<Record<string, unknown>>;
	acceptedAt: Date | null;
};

function createAcceptanceDatabase(options?: {
	invite?: Record<string, unknown>;
	consume?: boolean;
	insertConflict?: boolean;
	joinedTeam?: Record<string, unknown>;
}) {
	const state: AcceptanceState = { members: [], acceptedAt: null };
	const invite = options?.invite ?? {
		id: "invite-1",
		teamId: "team-1",
		invitedBy: "user-1",
		email: "member@example.com",
		teamRole: "member",
		acceptedAt: null,
		expiresAt: new Date("2030-01-01T00:00:00.000Z"),
		isPersonalTeam: false,
	};
	const joinedTeam = options?.joinedTeam ?? {
		id: "team-1",
		name: "Quality",
		slug: "quality",
		isPersonal: false,
	};
	const db = {
		transaction: vi.fn(async (callback: (tx: unknown) => Promise<unknown>) => {
			const draft = structuredClone(state);
			let selectCount = 0;
			const tx = {
				select: vi.fn(() => {
					selectCount += 1;
					if (selectCount === 1) {
						return {
							from: vi.fn(() => ({
								innerJoin: vi.fn(() => ({
									where: vi.fn(() => ({
										for: vi.fn(() => ({
											limit: vi.fn(async () => (invite ? [invite] : [])),
										})),
									})),
								})),
							})),
						};
					}
					return {
						from: vi.fn(() => ({
							where: vi.fn(() => ({
								limit: vi.fn(async () => (joinedTeam ? [joinedTeam] : [])),
							})),
						})),
					};
				}),
				insert: vi.fn(() => ({
					values: vi.fn(async (values: Record<string, unknown>) => {
						if (options?.insertConflict) {
							throw Object.assign(new Error("duplicate"), { code: "23505" });
						}
						draft.members.push(values);
					}),
				})),
				update: vi.fn(() => ({
					set: vi.fn(({ acceptedAt }: { acceptedAt: Date }) => ({
						where: vi.fn(() => ({
							returning: vi.fn(async () => {
								if (options?.consume === false) return [];
								draft.acceptedAt = acceptedAt;
								return [{ id: "invite-1" }];
							}),
						})),
					})),
				})),
			};
			const result = await callback(tx);
			Object.assign(state, draft);
			return result;
		}),
	} as unknown as Database;
	return { db, state };
}

beforeEach(() => {
	vi.useRealTimers();
});

describe("invite service", () => {
	it("stores only a SHA-256 token hash and safe prefix, then returns raw token once", async () => {
		vi.useFakeTimers();
		vi.setSystemTime(new Date("2026-08-16T00:00:00.000Z"));
		const { db, getInserted } = createInviteDatabase({
			id: "team-1",
			isPersonal: false,
		});

		const result = await createInvite(db, {
			teamId: "team-1",
			invitedBy: "user-1",
			email: "  Member@Example.com  ",
			teamRole: "member",
		});
		const inserted = getInserted();

		expect(result.token).toMatch(/^[A-Za-z0-9_-]{43}$/);
		expect(inserted).toMatchObject({
			tokenHash: createHash("sha256").update(result.token).digest("hex"),
			tokenPrefix: result.token.slice(0, 12),
			teamId: "team-1",
			invitedBy: "user-1",
			email: "member@example.com",
			teamRole: "member",
			expiresAt: new Date("2026-08-23T00:00:00.000Z"),
		});
		expect(inserted).not.toHaveProperty("token");
		expect(JSON.stringify(inserted)).not.toContain(result.token);
	});

	it("rejects invites for missing and personal teams", async () => {
		await expect(
			createInvite(createInviteDatabase().db, {
				teamId: "missing",
				invitedBy: "user-1",
				email: "member@example.com",
				teamRole: "member",
			}),
		).rejects.toMatchObject({ code: "NOT_FOUND", statusCode: 404 });

		await expect(
			createInvite(
				createInviteDatabase({ id: "personal", isPersonal: true }).db,
				{
					teamId: "personal",
					invitedBy: "user-1",
					email: "member@example.com",
					teamRole: "member",
				},
			),
		).rejects.toMatchObject({
			code: "FORBIDDEN",
			message: "Personal teams cannot invite members",
			statusCode: 403,
		});
	});

	it("returns valid invite metadata without acceptance state", async () => {
		const invite = {
			id: "invite-1",
			teamId: "team-1",
			teamName: "Quality",
			teamSlug: "quality",
			email: "member@example.com",
			teamRole: "member",
			acceptedAt: null,
			expiresAt: new Date("2030-01-01T00:00:00.000Z"),
		};

		await expect(
			validateInvite(createValidationDatabase(invite), "a".repeat(43)),
		).resolves.toEqual({
			id: "invite-1",
			teamId: "team-1",
			teamName: "Quality",
			teamSlug: "quality",
			email: "member@example.com",
			teamRole: "member",
			expiresAt: new Date("2030-01-01T00:00:00.000Z"),
		});
	});

	it.each([
		[undefined, "NOT_FOUND", 404],
		[
			{
				acceptedAt: new Date("2026-08-15T00:00:00.000Z"),
				expiresAt: new Date("2030-01-01T00:00:00.000Z"),
			},
			"INVITE_ACCEPTED",
			409,
		],
		[
			{ acceptedAt: null, expiresAt: new Date("2020-01-01T00:00:00.000Z") },
			"INVITE_EXPIRED",
			410,
		],
	] as const)("maps invalid invite state to %s", async (invite, code, statusCode) => {
		await expect(
			validateInvite(
				createValidationDatabase(invite as Record<string, unknown> | undefined),
				"a".repeat(43),
			),
		).rejects.toMatchObject({ code, statusCode });
	});

	it("requires a verified authenticated email before opening a transaction", async () => {
		const { db } = createAcceptanceDatabase();

		await expect(
			acceptInvite(db, "a".repeat(43), {
				userId: "user-2",
				email: "member@example.com",
				emailVerified: false,
			}),
		).rejects.toMatchObject({ code: "FORBIDDEN", statusCode: 403 });
		expect(db.transaction).not.toHaveBeenCalled();
	});

	it("normalizes and binds authenticated email while accepting atomically", async () => {
		const { db, state } = createAcceptanceDatabase();

		const result = await acceptInvite(db, "a".repeat(43), {
			userId: "user-2",
			email: "  Member@Example.com  ",
			emailVerified: true,
		});

		expect(result).toEqual({
			id: "team-1",
			name: "Quality",
			slug: "quality",
			isPersonal: false,
			teamRole: "member",
		});
		expect(state.members).toEqual([
			{
				teamId: "team-1",
				userId: "user-2",
				teamRole: "member",
				invitedBy: "user-1",
			},
		]);
		expect(state.acceptedAt).toBeInstanceOf(Date);
	});

	it.each([
		[
			{ isPersonalTeam: true },
			"member@example.com",
			"Personal teams cannot accept invites",
		],
		[
			{ isPersonalTeam: false },
			"other@example.com",
			"Invite email does not match authenticated email",
		],
	] as const)(
		"rejects forbidden acceptance without writes",
		async (inviteOverride, email, message) => {
			const baseInvite = {
				id: "invite-1",
				teamId: "team-1",
				invitedBy: "user-1",
				email: "member@example.com",
				teamRole: "member",
				acceptedAt: null,
				expiresAt: new Date("2030-01-01T00:00:00.000Z"),
				isPersonalTeam: false,
			};
			const { db, state } = createAcceptanceDatabase({
				invite: { ...baseInvite, ...inviteOverride },
			});

			await expect(
				acceptInvite(db, "a".repeat(43), {
					userId: "user-2",
					email,
					emailVerified: true,
				}),
			).rejects.toMatchObject({ code: "FORBIDDEN", message, statusCode: 403 });
			expect(state).toEqual({ members: [], acceptedAt: null });
		},
	);

	it("rolls back membership when conditional invite consumption loses a race", async () => {
		const { db, state } = createAcceptanceDatabase({ consume: false });

		await expect(
			acceptInvite(db, "a".repeat(43), {
				userId: "user-2",
				email: "member@example.com",
				emailVerified: true,
			}),
		).rejects.toMatchObject({ code: "INVITE_UNAVAILABLE", statusCode: 409 });
		expect(state).toEqual({ members: [], acceptedAt: null });
	});

	it("maps duplicate membership conflicts and leaves invite unconsumed", async () => {
		const { db, state } = createAcceptanceDatabase({ insertConflict: true });

		await expect(
			acceptInvite(db, "a".repeat(43), {
				userId: "user-2",
				email: "member@example.com",
				emailVerified: true,
			}),
		).rejects.toMatchObject({
			code: "TEAM_MEMBERSHIP_EXISTS",
			message: "User is already a member of this team",
			statusCode: 409,
		});
		expect(state).toEqual({ members: [], acceptedAt: null });
	});
});
