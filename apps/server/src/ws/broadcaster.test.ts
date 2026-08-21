import { describe, expect, it } from "vitest";
import { WebSocket } from "ws";
import { broadcast, joinRoom, leaveRoom, type WsEvent } from "./broadcaster.js";

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
});
