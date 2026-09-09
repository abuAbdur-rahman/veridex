import { Plus, UserMinus, Users } from "lucide-react";
import { useState } from "react";
import { Avatar } from "@/components/app/Avatar";
import { PageHeader } from "@/components/app/PageHeader";
import { EmptyState } from "@/components/app/EmptyState";
import { useMe } from "@/queries/session";
import {
	useProject,
	useProjectMembers,
	useAddProjectMember,
	useRemoveProjectMember,
	useUpdateProjectMemberRole,
} from "@/queries/projects";
import { useTeamMembers } from "@/queries/teams";
import { PROJECT_ROLES, type ProjectRole } from "@/lib/veridex-types";

interface MembersScreenProps {
	projectId: string;
}
const controlClass =
	"rounded-lg border border-[var(--line)] bg-[var(--surface)] px-3 py-2 text-sm text-[var(--ink)] outline-none transition-[border-color,box-shadow] duration-150 focus:border-[var(--accent)] focus:ring-2 focus:ring-[var(--accent-ring)]";
function initials(name: string) {
	return name
		.split(/\s+/)
		.slice(0, 2)
		.map((part) => part[0]?.toUpperCase() ?? "")
		.join("");
}
function gradient(id: string) {
	return `linear-gradient(135deg, hsl(${Math.abs([...id].reduce((n, c) => n * 31 + c.charCodeAt(0), 0)) % 360} 55% 55%), hsl(${(Math.abs(id.length * 71) + 80) % 360} 60% 65%))`;
}

export function MembersScreen({ projectId }: MembersScreenProps) {
	const { data: me } = useMe();
	const projectQuery = useProject(projectId);
	const membersQuery = useProjectMembers(projectId);
	const teamMembersQuery = useTeamMembers(projectQuery.data?.teamId ?? "");
	const addMember = useAddProjectMember(projectId);
	const updateRole = useUpdateProjectMemberRole(projectId);
	const removeMember = useRemoveProjectMember(projectId);
	const [selectedMemberId, setSelectedMemberId] = useState("");
	const [role, setRole] = useState<ProjectRole>("dev");
	const [status, setStatus] = useState("");
	const members = membersQuery.data ?? [];
	const memberIds = new Set(members.map((member) => member.id));
	const eligible = (teamMembersQuery.data ?? []).filter((member) => !memberIds.has(member.id));
	const canManage = members.some((member) => member.id === me?.user.id && member.role === "admin");

	async function handleAdd() {
		if (!selectedMemberId) {
			setStatus("Select a team member to add.");
			return;
		}
		try {
			await addMember.mutateAsync({ userId: selectedMemberId, role });
			setSelectedMemberId("");
			setStatus("Member added to project.");
		} catch (value) {
			setStatus(value instanceof Error ? value.message : "Could not add member.");
		}
	}
	return (
		<div className="mx-auto flex w-full max-w-[840px] flex-col gap-6">
			<PageHeader title="Members" count={String(members.length)} />
			{projectQuery.isError || membersQuery.isError ? (
				<p
					role="alert"
					className="rounded-md border border-[var(--block)] bg-[var(--block-bg)] px-3 py-2 text-sm text-[var(--block)]"
				>
					{(projectQuery.error ?? membersQuery.error)?.message}
				</p>
			) : null}
			{canManage ? (
				<div className="flex flex-col gap-3 rounded-[10px] border border-[var(--line)] bg-[var(--surface)] p-4 sm:flex-row sm:items-end">
					<label className="flex min-w-0 flex-1 flex-col gap-1.5 text-[13px] font-medium">
						Team member
						<select
							value={selectedMemberId}
							onChange={(event) => setSelectedMemberId(event.target.value)}
							className={controlClass}
						>
							<option value="">
								{eligible.length ? "Select a member" : "No eligible team members"}
							</option>
							{eligible.map((member) => (
								<option key={member.id} value={member.id}>
									{member.name}
								</option>
							))}
						</select>
					</label>
					<label className="flex flex-col gap-1.5 text-[13px] font-medium">
						Project role
						<select
							value={role}
							onChange={(event) => setRole(event.target.value as ProjectRole)}
							className={controlClass}
						>
							{PROJECT_ROLES.map((option) => (
								<option key={option} value={option}>
									{option}
								</option>
							))}
						</select>
					</label>
					<button
						type="button"
						disabled={!selectedMemberId || addMember.isPending}
						onClick={() => void handleAdd()}
						className="inline-flex min-h-10 items-center justify-center gap-2 rounded-lg bg-[var(--accent)] px-4 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-50"
					>
						<Plus className="size-4" aria-hidden="true" />
						{addMember.isPending ? "Adding..." : "Add"}
					</button>
				</div>
			) : null}
			<p className="min-h-5 text-xs text-[var(--ink-soft)]" role="status" aria-live="polite">
				{status}
			</p>
			{membersQuery.isPending ? (
				<p className="py-12 text-center text-sm text-[var(--ink-soft)]">Loading members...</p>
			) : members.length === 0 ? (
				<EmptyState
					icon={Users}
					title="No project members"
					description="Add an eligible team member above."
				/>
			) : (
				<ul className="overflow-hidden rounded-[10px] border border-[var(--line)] bg-[var(--surface)]">
					{members.map((member) => (
						<li
							key={member.id}
							className="flex flex-wrap items-center gap-3 border-b border-[var(--line-soft)] px-4 py-3 last:border-b-0"
						>
							<Avatar
								initials={initials(member.name)}
								gradient={gradient(member.id)}
								name={member.name}
								imageUrl={member.image ?? undefined}
							/>
							<span className="min-w-[140px] flex-1 text-sm font-medium">{member.name}</span>
							{canManage ? (
								<>
									<label className="sr-only" htmlFor={`role-${member.id}`}>
										Role for {member.name}
									</label>
									<select
										id={`role-${member.id}`}
										value={member.role}
										disabled={updateRole.isPending}
										onChange={(event) => {
											void updateRole
												.mutateAsync({ userId: member.id, role: event.target.value as ProjectRole })
												.then(() => setStatus(`${member.name}'s role updated.`))
												.catch((value: unknown) =>
													setStatus(
														value instanceof Error ? value.message : "Could not update role.",
													),
												);
										}}
										className={`${controlClass} font-[var(--mono)] text-xs uppercase`}
									>
										{PROJECT_ROLES.map((option) => (
											<option key={option}>{option}</option>
										))}
									</select>
									<button
										type="button"
										aria-label={`Remove ${member.name}`}
										disabled={removeMember.isPending}
										onClick={() => {
											if (window.confirm(`Remove ${member.name} from this project?`))
												void removeMember
													.mutateAsync(member.id)
													.then(() => setStatus(`${member.name} removed.`))
													.catch((value: unknown) =>
														setStatus(
															value instanceof Error ? value.message : "Could not remove member.",
														),
													);
										}}
										className="inline-flex size-10 items-center justify-center rounded-[6px] text-[var(--ink-soft)] hover:bg-[var(--block-bg)] hover:text-[var(--block)] disabled:opacity-50"
									>
										<UserMinus className="size-4" aria-hidden="true" />
									</button>
								</>
							) : (
								<span className="font-[var(--mono)] text-xs uppercase text-[var(--ink-soft)]">
									{member.role}
								</span>
							)}
						</li>
					))}
				</ul>
			)}
		</div>
	);
}
