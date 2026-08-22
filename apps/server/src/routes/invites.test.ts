import Fastify from "fastify";
import type { Database } from "../db/client.js";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { AppError, ForbiddenError, UnauthorizedError } from "../lib/errors.js";
import { inviteRoutes } from "./invites.js";

const {
	requireSession,
	requireTeamRole,
	createInvite,
	listPendingInvites,
	revokePendingInvite,
	validateInvite,
	acceptInvite,
} =
	vi.hoisted(() => ({
		requireSession: vi.fn(),
		requireTeamRole: vi.fn(),
		createInvite: vi.fn(),
		listPendingInvites: vi.fn(),
		revokePendingInvite: vi.fn(),
		validateInvite: vi.fn(),
		acceptInvite: vi.fn(),
	}));

vi.mock("../lib/auth.js", () => ({ requireSession, requireTeamRole }));
vi.mock("../services/invite.service.js", () => ({
	createInvite,
	listPendingInvites,
	revokePendingInvite,
	validateInvite,
	acceptInvite,
}));

const apps: Array<ReturnType<typeof Fastify>> = [];
const teamId = "11111111-1111-4111-8111-111111111111";
const token = "a".repeat(43);

async function createApp() {
	const app = Fastify({ logger: false });
	app.decorate("db", {} as Database);
	app.setErrorHandler((error, _request, reply) => {
		if (error instanceof AppError) {
			return reply.status(error.statusCode).send({
				error: {
					code: error.code,
					message: error.message,
					...(error.details === undefined ? {} : { details: error.details }),
				},
			});
		}
		return reply.status(500).send({
			error: { code: "INTERNAL_ERROR", message: "Something went wrong" },
		});
	});
	await app.register(inviteRoutes);
	apps.push(app);
	return app;
}

beforeEach(() => {
	vi.clearAllMocks();
	requireSession.mockResolvedValue({
		user: { id: "user-2", email: "User@Example.com", emailVerified: true },
	});
	requireTeamRole.mockResolvedValue({
		session: { user: { id: "user-1" } },
		membership: { teamRole: "owner" },
	});
});

afterEach(async () => {
	await Promise.all(apps.splice(0).map((app) => app.close()));
});

