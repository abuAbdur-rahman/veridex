import { TeamSettingsScreen } from "@/components/screens/TeamSettingsScreen";
import { TeamSettingsRoute } from "@/routes/teams.$teamId.settings";

export function TeamSettingsView() {
	const { teamId } = TeamSettingsRoute.useParams();
	return <TeamSettingsScreen teamId={teamId} />;
}
