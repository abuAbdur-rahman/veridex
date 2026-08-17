import { Plus, FolderKanban } from "lucide-react";
import { useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { PageHeader } from "@/components/app/PageHeader";
import { ProjectCard } from "@/components/app/ProjectCard";
import { EmptyState } from "@/components/app/EmptyState";
import {
	CreateProjectModal,
	type CreateProjectValues,
} from "@/components/screens/CreateProjectModal";
import { useWorkspaceTeam } from "@/components/app/workspace-team";
import { useMe } from "@/queries/session";
import { useCreateProject, useProjects } from "@/queries/projects";

export function DashboardScreen() {
	const navigate = useNavigate();
	const { data: me } = useMe();
	const { teamId: selectedTeamId } = useWorkspaceTeam();
	const team = me?.teams.find((item) => item.id === selectedTeamId) ?? me?.teams[0];
	const teamId = team?.id ?? "";
	const projectsQuery = useProjects(teamId);
	const createProject = useCreateProject(teamId);
	const [error, setError] = useState("");
	const [createOpen, setCreateOpen] = useState(false);
	const projects = projectsQuery.data ?? [];
	const canCreate = team?.teamRole === "owner" || team?.teamRole === "admin";

	async function handleSubmit(values: CreateProjectValues) {
		if (!teamId) return;
		setError("");
		try {
			const project = await createProject.mutateAsync(values);
			setCreateOpen(false);
			await navigate({ to: "/projects/$projectId", params: { projectId: project.id }, search: {} });
		} catch (value) {
			setError(value instanceof Error ? value.message : "Could not create project.");
		}
	}

	return (
		<div className="mx-auto w-full max-w-[1200px]">
			<PageHeader
				title="Projects"
				count={String(projects.length)}
				actions={
					canCreate ? (
						<button
							type="button"
							onClick={() => setCreateOpen(true)}
							className="inline-flex min-h-9 cursor-pointer items-center gap-2 rounded-lg border border-[var(--line)] bg-[var(--surface)] px-3.5 text-[13px] font-semibold text-[var(--ink)] transition-colors duration-150 hover:border-[var(--accent)] hover:text-[var(--accent)]"
						>
							<Plus className="size-4" aria-hidden="true" strokeWidth={1.5} />
							New Project
						</button>
					) : undefined
				}
			/>
			{projectsQuery.isPending ? (
				<p className="py-12 text-center text-sm text-[var(--ink-soft)]">Loading projects...</p>
			) : projectsQuery.isError ? (
				<EmptyState
					icon={FolderKanban}
					title="Projects could not load"
					description={projectsQuery.error.message}
				/>
			) : projects.length === 0 ? (
				<EmptyState
					icon={FolderKanban}
					title="No projects yet"
					description={
						canCreate
							? "Create a project to start tracking QA work."
							: "Ask a team administrator to add you to a project."
					}
				/>
			) : (
				<div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
					{projects.map((project) => (
						<ProjectCard key={project.id} project={project} />
					))}
				</div>
			)}
			<CreateProjectModal
				open={createOpen}
				pending={createProject.isPending}
				error={error}
				onClose={() => {
					setCreateOpen(false);
					setError("");
				}}
				onSubmit={handleSubmit}
			/>
		</div>
	);
}
