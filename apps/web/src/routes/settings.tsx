import { createRoute, lazyRouteComponent, Navigate } from "@tanstack/react-router";
import { rootRoute } from "@/routes/__root";

export const SettingsRoute = createRoute({
	getParentRoute: () => rootRoute,
	path: "/profile/settings",
	component: lazyRouteComponent(
		() => import("@/components/screens/SettingsScreen"),
		"SettingsScreen",
	),
});

export const LegacySettingsRoute = createRoute({
	getParentRoute: () => rootRoute,
	path: "/settings",
	component: () => <Navigate to="/profile/settings" replace />,
});

export const ProfileRoute = createRoute({
	getParentRoute: () => rootRoute,
	path: "/profile",
	component: () => <Navigate to="/profile/settings" replace />,
});
