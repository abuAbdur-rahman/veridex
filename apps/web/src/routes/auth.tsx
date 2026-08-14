import { createRoute, Navigate } from "@tanstack/react-router";
import { rootRoute } from "@/routes/__root";

export const AuthRoute = createRoute({
	getParentRoute: () => rootRoute,
	path: "/auth",
	component: () => <Navigate to="/login" replace />,
});
