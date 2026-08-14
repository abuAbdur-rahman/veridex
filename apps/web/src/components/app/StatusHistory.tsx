import { History } from "lucide-react";
import type { IssueHistoryEntry } from "@/lib/veridex-types";
import { formatRelativeTime } from "@/lib/format-time";

interface StatusHistoryProps {
	entries: IssueHistoryEntry[];
}

function statusLabel(status: IssueHistoryEntry["toStatus"] | null) {
	if (status === null) return "created";
	return status.replace("_", " ");
}

export function StatusHistory({ entries }: StatusHistoryProps) {
	return (
		<section aria-label="Status history">
			<h3 className="mb-3 flex items-center gap-2 font-[var(--mono)] text-[11px] font-semibold uppercase tracking-[0.08em] text-[var(--ink-soft)]">
				<History className="size-3.5" aria-hidden="true" strokeWidth={1.5} />
				Status History
			</h3>
			<ol className="relative ml-1.5 flex flex-col gap-4 border-l border-[var(--line)] pl-5">
				{entries.map((entry, index) => (
					<li key={index} className="relative">
						<span
							className="absolute -left-[26.5px] top-1 size-2.5 rounded-full border-2 border-[var(--bg)] bg-[var(--accent)]"
							aria-hidden="true"
						/>
						<p className="font-[var(--mono)] text-xs text-[var(--ink)]">
							{entry.fromStatus
								? `${statusLabel(entry.fromStatus)} \u2192 ${statusLabel(entry.toStatus)}`
								: `created as ${statusLabel(entry.toStatus)}`}
						</p>
						<p className="mt-0.5 text-xs text-[var(--ink-soft)]">
							by {entry.by} · {formatRelativeTime(entry.at)}
						</p>
						{entry.note ? (
							<p className="mt-1 rounded-lg border border-[var(--line)] bg-[var(--bg)] px-3 py-2 text-xs text-[var(--ink)]">
								{entry.note}
							</p>
						) : null}
					</li>
				))}
			</ol>
		</section>
	);
}
