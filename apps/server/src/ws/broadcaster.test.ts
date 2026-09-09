import { afterEach, describe, expect, it } from "vitest";
import { WebSocket } from "ws";
import {
	attachBroadcastPublisher,
	broadcast,
	detachBroadcastPublisher,
	handleRemoteBroadcast,
	joinRoom,
	leaveRoom,
	type WsEvent,
} from "./broadcaster.js";

describe("broadcaster", () => {
	it("broadcast sends the same stringified payload only to OPEN sockets", () => {
		const sent: string[] = [];
		const makeSocket = (open: boolean) => {
			const ws = {
				readyState: open ? WebSocket.OPEN : WebSocket.CLOSED,
				send: (msg: string) => sent.push(msg),
			} as unknown as WebSocket;
			return ws;
		};
		const openSocket = makeSocket(true);
		const closedSocket = makeSocket(false);
		const brokenSocket = {
			readyState: WebSocket.OPEN,
			send: () => {
				throw new Error("nope");
			},
		} as unknown as WebSocket;

		joinRoom("p1", openSocket);
		joinRoom("p1", closedSocket);
		joinRoom("p1", brokenSocket);

		const event: WsEvent = {
			type: "issue:created",
			payload: { issueId: "i1", projectId: "p1" },
		};
		broadcast("p1", event);

		expect(sent).toHaveLength(1);
		expect(sent[0]).toBe(JSON.stringify(event));

		const sent2: string[] = [];
		openSocket.send = (msg: string) => sent2.push(msg);
		broadcast("missing", event);
		expect(sent2).toHaveLength(0);

		leaveRoom("p1", openSocket);
		leaveRoom("p1", closedSocket);
		leaveRoom("p1", brokenSocket);
	});

	it("broadcast removes a socket whose send fails and deletes the empty room", () => {
		const sent: string[] = [];
		const healthy = {
			readyState: WebSocket.OPEN,
			send: (msg: string) => sent.push(msg),
		} as unknown as WebSocket;
		const broken = {
			readyState: WebSocket.OPEN,
			send: () => {
				throw new Error("nope");
			},
		} as unknown as WebSocket;

		joinRoom("p2", healthy);
		joinRoom("p2", broken);

		broadcast("p2", {
			type: "comment:created",
			payload: { commentId: "c1", issueId: "i1", projectId: "p2" },
		});
		expect(sent).toHaveLength(1);

		sent.length = 0;
		broadcast("p2", { type: "issue:created", payload: { issueId: "i1", projectId: "p2" } });
		expect(sent).toHaveLength(1);

		leaveRoom("p2", healthy);
	});
});

describe("broadcaster cross-instance envelope", () => {
	afterEach(() => {
		detachBroadcastPublisher();
	});

	it("handleRemoteBroadcast delivers a foreign-instance envelope to local sockets", () => {
		const sent: string[] = [];
		const socket = {
			readyState: WebSocket.OPEN,
			send: (msg: string) => sent.push(msg),
		} as unknown as WebSocket;
		joinRoom("p-x", socket);

		const event: WsEvent = {
			type: "issue:created",
			payload: { issueId: "i1", projectId: "p-x" },
		};
		handleRemoteBroadcast(
			JSON.stringify({ originId: "other-instance", event }),
		);

		expect(sent).toHaveLength(1);
		expect(sent[0]).toBe(JSON.stringify(event));

		leaveRoom("p-x", socket);
	});

	it("handleRemoteBroadcast ignores malformed or non-event payloads", () => {
		const sent: string[] = [];
		const socket = {
			readyState: WebSocket.OPEN,
			send: (msg: string) => sent.push(msg),
		} as unknown as WebSocket;
		joinRoom("p-y", socket);

		handleRemoteBroadcast("not-json");
		handleRemoteBroadcast(JSON.stringify({ originId: "x", event: { type: "weird" } }));
		handleRemoteBroadcast(
			JSON.stringify({ originId: "x", event: { payload: { projectId: 5 } } }),
		);

		expect(sent).toHaveLength(0);

		leaveRoom("p-y", socket);
	});

	it("attached publisher gets the envelope and own-instance is skipped on re-delivery", () => {
		const sent: string[] = [];
		const socket = {
			readyState: WebSocket.OPEN,
			send: (msg: string) => sent.push(msg),
		} as unknown as WebSocket;
		joinRoom("p-z", socket);

		const published: string[] = [];
		attachBroadcastPublisher((payload) => {
			published.push(payload);
		});

		const event: WsEvent = {
			type: "issue:status_changed",
			payload: {
				issueId: "i1",
				projectId: "p-z",
				toStatus: "in_qa",
				source: "mcp",
			},
		};
		broadcast("p-z", event);

		// Local delivery happened exactly once.
		expect(sent).toHaveLength(1);
		// The publisher received exactly one envelope with our origin id.
		expect(published).toHaveLength(1);

		// Feeding the exact envelope back must be skipped (same originId).
		handleRemoteBroadcast(published[0]);
		expect(sent).toHaveLength(1);

		// Detaching the publisher stops further publishing.
		detachBroadcastPublisher();
		published.length = 0;
		broadcast("p-z", event);
		expect(published).toHaveLength(0);

		leaveRoom("p-z", socket);
	});
});
