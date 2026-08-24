import { createRoute, lazyRouteComponent } from "@tanstack/react-router";
import { rootRoute } from "@/routes/__root";
import type { RoleView } from "@/lib/veridex-types";

interface ProjectSearch {
	view?: RoleView;
	q?: string;
	issue?: string;
}

const projectSearchDefaults: ProjectSearch = {};

function validateProjectSearch(input: Record<string, unknown>): ProjectSearch {
	const view = input.view;
	const q = typeof input.q === "string" ? input.q.slice(0, 100) : undefined;
	const issue = typeof input.issue === "string" ? input.issue : undefined;
	if (view === "dev" || view === "qa" || view === "tester" || view === "all") {
		return { view, q, issue };
	}
	return { ...projectSearchDefaults, q, issue };
}

export const ProjectRoute = createRoute({
	getParentRoute: () => rootRoute,
	path: "/projects/$projectId",
	validateSearch: validateProjectSearch,
	component: lazyRouteComponent(
		() => import("@/routes/project-view"),
		"ProjectRouteView",
	),
});
