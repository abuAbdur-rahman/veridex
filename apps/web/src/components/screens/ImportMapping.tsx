import { ArrowRight } from "lucide-react";
import type { ImportColumnMapping, IssueStatus, RowColorMapping } from "@/lib/veridex-types";
import { PageHeader } from "@/components/app/PageHeader";
import { SectionLabel } from "@/components/app/FormField";

interface ImportMappingProps {
	columns: ImportColumnMapping[];
	rowColors: RowColorMapping[];
	isCsv?: boolean;
	defaultStatus: IssueStatus;
	error?: string;
	onColumnChange: (index: number, targetField: string) => void;
	onRowColorChange: (index: number, targetStatus: IssueStatus) => void;
	onDefaultStatusChange: (status: IssueStatus) => void;
	onConfirm?: () => void;
	onCancel?: () => void;
}

export function ImportMapping({
	columns,
	rowColors,
	isCsv,
	defaultStatus,
	error,
	onColumnChange,
	onRowColorChange,
	onDefaultStatusChange,
	onConfirm,
	onCancel,
}: ImportMappingProps) {
	return (
		<div>
			<PageHeader title="Review demo preview" />
			<div className="flex flex-col gap-8">
				<section aria-label="Column mapping">
					<SectionLabel>Fixture column mapping</SectionLabel>
					<div className="mt-3 overflow-hidden rounded-[10px] border border-[var(--line)] bg-[var(--surface)]">
						<ul className="flex flex-col">
							{columns.map((column, i) => {
								const selectId = `column-mapping-${i}`;
								return (
									<li
										key={column.spreadsheetColumn}
										className="flex items-center gap-3 border-b border-[var(--line-soft)] px-4 py-3 last:border-b-0"
									>
										<label
											htmlFor={selectId}
											className="flex-1 truncate font-[var(--mono)] text-xs text-[var(--ink-soft)]"
										>
											&quot;{column.spreadsheetColumn}&quot;
										</label>
										<ArrowRight
											className="size-4 shrink-0 text-[var(--ink-soft)]"
											aria-hidden="true"
											strokeWidth={1.5}
										/>
										<select
											id={selectId}
											value={column.targetField}
											onChange={(event) => onColumnChange(i, event.target.value)}
											className="min-w-[180px] rounded-lg border border-[var(--line)] bg-[var(--bg)] px-3 py-2 text-[13px] text-[var(--ink)] outline-none transition-[border-color,box-shadow] duration-150 focus:border-[var(--accent)] focus:ring-2 focus:ring-[var(--accent-ring)]"
										>
											{["Title", "Severity", "Tags", "Environment.device", "image_url"].map((field) => (
												<option key={field} value={field}>
													{field}
												</option>
											))}
										</select>
									</li>
								);
							})}
						</ul>
					</div>
				</section>

				{isCsv ? (
					<section aria-label="Default status">
						<SectionLabel>Default status for all imported issues</SectionLabel>
						<label
							htmlFor="default-import-status"
							className="mt-3 block text-sm font-medium text-[var(--ink)]"
						>
							Imported issue status
						</label>
						<select
							id="default-import-status"
							value={defaultStatus}
							onChange={(event) => onDefaultStatusChange(event.target.value as IssueStatus)}
							className="mt-2 w-full max-w-[280px] rounded-lg border border-[var(--line)] bg-[var(--surface)] px-3 py-2 text-sm text-[var(--ink)] outline-none transition-[border-color,box-shadow] duration-150 focus:border-[var(--accent)] focus:ring-2 focus:ring-[var(--accent-ring)]"
						>
							<option value="backlog">Backlog</option>
							<option value="in_progress">In Progress</option>
							<option value="in_qa">In QA</option>
							<option value="verified">Verified</option>
						</select>
					</section>
				) : (
					<section aria-label="Detected row colors">
						<SectionLabel>Detected row colors</SectionLabel>
						<div className="mt-3 overflow-hidden rounded-[10px] border border-[var(--line)] bg-[var(--surface)]">
							<ul className="flex flex-col">
								{rowColors.map((color, i) => {
									const selectId = `row-color-mapping-${i}`;
									return (
										<li
											key={color.color}
											className="flex items-center gap-3 border-b border-[var(--line-soft)] px-4 py-3 last:border-b-0"
										>
											<span
												className="size-3.5 shrink-0 rounded-full border border-[var(--line)]"
												style={{ background: color.hex }}
												aria-hidden="true"
											/>
											<label
												htmlFor={selectId}
												className="w-[140px] shrink-0 font-[var(--mono)] text-xs text-[var(--ink)]"
											>
												{color.color} ({color.rows})
											</label>
											<ArrowRight
												className="size-4 shrink-0 text-[var(--ink-soft)]"
												aria-hidden="true"
												strokeWidth={1.5}
											/>
											<select
												id={selectId}
												value={color.targetStatus}
												onChange={(event) => onRowColorChange(i, event.target.value as IssueStatus)}
												className="min-w-[140px] rounded-lg border border-[var(--line)] bg-[var(--bg)] px-3 py-2 font-[var(--mono)] text-xs text-[var(--ink)] outline-none transition-[border-color,box-shadow] duration-150 focus:border-[var(--accent)] focus:ring-2 focus:ring-[var(--accent-ring)]"
											>
												{["backlog", "in_progress", "in_qa", "verified"].map((status) => (
													<option key={status} value={status}>
														{status.replace("_", " ")}
													</option>
												))}
											</select>
										</li>
									);
								})}
							</ul>
						</div>
					</section>
				)}

				{error ? (
					<p
						role="alert"
						className="rounded-lg border border-[var(--block)] px-4 py-3 text-sm text-[var(--block)]"
					>
						{error}
					</p>
				) : null}

				<div className="flex justify-end gap-3">
					<button
						type="button"
						onClick={onCancel}
						className="inline-flex min-h-10 cursor-pointer items-center justify-center rounded-lg border border-[var(--line)] bg-[var(--surface)] px-4 text-sm font-semibold text-[var(--ink)] transition-colors duration-150 hover:bg-[var(--bg-alt)]"
					>
						Cancel
					</button>
					<button
						type="button"
						onClick={onConfirm}
						className="inline-flex min-h-10 cursor-pointer items-center justify-center rounded-lg bg-[var(--accent)] px-4 text-sm font-semibold text-white transition-colors duration-150 hover:bg-[var(--accent-strong)]"
					>
						Confirm &amp; Import
					</button>
				</div>
			</div>
		</div>
	);
}
