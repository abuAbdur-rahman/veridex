import { createRoute } from "@tanstack/react-router";
import { MembersScreen } from "@/components/screens/MembersScreen";
import { rootRoute } from "@/routes/__root";

export const ProjectMembersRoute = createRoute({
	getParentRoute: () => rootRoute,
	path: "/projects/$projectId/members",
	component: ProjectMembersView,
});

function ProjectMembersView() {
	const { projectId } = ProjectMembersRoute.useParams();
	return <MembersScreen projectId={projectId} />;
}
