import { MembersScreen } from "@/components/screens/MembersScreen";
import { ProjectMembersRoute } from "@/routes/projects.$projectId.members";

export function ProjectMembersView() {
	const { projectId } = ProjectMembersRoute.useParams();
	return <MembersScreen projectId={projectId} />;
}
