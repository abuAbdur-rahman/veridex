import { createRoute } from "@tanstack/react-router";
import { TeamSettingsScreen } from "@/components/screens/TeamSettingsScreen";
import { rootRoute } from "@/routes/__root";

export const TeamSettingsRoute = createRoute({
	getParentRoute: () => rootRoute,
	path: "/teams/$teamId/settings",
	component: TeamSettingsView,
});

function TeamSettingsView() {
	const { teamId } = TeamSettingsRoute.useParams();
	return <TeamSettingsScreen teamId={teamId} />;
}
