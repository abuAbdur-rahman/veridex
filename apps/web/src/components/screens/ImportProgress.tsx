import { PageHeader } from "@/components/app/PageHeader";

interface ImportProgressProps {
	fileName: string;
	progress: number; // 0-100
	stage?: string;
	onCancel?: () => void;
}

export function ImportProgress({ fileName, progress, stage, onCancel }: ImportProgressProps) {
	const pct = Math.min(100, Math.max(0, Math.round(progress)));
	return (
		<div>
			<PageHeader title="Import Issues" />
			<div className="mx-auto flex max-w-[520px] flex-col gap-6 rounded-[12px] border border-[var(--line)] bg-[var(--surface)] p-8">
				<div>
					<p className="font-[var(--mono)] text-xs text-[var(--ink-soft)]">
						Demo preview
					</p>
					<h2 className="mt-1 truncate font-[var(--mono)] text-base font-semibold text-[var(--ink)]">
						{fileName}
					</h2>
				</div>
				<div>
					<div
						className="h-2.5 w-full overflow-hidden rounded-full bg-[var(--bg-alt)]"
						role="progressbar"
						aria-valuenow={pct}
						aria-valuemin={0}
						aria-valuemax={100}
						aria-label="Import progress"
					>
						<div
							className="h-full rounded-full bg-[var(--accent)] transition-[width] duration-300"
							style={{ width: `${pct}%` }}
						/>
					</div>
					<p className="mt-2 text-right font-[var(--mono)] text-xs text-[var(--ink-soft)]">
						{pct}%
					</p>
				</div>
				<p role="status" aria-live="polite" className="flex items-center gap-2 text-sm text-[var(--ink)]">
					<span className="size-3.5 animate-spin rounded-full border-2 border-[var(--line)] border-t-[var(--accent)]" aria-hidden="true" />
					{stage ?? "Preparing demo preview..."}
				</p>
				<button
					type="button"
					onClick={onCancel}
					className="self-end inline-flex min-h-10 cursor-pointer items-center justify-center rounded-lg border border-[var(--line)] bg-[var(--surface)] px-4 text-sm font-semibold text-[var(--ink)] transition-colors duration-150 hover:bg-[var(--bg-alt)]"
				>
					Cancel
				</button>
			</div>
		</div>
	);
}
