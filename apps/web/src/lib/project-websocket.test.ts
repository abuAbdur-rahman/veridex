import { QueryClient } from "@tanstack/react-query";
import { afterEach, describe, expect, it, vi } from "vitest";
import { connectProjectWebSocket } from "@/lib/project-websocket";

class FakeWebSocket {
	static OPEN = 1;
	url: string;
	readyState = FakeWebSocket.OPEN;
	listeners = new Map<string, (event: Event | MessageEvent) => void>();
	close = vi.fn();
	send = vi.fn();

	constructor(url: string) {
		this.url = url;
	}

	addEventListener(type: string, listener: (event: Event | MessageEvent) => void) {
		this.listeners.set(type, listener);
	}

	open() {
		this.listeners.get("open")?.(new Event("open"));
	}

	emit(value: unknown) {
		this.listeners.get("message")?.({ data: JSON.stringify(value) } as MessageEvent);
	}

	end() {
		this.readyState = 3;
		this.listeners.get("close")?.(new Event("close"));
	}
}

describe("project WebSocket", () => {
	afterEach(() => vi.unstubAllGlobals());

	it("invalidates project issue caches for issue events", () => {
		let socket: FakeWebSocket | undefined;
		vi.stubGlobal(
			"WebSocket",
			class extends FakeWebSocket {
				constructor(url: string) {
					super(url);
					socket = new FakeWebSocket(url);
					return socket;
				}
			},
		);
		const queryClient = new QueryClient();
		const invalidate = vi.spyOn(queryClient, "invalidateQueries");

		const disconnect = connectProjectWebSocket("project one", queryClient, vi.fn());
		socket?.open();
		socket?.emit({ type: "issue:updated", payload: { issueId: "i1", projectId: "project one" } });

		expect(socket?.url).toContain("projectId=project%20one");
		expect(invalidate).toHaveBeenCalledTimes(3);
		disconnect();
		expect(socket?.close).toHaveBeenCalledOnce();
	});

	it("reports expired sessions", () => {
		let socket: FakeWebSocket | undefined;
		vi.stubGlobal(
			"WebSocket",
			class extends FakeWebSocket {
				constructor(url: string) {
					super(url);
					socket = new FakeWebSocket(url);
					return socket;
				}
			},
		);
		const onAuthExpired = vi.fn();

		connectProjectWebSocket("p1", new QueryClient(), onAuthExpired);
		socket?.emit({ type: "auth:expired" });

		expect(onAuthExpired).toHaveBeenCalledOnce();
	});

	it("reconnects after a close and stops reconnecting after cleanup", () => {
		vi.useFakeTimers();
		const sockets: FakeWebSocket[] = [];
		vi.stubGlobal(
			"WebSocket",
			class extends FakeWebSocket {
				constructor(url: string) {
					super(url);
					sockets.push(this);
				}
			},
		);

		const disconnect = connectProjectWebSocket("p1", new QueryClient(), vi.fn());
		sockets[0]?.end();
		vi.advanceTimersByTime(1_000);
		expect(sockets).toHaveLength(2);

		disconnect();
		sockets[1]?.end();
		vi.advanceTimersByTime(30_000);
		expect(sockets).toHaveLength(2);
		vi.useRealTimers();
	});

	it("does not reset reconnect budget for unstable connections", () => {
		vi.useFakeTimers();
		const sockets: FakeWebSocket[] = [];
		vi.stubGlobal(
			"WebSocket",
			class extends FakeWebSocket {
				constructor(url: string) {
					super(url);
					sockets.push(this);
				}
			},
		);

		const disconnect = connectProjectWebSocket("p1", new QueryClient(), vi.fn());
		for (let attempt = 0; attempt < 5; attempt += 1) {
			sockets.at(-1)?.end();
			vi.advanceTimersByTime(Math.min(1_000 * 2 ** attempt, 30_000));
		}
		sockets.at(-1)?.end();
		vi.advanceTimersByTime(30_000);

		expect(sockets).toHaveLength(6);
		disconnect();
		vi.useRealTimers();
	});
});
