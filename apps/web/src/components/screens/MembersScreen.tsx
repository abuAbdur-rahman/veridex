import { Plus, UserMinus, Users } from "lucide-react";
import { useState } from "react";
import { Avatar } from "@/components/app/Avatar";
import { PageHeader } from "@/components/app/PageHeader";
import { useDemoStore } from "@/lib/demo-store";
import { PROJECT_ROLES, type ProjectRole } from "@/lib/veridex-types";

interface MembersScreenProps {
	projectId: string;
}

const controlClass = "rounded-lg border border-[var(--line)] bg-[var(--surface)] px-3 py-2 text-sm text-[var(--ink)] outline-none transition-[border-color,box-shadow] duration-150 focus:border-[var(--accent)] focus:ring-2 focus:ring-[var(--accent-ring)]";

export function MembersScreen({ projectId }: MembersScreenProps) {
	const projects = useDemoStore((state) => state.projects);
	const projectMembers = useDemoStore((state) => state.projectMembers);
	const teamMembers = useDemoStore((state) => state.teamMembers);
	const addProjectMember = useDemoStore((state) => state.addProjectMember);
	const setProjectMemberRole = useDemoStore((state) => state.setProjectMemberRole);
	const removeProjectMember = useDemoStore((state) => state.removeProjectMember);
	const [selectedMemberId, setSelectedMemberId] = useState("");
	const [role, setRole] = useState<ProjectRole>("dev");
	const [status, setStatus] = useState("");

	const project = projects.find(({ id }) => id === projectId);
	const members = projectMembers.filter((member) => member.projectId === projectId);
	const memberNames = new Set(members.map((member) => member.name.toLowerCase()));
	const eligibleMembers = teamMembers.filter((member) =>
		member.teamId === project?.teamId && !memberNames.has(member.name.toLowerCase()),
	);

	function handleAddMember() {
		const teamMember = eligibleMembers.find(({ id }) => id === selectedMemberId);
		if (!teamMember) {
			setStatus("Select a team member to add.");
			return;
		}
		const result = addProjectMember({ projectId, name: teamMember.name, role });
		setStatus(result.ok ? `${teamMember.name} added to project.` : result.error);
		if (result.ok) setSelectedMemberId("");
	}

	return (
		<div className="mx-auto flex w-full max-w-[840px] flex-col gap-6">
			<PageHeader title="Members" count={String(members.length)} />
			<div className="flex flex-col gap-3 rounded-[10px] border border-[var(--line)] bg-[var(--surface)] p-4 sm:flex-row sm:items-end">
				<label className="flex min-w-0 flex-1 flex-col gap-1.5 text-[13px] font-medium text-[var(--ink)]">
					Team member
					<select value={selectedMemberId} onChange={(event) => setSelectedMemberId(event.target.value)} className={controlClass}>
						<option value="">{eligibleMembers.length ? "Select a member" : "No eligible team members"}</option>
						{eligibleMembers.map((member) => <option key={member.id} value={member.id}>{member.name}</option>)}
					</select>
				</label>
				<label className="flex flex-col gap-1.5 text-[13px] font-medium text-[var(--ink)]">
					Project role
					<select value={role} onChange={(event) => setRole(event.target.value as ProjectRole)} className={controlClass}>
						{PROJECT_ROLES.map((option) => <option key={option} value={option}>{option}</option>)}
					</select>
				</label>
				<button type="button" disabled={!selectedMemberId} onClick={handleAddMember} className="inline-flex min-h-10 cursor-pointer items-center justify-center gap-2 rounded-lg bg-[var(--accent)] px-4 text-sm font-semibold text-white transition-colors hover:bg-[var(--accent-strong)] disabled:cursor-not-allowed disabled:opacity-50">
					<Plus className="size-4" aria-hidden="true" /> Add
				</button>
			</div>
			<p className="min-h-5 text-xs text-[var(--ink-soft)]" role="status" aria-live="polite">{status}</p>
			{members.length === 0 ? (
				<div className="grid place-items-center gap-2 rounded-[10px] border border-[var(--line)] bg-[var(--surface)] px-6 py-12 text-center">
					<Users className="size-7 text-[var(--ink-soft)]" aria-hidden="true" />
					<p className="text-sm font-semibold text-[var(--ink)]">No project members</p>
					<p className="text-[13px] text-[var(--ink-soft)]">Add an eligible team member above.</p>
				</div>
			) : (
				<ul className="overflow-hidden rounded-[10px] border border-[var(--line)] bg-[var(--surface)]">
					{members.map((member) => (
						<li key={member.id} className="flex flex-wrap items-center gap-3 border-b border-[var(--line-soft)] px-4 py-3 last:border-b-0">
							<Avatar initials={member.initials} gradient={member.gradient} name={member.name} />
							<span className="min-w-[140px] flex-1 text-sm font-medium text-[var(--ink)]">{member.name}</span>
							<label className="sr-only" htmlFor={`role-${member.id}`}>Role for {member.name}</label>
							<select id={`role-${member.id}`} value={member.role} onChange={(event) => {
								const result = setProjectMemberRole(member.id, event.target.value as ProjectRole);
								setStatus(result.ok ? `${member.name}'s role updated.` : result.error);
							}} className={`${controlClass} font-[var(--mono)] text-xs uppercase`}>
								{PROJECT_ROLES.map((option) => <option key={option} value={option}>{option}</option>)}
							</select>
							<button type="button" aria-label={`Remove ${member.name}`} onClick={() => {
								if (!window.confirm(`Remove ${member.name} from this project?`)) return;
								const result = removeProjectMember(member.id);
								setStatus(result.ok ? `${member.name} removed.` : result.error);
							}} className="inline-flex size-10 cursor-pointer items-center justify-center rounded-[6px] text-[var(--ink-soft)] hover:bg-[var(--block-bg)] hover:text-[var(--block)]">
								<UserMinus className="size-4" aria-hidden="true" />
							</button>
						</li>
					))}
				</ul>
			)}
		</div>
	);
}
