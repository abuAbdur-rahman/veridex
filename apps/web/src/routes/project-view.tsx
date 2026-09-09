import { ProjectHomeScreen } from "@/components/screens/ProjectHomeScreen";
import { ProjectRoute } from "@/routes/projects.$projectId";

export function ProjectRouteView() {
	const { projectId } = ProjectRoute.useParams();
	const { view, q, issue } = ProjectRoute.useSearch();
	return <ProjectHomeScreen projectId={projectId} view={view} query={q ?? ""} issueId={issue} />;
}
