import { ArrowRight, FolderKanban } from "lucide-react";
import { Link } from "@tanstack/react-router";
import type { Project } from "@/lib/veridex-types";
import { RoleBadge } from "@/components/app/EmptyState";

interface ProjectCardProps {
	project: Project;
}

export function ProjectCard({ project }: ProjectCardProps) {
	return (
		<Link
			to="/projects/$projectId"
			params={{ projectId: project.id }}
			className="group flex flex-col gap-3 rounded-[10px] border border-[var(--line)] bg-[var(--surface)] p-5 transition-colors duration-150 hover:border-[var(--accent)]"
		>
			<div className="flex items-start justify-between gap-2">
				<FolderKanban className="size-5 text-[var(--ink-soft)]" aria-hidden="true" strokeWidth={1.5} />
				<RoleBadge role={project.role} />
			</div>
			<h3 className="text-[15px] font-semibold text-[var(--ink)]">{project.name}</h3>
			<div className="mt-auto flex items-center justify-between">
				<p className="text-[13px] text-[var(--ink-soft)]">
					{project.openIssueCount} open issues
				</p>
				<ArrowRight
					className="size-4 text-[var(--ink-soft)] transition-transform duration-150 group-hover:translate-x-0.5 group-hover:text-[var(--accent)]"
					aria-hidden="true"
					strokeWidth={1.5}
				/>
			</div>
		</Link>
	);
}