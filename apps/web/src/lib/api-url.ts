const rawApiUrl = (import.meta.env.VITE_API_URL as string | undefined)?.trim() ?? "";
export const API_BASE_URL = rawApiUrl.replace(/\/+$/, "");

export function apiUrl(path: string): string {
	if (!API_BASE_URL) return path;
	if (/^https?:\/\//i.test(path)) return path;
	return `${API_BASE_URL}${path.startsWith("/") ? path : `/${path}`}`;
}

const rawWsUrl = (import.meta.env.VITE_WS_URL as string | undefined)?.trim() ?? "";
const WS_BASE_URL_RAW = rawWsUrl.replace(/\/+$/, "");

function deriveWsBaseFromApi(apiBase: string): string {
	if (!apiBase) return "";
	try {
		const url = new URL(apiBase);
		url.protocol = url.protocol === "https:" ? "wss:" : "ws:";
		url.pathname = "";
		url.search = "";
		url.hash = "";
		return url.toString().replace(/\/+$/, "");
	} catch {
		if (apiBase.startsWith("https://")) return `wss://${apiBase.slice(8)}`;
		if (apiBase.startsWith("http://")) return `ws://${apiBase.slice(7)}`;
		return apiBase;
	}
}

export const WS_BASE_URL =
	WS_BASE_URL_RAW || deriveWsBaseFromApi(API_BASE_URL);

export function wsUrl(path: string): string {
	if (/^wss?:\/\//i.test(path)) return path;
	if (WS_BASE_URL) return `${WS_BASE_URL}${path.startsWith("/") ? path : `/${path}`}`;
	if (typeof window !== "undefined") {
		const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
		return `${protocol}//${window.location.host}${path.startsWith("/") ? path : `/${path}`}`;
	}
	return path;
}

const rawMcpUrl = (import.meta.env.VITE_MCP_URL as string | undefined)?.trim() ?? "";
export function resolveMcpUrl(): string | undefined {
	if (rawMcpUrl) return rawMcpUrl;
	if (API_BASE_URL) return apiUrl("/mcp");
	return undefined;
}
