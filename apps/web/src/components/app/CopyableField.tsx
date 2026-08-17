import { Check, Copy } from "lucide-react";
import { useState } from "react";
import { cn } from "@/lib/utils";

interface CopyableFieldProps {
	value: string;
	label?: string;
	mono?: boolean;
}

export function CopyableField({ value, label, mono }: CopyableFieldProps) {
	const [copied, setCopied] = useState(false);

	async function handleCopy() {
		await navigator.clipboard?.writeText(value).catch(() => undefined);
		setCopied(true);
		setTimeout(() => setCopied(false), 1600);
	}

	return (
		<div>
			{label ? (
				<p className="mb-1.5 font-[var(--mono)] text-[10px] font-semibold uppercase tracking-[0.08em] text-[var(--ink-soft)]">
					{label}
				</p>
			) : null}
			<div className="flex items-stretch">
				<div
					className={cn(
						"flex min-w-0 flex-1 items-center rounded-l-lg border border-r-0 border-[var(--line)] bg-[var(--bg)] px-3 py-2.5",
						mono ? "font-[var(--mono)] text-xs text-[var(--ink)]" : "text-[13px] text-[var(--ink)]",
					)}
				>
					<span className="truncate">{value}</span>
				</div>
				<button
					type="button"
					onClick={handleCopy}
					aria-label={`Copy ${label ?? "value"}`}
					className="inline-flex min-w-11 cursor-pointer items-center justify-center rounded-r-lg border border-[var(--line)] bg-[var(--surface)] px-3 text-[var(--ink-soft)] transition-colors duration-150 hover:bg-[var(--bg-alt)] hover:text-[var(--ink)]"
				>
					{copied ? (
						<Check className="size-4 text-[var(--pass)]" aria-hidden="true" strokeWidth={1.5} />
					) : (
						<Copy className="size-4" aria-hidden="true" strokeWidth={1.5} />
					)}
				</button>
			</div>
		</div>
	);
}
