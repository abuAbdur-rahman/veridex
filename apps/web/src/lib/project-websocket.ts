import type { QueryClient } from "@tanstack/react-query";
import { wsUrl } from "@/lib/api-url";
import { issueCommentsQueryKey, issueHistoryQueryKey, issueQueryKey, issuesQueryKey } from "@/queries/issues";

export type ProjectSocketEvent =
	| { type: "issue:created"; payload: { issueId: string; projectId: string } }
	| { type: "issue:updated"; payload: { issueId: string; projectId: string } }
	| {
			type: "issue:status_changed";
			payload: { issueId: string; projectId: string; toStatus: string; source: string };
	  }
	| { type: "issue:assigned"; payload: { issueId: string; projectId: string } }
	| { type: "issue:deleted"; payload: { issueId: string; projectId: string } }
	| {
			type: "comment:created";
			payload: { commentId: string; issueId: string; projectId: string };
	  }
	| {
			type: "comment:updated";
			payload: { commentId: string; issueId: string; projectId: string };
	  }
	| {
			type: "comment:deleted";
			payload: { commentId: string; issueId: string; projectId: string };
	  }
	| { type: "auth:expired" };

const MAX_RECONNECT_ATTEMPTS = 5;
const RECONNECT_BASE_DELAY = 1_000;
const RECONNECT_MAX_DELAY = 30_000;
const STABLE_CONNECTION_MS = 10_000;

function websocketUrl(projectId: string) {
	return wsUrl(`/ws?projectId=${encodeURIComponent(projectId)}`);
}

export function connectProjectWebSocket(
	projectId: string,
	queryClient: QueryClient,
	onAuthExpired: () => void,
) {
	if (typeof WebSocket === "undefined") return () => undefined;

	let socket: WebSocket | undefined;
	let reconnectTimer: number | undefined;
	let reconnectAttempts = 0;
	let disposed = false;
	let sessionExpired = false;
	let keepAlive: number | undefined;
	let stableConnectionTimer: number | undefined;

	const refresh = (issueId: string) => {
		void queryClient.invalidateQueries({ queryKey: issuesQueryKey(projectId) });
		void queryClient.invalidateQueries({ queryKey: issueQueryKey(projectId, issueId) });
		void queryClient.invalidateQueries({ queryKey: issueHistoryQueryKey(projectId, issueId) });
	};

	const clearKeepAlive = () => {
		if (keepAlive !== undefined) {
			window.clearInterval(keepAlive);
			keepAlive = undefined;
		}
	};

	const clearStableConnectionTimer = () => {
		if (stableConnectionTimer !== undefined) {
			window.clearTimeout(stableConnectionTimer);
			stableConnectionTimer = undefined;
		}
	};

	const scheduleReconnect = () => {
		if (disposed || sessionExpired || reconnectAttempts >= MAX_RECONNECT_ATTEMPTS) return;
		reconnectAttempts += 1;
		const delay = Math.min(
			RECONNECT_BASE_DELAY * 2 ** (reconnectAttempts - 1),
			RECONNECT_MAX_DELAY,
		);
		reconnectTimer = window.setTimeout(() => {
			reconnectTimer = undefined;
			openSocket();
		}, delay);
	};

	function openSocket() {
		if (disposed || sessionExpired) return;
		socket = new WebSocket(websocketUrl(projectId));
		socket.addEventListener("open", () => {
			clearStableConnectionTimer();
			stableConnectionTimer = window.setTimeout(() => {
				reconnectAttempts = 0;
				stableConnectionTimer = undefined;
			}, STABLE_CONNECTION_MS);
			clearKeepAlive();
			keepAlive = window.setInterval(() => {
				if (socket?.readyState === WebSocket.OPEN) {
					socket.send(JSON.stringify({ type: "ping" }));
				}
			}, 30_000);
		});
		socket.addEventListener("message", (event) => {
			try {
				const value: unknown = JSON.parse(String(event.data));
				if (!value || typeof value !== "object" || !("type" in value)) return;
				const type = value.type;
				if (type === "auth:expired") {
					sessionExpired = true;
					onAuthExpired();
				}
				if (
					typeof type === "string" &&
					type.startsWith("issue:") &&
					"payload" in value &&
					value.payload &&
					typeof value.payload === "object" &&
					"issueId" in value.payload &&
					typeof value.payload.issueId === "string"
				) {
					refresh(value.payload.issueId);
				}
				if (
					typeof type === "string" &&
					type.startsWith("comment:") &&
					"payload" in value &&
					value.payload &&
					typeof value.payload === "object" &&
					"issueId" in value.payload &&
					typeof value.payload.issueId === "string"
				) {
					void queryClient.invalidateQueries({
						queryKey: issueCommentsQueryKey(projectId, value.payload.issueId),
					});
				}
			} catch {
				// Ignore malformed messages from a peer; the next query remains authoritative.
			}
		});
		socket.addEventListener("close", () => {
			clearStableConnectionTimer();
			clearKeepAlive();
			scheduleReconnect();
		});
	}

	openSocket();

	return () => {
		disposed = true;
		clearKeepAlive();
		clearStableConnectionTimer();
		if (reconnectTimer !== undefined) window.clearTimeout(reconnectTimer);
		socket?.close();
	};
}
