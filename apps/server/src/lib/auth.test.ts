import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Database } from "../db/client.js";
import { ForbiddenError, NotFoundError, UnauthorizedError } from "./errors.js";
import { requireProjectRole, requireSession, requireTeamRole } from "./auth.js";

const getSession = vi.fn();
const limit = vi.fn();
const where = vi.fn(() => ({ limit }));
const from = vi.fn(() => ({ where }));
const select = vi.fn(() => ({ from }));

const request = {
	headers: { cookie: "session=test" },
	server: {
		auth: { api: { getSession } },
		db: { select } as unknown as Database,
	},
} as unknown as Parameters<typeof requireProjectRole>[0];

const session = {
	session: { id: "session-1" },
	user: { id: "user-1" },
};

const membership = {
	projectId: "a1b2c3d4-0000-4000-8000-000000000001",
	userId: "user-1",
	role: "qa" as const,
	addedAt: new Date("2026-01-01T00:00:00Z"),
};

beforeEach(() => {
	vi.clearAllMocks();
	getSession.mockResolvedValue(session);
	limit.mockResolvedValue([membership]);
});

describe("requireSession", () => {
	it("rejects a missing session", async () => {
		getSession.mockResolvedValue(null);

		await expect(requireSession(request)).rejects.toBeInstanceOf(
			UnauthorizedError,
		);
	});
});

describe("requireProjectRole", () => {
	it("does not query membership without an active session", async () => {
		getSession.mockResolvedValue(null);

		await expect(
			requireProjectRole(request, "a1b2c3d4-0000-4000-8000-000000000001", ["qa"]),
		).rejects.toBeInstanceOf(UnauthorizedError);
		expect(select).not.toHaveBeenCalled();
	});

	it("rejects a non-UUID project id without querying membership", async () => {
		await expect(requireProjectRole(request, "not-a-uuid", ["qa"])).rejects.toBeInstanceOf(
			NotFoundError,
		);
		expect(select).not.toHaveBeenCalled();
	});

	it("returns 403 for a non-member", async () => {
		limit.mockResolvedValue([]);

		await expect(
			requireProjectRole(request, "a1b2c3d4-0000-4000-8000-000000000001", ["qa"]),
		).rejects.toBeInstanceOf(ForbiddenError);
		expect(where).toHaveBeenCalledOnce();
		expect(limit).toHaveBeenCalledWith(1);
	});

	it("returns 403 for a disallowed role", async () => {
		await expect(
			requireProjectRole(request, "a1b2c3d4-0000-4000-8000-000000000001", ["dev"]),
		).rejects.toBeInstanceOf(ForbiddenError);
	});

	it("returns the session and membership for an allowed role", async () => {
		await expect(
			requireProjectRole(request, "a1b2c3d4-0000-4000-8000-000000000001", ["qa", "tester"]),
		).resolves.toEqual({ session, membership });
	});

	it("allows admin only when explicitly included", async () => {
		const adminMembership = { ...membership, role: "admin" as const };
		limit.mockResolvedValue([adminMembership]);

		await expect(
			requireProjectRole(request, "a1b2c3d4-0000-4000-8000-000000000001", ["qa"]),
		).rejects.toBeInstanceOf(ForbiddenError);
		await expect(
			requireProjectRole(request, "a1b2c3d4-0000-4000-8000-000000000001", ["qa", "admin"]),
		).resolves.toEqual({ session, membership: adminMembership });
	});
});

describe("requireTeamRole", () => {
	const teamId = "a1b2c3d4-0000-4000-8000-000000000002";
	const teamMembership = {
		teamId,
		userId: "user-1",
		teamRole: "admin" as const,
		invitedBy: "user-2",
		joinedAt: new Date("2026-01-01T00:00:00Z"),
	};

	it("does not query membership without an active session", async () => {
		getSession.mockResolvedValue(null);

		await expect(requireTeamRole(request, teamId, ["admin"])).rejects.toBeInstanceOf(
			UnauthorizedError,
		);
		expect(select).not.toHaveBeenCalled();
	});

	it("rejects a non-UUID team id without querying membership", async () => {
		await expect(requireTeamRole(request, "not-a-uuid", ["admin"])).rejects.toBeInstanceOf(
			NotFoundError,
		);
		expect(select).not.toHaveBeenCalled();
	});

	it("returns 403 for a non-member", async () => {
		limit.mockResolvedValue([]);

		await expect(requireTeamRole(request, teamId, ["admin"])).rejects.toBeInstanceOf(
			ForbiddenError,
		);
		expect(where).toHaveBeenCalledOnce();
		expect(limit).toHaveBeenCalledWith(1);
	});

	it("returns 403 for a disallowed role", async () => {
		limit.mockResolvedValue([teamMembership]);

		await expect(requireTeamRole(request, teamId, ["owner"])).rejects.toBeInstanceOf(
			ForbiddenError,
		);
	});

	it("returns the session and membership for an allowed role", async () => {
		limit.mockResolvedValue([teamMembership]);

		await expect(requireTeamRole(request, teamId, ["owner", "admin"])).resolves.toEqual({
			session,
			membership: teamMembership,
		});
	});
});
