import { MessageSquare } from "lucide-react";
import type { IssueComment } from "@/lib/veridex-types";
import { Avatar } from "@/components/app/Avatar";
import { formatRelativeTime } from "@/lib/format-time";

interface CommentThreadProps {
	comments: IssueComment[];
}

export function CommentThread({ comments }: CommentThreadProps) {
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
							<Avatar
								initials={comment.author.initials}
								gradient={comment.author.gradient}
								name={comment.author.name}
								className="mt-0.5"
							/>
							<div className="min-w-0 flex-1">
								<p className="flex items-baseline gap-2">
									<span className="text-[13px] font-semibold text-[var(--ink)]">
										{comment.author.name}
									</span>
									<span className="font-[var(--mono)] text-[11px] text-[var(--ink-soft)]">
										{formatRelativeTime(comment.at)}
									</span>
								</p>
								<p className="mt-1 text-[13px] leading-[1.5] text-[var(--ink)]">
									{comment.body}
								</p>
							</div>
						</li>
					))}
				</ul>
			)}
			<div className="mt-4">
				<label htmlFor="new-comment" className="sr-only">
					Add a comment
				</label>
				<textarea
					id="new-comment"
					rows={2}
					placeholder="Add a comment..."
					className="w-full rounded-lg border border-[var(--line)] bg-[var(--bg)] px-3 py-2.5 text-[13px] text-[var(--ink)] outline-none transition-[border-color,box-shadow] duration-150 placeholder:text-[var(--ink-soft)] focus:border-[var(--accent)] focus:ring-2 focus:ring-[var(--accent-ring)]"
				/>
			</div>
		</section>
	);
}
