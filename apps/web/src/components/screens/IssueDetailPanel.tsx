import { ImageIcon, Save, Trash2 } from "lucide-react";
import { useState, type FormEvent } from "react";
import { SeverityBadge } from "@/components/app/SeverityBadge";
import { StatusHistory } from "@/components/app/StatusHistory";
import { StatusPill } from "@/components/app/StatusPill";
import {
	Dialog,
	DialogClose,
	DialogContent,
	DialogDescription,
	DialogFooter,
	DialogHeader,
	DialogTitle,
} from "@/components/ui/dialog";
import {
	Sheet,
	SheetContent,
	SheetDescription,
	SheetHeader,
	SheetTitle,
} from "@/components/ui/sheet";
import { getAllowedTransitions } from "@/stores/demo-store";
import {
	requiresAuditNote,
	type Issue,
	type IssueHistoryEntry,
	type IssueStatus,
	type ProjectRole,
	type Severity,
} from "@/lib/veridex-types";
import type { ServerProjectMember } from "@/api/projects";
import type { UpdateIssueInput } from "@/api/issues";

interface IssueDetailPanelProps {
	issue: Issue;
	history: IssueHistoryEntry[];
	members: ServerProjectMember[];
	role: ProjectRole;
	pending?: boolean;
	historyPending?: boolean;
	onClose: () => void;
	onUpdate: (input: UpdateIssueInput) => Promise<void>;
	onStatusChange: (status: IssueStatus, note?: string) => Promise<void>;
	onAssign: (input: { assigneeId?: string | null; qaAssigneeId?: string | null }) => Promise<void>;
	onDelete: () => Promise<void>;
}
export function IssueDetailPanel({
	issue,
	history,
	members,
	role,
	pending = false,
	historyPending = false,
	onClose,
	onUpdate,
	onStatusChange,
	onAssign,
	onDelete,
}: IssueDetailPanelProps) {
	const [editing, setEditing] = useState(false);
	const [imageOpen, setImageOpen] = useState(false);
	const [error, setError] = useState("");
	const canEdit = role !== "tester";
	const canAssign = role === "qa" || role === "admin";
	const canDelete = role === "admin";
	async function run(action: () => Promise<void>) {
		setError("");
		try {
			await action();
		} catch (value) {
			setError(value instanceof Error ? value.message : "The change could not be saved.");
			throw value;
		}
	}
	async function save(event: FormEvent<HTMLFormElement>) {
		event.preventDefault();
		const data = new FormData(event.currentTarget);
		const environmentText = String(data.get("environment") ?? "").trim();
		try {
			await run(() =>
				onUpdate({
					title: String(data.get("title") ?? "").trim(),
					description: String(data.get("description") ?? "").trim() || null,
					severity: String(data.get("severity") ?? "medium") as Severity,
					environment: environmentText ? { browser: environmentText } : null,
				}),
			);
			setEditing(false);
		} catch {
			/* Error is rendered above the form. */
		}
	}
	async function move(status: IssueStatus) {
		let note: string | undefined;
		if (requiresAuditNote(status)) {
			note = window.prompt("Add an audit note for this status change")?.trim();
			if (!note) return;
		}
		try {
			await run(() => onStatusChange(status, note));
		} catch {
			/* Error is rendered in the panel. */
		}
	}
	return (
		<Sheet
			open
			onOpenChange={(open) => {
				if (!open && !pending) onClose();
			}}
		>
			<SheetContent
				className="w-full max-w-[620px] gap-0 bg-[var(--surface)] sm:max-w-[620px]"
				aria-label={`Issue ${issue.ticketRef}`}
			>
				<SheetHeader className="border-b border-[var(--line)] px-5 py-4 pr-14">
					<p className="font-[var(--mono)] text-xs text-[var(--ink-soft)]">{issue.ticketRef}</p>
					<SheetTitle className="font-[var(--sans)] text-lg font-semibold leading-snug">
						{issue.title}
					</SheetTitle>
					<SheetDescription className="sr-only">View and update issue details</SheetDescription>
				</SheetHeader>
				<div className="flex-1 space-y-6 overflow-y-auto p-5">
					<div className="flex flex-wrap items-center gap-2">
						<StatusPill status={issue.status} />
						<SeverityBadge severity={issue.severity} />
						<div className="ml-auto flex flex-wrap gap-2">
							{issue.imageUrl ? (
								<button
									type="button"
									onClick={() => setImageOpen(true)}
									className="inline-flex min-h-9 items-center gap-2 rounded-md border border-[var(--line)] px-3 text-sm font-semibold hover:border-[var(--accent)]"
								>
									<ImageIcon className="size-4" />
									View image
								</button>
							) : null}
							{canEdit ? (
								<button
									type="button"
									disabled={pending}
									onClick={() => setEditing((value) => !value)}
									className="min-h-9 rounded-md border border-[var(--line)] px-3 text-sm font-semibold hover:border-[var(--accent)] disabled:opacity-50"
								>
									{editing ? "Cancel edit" : "Edit"}
								</button>
							) : null}
						</div>
					</div>
					{error ? (
						<p
							role="alert"
							className="rounded-md border border-[var(--block)] bg-[var(--block-bg)] px-3 py-2 text-sm text-[var(--block)]"
						>
							{error}
						</p>
					) : null}
					{editing ? (
						<form
							onSubmit={(event) => void save(event)}
							className="space-y-4 rounded-md border border-[var(--line)] bg-[var(--bg)] p-4"
						>
							<Field label="Title">
								<input
									name="title"
									defaultValue={issue.title}
									required
									maxLength={200}
									className="app-input"
								/>
							</Field>
							<div className="grid gap-4 sm:grid-cols-2">
								<Field label="Severity">
									<select name="severity" defaultValue={issue.severity} className="app-input">
										{["low", "medium", "high", "critical"].map((value) => (
											<option key={value}>{value}</option>
										))}
									</select>
								</Field>
								<Field label="Environment">
									<input
										name="environment"
										defaultValue={issue.environment}
										className="app-input"
									/>
								</Field>
							</div>
							<Field label="Description">
								<textarea
									name="description"
									defaultValue={issue.description}
									rows={4}
									className="app-input"
								/>
							</Field>
							<button
								type="submit"
								disabled={pending}
								className="inline-flex min-h-10 items-center gap-2 rounded-md bg-[var(--accent)] px-4 text-sm font-semibold text-white disabled:opacity-50"
							>
								<Save className="size-4" />
								{pending ? "Saving..." : "Save issue"}
							</button>
						</form>
					) : (
						<IssueSummary issue={issue} />
					)}
					{canAssign ? (
						<section>
							<Label>Assignment</Label>
							<div className="mt-2 grid gap-3 sm:grid-cols-2">
								<Assignment
									label="Developer"
									value={issue.assignee?.id ?? ""}
									members={members}
									disabled={pending}
									onChange={(assigneeId) =>
										void run(() =>
											onAssign({
												assigneeId: assigneeId || null,
												qaAssigneeId: issue.qaOwner?.id ?? null,
											}),
										).catch(() => undefined)
									}
								/>
								<Assignment
									label="QA owner"
									value={issue.qaOwner?.id ?? ""}
									members={members}
									disabled={pending}
									onChange={(qaAssigneeId) =>
										void run(() =>
											onAssign({
												assigneeId: issue.assignee?.id ?? null,
												qaAssigneeId: qaAssigneeId || null,
											}),
										).catch(() => undefined)
									}
								/>
							</div>
						</section>
					) : null}
					{canEdit && getAllowedTransitions(issue.status).length ? (
						<section>
							<Label>Workflow</Label>
							<div className="mt-2 flex flex-wrap gap-2">
								{getAllowedTransitions(issue.status).map((status) => (
									<button
										key={status}
										type="button"
										disabled={pending}
										onClick={() => void move(status)}
										className="min-h-9 rounded-md border border-[var(--line)] px-3 text-sm font-semibold hover:border-[var(--accent)] disabled:opacity-50"
									>
										Move to {status.replaceAll("_", " ")}
									</button>
								))}
							</div>
						</section>
					) : null}
					{historyPending ? (
						<p className="text-sm text-[var(--ink-soft)]">Loading status history...</p>
					) : (
						<StatusHistory entries={history} />
					)}
					<section>
						<Label>Comments</Label>
						<p className="mt-2 rounded-md border border-[var(--line)] bg-[var(--bg)] px-3 py-3 text-sm text-[var(--ink-soft)]">
							Comments are not available for server-backed issues yet.
						</p>
					</section>
					{canDelete ? (
						<section className="border-t border-[var(--line)] pt-5">
							<button
								type="button"
								disabled={pending}
								onClick={() => {
									if (window.confirm(`Delete ${issue.ticketRef}? This cannot be undone.`))
										void run(onDelete).catch(() => undefined);
								}}
								className="inline-flex min-h-10 items-center gap-2 rounded-md border border-[var(--block)] px-3 text-sm font-semibold text-[var(--block)] hover:bg-[var(--block-bg)] disabled:opacity-50"
							>
								<Trash2 className="size-4" />
								Delete issue
							</button>
						</section>
					) : null}
				</div>
			</SheetContent>
			{issue.imageUrl ? (
				<Dialog open={imageOpen} onOpenChange={setImageOpen}>
					<DialogContent className="h-[calc(100dvh-2rem)] max-w-[calc(100vw-2rem)] grid-rows-[auto_minmax(0,1fr)_auto] bg-[var(--surface)] p-4 sm:max-w-[calc(100vw-2rem)]">
						<DialogHeader className="pr-10">
							<DialogTitle>{issue.ticketRef} image</DialogTitle>
							<DialogDescription>Attached image for {issue.title}</DialogDescription>
						</DialogHeader>
						<div className="flex min-h-0 items-center justify-center overflow-hidden rounded-md border border-[var(--line)] bg-black/90 p-2">
							<img
								src={issue.imageUrl}
								alt={`Attachment for ${issue.ticketRef}: ${issue.title}`}
								className="max-h-full max-w-full object-contain"
							/>
						</div>
						<DialogFooter className="mx-0 mb-0 rounded-b-md bg-transparent p-0 pt-4">
							<DialogClose className="min-h-10 rounded-md border border-[var(--line)] px-4 text-sm font-semibold hover:border-[var(--accent)]">
								Close image
							</DialogClose>
						</DialogFooter>
					</DialogContent>
				</Dialog>
			) : null}
		</Sheet>
	);
}
function Assignment({
	label,
	value,
	members,
	disabled,
	onChange,
}: {
	label: string;
	value: string;
	members: ServerProjectMember[];
	disabled: boolean;
	onChange: (id: string) => void;
}) {
	return (
		<label className="text-sm font-medium">
			{label}
			<select
				value={value}
				disabled={disabled}
				onChange={(event) => onChange(event.target.value)}
				className="app-input mt-1.5"
			>
				<option value="">Unassigned</option>
				{members.map((member) => (
					<option key={member.id} value={member.id}>
						{member.name}
					</option>
				))}
			</select>
		</label>
	);
}
function Field({ label, children }: { label: string; children: React.ReactNode }) {
	return (
		<label className="block">
			<span className="mb-1.5 block text-sm font-medium">{label}</span>
			{children}
		</label>
	);
}
function Label({ children }: { children: React.ReactNode }) {
	return (
		<h3 className="font-[var(--mono)] text-[11px] font-semibold uppercase text-[var(--ink-soft)]">
			{children}
		</h3>
	);
}
function IssueSummary({ issue }: { issue: Issue }) {
	return (
		<div className="space-y-5">
			<dl className="grid gap-4 sm:grid-cols-2">
				<div>
					<dt className="font-[var(--mono)] text-[10px] uppercase text-[var(--ink-soft)]">
						Assignee
					</dt>
					<dd className="mt-1 text-sm">{issue.assignee?.name ?? "Unassigned"}</dd>
				</div>
				<div>
					<dt className="font-[var(--mono)] text-[10px] uppercase text-[var(--ink-soft)]">
						QA owner
					</dt>
					<dd className="mt-1 text-sm">{issue.qaOwner?.name ?? "Unassigned"}</dd>
				</div>
			</dl>
			{issue.description ? (
				<section>
					<Label>Description</Label>
					<p className="mt-2 text-sm leading-relaxed">{issue.description}</p>
				</section>
			) : null}
			{issue.environment ? (
				<section>
					<Label>Environment</Label>
					<p className="mt-2 font-[var(--mono)] text-xs">{issue.environment}</p>
				</section>
			) : null}
			{issue.stepsToReproduce?.length ? (
				<section>
					<Label>Steps to reproduce</Label>
					<ol className="mt-2 list-decimal space-y-1 pl-5 text-sm">
						{issue.stepsToReproduce.map((step, index) => (
							<li key={`${index}-${step}`}>{step}</li>
						))}
					</ol>
				</section>
			) : null}
		</div>
	);
}