describe("invite routes", () => {
	it("lists pending invites for team admins", async () => {
		const pending = [{ id: "invite-1", email: "member@example.com" }];
		listPendingInvites.mockResolvedValue(pending);

		const response = await (await createApp()).inject({
			method: "GET",
			url: `/api/teams/${teamId}/invites`,
		});

		expect(response.statusCode).toBe(200);
		expect(response.json()).toEqual(pending);
		expect(requireTeamRole).toHaveBeenCalledWith(expect.anything(), teamId, ["owner", "admin"]);
		expect(listPendingInvites).toHaveBeenCalledWith(expect.anything(), teamId);
	});

	it("hard-deletes a pending invite with 204", async () => {
		revokePendingInvite.mockResolvedValue(undefined);
		const inviteId = "22222222-2222-4222-8222-222222222222";

		const response = await (await createApp()).inject({
			method: "DELETE",
			url: `/api/teams/${teamId}/invites/${inviteId}`,
		});

		expect(response.statusCode).toBe(204);
		expect(revokePendingInvite).toHaveBeenCalledWith(expect.anything(), teamId, inviteId);
	});

	it("normalizes invite email and returns the raw token once with 201", async () => {
		const created = {
			id: "invite-1",
			teamId,
			email: "user@example.com",
			teamRole: "admin",
			token,
		};
		createInvite.mockResolvedValue(created);

		const response = await (await createApp()).inject({
			method: "POST",
			url: `/api/teams/${teamId}/invites`,
			payload: { email: "  User@Example.com  ", teamRole: "admin" },
		});

		expect(response.statusCode).toBe(201);
		expect(response.json()).toEqual(created);
		expect(createInvite).toHaveBeenCalledWith(expect.anything(), {
			teamId,
			invitedBy: "user-1",
			email: "user@example.com",
			teamRole: "admin",
		});
	});

	it.each([
		["owner", "admin"],
		["owner", "member"],
		["admin", "member"],
	] as const)("allows %s to grant %s", async (actorRole, grantedRole) => {
		requireTeamRole.mockResolvedValue({
			session: { user: { id: "user-1" } },
			membership: { teamRole: actorRole },
		});
		createInvite.mockResolvedValue({ token });

		const response = await (await createApp()).inject({
			method: "POST",
			url: `/api/teams/${teamId}/invites`,
			payload: { email: "user@example.com", teamRole: grantedRole },
		});

		expect(response.statusCode).toBe(201);
		expect(createInvite).toHaveBeenCalledOnce();
	});

	it.each([
		["owner", "owner"],
		["admin", "owner"],
		["admin", "admin"],
	] as const)("forbids %s from granting %s", async (actorRole, grantedRole) => {
		requireTeamRole.mockResolvedValue({
			session: { user: { id: "user-1" } },
			membership: { teamRole: actorRole },
		});

		const response = await (await createApp()).inject({
			method: "POST",
			url: `/api/teams/${teamId}/invites`,
			payload: { email: "user@example.com", teamRole: grantedRole },
		});

		expect(response.statusCode).toBe(403);
		expect(response.json()).toEqual({
			error: {
				code: "FORBIDDEN",
				message: "Cannot grant requested team role",
			},
		});
		expect(createInvite).not.toHaveBeenCalled();
	});

	it("requires owner or admin membership to create invites", async () => {
		requireTeamRole.mockRejectedValue(new ForbiddenError());

		const response = await (await createApp()).inject({
			method: "POST",
			url: `/api/teams/${teamId}/invites`,
			payload: { email: "user@example.com", teamRole: "member" },
		});

		expect(response.statusCode).toBe(403);
		expect(requireTeamRole).toHaveBeenCalledWith(expect.anything(), teamId, [
			"owner",
			"admin",
		]);
	});

	it.each([
		{ email: "not-email", teamRole: "member" },
		{ email: "user@example.com", teamRole: "tester" },
	])("rejects invalid invite creation input", async (payload) => {
		const response = await (await createApp()).inject({
			method: "POST",
			url: `/api/teams/${teamId}/invites`,
			payload,
		});

		expect(response.statusCode).toBe(422);
		expect(response.json()).toMatchObject({
			error: { code: "VALIDATION_ERROR", message: "Invalid input" },
		});
		expect(requireTeamRole).not.toHaveBeenCalled();
	});

	it("validates invite tokens without requiring a session", async () => {
		const metadata = {
			teamId,
			teamName: "Quality",
			email: "user@example.com",
			teamRole: "member",
		};
		validateInvite.mockResolvedValue(metadata);

		const response = await (await createApp()).inject({
			method: "GET",
			url: `/api/invites/${token}/validate`,
		});

		expect(response.statusCode).toBe(200);
		expect(response.json()).toEqual(metadata);
		expect(requireSession).not.toHaveBeenCalled();
		expect(validateInvite).toHaveBeenCalledWith(expect.anything(), token);
	});

	it("requires a session to accept an invite", async () => {
		requireSession.mockRejectedValue(new UnauthorizedError());

		const response = await (await createApp()).inject({
			method: "POST",
			url: `/api/invites/${token}/accept`,
		});

		expect(response.statusCode).toBe(401);
		expect(acceptInvite).not.toHaveBeenCalled();
	});

	it("passes verified authenticated identity to invite acceptance", async () => {
		const joined = {
			id: teamId,
			name: "Quality",
			slug: "quality",
			isPersonal: false,
			teamRole: "member",
		};
		acceptInvite.mockResolvedValue(joined);

		const response = await (await createApp()).inject({
			method: "POST",
			url: `/api/invites/${token}/accept`,
		});

		expect(response.statusCode).toBe(200);
		expect(response.json()).toEqual(joined);
		expect(acceptInvite).toHaveBeenCalledWith(expect.anything(), token, {
			userId: "user-2",
			email: "User@Example.com",
			emailVerified: true,
		});
	});

	it.each(["short", `${"a".repeat(42)}!`])(
		"rejects malformed path token %s",
		async (malformedToken) => {
			const response = await (await createApp()).inject({
				method: "GET",
				url: `/api/invites/${malformedToken}/validate`,
			});

			expect(response.statusCode).toBe(422);
			expect(validateInvite).not.toHaveBeenCalled();
		},
	);

	it.each([
		[new AppError("INVITE_ACCEPTED", "Invite has already been accepted", 409), 409],
		[new AppError("INVITE_EXPIRED", "Invite has expired", 410), 410],
	] as const)("preserves invite state error envelopes", async (error, statusCode) => {
		validateInvite.mockRejectedValue(error);

		const response = await (await createApp()).inject({
			method: "GET",
			url: `/api/invites/${token}/validate`,
		});

		expect(response.statusCode).toBe(statusCode);
		expect(response.json()).toEqual({
			error: { code: error.code, message: error.message },
		});
	});
});
