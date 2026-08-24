import { randomUUID } from "node:crypto";
import { WebSocket } from "ws";

export type ChangeSource = "web" | "mcp" | "import";

export type IssueStatus =
	| "backlog"
	| "in_progress"
	| "in_qa"
	| "verified"
	| "rejected";

/**
 * Events broadcast to every socket in a project room. The web client and any
 * MCP consumers receive the same payloads; each carries enough to reconcile a
 * local board without re-fetching the full issue list.
 */
export type WsEvent =
	| { type: "issue:created"; payload: { issueId: string; projectId: string } }
	| { type: "issue:updated"; payload: { issueId: string; projectId: string } }
	| {
			type: "issue:status_changed";
			payload: {
				issueId: string;
				projectId: string;
				toStatus: IssueStatus;
				source: ChangeSource;
			};
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
	  };

export const BROADCAST_CHANNEL = "veridex:ws-events";

interface BroadcastEnvelope {
	originId: string;
	event: WsEvent;
}

// Postgres NOTIFY payload cap is 8000 bytes. Events are tiny; this guard only
// protects against an unexpected oversize payload silently dropped by the bus.
const MAX_PAYLOAD_BYTES = 8000;

// Per-process identity so a server does not echo its own notifications back to
// its own sockets (which would duplicate deliveries within one instance).
const INSTANCE_ID = randomUUID();

type Publisher = (payload: string) => void | Promise<void>;
let publisher: Publisher | undefined;

const rooms = new Map<string, Set<WebSocket>>();

export function joinRoom(projectId: string, socket: WebSocket): void {
	let sockets = rooms.get(projectId);
	if (!sockets) {
		sockets = new Set();
		rooms.set(projectId, sockets);
	}
	sockets.add(socket);
}

export function leaveRoom(projectId: string, socket: WebSocket): void {
	const sockets = rooms.get(projectId);
	if (!sockets) return;
	sockets.delete(socket);
	if (sockets.size === 0) rooms.delete(projectId);
}

function deliverLocally(projectId: string, event: WsEvent): void {
	const sockets = rooms.get(projectId);
	if (!sockets || sockets.size === 0) return;
	const message = JSON.stringify(event);
	for (const socket of sockets) {
		if (socket.readyState === WebSocket.OPEN) {
			try {
				socket.send(message);
			} catch {
				// A socket that fails to send is treated as gone immediately;
				// a later close event may never arrive.
				leaveRoom(projectId, socket);
			}
		}
	}
}

export function broadcast(projectId: string, event: WsEvent): void {
	deliverLocally(projectId, event);
	if (!publisher) return;
	const envelope: BroadcastEnvelope = { originId: INSTANCE_ID, event };
	const payload = JSON.stringify(envelope);
	if (Buffer.byteLength(payload, "utf8") > MAX_PAYLOAD_BYTES) return;
	void publisher(payload);
}

export function attachBroadcastPublisher(fn: Publisher): void {
	publisher = fn;
}

export function detachBroadcastPublisher(): void {
	publisher = undefined;
}

export function handleRemoteBroadcast(raw: string): void {
	let envelope: BroadcastEnvelope;
	try {
		envelope = JSON.parse(raw) as BroadcastEnvelope;
	} catch {
		return;
	}
	if (!envelope || envelope.originId === INSTANCE_ID) return;
	if (!isWsEvent(envelope.event)) return;
	deliverLocally(envelope.event.payload.projectId, envelope.event);
}

function isWsEvent(value: unknown): value is WsEvent {
	if (typeof value !== "object" || value === null) return false;
	const candidate = value as { type?: unknown; payload?: unknown };
	if (typeof candidate.type !== "string") return false;
	if (
		typeof candidate.payload !== "object" ||
		candidate.payload === null ||
		typeof (candidate.payload as { projectId?: unknown }).projectId !== "string"
	) {
		return false;
	}
	return true;
}
