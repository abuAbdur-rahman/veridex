import { createRoute, Navigate } from "@tanstack/react-router";
import { McpScreen } from "@/components/screens/McpScreen";
import { rootRoute } from "@/routes/__root";

export const McpRoute = createRoute({
	getParentRoute: () => rootRoute,
	path: "/profile/mcp",
	component: McpView,
});

function McpView() {
	return <McpScreen />;
}

export const LegacyMcpRoute = createRoute({
	getParentRoute: () => rootRoute,
	path: "/settings/mcp",
	component: () => <Navigate to="/profile/mcp" replace />,
});
