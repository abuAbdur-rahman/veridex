import type { ReactNode } from "react";

interface PageHeaderProps {
	title: string;
	count?: string;
	actions?: ReactNode;
	children?: ReactNode;
}

export function PageHeader({ title, count, actions, children }: PageHeaderProps) {
	return (
		<div className="mb-6 flex flex-wrap items-center gap-3">
			<h1 className="font-[var(--mono)] text-xl font-semibold tracking-[-0.02em] text-[var(--ink)]">
				{title}
			</h1>
			{count ? (
				<span className="rounded-full bg-[var(--bg-alt)] px-2.5 py-0.5 font-[var(--mono)] text-xs text-[var(--ink-soft)]">
					{count}
				</span>
			) : null}
			{children}
			{actions ? <div className="ml-auto flex items-center gap-2">{actions}</div> : null}
		</div>
	);
}