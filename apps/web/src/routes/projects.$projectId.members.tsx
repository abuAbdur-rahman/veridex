import { createRoute, lazyRouteComponent } from "@tanstack/react-router";
import { rootRoute } from "@/routes/__root";

export const ProjectMembersRoute = createRoute({
	getParentRoute: () => rootRoute,
	path: "/projects/$projectId/members",
	component: lazyRouteComponent(
		() => import("@/routes/project-members-view"),
		"ProjectMembersView",
	),
});
