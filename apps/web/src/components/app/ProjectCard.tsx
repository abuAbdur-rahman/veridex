import { ArrowRight, EllipsisVertical, FolderKanban, Trash2 } from "lucide-react";
import { Link } from "@tanstack/react-router";
import type { ServerProject } from "@/api/projects";
import { RoleBadge } from "@/components/app/EmptyState";
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

interface ProjectCardProps {
	project: ServerProject;
	onDelete: (project: ServerProject) => void;
}

export function ProjectCard({ project, onDelete }: ProjectCardProps) {
	const role = project.projectRole ?? "dev";
	return (
		<div className="group relative flex flex-col gap-3 rounded-[10px] border border-[var(--line)] bg-[var(--surface)] p-5 transition-colors duration-150 hover:border-[var(--accent)]">
			<Link
				to="/projects/$projectId"
				params={{ projectId: project.id }}
				className="absolute inset-0 rounded-[10px] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--accent)]"
				aria-label={`Open ${project.name}`}
			/>
			<div className="flex items-start justify-between gap-2">
				<FolderKanban
					className="size-5 text-[var(--ink-soft)]"
					aria-hidden="true"
					strokeWidth={1.5}
				/>
				<div className="relative z-10 flex items-center gap-1">
					<RoleBadge role={role} />
					{project.projectRole === "admin" ? (
						<DropdownMenu>
							<DropdownMenuTrigger
								aria-label={`Actions for ${project.name}`}
								className="grid size-8 place-items-center rounded-md text-[var(--ink-soft)] hover:bg-[var(--bg-alt)] hover:text-[var(--ink)]"
							>
								<EllipsisVertical className="size-4" aria-hidden="true" />
							</DropdownMenuTrigger>
							<DropdownMenuContent align="end" className="min-w-[150px]">
								<DropdownMenuItem variant="destructive" onClick={() => onDelete(project)}>
									<Trash2 /> Delete project
								</DropdownMenuItem>
							</DropdownMenuContent>
						</DropdownMenu>
					) : null}
				</div>
			</div>
			<h3 className="text-[15px] font-semibold text-[var(--ink)]">{project.name}</h3>
			<div className="mt-auto flex items-center justify-between">
				<p className="text-[13px] text-[var(--ink-soft)]">
					{project.description ?? "No description"}
				</p>
				<ArrowRight
					className="size-4 text-[var(--ink-soft)] transition-transform duration-150 group-hover:translate-x-0.5 group-hover:text-[var(--accent)]"
					aria-hidden="true"
					strokeWidth={1.5}
				/>
			</div>
		</div>
	);
}
