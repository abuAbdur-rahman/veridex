import { createRoute, lazyRouteComponent } from "@tanstack/react-router";
import { rootRoute } from "@/routes/__root";

export const TeamSettingsRoute = createRoute({
	getParentRoute: () => rootRoute,
	path: "/teams/$teamId/settings",
	component: lazyRouteComponent(
		() => import("@/routes/team-settings-view"),
		"TeamSettingsView",
	),
});
