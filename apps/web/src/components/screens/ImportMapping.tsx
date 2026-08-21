import { ArrowRight } from "lucide-react";
import type { IssueStatus } from "@/lib/veridex-types";
import type { ServerProjectMember } from "@/api/projects";
import { PageHeader } from "@/components/app/PageHeader";
import { SectionLabel } from "@/components/app/FormField";

const statusLabels: Record<IssueStatus, string> = {
	backlog: "Backlog",
	in_progress: "In Progress",
	in_qa: "In QA",
	verified: "Verified",
	rejected: "Rejected",
};

const spreadsheetColorMappings: Array<{
	color: string;
	hex: string;
	status: IssueStatus;
}> = [
	{ color: "White", hex: "#FFFFFF", status: "backlog" },
	{ color: "Red", hex: "#FF0000", status: "rejected" },
	{ color: "Green", hex: "#00FF00", status: "verified" },
	{ color: "Yellow", hex: "#FFFF00", status: "in_qa" },
	{ color: "Orange", hex: "#FF9900", status: "in_progress" },
];

interface ImportMappingProps {
	columns: Array<{ spreadsheetColumn: string; targetField: string }>;
	rowColors: Array<{ color: string; hex: string; rows: number; targetStatus: IssueStatus }>;
	isCsv?: boolean;
	defaultStatus: IssueStatus;
	error?: string;
	sampleRows?: Record<string, unknown>[];
	worksheets?: Array<{ index: number; name: string; totalRows: number }>;
	selectedWorksheetIndex?: number;
	members?: ServerProjectMember[];
	statusAssigneeMapping: Record<string, string[]>;
	onWorksheetChange?: (index: number) => void;
	onStatusAssigneeChange: (status: IssueStatus, userId: string) => void;
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
	worksheets = [],
	selectedWorksheetIndex = 0,
	members = [],
	statusAssigneeMapping,
	onWorksheetChange,
	onStatusAssigneeChange,
}: ImportMappingProps) {
	const developerMembers = members.filter((member) => member.role === "dev");
	const qaMembers = members.filter((member) => member.role === "qa");
	const assignableStatuses: Array<{ status: IssueStatus; members: ServerProjectMember[] }> = [];
	if (developerMembers.length > 0) assignableStatuses.push({ status: "backlog", members: developerMembers });
	if (qaMembers.length > 0) assignableStatuses.push({ status: "in_qa", members: qaMembers });

	return (
		<div>
			<PageHeader title="Review import mapping" />
			<div className="flex flex-col gap-8">
				{!isCsv && worksheets.length > 1 ? (
					<section aria-label="Worksheet selection">
						<SectionLabel>Worksheet</SectionLabel>
						<label htmlFor="import-worksheet" className="mt-3 block text-sm font-medium text-[var(--ink)]">Import from worksheet</label>
						<select id="import-worksheet" value={selectedWorksheetIndex} onChange={(event) => onWorksheetChange?.(Number(event.target.value))} className="mt-2 w-full max-w-[360px] rounded-lg border border-[var(--line)] bg-[var(--surface)] px-3 py-2 text-sm text-[var(--ink)] outline-none focus:border-[var(--accent)] focus:ring-2 focus:ring-[var(--accent-ring)]">
							{worksheets.map((sheet) => <option key={sheet.index} value={sheet.index}>{sheet.name} ({sheet.totalRows} rows)</option>)}
						</select>
					</section>
				) : null}
				<section aria-label="Column mapping">
					<SectionLabel>Column mapping</SectionLabel>
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
											{[
												"",
								"title",
								"description",
								"severity",
								"environment",
												"stepsToReproduce",
												"expectedResult",
												"actualResult",
												"imageUrl",
											].map((field) => (
												<option key={field} value={field}>
													{field === "" ? "(skip)" : field}
												</option>
											))}
										</select>
									</li>
								);
							})}
						</ul>
					</div>
				</section>

				{!isCsv ? (
					<section aria-label="Spreadsheet color mapping">
						<SectionLabel>Spreadsheet color mapping</SectionLabel>
						<p className="mt-2 text-sm text-[var(--ink-soft)]">
							Default mapping. You can override detected colors below before importing.
						</p>
						<ul className="mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-5">
							{spreadsheetColorMappings.map((mapping) => (
								<li
									key={mapping.color}
									className="flex items-center gap-2 rounded-lg border border-[var(--line)] bg-[var(--surface)] px-3 py-2"
								>
									<span
										className="size-3.5 shrink-0 rounded-full border border-[var(--line)]"
										style={{ background: mapping.hex }}
										aria-hidden="true"
									/>
									<span className="text-xs text-[var(--ink)]">
										{mapping.color} <span className="text-[var(--ink-soft)]">→</span>{" "}
										<span className="font-[var(--mono)]">{statusLabels[mapping.status]}</span>
									</span>
								</li>
							))}
						</ul>
					</section>
				) : null}

				{isCsv ? (
					<section aria-label="Default status">
						<SectionLabel>Status for uncategorized issues.</SectionLabel>
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
							<option value="rejected">Rejected</option>
						</select>
					</section>
				) : rowColors.length > 0 ? (
					<section aria-label="Detected row colors">
						<SectionLabel>Detected row colors</SectionLabel>
						<div className="mt-3 overflow-hidden rounded-[10px] border border-[var(--line)] bg-[var(--surface)]">
							<ul className="flex flex-col">
								{rowColors.map((color, i) => {
									const selectId = `row-color-mapping-${i}`;
									return (
										<li
											key={`${color.hex}-${i}`}
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
													{["backlog", "in_progress", "in_qa", "verified", "rejected"].map((status) => (
													<option key={status} value={status}>
														{statusLabels[status as IssueStatus]}
													</option>
												))}
											</select>
										</li>
									);
								})}
							</ul>
						</div>
					</section>
				) : (
					<section aria-label="Default status">
						<SectionLabel>Status for uncategorized issues.</SectionLabel>
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
							<option value="rejected">Rejected</option>
						</select>
					</section>
				)}

				{assignableStatuses.length > 0 ? (
					<section aria-label="Status assignees">
						<SectionLabel>Assign by imported status</SectionLabel>
						<p className="mt-2 text-sm text-[var(--ink-soft)]">Optional. These assignments override assignee columns for matching statuses. QA statuses can only be assigned QA members; development statuses can only be assigned developers. Verified and rejected issues are never assigned.</p>
						<div className="mt-3 grid gap-3 sm:grid-cols-2">
							{assignableStatuses.map(({ status, members: assignable }) => (
								<label key={status} className="flex flex-col gap-1 text-sm font-medium text-[var(--ink)]">
									<span>{statusLabels[status]}</span>
									<select value={statusAssigneeMapping[status]?.[0] ?? ""} onChange={(event) => onStatusAssigneeChange(status, event.target.value)} className="rounded-lg border border-[var(--line)] bg-[var(--surface)] px-3 py-2 text-sm font-normal text-[var(--ink)] outline-none focus:border-[var(--accent)] focus:ring-2 focus:ring-[var(--accent-ring)]">
										<option value="">No assignment</option>
										{assignable.map((member) => <option key={member.id} value={member.id}>{member.name}</option>)}
									</select>
								</label>
							))}
						</div>
					</section>
				) : null}

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
