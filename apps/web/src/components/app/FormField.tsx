import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

interface FormFieldProps {
	label: string;
	required?: boolean;
	hint?: string;
	error?: string;
	htmlFor?: string;
	children: ReactNode;
	className?: string;
}

export function FormField({
	label,
	required,
	hint,
	error,
	htmlFor,
	children,
	className,
}: FormFieldProps) {
	return (
		<div className={cn("flex flex-col gap-1.5", className)}>
			<label htmlFor={htmlFor} className="text-[13px] font-medium text-[var(--ink)]">
				{label}
				{required ? <span className="ml-0.5 text-[var(--block)]">*</span> : null}
			</label>
			{children}
			{error ? (
				<p className="text-xs text-[var(--block)]">{error}</p>
			) : hint ? (
				<p className="text-xs text-[var(--ink-soft)]">{hint}</p>
			) : null}
		</div>
	);
}

export function SectionLabel({ children }: { children: ReactNode }) {
	return (
		<h2 className="flex items-center gap-2 font-[var(--mono)] text-[11px] font-semibold uppercase tracking-[0.08em] text-[var(--ink-soft)]">
			{children}
		</h2>
	);
}