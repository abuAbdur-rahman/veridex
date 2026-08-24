import { afterEach, describe, expect, it, vi } from "vitest";

const h = vi.hoisted(() => {
	const listenMock = vi.fn();
	const notifyMock = vi.fn();
	const endMock = vi.fn();
	const sqlFactory = vi.fn(() => ({
		listen: (...args: unknown[]) => listenMock(...args),
		notify: (...args: unknown[]) => notifyMock(...args),
		end: (...args: unknown[]) => endMock(...args),
	}));
	return { listenMock, notifyMock, endMock, sqlFactory };
});

vi.mock("postgres", () => ({ default: h.sqlFactory }));

import { createPostgresEventBus } from "./event-bus.js";

afterEach(() => {
	h.listenMock.mockClear();
	h.notifyMock.mockClear();
	h.endMock.mockClear();
});

describe("createPostgresEventBus", () => {
	it("LISTENs on the given channel at startup", async () => {
		await createPostgresEventBus("postgresql://x", {
			channel: "c1",
			onPayload: () => {},
		});
		expect(h.listenMock).toHaveBeenCalledWith("c1", expect.any(Function));
	});

	it("routes incoming NOTIFY payloads to onPayload", async () => {
		const onPayload = vi.fn();
		await createPostgresEventBus("postgresql://x", {
			channel: "c1",
			onPayload,
		});
		const cb = h.listenMock.mock.calls[0][1] as (payload: string) => void;
		cb("hello");
		expect(onPayload).toHaveBeenCalledWith("hello");
	});

	it("publishes via NOTIFY with the channel and payload", async () => {
		const bus = await createPostgresEventBus("postgresql://x", {
			channel: "c1",
			onPayload: () => {},
		});
		await bus.publish("payload-1");
		expect(h.notifyMock).toHaveBeenCalledWith("c1", "payload-1");
	});

	it("forwards listener errors to onError without surfacing them", async () => {
		const onPayload = vi.fn(() => {
			throw new Error("boom");
		});
		const onError = vi.fn();
		await createPostgresEventBus("postgresql://x", {
			channel: "c1",
			onPayload,
			onError,
		});
		const cb = h.listenMock.mock.calls[0][1] as (payload: string) => void;
		cb("x");
		expect(onPayload).toHaveBeenCalled();
		expect(onError).toHaveBeenCalled();
	});

	it("close() ends the dedicated connection", async () => {
		const bus = await createPostgresEventBus("postgresql://x", {
			channel: "c1",
			onPayload: () => {},
		});
		await bus.close();
		expect(h.endMock).toHaveBeenCalledWith({ timeout: 5 });
	});
});
