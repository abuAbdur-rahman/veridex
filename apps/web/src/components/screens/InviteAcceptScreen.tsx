import { BadgeCheck } from "lucide-react";
import { LogoMark } from "@/components/layout/LogoMark";
import { ThemeToggle } from "@/components/theme/ThemeToggle";

interface InviteAcceptScreenProps {
	teamName: string;
	invitedBy: string;
	state?: "valid" | "expired" | "accepted" | "invalid";
	onAccept?: () => void;
	onDecline?: () => void;
}

export function InviteAcceptScreen({
	teamName,
	invitedBy,
	state = "valid",
	onAccept,
	onDecline,
}: InviteAcceptScreenProps) {
	const errorByState: Record<string, string> = {
		expired: "This invite has expired. Ask the team admin to send a new one.",
		accepted: "This invite has already been used.",
		invalid: "This invite link isn't valid.",
	};

	return (
		<main className="grid min-h-dvh place-items-center bg-[var(--bg)] px-4">
			<div className="w-full max-w-[420px]">
				<header className="mb-10 flex items-center justify-between">
					<LogoMark />
					<ThemeToggle />
				</header>
				{state === "valid" ? (
					<>
						<div className="mb-6 grid size-12 place-items-center rounded-xl bg-[var(--pass-bg)]">
							<BadgeCheck className="size-6 text-[var(--pass)]" aria-hidden="true" strokeWidth={1.5} />
						</div>
						<h1 className="mb-2 font-[var(--mono)] text-2xl font-semibold tracking-[-0.02em] text-[var(--ink)]">
							You've been invited to join
						</h1>
						<p className="mb-1 text-base font-semibold text-[var(--ink)]">
							&ldquo;{teamName}&rdquo;
						</p>
						<p className="mb-8 text-sm text-[var(--ink-soft)]">
							Invited by {invitedBy}
						</p>
						<div className="flex gap-3">
							<button
								type="button"
								onClick={onAccept}
								className="flex min-h-11 flex-1 cursor-pointer items-center justify-center rounded-lg bg-[var(--accent)] px-4 text-sm font-semibold text-white transition-colors duration-150 hover:bg-[var(--accent-strong)]"
							>
								Accept Invite
							</button>
							<button
								type="button"
								onClick={onDecline}
								className="flex min-h-11 cursor-pointer items-center justify-center rounded-lg border border-[var(--line)] bg-[var(--surface)] px-4 text-sm font-semibold text-[var(--ink)] transition-colors duration-150 hover:bg-[var(--bg-alt)]"
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