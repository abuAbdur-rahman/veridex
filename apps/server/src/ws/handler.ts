import { and, eq } from "drizzle-orm";
import type { FastifyRequest } from "fastify";
import { WebSocket } from "ws";
import { z } from "zod";
import { UnauthorizedError } from "../lib/errors.js";
import { projectMember } from "../db/schema/project.js";
import { broadcast, joinRoom, leaveRoom } from "./broadcaster.js";

const PING_MIN_INTERVAL_MS = 5_000;
const REVALIDATION_INTERVAL_MS = 60_000;

function toHeaders(headers: FastifyRequest["headers"]): Headers {
	const result = new Headers();
	for (const [key, value] of Object.entries(headers)) {
		if (typeof value === "string") {
			result.set(key, value);
		} else if (Array.isArray(value)) {
			for (const item of value) result.append(key, item);
		}
	}
	return result;
}

export async function websocketHandler(
	socket: WebSocket,
	request: FastifyRequest,
): Promise<void> {
	if (request.headers.origin !== request.server.config.WEB_ORIGIN) {
		socket.close(4002, "Origin not allowed");
		return;
	}

	const url = new URL(request.url, "http://localhost");
	const projectId = url.searchParams.get("projectId");
	if (!projectId) {
		socket.close(4000, "projectId required");
		return;
	}
	if (!z.string().uuid().safeParse(projectId).success) {
		socket.close(4000, "projectId invalid");
		return;
	}

	let sessionUserId: string;
	try {
		const session = await request.server.auth.api.getSession({
			headers: toHeaders(request.headers),
		});
		if (!session) {
			socket.close(4001, "Session expired");
			return;
		}
		sessionUserId = session.user.id;
	} catch (error) {
		if (error instanceof UnauthorizedError) {
			socket.close(4001, "Session expired");
		} else {
			request.log.error(error);
			socket.close(1011, "Internal server error");
		}
		return;
	}

	let membership: { userId: string } | undefined;
	try {
		[membership] = await request.server.db
			.select({ userId: projectMember.userId })
			.from(projectMember)
			.where(
				and(
					eq(projectMember.projectId, projectId),
					eq(projectMember.userId, sessionUserId),
				),
			)
			.limit(1);
	} catch (error) {
		request.log.error(error);
		socket.close(1011, "Internal server error");
		return;
	}

	if (!membership) {
		socket.close(4003, "Not a project member");
		return;
	}

	joinRoom(projectId, socket);
	let lastPingAt = 0;

	// Revalidates session and membership without waiting for a client ping so
	// revoked access cannot linger on a silent connection.
	const revalidateConnection = async (): Promise<void> => {
		if (socket.readyState !== WebSocket.OPEN) return;
		const refreshed = await request.server.auth.api
			.getSession({ headers: toHeaders(request.headers) })
			.catch(() => null);
		if (!refreshed) {
			if (socket.readyState === WebSocket.OPEN) {
				try {
					socket.send(JSON.stringify({ type: "auth:expired" }));
				} catch (error) {
					request.log.error(error);
				}
			}
			socket.close(4001, "Session expired");
			return;
		}

		let stillMember: { userId: string } | undefined;
		try {
			[stillMember] = await request.server.db
				.select({ userId: projectMember.userId })
				.from(projectMember)
				.where(
					and(
						eq(projectMember.projectId, projectId),
						eq(projectMember.userId, refreshed.user.id),
					),
				)
				.limit(1);
		} catch (error) {
			request.log.error(error);
			socket.close(1011, "Internal server error");
			return;
		}
		if (!stillMember) {
			socket.close(4003, "Not a project member");
			return;
		}

		if (socket.readyState !== WebSocket.OPEN) return;
		try {
			socket.send(JSON.stringify({ type: "pong" }));
		} catch (error) {
			request.log.error(error);
			socket.close(1011, "Internal server error");
		}
	};

	const revalidationTimer = setInterval(() => {
		void revalidateConnection();
	}, REVALIDATION_INTERVAL_MS);

	socket.on("message", (data) => {
		void (async () => {
			let message: unknown;
			try {
				message = JSON.parse(data.toString());
			} catch {
				return;
			}
			if (typeof message !== "object" || message === null) return;
			if ((message as { type?: unknown }).type !== "ping") return;
			const now = Date.now();
			if (now - lastPingAt < PING_MIN_INTERVAL_MS) return;
			lastPingAt = now;
			await revalidateConnection();
		})();
	});

	socket.on("close", () => {
		clearInterval(revalidationTimer);
		leaveRoom(projectId, socket);
	});
}
