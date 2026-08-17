import { useQuery, useQueryClient } from "@tanstack/react-query";
import { createRoute, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { ApiError } from "@/api/client";
import { acceptInvite, validateInvite } from "@/api/invites";
import { InviteAcceptScreen } from "@/components/screens/InviteAcceptScreen";
import { teamsQueryKey } from "@/queries/teams";
import { rootRoute } from "@/routes/__root";

export const InviteRoute = createRoute({
	getParentRoute: () => rootRoute,
	path: "/join/team/$token",
	component: InviteAcceptRoute,
});

function InviteAcceptRoute() {
	const { token } = InviteRoute.useParams();
	const navigate = useNavigate();
	const queryClient = useQueryClient();
	const [busy, setBusy] = useState(false);
	const [acceptError, setAcceptError] = useState("");
	const inviteQuery = useQuery({
		queryKey: ["invite", token, "validate"],
		queryFn: () => validateInvite(token),
		retry: false,
	});

	const validationError = inviteQuery.error instanceof ApiError ? inviteQuery.error : null;
	const state = inviteQuery.isPending
		? "loading"
		: validationError?.code === "INVITE_EXPIRED"
			? "expired"
			: validationError?.code === "INVITE_ACCEPTED"
				? "accepted"
				: inviteQuery.data
					? "valid"
					: "invalid";

	async function handleAccept() {
		setBusy(true);
		setAcceptError("");
		try {
			await acceptInvite(token);
			await queryClient.invalidateQueries({ queryKey: teamsQueryKey });
			void navigate({ to: "/dashboard" });
		} catch (error) {
			if (error instanceof ApiError && error.status === 401) {
				void navigate({ to: "/login", search: { redirect: `/join/team/${token}` } });
				return;
			}
			setAcceptError(error instanceof ApiError ? error.message : "Could not accept invite.");
			setBusy(false);
		}
	}

	return (
		<InviteAcceptScreen
			teamName={inviteQuery.data?.teamName ?? "Team"}
			inviteEmail={inviteQuery.data?.email}
			state={state}
			busy={busy}
			error={acceptError || validationError?.message}
			onAccept={() => void handleAccept()}
			onDecline={() => void navigate({ to: "/" })}
		/>
	);
}
