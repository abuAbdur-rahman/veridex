import { createRootRoute, Outlet } from "@tanstack/react-router";
import { RootLayout } from "@/components/app/AppShell";

function RootView() {
	return <RootLayout><Outlet /></RootLayout>;
}

export const rootRoute = createRootRoute({ component: RootView });
