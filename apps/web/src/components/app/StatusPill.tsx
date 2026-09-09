import { cn } from "@/lib/utils";
import type { IssueStatus } from "@/lib/veridex-types";

const statusTokens: Record<IssueStatus, { label: string; cls: string }> = {
	backlog: {
		label: "Backlog",
		cls: "bg-[var(--bg-alt)] text-[var(--ink-soft)]",
	},
	in_progress: {
		label: "In Progress",
		cls: "bg-[var(--block-bg)] text-[var(--block)]",
	},
	in_qa: {
		label: "In QA",
		cls: "bg-[var(--pending-bg)] text-[var(--pending)]",
	},
	verified: {
		label: "Verified",
		cls: "bg-[var(--pass-bg)] text-[var(--pass)]",
	},
	rejected: {
		label: "Rejected",
		cls: "bg-[var(--block-bg)] text-[var(--block)]",
	},
};

interface StatusPillProps {
	status: IssueStatus;
	className?: string;
}

export function StatusPill({ status, className }: StatusPillProps) {
	const token = statusTokens[status];
	return (
		<span
			className={cn(
				"inline-flex items-center gap-2 rounded-[6px] px-[10px] py-1 font-[var(--mono)] text-xs font-medium uppercase tracking-[0.02em]",
				token.cls,
				className,
			)}
		>
			<span
				className="size-1.5 rounded-full"
				style={{ background: "currentColor" }}
				aria-hidden="true"
			/>
			{token.label}
		</span>
	);
}
