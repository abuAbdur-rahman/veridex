import { BadgeCheck, Loader2 } from "lucide-react";
import { LogoMark } from "@/components/layout/LogoMark";
import { ThemeToggle } from "@/components/theme/ThemeToggle";

interface InviteAcceptScreenProps {
	teamName: string;
	inviteEmail?: string;
	state?: "loading" | "valid" | "expired" | "accepted" | "invalid";
	busy?: boolean;
	error?: string;
	onAccept?: () => void;
	onDecline?: () => void;
}

export function InviteAcceptScreen({
	teamName,
	inviteEmail,
	state = "valid",
	busy = false,
	error,
	onAccept,
	onDecline,
}: InviteAcceptScreenProps) {
	const errorByState: Record<string, string> = {
		expired: "This invite has expired. Ask the team admin to send a new one.",
		accepted: "This invite has already been used.",
		invalid: error ?? "This invite link isn't valid.",
	};

	return (
		<main className="grid min-h-dvh place-items-center bg-[var(--bg)] px-4">
			<div className="w-full max-w-[420px]">
				<header className="mb-10 flex items-center justify-between">
					<LogoMark />
					<ThemeToggle />
				</header>
				{state === "loading" ? (
					<div role="status" className="flex items-center gap-3 text-sm text-[var(--ink-soft)]">
						<Loader2 className="size-5 animate-spin" aria-hidden="true" /> Validating invite...
					</div>
				) : state === "valid" ? (
					<>
						<div className="mb-6 grid size-12 place-items-center rounded-xl bg-[var(--pass-bg)]">
							<BadgeCheck
								className="size-6 text-[var(--pass)]"
								aria-hidden="true"
								strokeWidth={1.5}
							/>
						</div>
						<h1 className="mb-2 font-[var(--mono)] text-2xl font-semibold tracking-[-0.02em] text-[var(--ink)]">
							You've been invited to join
						</h1>
						<p className="mb-1 text-base font-semibold text-[var(--ink)]">
							&ldquo;{teamName}&rdquo;
						</p>
						{inviteEmail ? (
							<p className="mb-8 text-sm text-[var(--ink-soft)]">
								This invite is for {inviteEmail}.
							</p>
						) : null}
						{error ? (
							<p
								role="alert"
								className="mb-4 rounded-md border border-[var(--block)] bg-[var(--block-bg)] px-3 py-2 text-sm text-[var(--block)]"
							>
								{error}
							</p>
						) : null}
						<div className="flex gap-3">
							<button
								type="button"
								onClick={onAccept}
								disabled={busy}
								className="flex min-h-11 flex-1 cursor-pointer items-center justify-center rounded-lg bg-[var(--accent)] px-4 text-sm font-semibold text-white transition-colors duration-150 hover:bg-[var(--accent-strong)] disabled:cursor-wait disabled:opacity-60"
							>
								{busy ? "Accepting..." : "Accept Invite"}
							</button>
							<button
								type="button"
								onClick={onDecline}
								disabled={busy}
								className="flex min-h-11 cursor-pointer items-center justify-center rounded-lg border border-[var(--line)] bg-[var(--surface)] px-4 text-sm font-semibold text-[var(--ink)] transition-colors duration-150 hover:bg-[var(--bg-alt)] disabled:cursor-not-allowed disabled:opacity-60"
							>
								Decline
							</button>
						</div>
					</>
				) : (
					<div className="rounded-xl border border-[var(--line)] bg-[var(--surface)] p-6">
						<h1 className="mb-2 font-[var(--mono)] text-lg font-semibold text-[var(--ink)]">
							Invite unavailable
						</h1>
						<p className="text-sm text-[var(--ink-soft)]">{errorByState[state]}</p>
					</div>
				)}
			</div>
		</main>
	);
}
