import { createRoute, Navigate } from "@tanstack/react-router";
import { SettingsScreen } from "@/components/screens/SettingsScreen";
import { rootRoute } from "@/routes/__root";

export const SettingsRoute = createRoute({
	getParentRoute: () => rootRoute,
	path: "/profile/settings",
	component: SettingsView,
});

function SettingsView() {
	return <SettingsScreen />;
}

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
