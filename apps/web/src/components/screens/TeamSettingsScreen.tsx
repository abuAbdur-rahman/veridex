import { Check, Copy, MailPlus, Users } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { PageHeader } from "@/components/app/PageHeader";
import { SectionLabel } from "@/components/app/FormField";
import { ApiError } from "@/api/client";
import { createTeamInvite } from "@/api/teams";
import { useTeamMembers, useTeams } from "@/queries/teams";

interface TeamSettingsScreenProps { teamId: string; }

export function TeamSettingsScreen({ teamId }: TeamSettingsScreenProps) {
	const { data: teams } = useTeams();
	const { data: members, isPending: membersPending, error: membersError } = useTeamMembers(teamId);
	const teamName = teams?.find((team) => team.id === teamId)?.name ?? "Team";
	const [email, setEmail] = useState("");
	const [status, setStatus] = useState("");
	const [inviteLink, setInviteLink] = useState("");
	const [copied, setCopied] = useState(false);
	const [inviteBusy, setInviteBusy] = useState(false);

	async function submitInvite(event: React.FormEvent<HTMLFormElement>) {
		event.preventDefault();
		setInviteBusy(true);
		setStatus("");
		try {
			const invite = await createTeamInvite(teamId, { email, teamRole: "member" });
			const link = `${window.location.origin}/join/team/${invite.token}`;
			setInviteLink(link);
			setEmail("");
			setStatus(`Invite created for ${invite.email}. Copy the link to share it.`);
		} catch (error) {
			setStatus(error instanceof ApiError ? error.message : "Could not create invite.");
		} finally {
			setInviteBusy(false);
		}
	}

	async function copyLink() {
		if (!inviteLink) return;
		try {
			await navigator.clipboard.writeText(inviteLink);
			setCopied(true);
			toast.success("Invite link copied.");
			window.setTimeout(() => setCopied(false), 1600);
		} catch {
			setStatus("Could not copy invite link.");
		}
	}

	return (
		<div className="mx-auto flex w-full max-w-[840px] flex-col gap-8">
			<PageHeader title={`Team: ${teamName}`} />
			<section aria-labelledby="invite-member-heading" className="flex flex-col gap-3">
				<SectionLabel><MailPlus className="size-3.5" aria-hidden="true" /> Invite member</SectionLabel>
				<form className="flex flex-col gap-3 rounded-[10px] border border-[var(--line)] bg-[var(--surface)] p-4 sm:flex-row sm:items-end" onSubmit={(event) => void submitInvite(event)}>
					<label className="flex min-w-0 flex-1 flex-col gap-1.5 text-[13px] font-medium text-[var(--ink)]" htmlFor="team-invite-email">Email address
						<input id="team-invite-email" type="email" autoComplete="email" required value={email} onChange={(event) => setEmail(event.target.value)} placeholder="teammate@company.com" className="rounded-lg border border-[var(--line)] bg-[var(--bg)] px-3.5 py-2.5 text-sm text-[var(--ink)] outline-none focus:border-[var(--accent)] focus:ring-2 focus:ring-[var(--accent-ring)]" />
					</label>
					<button type="submit" disabled={inviteBusy} className="inline-flex min-h-10 cursor-pointer items-center justify-center gap-2 rounded-lg bg-[var(--accent)] px-4 text-sm font-semibold text-white hover:bg-[var(--accent-strong)] disabled:cursor-wait disabled:opacity-60"><MailPlus className="size-4" aria-hidden="true" /> {inviteBusy ? "Creating..." : "Create invite"}</button>
				</form>
				<p className="min-h-5 text-xs text-[var(--ink-soft)]" role="status" aria-live="polite">{status}</p>
			</section>
			{inviteLink ? <section aria-label="Shareable invite link">
				<SectionLabel>Shareable invite link</SectionLabel>
				<div className="mt-3 flex items-stretch">
					<div className="min-w-0 flex-1 truncate rounded-l-lg border border-r-0 border-[var(--line)] bg-[var(--bg)] px-3 py-2.5 font-[var(--mono)] text-xs text-[var(--ink)]">{inviteLink}</div>
					<button type="button" onClick={() => void copyLink()} aria-label="Copy invite link" className="inline-flex min-w-11 cursor-pointer items-center justify-center rounded-r-lg border border-[var(--line)] bg-[var(--surface)] text-[var(--ink-soft)] hover:bg-[var(--bg-alt)] hover:text-[var(--ink)]">{copied ? <Check className="size-4 text-[var(--pass)]" aria-hidden="true" /> : <Copy className="size-4" aria-hidden="true" />}</button>
				</div>
				<p className="mt-2 text-xs text-[var(--ink-soft)]">The server does not expose pending-invite listing or revoke operations.</p>
			</section> : null}
			<section aria-label="Members"><SectionLabel><Users className="size-3.5" aria-hidden="true" /> Members</SectionLabel>
				{membersPending ? <p className="mt-3 rounded-[10px] border border-[var(--line)] bg-[var(--surface)] px-4 py-8 text-center text-[13px] text-[var(--ink-soft)]">Loading members...</p> : null}
				{membersError ? <p role="alert" className="mt-3 rounded-[10px] border border-[var(--block)] bg-[var(--block-bg)] px-4 py-3 text-sm text-[var(--block)]">{membersError instanceof ApiError ? membersError.message : "Could not load members."}</p> : null}
				{members && members.length === 0 ? <p className="mt-3 rounded-[10px] border border-[var(--line)] bg-[var(--surface)] px-4 py-8 text-center text-[13px] text-[var(--ink-soft)]">No members found.</p> : null}
				{members && members.length > 0 ? <ul className="mt-3 overflow-hidden rounded-[10px] border border-[var(--line)] bg-[var(--surface)]">{members.map((member) => <li key={member.id} className="flex items-center gap-3 border-b border-[var(--line-soft)] px-4 py-3 last:border-b-0"><span className="min-w-0 flex-1"><span className="block text-sm font-medium text-[var(--ink)]">{member.name}</span><span className="block truncate font-[var(--mono)] text-xs text-[var(--ink-soft)]">{member.email}</span></span><span className="rounded-[6px] bg-[var(--bg-alt)] px-2.5 py-1 font-[var(--mono)] text-xs uppercase text-[var(--ink-soft)]">{member.teamRole}</span></li>)}</ul> : null}
			</section>
		</div>
	);
}
