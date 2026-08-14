import { createRoute } from "@tanstack/react-router";
import { LoginScreen } from "@/components/screens/LoginScreen";
import { rootRoute } from "@/routes/__root";

export const LoginRoute = createRoute({
	getParentRoute: () => rootRoute,
	path: "/login",
	component: LoginScreen,
});