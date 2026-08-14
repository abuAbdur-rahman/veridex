import { Check, Copy, MailPlus, Trash2, Users } from "lucide-react";
import { useState } from "react";
import { PageHeader } from "@/components/app/PageHeader";
import { SectionLabel } from "@/components/app/FormField";
import { useDemoStore } from "@/lib/demo-store";

interface TeamSettingsScreenProps { teamId: string; }

export function TeamSettingsScreen({ teamId }: TeamSettingsScreenProps) {
	const teams = useDemoStore((state) => state.teams);
	const teamMembers = useDemoStore((state) => state.teamMembers);
	const pendingInvites = useDemoStore((state) => state.pendingInvites);
	const setCurrentTeam = useDemoStore((state) => state.setCurrentTeam);
	const inviteTeamMember = useDemoStore((state) => state.inviteTeamMember);
	const revokeTeamInvite = useDemoStore((state) => state.revokeTeamInvite);
	const [email, setEmail] = useState("");
	const [status, setStatus] = useState("");
	const [copied, setCopied] = useState(false);
	const team = teams.find(({ id }) => id === teamId);
	const members = teamMembers.filter((member) => member.teamId === teamId);
	const invites = pendingInvites.filter((invite) => invite.teamId === teamId);
	const inviteLink = `${window.location.origin}/join/team/vrx_invite_${teamId}`;

	async function copyLink() {
		try {
			await navigator.clipboard.writeText(inviteLink);
			setCopied(true);
			setStatus("Invite link copied.");
			window.setTimeout(() => setCopied(false), 1600);
		} catch {
			setStatus("Could not copy invite link.");
		}
	}

	return (
		<div className="mx-auto flex w-full max-w-[840px] flex-col gap-8">
			<PageHeader title={`Team: ${team?.name ?? "Unknown team"}`} />
			<section aria-labelledby="invite-member-heading" className="flex flex-col gap-3">
				<SectionLabel><MailPlus className="size-3.5" aria-hidden="true" /> Invite member</SectionLabel>
				<form className="flex flex-col gap-3 rounded-[10px] border border-[var(--line)] bg-[var(--surface)] p-4 sm:flex-row sm:items-end" onSubmit={(event) => {
					event.preventDefault();
					const teamResult = setCurrentTeam(teamId);
					if (!teamResult.ok) { setStatus(teamResult.error); return; }
					const result = inviteTeamMember(email);
					setStatus(result.ok ? `Invite sent to ${result.value.email}.` : result.error);
					if (result.ok) setEmail("");
				}}>
					<label className="flex min-w-0 flex-1 flex-col gap-1.5 text-[13px] font-medium text-[var(--ink)]" htmlFor="team-invite-email">Email address
						<input id="team-invite-email" type="email" autoComplete="email" required value={email} onChange={(event) => setEmail(event.target.value)} placeholder="teammate@company.com" className="rounded-lg border border-[var(--line)] bg-[var(--bg)] px-3.5 py-2.5 text-sm text-[var(--ink)] outline-none focus:border-[var(--accent)] focus:ring-2 focus:ring-[var(--accent-ring)]" />
					</label>
					<button type="submit" className="inline-flex min-h-10 cursor-pointer items-center justify-center gap-2 rounded-lg bg-[var(--accent)] px-4 text-sm font-semibold text-white hover:bg-[var(--accent-strong)]"><MailPlus className="size-4" aria-hidden="true" /> Invite</button>
				</form>
				<p className="min-h-5 text-xs text-[var(--ink-soft)]" role="status" aria-live="polite">{status}</p>
			</section>
			<section aria-label="Shareable invite link">
				<SectionLabel>Shareable invite link</SectionLabel>
				<div className="mt-3 flex items-stretch">
					<div className="min-w-0 flex-1 truncate rounded-l-lg border border-r-0 border-[var(--line)] bg-[var(--bg)] px-3 py-2.5 font-[var(--mono)] text-xs text-[var(--ink)]">{inviteLink}</div>
					<button type="button" onClick={copyLink} aria-label="Copy invite link" className="inline-flex min-w-11 cursor-pointer items-center justify-center rounded-r-lg border border-[var(--line)] bg-[var(--surface)] text-[var(--ink-soft)] hover:bg-[var(--bg-alt)] hover:text-[var(--ink)]">{copied ? <Check className="size-4 text-[var(--pass)]" aria-hidden="true" /> : <Copy className="size-4" aria-hidden="true" />}</button>
				</div>
			</section>
			<section aria-label="Members"><SectionLabel><Users className="size-3.5" aria-hidden="true" /> Members</SectionLabel>
				<ul className="mt-3 overflow-hidden rounded-[10px] border border-[var(--line)] bg-[var(--surface)]">{members.map((member) => <li key={member.id} className="flex items-center gap-3 border-b border-[var(--line-soft)] px-4 py-3 last:border-b-0"><span className="min-w-0 flex-1"><span className="block text-sm font-medium text-[var(--ink)]">{member.name}</span><span className="block truncate font-[var(--mono)] text-xs text-[var(--ink-soft)]">{member.email}</span></span><span className="rounded-[6px] bg-[var(--bg-alt)] px-2.5 py-1 font-[var(--mono)] text-xs uppercase text-[var(--ink-soft)]">{member.role}</span></li>)}</ul>
			</section>
			<section aria-label="Pending invites"><SectionLabel>Pending invites</SectionLabel>
				{invites.length === 0 ? <p className="mt-3 rounded-[10px] border border-[var(--line)] bg-[var(--surface)] px-4 py-8 text-center text-[13px] text-[var(--ink-soft)]">No pending invites.</p> : <ul className="mt-3 overflow-hidden rounded-[10px] border border-[var(--line)] bg-[var(--surface)]">{invites.map((invite) => <li key={invite.id} className="flex items-center gap-3 border-b border-[var(--line-soft)] px-4 py-3 last:border-b-0"><span className="min-w-0 flex-1 truncate font-[var(--mono)] text-xs text-[var(--ink)]">{invite.email}</span><span className="text-xs text-[var(--ink-soft)]">{invite.expiresInDays}d left</span><button type="button" aria-label={`Revoke invite for ${invite.email}`} onClick={() => { if (!window.confirm(`Revoke invite for ${invite.email}?`)) return; const result = revokeTeamInvite(invite.id); setStatus(result.ok ? `Invite for ${invite.email} revoked.` : result.error); }} className="inline-flex size-10 cursor-pointer items-center justify-center rounded-[6px] text-[var(--ink-soft)] hover:bg-[var(--block-bg)] hover:text-[var(--block)]"><Trash2 className="size-4" aria-hidden="true" /></button></li>)}</ul>}
			</section>
		</div>
	);
}
