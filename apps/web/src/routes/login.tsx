import { createRoute } from "@tanstack/react-router";
import { LoginScreen } from "@/components/screens/LoginScreen";
import { rootRoute } from "@/routes/__root";

interface LoginSearch {
	redirect?: string;
}

export const LoginRoute = createRoute({
	getParentRoute: () => rootRoute,
	path: "/login",
	validateSearch: (search: Record<string, unknown>): LoginSearch => ({
		...(typeof search.redirect === "string" &&
		search.redirect.startsWith("/join/team/") &&
		!search.redirect.startsWith("//")
			? { redirect: search.redirect }
			: {}),
	}),
	component: LoginRouteView,
});

function LoginRouteView() {
	const { redirect } = LoginRoute.useSearch();
	return <LoginScreen redirectTo={redirect} />;
}
