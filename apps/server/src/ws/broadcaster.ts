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

// In-memory room registry. Single-instance only — see backend spec §3 scaling
// limit. Swap to Postgres LISTEN/NOTIFY over the pg-boss connection for
// multi-instance without changing this module's public surface.
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

export function broadcast(projectId: string, event: WsEvent): void {
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
