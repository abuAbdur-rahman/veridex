import {
	createRootRoute,
	createRoute,
	createRouter,
	Outlet,
} from "@tanstack/react-router";
import { AuthPage } from "@/routes/auth";
import { LandingPage } from "@/routes/index";

const rootRoute = createRootRoute({ component: Outlet });
const indexRoute = createRoute({
	getParentRoute: () => rootRoute,
	path: "/",
	component: LandingPage,
});
const authRoute = createRoute({
	getParentRoute: () => rootRoute,
	path: "/auth",
	component: AuthPage,
});
const routeTree = rootRoute.addChildren([indexRoute, authRoute]);

export const router = createRouter({ routeTree });

declare module "@tanstack/react-router" {
	interface Register {
		router: typeof router;
	}
}
