import { createRouter } from "@tanstack/react-router";
import { RoutePending } from "@/components/app/RoutePending";
import { rootRoute } from "@/routes/__root";
import { IndexRoute } from "@/routes/index";
import { AuthRoute } from "@/routes/auth";
import { LoginRoute } from "@/routes/login";
import { InviteRoute } from "@/routes/invite";
import { OnboardingRoute } from "@/routes/onboarding";
import { DashboardRoute } from "@/routes/dashboard";
import { ProjectRoute } from "@/routes/projects.$projectId";
import { ProjectTriageRoute } from "@/routes/projects.$projectId.triage";
import { ProjectMembersRoute } from "@/routes/projects.$projectId.members";
import { ProjectImportRoute } from "@/routes/projects.$projectId.import";
import { TeamSettingsRoute } from "@/routes/teams.$teamId.settings";
import { LegacySettingsRoute, ProfileRoute, SettingsRoute } from "@/routes/settings";
import { LegacyMcpRoute, McpRoute } from "@/routes/settings.mcp";
import { queryClient } from "@/lib/query-client";

const routeTree = rootRoute.addChildren([
	IndexRoute,
	AuthRoute,
	LoginRoute,
	InviteRoute,
	OnboardingRoute,
	DashboardRoute,
	ProjectRoute,
	ProjectTriageRoute,
	ProjectMembersRoute,
	ProjectImportRoute,
	TeamSettingsRoute,
	SettingsRoute,
	ProfileRoute,
	LegacySettingsRoute,
	McpRoute,
	LegacyMcpRoute,
]);

export const router = createRouter({
	routeTree,
	context: { queryClient },
	defaultPendingComponent: RoutePending,
	defaultPendingMs: 200,
	defaultPendingMinMs: 200,
});

declare module "@tanstack/react-router" {
	interface Register {
		router: typeof router;
	}
}
