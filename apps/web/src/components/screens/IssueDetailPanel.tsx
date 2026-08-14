import { FlaskConical, MessageSquare, Save } from "lucide-react";
import { useState, type FormEvent } from "react";

import { Avatar } from "@/components/app/Avatar";
import { SeverityBadge } from "@/components/app/SeverityBadge";
import { StatusHistory } from "@/components/app/StatusHistory";
import { StatusPill } from "@/components/app/StatusPill";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { getAllowedTransitions, isBackwardTransition, type ActionResult } from "@/lib/demo-store";
import { formatRelativeTime } from "@/lib/format-time";
import type { Issue, IssueComment, IssueHistoryEntry, IssueStatus, Severity } from "@/lib/veridex-types";

interface IssueDetailPanelProps {
	issue: Issue;
	history: IssueHistoryEntry[];
	comments: IssueComment[];
	onClose: () => void;
	onUpdate: (input: Partial<Pick<Issue, "title" | "description" | "severity" | "environment">>) => ActionResult<Issue>;
	onStatusChange: (status: IssueStatus, note?: string) => ActionResult<Issue>;
	onComment: (body: string) => ActionResult<IssueComment>;
}

export function IssueDetailPanel({ issue, history, comments, onClose, onUpdate, onStatusChange, onComment }: IssueDetailPanelProps) {
	const [editing, setEditing] = useState(false);
	const [error, setError] = useState("");

	function save(event: FormEvent<HTMLFormElement>) {
		event.preventDefault();
		const data = new FormData(event.currentTarget);
		const result = onUpdate({
			title: String(data.get("title") ?? ""),
			description: String(data.get("description") ?? ""),
			environment: String(data.get("environment") ?? ""),
			severity: String(data.get("severity") ?? "medium") as Severity,
		});
		if (result.ok) { setEditing(false); setError(""); } else setError(result.error);
	}

	function move(status: IssueStatus) {
		let note: string | undefined;
		if (isBackwardTransition(issue.status, status)) {
			note = window.prompt("Why is this issue moving backward?") ?? undefined;
			if (!note) return;
		}
		const result = onStatusChange(status, note);
		setError(result.ok ? "" : result.error);
	}

	return (
		<Sheet open onOpenChange={(open) => { if (!open) onClose(); }}>
			<SheetContent className="w-full max-w-[620px] gap-0 bg-[var(--surface)] sm:max-w-[620px]" aria-label={`Issue ${issue.ticketRef}`}>
				<SheetHeader className="border-b border-[var(--line)] px-5 py-4 pr-14">
					<p className="font-[var(--mono)] text-xs text-[var(--ink-soft)]">{issue.ticketRef}</p>
					<SheetTitle className="font-[var(--sans)] text-lg font-semibold leading-snug">{issue.title}</SheetTitle>
					<SheetDescription className="sr-only">View and update issue details</SheetDescription>
				</SheetHeader>
				<div className="flex-1 space-y-6 overflow-y-auto p-5">
					<div className="flex flex-wrap items-center gap-2"><StatusPill status={issue.status} /><SeverityBadge severity={issue.severity} /><button type="button" onClick={() => setEditing((value) => !value)} className="ml-auto min-h-9 rounded-md border border-[var(--line)] px-3 text-sm font-semibold hover:border-[var(--accent)]">{editing ? "Cancel edit" : "Edit"}</button></div>
					{error ? <p role="alert" className="rounded-md border border-[var(--block)] bg-[var(--block-bg)] px-3 py-2 text-sm text-[var(--block)]">{error}</p> : null}
					{editing ? (
						<form onSubmit={save} className="space-y-4 rounded-md border border-[var(--line)] bg-[var(--bg)] p-4">
							<Field label="Title"><input name="title" defaultValue={issue.title} required className="app-input" /></Field>
							<div className="grid gap-4 sm:grid-cols-2"><Field label="Severity"><select name="severity" defaultValue={issue.severity} className="app-input">{["low","medium","high","critical"].map((value) => <option key={value}>{value}</option>)}</select></Field><Field label="Environment"><input name="environment" defaultValue={issue.environment} className="app-input" /></Field></div>
							<Field label="Description"><textarea name="description" defaultValue={issue.description} rows={4} className="app-input" /></Field>
							<button type="submit" className="inline-flex min-h-10 items-center gap-2 rounded-md bg-[var(--accent)] px-4 text-sm font-semibold text-white hover:bg-[var(--accent-strong)]"><Save className="size-4" /> Save issue</button>
						</form>
					) : <IssueSummary issue={issue} />}
					{getAllowedTransitions(issue.status).length > 0 ? <section><Label>Workflow</Label><div className="mt-2 flex flex-wrap gap-2">{getAllowedTransitions(issue.status).map((status) => <button key={status} type="button" onClick={() => move(status)} className="min-h-9 rounded-md border border-[var(--line)] px-3 text-sm font-semibold hover:border-[var(--accent)] hover:text-[var(--accent-strong)]">Move to {status.replaceAll("_", " ")}</button>)}</div></section> : null}
					<StatusHistory entries={history} />
					<section><Label>Comments</Label><ul className="mt-3 space-y-3">{comments.map((comment) => <li key={comment.id} className="rounded-md border border-[var(--line)] bg-[var(--bg)] p-3"><div className="flex items-center gap-2"><Avatar initials={comment.author.initials} gradient={comment.author.gradient} name={comment.author.name} /><span className="text-sm font-semibold">{comment.author.name}</span><time className="ml-auto font-[var(--mono)] text-[10px] text-[var(--ink-soft)]">{formatRelativeTime(comment.at)}</time></div><p className="mt-2 text-sm leading-relaxed">{comment.body}</p></li>)}</ul><form className="mt-3 flex gap-2" onSubmit={(event) => { event.preventDefault(); const form = event.currentTarget; const input = form.elements.namedItem("comment") as HTMLInputElement; const result = onComment(input.value); if (result.ok) { form.reset(); setError(""); } else setError(result.error); }}><input name="comment" aria-label="Add comment" placeholder="Add a QA note or implementation update" className="app-input min-w-0 flex-1" /><button type="submit" className="grid size-10 shrink-0 place-items-center rounded-md bg-[var(--accent)] text-white" aria-label="Post comment"><MessageSquare className="size-4" /></button></form></section>
				</div>
			</SheetContent>
		</Sheet>
	);
}

