import { createRoute, lazyRouteComponent, Navigate } from "@tanstack/react-router";
import { rootRoute } from "@/routes/__root";

export const McpRoute = createRoute({
	getParentRoute: () => rootRoute,
	path: "/profile/mcp",
	component: lazyRouteComponent(() => import("@/components/screens/McpScreen"), "McpScreen"),
});

export const LegacyMcpRoute = createRoute({
	getParentRoute: () => rootRoute,
	path: "/settings/mcp",
	component: () => <Navigate to="/profile/mcp" replace />,
});
