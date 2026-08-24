import { createRoute, lazyRouteComponent } from "@tanstack/react-router";
import { rootRoute } from "@/routes/__root";

const LazyProjectImportView = lazyRouteComponent(
	() => import("@/routes/project-import-view"),
	"ProjectImportView",
);

export const ProjectImportRoute = createRoute({
	getParentRoute: () => rootRoute,
	path: "/projects/$projectId/import",
	component: ProjectImportRouteView,
});

function ProjectImportRouteView() {
	const { projectId } = ProjectImportRoute.useParams();
	return <LazyProjectImportView projectId={projectId} />;
}
