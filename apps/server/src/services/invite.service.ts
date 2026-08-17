import { createHash, randomBytes } from "node:crypto";
import { and, eq, gt, isNull } from "drizzle-orm";
import type { Database } from "../db/client.js";
import { invites, team, teamMember } from "../db/schema/index.js";
import { AppError, ForbiddenError, NotFoundError } from "../lib/errors.js";
import type { TeamRole } from "../lib/auth.js";

const inviteLifetimeMs = 7 * 24 * 60 * 60 * 1_000;

function hashToken(token: string) {
	return createHash("sha256").update(token).digest("hex");
}

function normalizeEmail(email: string) {
	return email.trim().toLowerCase();
}

function isUniqueConflict(error: unknown) {
	return (
		typeof error === "object" &&
		error !== null &&
		"code" in error &&
		error.code === "23505"
	);
}

function assertInviteState(invite: { acceptedAt: Date | null; expiresAt: Date }) {
	if (invite.acceptedAt) {
		throw new AppError("INVITE_ACCEPTED", "Invite has already been accepted", 409);
	}
	if (invite.expiresAt <= new Date()) {
		throw new AppError("INVITE_EXPIRED", "Invite has expired", 410);
	}
}

export async function createInvite(
	db: Database,
	input: {
		teamId: string;
		invitedBy: string;
		email: string;
		teamRole: Exclude<TeamRole, "owner">;
	},
) {
	const [inviteTeam] = await db
		.select({ id: team.id, isPersonal: team.isPersonal })
		.from(team)
		.where(eq(team.id, input.teamId))
		.limit(1);

	if (!inviteTeam) throw new NotFoundError("Team");
	if (inviteTeam.isPersonal) {
		throw new ForbiddenError("Personal teams cannot invite members");
	}

	const token = randomBytes(32).toString("base64url");
	const [createdInvite] = await db
		.insert(invites)
		.values({
			tokenHash: hashToken(token),
			tokenPrefix: token.slice(0, 12),
			teamId: input.teamId,
			invitedBy: input.invitedBy,
			email: normalizeEmail(input.email),
			teamRole: input.teamRole,
			expiresAt: new Date(Date.now() + inviteLifetimeMs),
		})
		.returning({
			id: invites.id,
			tokenPrefix: invites.tokenPrefix,
			teamId: invites.teamId,
			email: invites.email,
			teamRole: invites.teamRole,
			expiresAt: invites.expiresAt,
			createdAt: invites.createdAt,
		});

	if (!createdInvite) {
		throw new AppError("INVITE_CREATE_FAILED", "Could not create invite", 500);
	}

	return { ...createdInvite, token };
}

export async function validateInvite(db: Database, token: string) {
	const [invite] = await db
		.select({
			id: invites.id,
			teamId: invites.teamId,
			teamName: team.name,
			teamSlug: team.slug,
			email: invites.email,
			teamRole: invites.teamRole,
			acceptedAt: invites.acceptedAt,
			expiresAt: invites.expiresAt,
		})
		.from(invites)
		.innerJoin(team, eq(team.id, invites.teamId))
		.where(eq(invites.tokenHash, hashToken(token)))
		.limit(1);

	if (!invite) throw new NotFoundError("Invite");
	assertInviteState(invite);

	const { acceptedAt: _acceptedAt, ...metadata } = invite;
	return metadata;
}

export async function acceptInvite(
	db: Database,
	token: string,
	identity: { userId: string; email: string; emailVerified: boolean },
) {
	if (!identity.emailVerified) {
		throw new ForbiddenError("Verified email required");
	}

	try {
		return await db.transaction(async (tx) => {
			const [invite] = await tx
				.select({
					id: invites.id,
					teamId: invites.teamId,
					invitedBy: invites.invitedBy,
					email: invites.email,
					teamRole: invites.teamRole,
					acceptedAt: invites.acceptedAt,
					expiresAt: invites.expiresAt,
					isPersonalTeam: team.isPersonal,
				})
				.from(invites)
				.innerJoin(team, eq(team.id, invites.teamId))
				.where(eq(invites.tokenHash, hashToken(token)))
				.for("update")
				.limit(1);

			if (!invite) throw new NotFoundError("Invite");
			assertInviteState(invite);
			if (invite.isPersonalTeam) {
				throw new ForbiddenError("Personal teams cannot accept invites");
			}
			if (normalizeEmail(identity.email) !== invite.email) {
				throw new ForbiddenError("Invite email does not match authenticated email");
			}

			await tx.insert(teamMember).values({
				teamId: invite.teamId,
				userId: identity.userId,
				teamRole: invite.teamRole,
				invitedBy: invite.invitedBy,
			});

			const [consumedInvite] = await tx
				.update(invites)
				.set({ acceptedAt: new Date() })
				.where(
					and(
						eq(invites.id, invite.id),
						isNull(invites.acceptedAt),
						gt(invites.expiresAt, new Date()),
					),
				)
				.returning({ id: invites.id });

			if (!consumedInvite) {
				throw new AppError("INVITE_UNAVAILABLE", "Invite is no longer available", 409);
			}

			const [joinedTeam] = await tx
				.select({
					id: team.id,
					name: team.name,
					slug: team.slug,
					isPersonal: team.isPersonal,
				})
				.from(team)
				.where(eq(team.id, invite.teamId))
				.limit(1);

			if (!joinedTeam) throw new NotFoundError("Team");
			return { ...joinedTeam, teamRole: invite.teamRole };
		});
	} catch (error) {
		if (error instanceof AppError) throw error;
		if (isUniqueConflict(error)) {
			throw new AppError(
				"TEAM_MEMBERSHIP_EXISTS",
				"User is already a member of this team",
				409,
			);
		}
		throw error;
	}
}
