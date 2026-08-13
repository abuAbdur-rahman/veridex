import type { ReactNode } from "react";

export function Eyebrow({ children }: { children: ReactNode }) {
	return <span className="eyebrow">{children}</span>;
}

export function SectionHead({
	label,
	title,
	subtitle,
}: {
	label: string;
	title: string;
	subtitle?: string;
}) {
	return (
		<div className="section-head">
			<Eyebrow>{label}</Eyebrow>
			<h2>{title}</h2>
			{subtitle ? <p className="section-sub">{subtitle}</p> : null}
		</div>
	);
}