function Field({ label, children }: { label: string; children: React.ReactNode }) { return <label className="block"><span className="mb-1.5 block text-sm font-medium">{label}</span>{children}</label>; }
function Label({ children }: { children: React.ReactNode }) { return <h3 className="font-[var(--mono)] text-[11px] font-semibold uppercase text-[var(--ink-soft)]">{children}</h3>; }
function IssueSummary({ issue }: { issue: Issue }) { return <div className="space-y-5"><dl className="grid gap-4 sm:grid-cols-2"><div><dt className="font-[var(--mono)] text-[10px] uppercase text-[var(--ink-soft)]">Assignee</dt><dd className="mt-1 text-sm">{issue.assignee?.name ?? "Unassigned"}</dd></div><div><dt className="font-[var(--mono)] text-[10px] uppercase text-[var(--ink-soft)]">QA owner</dt><dd className="mt-1 text-sm">{issue.qaOwner?.name ?? "Unassigned"}</dd></div></dl>{issue.description ? <section><Label>Description</Label><p className="mt-2 text-sm leading-relaxed">{issue.description}</p></section> : null}{issue.environment ? <section><Label>Environment</Label><p className="mt-2 font-[var(--mono)] text-xs">{issue.environment}</p></section> : null}{issue.stepsToReproduce?.length ? <section><Label>Steps to reproduce</Label><ol className="mt-2 list-decimal space-y-1 pl-5 text-sm">{issue.stepsToReproduce.map((step) => <li key={step}>{step}</li>)}</ol></section> : null}{issue.testCaseRef ? <p className="inline-flex items-center gap-2 rounded-md border border-[var(--line)] px-3 py-2 font-[var(--mono)] text-xs"><FlaskConical className="size-4" /> {issue.testCaseRef}</p> : null}</div>; }
