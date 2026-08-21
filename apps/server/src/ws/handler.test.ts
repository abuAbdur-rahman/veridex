import Fastify from "fastify";
import type { FastifyInstance } from "fastify";
import type { Database } from "../db/client.js";
import type { createAuth } from "../auth/index.js";
import type { Environment } from "../config.js";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { WebSocket } from "ws";
import { websocketPlugin } from "../plugins/websocket.js";
import { joinRoom, leaveRoom, broadcast } from "./broadcaster.js";

const { joinRoom: joinRoomMock, leaveRoom: leaveRoomMock, broadcast: broadcastMock } = vi.hoisted(
	() => ({
		joinRoom: vi.fn(),
		leaveRoom: vi.fn(),
		broadcast: vi.fn(),
	}),
);
vi.mock("./broadcaster.js", () => ({
	joinRoom: joinRoomMock,
	leaveRoom: leaveRoomMock,
	broadcast: broadcastMock,
}));

const apps: FastifyInstance[] = [];
let getSession: ReturnType<typeof vi.fn>;

async function createServer(overrides: { membership?: boolean; dbError?: boolean } = {}) {
	getSession = vi.fn().mockResolvedValue({ user: { id: "u1" } });
	const app = Fastify({ logger: false });
	app.decorate("auth", { api: { getSession } } as unknown as ReturnType<typeof createAuth>);
	app.decorate("db", {
		select: vi.fn().mockReturnValue({
			from: vi.fn().mockReturnValue({
				where: vi.fn().mockReturnValue({
					limit: vi
						.fn()
						.mockImplementation(() =>
							overrides.dbError
								? Promise.reject(new Error("database unavailable"))
										: Promise.resolve(
												overrides.membership === false ? [] : [{ userId: "u1" }],
											),
						),
				}),
					}),
			}),
		} as unknown as Database);
	app.decorate("config", { WEB_ORIGIN: "http://localhost:5173" } as Environment);
	await app.register(websocketPlugin);
	await app.listen({ port: 0, host: "127.0.0.1" });
	const address = app.server.address();
	const port = typeof address === "object" && address ? address.port : 0;
	return { app, port };
}

function connect(port: number, path: string) {
	return new WebSocket(`ws://127.0.0.1:${port}${path}`, {
		headers: { Origin: "http://localhost:5173" },
	});
}

function connectWithOrigin(port: number, path: string, origin: string) {
	return new WebSocket(`ws://127.0.0.1:${port}${path}`, {
		headers: { Origin: origin },
	});
}

function nextMessage(socket: WebSocket): Promise<string> {
	return new Promise((resolve, reject) => {
		socket.once("message", (data) => resolve(data.toString()));
		socket.once("error", reject);
	});
}

function closedWith(socket: WebSocket): Promise<number> {
	return new Promise((resolve) => {
		socket.once("close", (code) => resolve(code));
	});
}

beforeEach(() => {
	vi.clearAllMocks();
});

afterEach(async () => {
	await Promise.all(apps.splice(0).map((app) => app.close()));
});

describe("websocket handler", () => {
	it("closes 4000 when projectId is missing", async () => {
		const { app, port } = await createServer();
		apps.push(app);
		const socket = connect(port, "/ws");
		const code = await closedWith(socket);
		expect(code).toBe(4000);
	});

	it("closes 4002 for a disallowed origin", async () => {
		const { app, port } = await createServer();
		apps.push(app);
		const socket = connectWithOrigin(port, "/ws?projectId=a1b2c3d4-0000-4000-8000-000000000001", "https://untrusted.example");
		const code = await closedWith(socket);
		expect(code).toBe(4002);
		expect(getSession).not.toHaveBeenCalled();
	});

	it("closes 4000 for a malformed projectId", async () => {
		const { app, port } = await createServer();
		apps.push(app);
		const socket = connect(port, "/ws?projectId=not-a-uuid");
		const code = await closedWith(socket);
		expect(code).toBe(4000);
		expect(getSession).not.toHaveBeenCalled();
	});

	it("closes 4003 when the user is not a project member", async () => {
		const { app, port } = await createServer({ membership: false });
		apps.push(app);
		const socket = connect(port, "/ws?projectId=a1b2c3d4-0000-4000-8000-000000000001");
		const code = await closedWith(socket);
		expect(code).toBe(4003);
	});

	it("closes 1011 when membership lookup fails", async () => {
		const { app, port } = await createServer({ dbError: true });
		apps.push(app);
		const socket = connect(port, "/ws?projectId=a1b2c3d4-0000-4000-8000-000000000001");
		const code = await closedWith(socket);
		expect(code).toBe(1011);
	});

	it("joins the room and answers a ping with pong", async () => {
		const { app, port } = await createServer();
		apps.push(app);
		const socket = connect(port, "/ws?projectId=a1b2c3d4-0000-4000-8000-000000000001");
		await new Promise<void>((resolve) => socket.once("open", () => resolve()));
		expect(joinRoomMock).toHaveBeenCalledWith("a1b2c3d4-0000-4000-8000-000000000001", expect.anything());

		socket.send(JSON.stringify({ type: "ping" }));
		const message = await nextMessage(socket);
		expect(JSON.parse(message)).toEqual({ type: "pong" });

		socket.close();
		const code = await closedWith(socket);
		expect(code).toBe(1005);
		expect(leaveRoomMock).toHaveBeenCalledWith("a1b2c3d4-0000-4000-8000-000000000001", expect.anything());
	});

	it("sends auth:expired and closes 4001 when the session lapses", async () => {
		const { app, port } = await createServer();
		apps.push(app);
		const socket = connect(port, "/ws?projectId=a1b2c3d4-0000-4000-8000-000000000001");
		await new Promise<void>((resolve) => socket.once("open", () => resolve()));
		getSession.mockResolvedValueOnce(null);

		socket.send(JSON.stringify({ type: "ping" }));
		const message = await nextMessage(socket);
		expect(JSON.parse(message)).toEqual({ type: "auth:expired" });

		const code = await closedWith(socket);
		expect(code).toBe(4001);
	});

	it("closes 4003 when membership disappears during a ping", async () => {
		const { app, port } = await createServer();
		apps.push(app);
		const socket = connect(port, "/ws?projectId=a1b2c3d4-0000-4000-8000-000000000001");
		await new Promise<void>((resolve) => socket.once("open", () => resolve()));
		const select = app.db.select as ReturnType<typeof vi.fn>;
		select.mockReturnValueOnce({
			from: vi.fn().mockReturnValue({
				where: vi.fn().mockReturnValue({
					limit: vi.fn().mockResolvedValue([]),
				}),
			}),
		});

		socket.send(JSON.stringify({ type: "ping" }));
		expect(await closedWith(socket)).toBe(4003);
	});
});
