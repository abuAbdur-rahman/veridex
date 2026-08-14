import type { LucideIcon } from "lucide-react";
import type { ReactNode } from "react";
import type { ProjectRole } from "@/lib/veridex-types";

interface EmptyStateProps {
	icon: LucideIcon;
	title: string;
	description?: string;
	action?: ReactNode;
}

export function EmptyState({ icon: Icon, title, description, action }: EmptyStateProps) {
	return (
		<div className="flex flex-col items-center justify-center gap-3 py-16 text-center">
			<Icon className="size-8 text-[var(--ink-soft)]" aria-hidden="true" strokeWidth={1.5} />
			<h3 className="text-[15px] font-semibold text-[var(--ink)]">{title}</h3>
			{description ? (
				<p className="max-w-[34ch] text-[13px] leading-[1.5] text-[var(--ink-soft)]">
					{description}
				</p>
			) : null}
			{action ? <div className="mt-2">{action}</div> : null}
		</div>
	);
}

const roleColor: Record<ProjectRole, string> = {
	dev: "bg-[var(--dev-bg)] text-[var(--dev)]",
	qa: "bg-[var(--pending-bg)] text-[var(--pending)]",
	tester: "bg-[var(--pass-bg)] text-[var(--pass)]",
	admin: "bg-[var(--accent-bg)] text-[var(--accent-strong)]",
};

export function RoleBadge({ role }: { role: ProjectRole }) {
	return (
		<span
			className={`inline-flex items-center rounded-[6px] px-[10px] py-1 font-[var(--mono)] text-xs font-medium uppercase tracking-[0.02em] ${roleColor[role]}`}
		>
			{role}
		</span>
	);
}