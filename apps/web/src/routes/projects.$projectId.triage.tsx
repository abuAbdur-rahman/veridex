import { createRoute } from "@tanstack/react-router";
import { Navigate } from "@tanstack/react-router";
import { rootRoute } from "@/routes/__root";

export const ProjectTriageRoute = createRoute({
	getParentRoute: () => rootRoute,
	path: "/projects/$projectId/triage",
	component: ProjectTriageView,
});

function ProjectTriageView() {
	const { projectId } = ProjectTriageRoute.useParams();
	return (
		<Navigate to="/projects/$projectId" params={{ projectId }} search={{ view: "qa" }} replace />
	);
}
