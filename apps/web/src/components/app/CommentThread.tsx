import { MessageSquare, Send } from "lucide-react";
import { useState, type FormEvent } from "react";
import type { ServerComment } from "@/api/comments";
import { formatRelativeTime } from "@/lib/format-time";

interface CommentThreadProps {
	comments: ServerComment[];
	pending?: boolean;
	error?: string;
	resolveAuthor: (authorId: string) => string;
	onSubmit: (body: string) => Promise<void>;
}

export function CommentThread({
	comments,
	pending = false,
	error,
	resolveAuthor,
	onSubmit,
}: CommentThreadProps) {
	const [body, setBody] = useState("");
	async function submit(event: FormEvent<HTMLFormElement>) {
		event.preventDefault();
		const nextBody = body.trim();
		if (!nextBody) return;
		try {
			await onSubmit(nextBody);
			setBody("");
		} catch {
			// Parent surfaces the submission error; keep the entered text for retry.
		}
	}
	return (
		<section aria-label="Comments">
			<h3 className="mb-3 flex items-center gap-2 font-[var(--mono)] text-[11px] font-semibold uppercase tracking-[0.08em] text-[var(--ink-soft)]">
				<MessageSquare className="size-3.5" aria-hidden="true" strokeWidth={1.5} />
				Comments ({comments.length})
			</h3>
			{comments.length === 0 ? (
				<p className="rounded-lg border border-[var(--line)] bg-[var(--bg)] px-4 py-5 text-center text-[13px] text-[var(--ink-soft)]">
					No comments yet. Start the conversation.
				</p>
			) : (
				<ul className="flex flex-col gap-4">
					{comments.map((comment) => (
						<li key={comment.id} className="flex gap-3">
							<span className="mt-0.5 grid size-8 shrink-0 place-items-center rounded-full border border-[var(--line)] bg-[var(--bg-alt)] font-[var(--mono)] text-[10px] font-semibold uppercase text-[var(--ink-soft)]">
								{resolveAuthor(comment.authorId).slice(0, 2)}
							</span>
							<div className="min-w-0 flex-1">
								<p className="flex items-baseline gap-2">
									<span className="text-[13px] font-semibold text-[var(--ink)]">
										{resolveAuthor(comment.authorId)}
									</span>
									<span className="font-[var(--mono)] text-[11px] text-[var(--ink-soft)]">
										{formatRelativeTime(comment.createdAt)}
									</span>
								</p>
								<p className="mt-1 text-[13px] leading-[1.5] text-[var(--ink)]">{comment.body}</p>
							</div>
						</li>
					))}
				</ul>
			)}
			<form className="mt-4" onSubmit={(event) => void submit(event)}>
				<label htmlFor="new-comment" className="sr-only">
					Add a comment
				</label>
				<textarea
					id="new-comment"
					rows={2}
					maxLength={5000}
					required
					value={body}
					disabled={pending}
					onChange={(event) => setBody(event.target.value)}
					placeholder="Add a comment..."
					className="w-full rounded-lg border border-[var(--line)] bg-[var(--bg)] px-3 py-2.5 text-[13px] text-[var(--ink)] outline-none transition-[border-color,box-shadow] duration-150 placeholder:text-[var(--ink-soft)] focus:border-[var(--accent)] focus:ring-2 focus:ring-[var(--accent-ring)] disabled:opacity-60"
				/>
				<div className="mt-2 flex items-center justify-between gap-3">
					<p role="alert" className="text-xs text-[var(--block)]">{error}</p>
					<button
						type="submit"
						disabled={pending || !body.trim()}
						className="ml-auto inline-flex min-h-9 items-center gap-2 rounded-md bg-[var(--accent)] px-3 text-xs font-semibold text-white hover:bg-[var(--accent-strong)] disabled:opacity-50"
					>
						<Send className="size-3.5" aria-hidden="true" />
						{pending ? "Posting..." : "Post comment"}
					</button>
				</div>
			</form>
		</section>
	);
}
