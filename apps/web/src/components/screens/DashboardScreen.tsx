import { Plus } from "lucide-react";
import { useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { PageHeader } from "@/components/app/PageHeader";
import { ProjectCard } from "@/components/app/ProjectCard";
import { useDemoStore } from "@/lib/demo-store";

export function DashboardScreen() {
	const navigate = useNavigate();
	const allProjects = useDemoStore((state) => state.projects);
	const currentTeamId = useDemoStore((state) => state.currentTeamId);
	const createProject = useDemoStore((state) => state.createProject);
	const [creating, setCreating] = useState(false);
	const projects = allProjects.filter((project) => project.teamId === currentTeamId);
	function handleCreate() {
		const name = window.prompt("Project name");
		if (!name) return;
		setCreating(true);
		const result = createProject({ name });
		setCreating(false);
		if (result.ok) void navigate({ to: "/projects/$projectId", params: { projectId: result.value.id }, search: {} });
	}
	return (
		<div className="mx-auto w-full max-w-[1200px]">
			<PageHeader
				title="Projects"
				count={String(projects.length)}
				actions={
					<button
						type="button"
						onClick={handleCreate}
						disabled={creating}
						className="inline-flex min-h-9 cursor-pointer items-center gap-2 rounded-lg border border-[var(--line)] bg-[var(--surface)] px-3.5 text-[13px] font-semibold text-[var(--ink)] transition-colors duration-150 hover:border-[var(--accent)] hover:text-[var(--accent)]"
					>
						<Plus className="size-4" aria-hidden="true" strokeWidth={1.5} />
						{creating ? "Creating..." : "New Project"}
					</button>
				}
			/>
			<div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
				{projects.map((project) => (
					<ProjectCard key={project.id} project={project} />
				))}
			</div>
		</div>
	);
}
