import { createRoute } from "@tanstack/react-router";
import { OnboardingScreen } from "@/components/screens/OnboardingScreen";
import { rootRoute } from "@/routes/__root";

export const OnboardingRoute = createRoute({
	getParentRoute: () => rootRoute,
	path: "/onboarding",
	component: OnboardingScreen,
});
