import { ImageIcon, Save, Trash2 } from "lucide-react";
import { useState, type FormEvent } from "react";
import { SeverityBadge } from "@/components/app/SeverityBadge";
import { CommentThread } from "@/components/app/CommentThread";
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
import type { ServerComment } from "@/api/comments";

interface IssueDetailPanelProps {
	issue: Issue;
	history: IssueHistoryEntry[];
	members: ServerProjectMember[];
	role: ProjectRole;
	pending?: boolean;
	historyPending?: boolean;
	comments: ServerComment[];
	commentsPending?: boolean;
	commentPending?: boolean;
	commentError?: string;
	onClose: () => void;
	onUpdate: (input: UpdateIssueInput) => Promise<void>;
	onStatusChange: (status: IssueStatus, note?: string) => Promise<void>;
	onAssign: (input: { developerAssigneeIds: string[]; qaAssigneeIds: string[] }) => Promise<void>;
	onDelete: () => Promise<void>;
	onComment: (body: string) => Promise<void>;
}
export function IssueDetailPanel({
	issue,
	history,
	members,
	role,
	pending = false,
	historyPending = false,
	comments,
	commentsPending = false,
	commentPending = false,
	commentError,
	onClose,
	onUpdate,
	onStatusChange,
	onAssign,
	onDelete,
	onComment,
}: IssueDetailPanelProps) {
	const [editing, setEditing] = useState(false);
	const [imageOpen, setImageOpen] = useState(false);
	const [error, setError] = useState("");
	const canEdit = role !== "tester";
	const canAssign = role === "qa" || role === "admin";
	const canDelete = role === "admin";
	const developerMembers = members.filter((member) => member.role === "dev");
	const qaMembers = members.filter((member) => member.role === "qa");
	const visibleTransitions = getAllowedTransitions(issue.status).filter(
		(status) => status !== "rejected" || role === "dev",
	);
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
				className="w-full max-w-[780px] gap-0 bg-[var(--surface)] sm:max-w-[780px]"
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
					{canAssign && (developerMembers.length > 0 || qaMembers.length > 0) ? (
						<section>
							<Label>Assignment</Label>
							<div className="mt-2 grid gap-3 sm:grid-cols-2">
								{developerMembers.length > 0 ? (
									<AssignmentMulti
										label="Developers"
										members={developerMembers}
										selected={assigneeIds(issue.developerAssignees)}
										disabled={pending}
										onChange={(developerAssigneeIds) =>
											void run(() =>
												onAssign({
													developerAssigneeIds,
													qaAssigneeIds: assigneeIds(issue.qaAssignees),
												}),
											).catch(() => undefined)
										}
									/>
								) : null}
								{qaMembers.length > 0 ? (
									<AssignmentMulti
										label="QA"
										members={qaMembers}
										selected={assigneeIds(issue.qaAssignees)}
										disabled={pending}
										onChange={(qaAssigneeIds) =>
											void run(() =>
												onAssign({
													developerAssigneeIds: assigneeIds(issue.developerAssignees),
													qaAssigneeIds,
												}),
											).catch(() => undefined)
										}
									/>
								) : null}
							</div>
						</section>
					) : null}
					{canEdit && visibleTransitions.length > 0 ? (
						<section>
							<Label>Workflow</Label>
							<div className="mt-2 flex flex-wrap gap-2">
								{visibleTransitions.map((status) => (
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
					{commentsPending ? (
						<p className="text-sm text-[var(--ink-soft)]">Loading comments...</p>
					) : (
						<CommentThread
							comments={comments}
							pending={commentPending}
							error={commentError}
							resolveAuthor={(authorId) =>
								members.find((member) => member.id === authorId)?.name ?? authorId
							}
							onSubmit={onComment}
						/>
					)}
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
function assigneeIds(assignees: Issue["developerAssignees"]): string[] {
	return assignees.map((assignee) => assignee.id).filter((id): id is string => Boolean(id));
}
function AssignmentMulti({
	label,
	members,
	selected,
	disabled,
	onChange,
}: {
	label: string;
	members: ServerProjectMember[];
	selected: string[];
	disabled: boolean;
	onChange: (ids: string[]) => void;
}) {
	function toggle(id: string) {
		onChange(
			selected.includes(id) ? selected.filter((value) => value !== id) : [...selected, id],
		);
	}
	return (
		<fieldset className="text-sm font-medium">
			<legend>{label}</legend>
			<div className="mt-1.5 max-h-44 space-y-1 overflow-y-auto rounded-md border border-[var(--line)] bg-[var(--bg)] p-2">
				{members.length === 0 ? (
					<p className="px-1 py-1 text-xs font-normal text-[var(--ink-soft)]">
						No {label.toLowerCase()} members
					</p>
				) : (
					members.map((member) => (
						<label
							key={member.id}
							className="flex cursor-pointer items-center gap-2 rounded px-1 py-1 text-xs font-normal hover:bg-[var(--bg-alt)]"
						>
							<input
								type="checkbox"
								checked={selected.includes(member.id)}
								disabled={disabled}
								onChange={() => toggle(member.id)}
								className="size-3.5 accent-[var(--accent)]"
							/>
							<span className="truncate">{member.name}</span>
						</label>
					))
				)}
			</div>
		</fieldset>
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
						Developers
					</dt>
					<dd className="mt-1 text-sm">
						{issue.developerAssignees.length > 0
							? issue.developerAssignees.map((assignee) => assignee.name).join(", ")
							: "Unassigned"}
					</dd>
				</div>
				<div>
					<dt className="font-[var(--mono)] text-[10px] uppercase text-[var(--ink-soft)]">
						QA
					</dt>
					<dd className="mt-1 text-sm">
						{issue.qaAssignees.length > 0
							? issue.qaAssignees.map((assignee) => assignee.name).join(", ")
							: "Unassigned"}
					</dd>
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
