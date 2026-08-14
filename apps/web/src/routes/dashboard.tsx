import { createRoute } from "@tanstack/react-router";
import { DashboardScreen } from "@/components/screens/DashboardScreen";
import { rootRoute } from "@/routes/__root";

export const DashboardRoute = createRoute({
	getParentRoute: () => rootRoute,
	path: "/dashboard",
	component: DashboardScreen,
});