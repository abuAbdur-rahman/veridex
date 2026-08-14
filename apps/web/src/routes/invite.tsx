import { createRoute, useNavigate } from "@tanstack/react-router";
import { InviteAcceptScreen } from "@/components/screens/InviteAcceptScreen";
import { rootRoute } from "@/routes/__root";
import { useDemoStore } from "@/lib/demo-store";

export const InviteRoute = createRoute({
	getParentRoute: () => rootRoute,
	path: "/join/team/$token",
	component: InviteAcceptRoute,
});

function InviteAcceptRoute() {
	const { token } = InviteRoute.useParams();
	const navigate = useNavigate();
	const teams = useDemoStore((state) => state.teams);
	const setCurrentTeam = useDemoStore((state) => state.setCurrentTeam);
	const teamId = token.startsWith("vrx_invite_") ? token.slice("vrx_invite_".length) : "";
	const team = teams.find((item) => item.id === teamId);
	return <InviteAcceptScreen
		teamName={team?.name ?? "Unknown team"}
		invitedBy="sarah@acme.com"
		state={team ? "valid" : "invalid"}
		onAccept={() => {
			if (!team) return;
			setCurrentTeam(team.id);
			void navigate({ to: "/dashboard" });
		}}
		onDecline={() => void navigate({ to: "/dashboard" })}
	/>;
}
