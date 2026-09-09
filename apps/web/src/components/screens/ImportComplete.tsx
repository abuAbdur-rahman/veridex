import { useState } from "react";
import { CheckCircle2, XCircle } from "lucide-react";
import type { ImportErrorRow } from "@/lib/veridex-types";

interface ImportCompleteProps {
	importedCount: number;
	failedCount: number;
	errors?: ImportErrorRow[];
	onViewBoard?: () => void;
	onRestart?: () => void;
}

export function ImportComplete({
	importedCount,
	failedCount,
	errors = [],
	onViewBoard,
	onRestart,
}: ImportCompleteProps) {
	const [showErrors, setShowErrors] = useState(false);

	return (
		<div className="mx-auto flex max-w-[420px] flex-col items-center gap-5 pt-10 text-center">
			<CheckCircle2 className="size-12 text-[var(--pass)]" aria-hidden="true" strokeWidth={1.5} />
			<h1 className="font-[var(--mono)] text-xl font-semibold text-[var(--ink)]">
				Import complete
			</h1>
			<p className="font-[var(--mono)] text-3xl font-semibold text-[var(--ink)]">
				{importedCount}
				<span className="ml-2 text-sm font-normal text-[var(--ink-soft)]">issues imported</span>
			</p>
			{failedCount > 0 ? (
				<div className="flex w-full flex-col gap-2">
					<button
						type="button"
						onClick={() => setShowErrors((s) => !s)}
						aria-expanded={showErrors}
						aria-controls="import-errors"
						className="inline-flex items-center gap-2 font-[var(--mono)] text-sm font-medium text-[var(--block)] transition-colors duration-150 hover:underline"
					>
						<XCircle className="size-4" aria-hidden="true" strokeWidth={1.5} />
						{failedCount} rows failed
						<span aria-hidden="true">{showErrors ? "▴" : "▾"}</span>
					</button>
					{showErrors ? (
						<ul
							id="import-errors"
							className="overflow-hidden rounded-[10px] border border-[var(--line)] bg-[var(--surface)] text-left"
						>
							{errors.map((error) => (
								<li
									key={error.row}
									className="flex items-center gap-3 border-b border-[var(--line-soft)] px-4 py-2.5 text-[13px] last:border-b-0"
								>
									<span className="shrink-0 font-[var(--mono)] text-xs text-[var(--ink-soft)]">
										Row {error.row}
									</span>
									<span className="text-[var(--ink)]">{error.message}</span>
								</li>
							))}
						</ul>
					) : null}
				</div>
			) : null}
			<div className="mt-2 flex flex-wrap justify-center gap-3">
				<button
					type="button"
					onClick={onRestart}
					className="inline-flex min-h-11 cursor-pointer items-center justify-center rounded-lg border border-[var(--line)] bg-[var(--surface)] px-5 text-sm font-semibold text-[var(--ink)] transition-colors duration-150 hover:bg-[var(--bg-alt)]"
				>
					Import another file
				</button>
				<button
					type="button"
					onClick={onViewBoard}
					className="inline-flex min-h-11 cursor-pointer items-center justify-center rounded-lg bg-[var(--accent)] px-6 text-sm font-semibold text-white transition-colors duration-150 hover:bg-[var(--accent-strong)]"
				>
					View board
				</button>
			</div>
		</div>
	);
}
