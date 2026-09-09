import { createRoute, lazyRouteComponent } from "@tanstack/react-router";
import { rootRoute } from "@/routes/__root";

export const DashboardRoute = createRoute({
	getParentRoute: () => rootRoute,
	path: "/dashboard",
	component: lazyRouteComponent(
		() => import("@/components/screens/DashboardScreen"),
		"DashboardScreen",
	),
});
