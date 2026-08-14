import { ChevronDown, Minus, ArrowUp, AlertOctagon } from "lucide-react";
import { cn } from "@/lib/utils";
import type { Severity } from "@/lib/veridex-types";

interface SeverityDotProps {
	severity: Severity;
	className?: string;
}

export function SeverityDot({ severity, className }: SeverityDotProps) {
	return (
		<span
			className={cn("inline-block size-2 rounded-full", className)}
			style={{ background: severityColor(severity) }}
			aria-hidden="true"
		/>
	);
}

export function severityColor(severity: Severity): string {
	switch (severity) {
		case "low":
			return "var(--ink-soft)";
		case "medium":
			return "var(--pending)";
		case "high":
			return "var(--block)";
		case "critical":
			return "var(--block)";
	}
}

export function severityIcon(severity: Severity) {
	switch (severity) {
		case "low":
			return { Icon: ChevronDown, color: "var(--ink-soft)" };
		case "medium":
			return { Icon: Minus, color: "var(--pending)" };
		case "high":
			return { Icon: ArrowUp, color: "var(--block)" };
		case "critical":
			return { Icon: AlertOctagon, color: "var(--block)" };
	}
}