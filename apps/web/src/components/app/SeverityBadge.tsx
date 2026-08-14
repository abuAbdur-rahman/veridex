import { AlertOctagon, ArrowUp, ChevronDown, Minus } from "lucide-react";
import { cn } from "@/lib/utils";
import type { Severity } from "@/lib/veridex-types";

const severityConfig: Record<
	Severity,
	{ label: string; cls: string; icon?: typeof Minus }
> = {
	low: {
		label: "Low",
		cls: "border border-[var(--line)] text-[var(--ink-soft)]",
		icon: ChevronDown,
	},
	medium: {
		label: "Medium",
		cls: "bg-[var(--pending-bg)] text-[var(--pending)]",
		icon: Minus,
	},
	high: {
		label: "High",
		cls: "bg-[var(--block-bg)] text-[var(--block)] font-semibold",
		icon: ArrowUp,
	},
	critical: {
		label: "Critical",
		cls: "bg-[var(--block)] text-white font-semibold",
		icon: AlertOctagon,
	},
};

interface SeverityBadgeProps {
	severity: Severity;
	className?: string;
}

export function SeverityBadge({ severity, className }: SeverityBadgeProps) {
	const config = severityConfig[severity];
	const Icon = config.icon;
	return (
		<span
			className={cn(
				"inline-flex items-center gap-1 rounded-[6px] px-[10px] py-1 font-[var(--mono)] text-xs uppercase tracking-[0.02em]",
				config.cls,
				className,
			)}
		>
			{Icon ? <Icon className="size-3.5" aria-hidden="true" strokeWidth={1.5} /> : null}
			{config.label}
		</span>
	);
}