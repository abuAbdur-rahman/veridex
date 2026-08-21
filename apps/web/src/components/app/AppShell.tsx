import { useQueryClient } from "@tanstack/react-query";
import { Link, useNavigate, useRouterState } from "@tanstack/react-router";
import {
	ChevronsUpDown,
	EllipsisVertical,
	LayoutDashboard,
	LayoutGrid,
	LogOut,
	Menu,
	Plus,
	Search,
	Settings,
	Trash2,
	Upload,
	Users,
	Workflow,
	X,
} from "lucide-react";
import { useEffect, useState, type ReactNode } from "react";

import { Avatar } from "@/components/app/Avatar";
import { CreateTeamModal } from "@/components/app/CreateTeamModal";
import { WorkspaceTeamContext } from "@/components/app/workspace-team";
import { ViewSwitcher } from "@/components/app/ViewSwitcher";
import { LogoMark } from "@/components/layout/LogoMark";
import { ThemeToggle } from "@/components/theme/ThemeToggle";
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuGroup,
	DropdownMenuItem,
	DropdownMenuLabel,
	DropdownMenuSeparator,
	DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogHeader,
	DialogTitle,
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import { deriveProfile, type DerivedProfile } from "@/api/session";
import { createTeam } from "@/api/teams";
import { useMe } from "@/queries/session";
import { teamsQueryKey, useTeams } from "@/queries/teams";
import { useDeleteProject, useProject, useProjectMembers, useProjects } from "@/queries/projects";
import { useDemoStore } from "@/stores/demo-store";
import { isRoleView, type RoleView } from "@/lib/veridex-types";

const workspacePrefixes = ["/dashboard", "/projects/", "/teams/", "/profile", "/settings"];

export function RootLayout({ children }: { children: ReactNode }) {
	const pathname = useRouterState({ select: (state) => state.location.pathname });
	const isWorkspace = workspacePrefixes.some(
		(prefix) => pathname === prefix || pathname.startsWith(prefix),
	);
	return isWorkspace ? <AppShell>{children}</AppShell> : children;
}

function getProjectId(pathname: string) {
	return pathname.match(/^\/projects\/([^/]+)/)?.[1];
}

function getPageLabel(pathname: string) {
	if (pathname === "/dashboard") return "Projects";
	if (pathname.endsWith("/import")) return "Import";
	if (pathname.endsWith("/members")) return "Members";
	if (pathname.includes("/teams/")) return "Team settings";
	if (pathname === "/profile/mcp") return "MCP connection";
	if (pathname === "/profile/settings") return "Personal settings";
	return "Issue board";
}

export function AppShell({ children }: { children: ReactNode }) {
	const pathname = useRouterState({ select: (state) => state.location.pathname });
	const search = useRouterState({ select: (state) => state.location.search });
	const navigate = useNavigate();
	const [activeTeamId, setActiveTeamId] = useState("");
	const [navOpen, setNavOpen] = useState(false);
	const [logoutError, setLogoutError] = useState("");
	const [logoutOpen, setLogoutOpen] = useState(false);
	const [logoutBusy, setLogoutBusy] = useState(false);
	const projectId = getProjectId(pathname);
	const project = useProject(projectId ?? "").data;
	const { data: me } = useMe();
	const { data: projectMembers } = useProjectMembers(projectId ?? "");
	const projectRole = projectMembers?.find((member) => member.id === me?.user.id)?.role;
	const view = isRoleView(search.view)
		? search.view
		: projectRole === "admin"
			? "all"
			: (projectRole ?? "dev");
	const query = "q" in search && typeof search.q === "string" ? search.q : "";

	useEffect(() => setNavOpen(false), [pathname]);
	useEffect(() => {
		if (project?.teamId) {
			setActiveTeamId(project.teamId);
		}
	}, [project?.teamId]);

	function updateProjectSearch(next: { view?: RoleView; q?: string }) {
		if (!projectId) return;
		void navigate({
			to: "/projects/$projectId",
			params: { projectId },
			search: (previous) => ({ ...previous, ...next }),
			replace: true,
		});
	}

	return (
		<WorkspaceTeamContext.Provider value={{ teamId: activeTeamId, setTeamId: setActiveTeamId }}>
			<div className="flex h-dvh overflow-hidden bg-[var(--bg)] text-[var(--ink)]">
				<a
					href="#workspace-content"
					className="sr-only z-[70] bg-[var(--surface)] p-3 focus:not-sr-only"
				>
					Skip to content
				</a>
				{navOpen ? (
					<button
						type="button"
						className="fixed inset-0 z-40 bg-black/50 lg:hidden"
						onClick={() => setNavOpen(false)}
						aria-label="Close navigation"
					/>
				) : null}
				<div
					className={cn(
						"fixed inset-y-0 left-0 z-50 transition-transform lg:static lg:translate-x-0",
						navOpen ? "translate-x-0" : "-translate-x-full lg:translate-x-0",
					)}
				>
					<Sidebar
						projectId={projectId}
						pathname={pathname}
						activeTeamId={activeTeamId}
						onTeamChange={setActiveTeamId}
						onClose={() => setNavOpen(false)}
						onLogout={() => {
							setLogoutError("");
							setLogoutOpen(true);
						}}
					/>
				</div>
				<Dialog
					open={logoutOpen}
					onOpenChange={(open) => {
						if (!logoutBusy) setLogoutOpen(open);
					}}
				>
					<DialogContent className="max-w-[420px] gap-0 overflow-hidden border border-[var(--line)] bg-[var(--surface)] p-0 text-[var(--ink)] sm:max-w-[420px]">
						<DialogHeader className="border-b border-[var(--line)] px-5 py-4 pr-14">
							<DialogTitle className="font-[var(--mono)] text-base font-semibold">
								Log out of Veridex?
							</DialogTitle>
							<DialogDescription className="mt-2 text-sm leading-6 text-[var(--ink-soft)]">
								You will need to sign in again to access projects, issues, and MCP settings.
							</DialogDescription>
						</DialogHeader>
						<div className="p-5">
							{logoutError ? (
								<p
									role="alert"
									className="mb-4 rounded-md border border-[var(--block)] bg-[var(--block-bg)] px-3 py-2 text-sm text-[var(--block)]"
								>
									{logoutError}
								</p>
							) : null}
							<div className="flex justify-end gap-3">
								<button
									type="button"
									disabled={logoutBusy}
									onClick={() => setLogoutOpen(false)}
									className="min-h-10 rounded-md border border-[var(--line)] px-4 text-sm font-semibold hover:bg-[var(--bg-alt)] disabled:opacity-50"
								>
									Cancel
								</button>
								<button
									type="button"
									disabled={logoutBusy}
									onClick={async () => {
										setLogoutBusy(true);
										setLogoutError("");
										try {
											const response = await fetch("/api/auth/sign-out", {
												method: "POST",
												credentials: "include",
											});
											if (!response.ok) throw new Error("Sign out failed");
											window.location.assign("/login");
										} catch {
											setLogoutError("Sign out failed. Try again.");
											setLogoutBusy(false);
										}
									}}
									className="inline-flex min-h-10 min-w-[92px] items-center justify-center rounded-md border border-[var(--line)] bg-[var(--surface)] px-4 text-sm font-semibold text-[var(--ink)] hover:bg-[var(--bg-alt)] disabled:opacity-50"
								>
									{logoutBusy ? "Logging out..." : "Log out"}
								</button>
							</div>
						</div>
					</DialogContent>
				</Dialog>
				<div className="flex min-w-0 flex-1 flex-col">
					<header className="sticky top-0 z-30 flex min-h-[60px] items-center gap-3 border-b border-[var(--line)] bg-[color:var(--surface)] px-3 sm:px-5">
						<button
							type="button"
							onClick={() => setNavOpen(true)}
							aria-label="Open navigation"
							className="grid size-10 shrink-0 place-items-center rounded-md text-[var(--ink-soft)] hover:bg-[var(--bg-alt)] lg:hidden"
						>
							<Menu className="size-5" aria-hidden="true" />
						</button>
						<div className="min-w-0">
							<p className="truncate font-[var(--mono)] text-[10px] uppercase text-[var(--ink-soft)]">
								{project?.name ?? "Veridex workspace"}
							</p>
							<p className="truncate text-sm font-semibold">{getPageLabel(pathname)}</p>
						</div>
						{projectId && pathname === `/projects/${projectId}` ? (
							<>
								<label className="ml-auto hidden min-w-0 max-w-[300px] flex-1 items-center gap-2 rounded-md border border-[var(--line)] bg-[var(--bg)] px-3 md:flex">
									<Search className="size-4 shrink-0 text-[var(--ink-soft)]" aria-hidden="true" />
									<span className="sr-only">Search issues</span>
									<input
										value={query}
										onChange={(event) =>
											updateProjectSearch({ q: event.target.value || undefined })
										}
										placeholder="Search reference or title"
										className="h-9 min-w-0 flex-1 bg-transparent text-sm outline-none placeholder:text-[var(--ink-soft)]"
									/>
								</label>
								<ViewSwitcher
									value={view}
									onChange={(nextView) => updateProjectSearch({ view: nextView })}
									label="Role view"
								/>
							</>
						) : (
							<div className="ml-auto" />
						)}
						<ThemeToggle />
					</header>
					<main
						id="workspace-content"
						className="min-h-0 flex-1 overflow-y-auto overflow-x-hidden p-4 sm:p-6 lg:p-8"
					>
						{children}
					</main>
				</div>
			</div>
		</WorkspaceTeamContext.Provider>
	);
}

function Sidebar({
	projectId,
	pathname,
	activeTeamId,
	onTeamChange,
	onClose,
	onLogout,
}: {
	projectId?: string;
	pathname: string;
	activeTeamId: string;
	onTeamChange: (teamId: string) => void;
	onClose: () => void;
	onLogout: () => void;
}) {
	const navigate = useNavigate();
	const queryClient = useQueryClient();
	const { data: serverTeams } = useTeams();
	const currentTeamId = useDemoStore((state) => state.currentTeamId);
	const { data: me } = useMe();
	const [teamOpen, setTeamOpen] = useState(false);
	const [teamError, setTeamError] = useState("");
	const [teamBusy, setTeamBusy] = useState(false);
	const [deleteProjectTarget, setDeleteProjectTarget] = useState<{
		id: string;
		name: string;
	} | null>(null);
	const [deleteProjectError, setDeleteProjectError] = useState("");
	const demoProfile = useDemoStore((state) => state.profile);
	const profile: DerivedProfile = me?.user
		? deriveProfile(me.user)
		: {
				id: demoProfile.id,
				name: demoProfile.name,
				username: demoProfile.username,
				email: demoProfile.email,
				initials: demoProfile.initials,
				gradient: demoProfile.gradient,
			};
	const teams = serverTeams ?? me?.teams ?? [];
	const currentTeam =
		teams.find((team) => team.id === activeTeamId) ??
		teams.find((team) => team.id === currentTeamId) ??
		teams[0];
	const { data: serverProjects } = useProjects(currentTeam?.id ?? "");
	const deleteProjectMutation = useDeleteProject(currentTeam?.id ?? "");
	const teamProjects = serverProjects ?? [];

	function switchTeam(teamId: string) {
		onTeamChange(teamId);
		void navigate({ to: "/dashboard" });
	}

	async function handleCreateTeamSubmit(values: { name: string; slug: string }) {
		setTeamError("");
		setTeamBusy(true);
		try {
			const team = await createTeam(values);
			setTeamOpen(false);
			queryClient.setQueryData(teamsQueryKey, (current: typeof serverTeams) => [
				...(current ?? []),
				team,
			]);
			onTeamChange(team.id);
			void navigate({ to: "/teams/$teamId/settings", params: { teamId: team.id } });
		} catch (error) {
			setTeamError(error instanceof Error ? error.message : "Could not create team.");
			setTeamBusy(false);
		}
	}

	async function handleDeleteProject() {
		if (!deleteProjectTarget) return;
		setDeleteProjectError("");
		try {
			await deleteProjectMutation.mutateAsync(deleteProjectTarget.id);
			const deletedProjectId = deleteProjectTarget.id;
			setDeleteProjectTarget(null);
			if (projectId === deletedProjectId) void navigate({ to: "/dashboard" });
		} catch (error) {
			setDeleteProjectError(error instanceof Error ? error.message : "Could not delete project.");
		}
	}

	return (
		<aside
			className="flex h-dvh w-[256px] flex-col border-r border-[var(--line)] bg-[var(--surface)]"
			aria-label="Workspace navigation"
		>
			<div className="flex h-[60px] items-center gap-3 border-b border-[var(--line)] px-3">
				<Link to="/dashboard" className="inline-flex" aria-label="Veridex dashboard">
					<LogoMark />
				</Link>
				<button
					type="button"
					onClick={onClose}
					className="ml-auto grid size-9 place-items-center rounded-md text-[var(--ink-soft)] hover:bg-[var(--bg-alt)] lg:hidden"
					aria-label="Close navigation"
				>
					<X className="size-4" />
				</button>
			</div>
			<div className="p-2">
				<DropdownMenu>
					<DropdownMenuTrigger className="flex w-full items-center gap-2 rounded-md border border-[var(--line)] px-2.5 py-2 text-left hover:bg-[var(--bg)]">
						<span className="grid size-7 place-items-center rounded bg-[var(--ink)] font-[var(--mono)] text-xs font-bold text-[var(--surface)]">
							{currentTeam?.name.slice(0, 2).toUpperCase()}
						</span>
						<span className="min-w-0 flex-1 truncate text-sm font-semibold">
							{currentTeam?.name}
						</span>
						<ChevronsUpDown className="size-4 text-[var(--ink-soft)]" />
					</DropdownMenuTrigger>
					<DropdownMenuContent className="min-w-[232px]">
						<DropdownMenuGroup>
							<DropdownMenuLabel>Switch team</DropdownMenuLabel>
							{teams.map((team) => (
								<DropdownMenuItem key={team.id} onClick={() => switchTeam(team.id)}>
									{team.name}
								</DropdownMenuItem>
							))}
						</DropdownMenuGroup>
						<DropdownMenuSeparator />
						<DropdownMenuItem
							onClick={() => {
								setTeamError("");
								setTeamOpen(true);
							}}
						>
							<Plus /> Create team
						</DropdownMenuItem>
						<DropdownMenuItem
							onClick={() =>
								currentTeam &&
								void navigate({ to: "/teams/$teamId/settings", params: { teamId: currentTeam.id } })
							}
						>
							<Settings /> Team settings
						</DropdownMenuItem>
					</DropdownMenuContent>
				</DropdownMenu>
			</div>
			<CreateTeamModal
				open={teamOpen}
				pending={teamBusy}
				error={teamError}
				onClose={() => {
					setTeamOpen(false);
					setTeamError("");
				}}
				onSubmit={handleCreateTeamSubmit}
			/>
			<Dialog
				open={deleteProjectTarget !== null}
				onOpenChange={(open) => {
					if (!deleteProjectMutation.isPending && !open) {
						setDeleteProjectTarget(null);
						setDeleteProjectError("");
					}
				}}
			>
				<DialogContent className="max-w-[420px] gap-0 overflow-hidden border border-[var(--line)] bg-[var(--surface)] p-0 text-[var(--ink)] sm:max-w-[420px]">
					<DialogHeader className="border-b border-[var(--line)] px-5 py-4 pr-14">
						<DialogTitle className="font-[var(--mono)] text-base font-semibold">
							Delete {deleteProjectTarget?.name}?
						</DialogTitle>
						<DialogDescription className="mt-2 text-sm leading-6 text-[var(--ink-soft)]">
							This permanently deletes the project and its issues, members, imports, tags, and test cases.
						</DialogDescription>
					</DialogHeader>
					<div className="p-5">
						{deleteProjectError ? (
							<p role="alert" className="mb-4 rounded-md border border-[var(--block)] bg-[var(--block-bg)] px-3 py-2 text-sm text-[var(--block)]">
								{deleteProjectError}
							</p>
						) : null}
						<div className="flex justify-end gap-3">
							<button
								type="button"
								disabled={deleteProjectMutation.isPending}
								onClick={() => setDeleteProjectTarget(null)}
								className="min-h-10 rounded-md border border-[var(--line)] px-4 text-sm font-semibold hover:bg-[var(--bg-alt)] disabled:opacity-50"
							>
								Cancel
							</button>
							<button
								type="button"
								disabled={deleteProjectMutation.isPending}
								onClick={() => void handleDeleteProject()}
									className="inline-flex min-h-10 min-w-[92px] items-center justify-center rounded-md border border-[var(--line)] bg-[var(--surface)] px-4 text-sm font-semibold text-[var(--ink)] hover:bg-[var(--bg-alt)] disabled:opacity-50"
							>
								{deleteProjectMutation.isPending ? "Deleting..." : "Continue"}
							</button>
						</div>
					</div>
				</DialogContent>
			</Dialog>
			<nav className="min-h-0 flex-1 overflow-y-auto px-2" aria-label="Primary">
				<NavLink to="/dashboard" active={pathname === "/dashboard"} icon={LayoutDashboard}>
					Projects
				</NavLink>
				<p className="px-2.5 pb-1 pt-5 font-[var(--mono)] text-[10px] font-semibold uppercase text-[var(--ink-soft)]">
					Current team
				</p>
				{teamProjects.map((project) => (
					<div
						key={project.id}
						className={cn(
							"group flex min-h-10 items-center rounded-md text-sm",
							project.id === projectId
								? "bg-[var(--accent-bg)] font-semibold text-[var(--accent-strong)]"
								: "text-[var(--ink-soft)] hover:bg-[var(--bg)] hover:text-[var(--ink)]",
						)}
					>
						<Link
							to="/projects/$projectId"
							params={{ projectId: project.id }}
							search={{}}
							className="flex min-w-0 flex-1 items-center gap-2 px-2.5"
						>
							<span className="size-2 shrink-0 rounded-full bg-current" />
							<span className="truncate">{project.name}</span>
						</Link>
						{project.projectRole === "admin" ? (
							<DropdownMenu>
								<DropdownMenuTrigger
									aria-label={`Actions for ${project.name}`}
									className="mr-1 grid size-8 shrink-0 place-items-center rounded-md opacity-0 hover:bg-[var(--bg-alt)] focus-visible:opacity-100 group-hover:opacity-100"
								>
									<EllipsisVertical className="size-4" aria-hidden="true" />
								</DropdownMenuTrigger>
								<DropdownMenuContent align="end" className="min-w-[150px]">
									<DropdownMenuItem
										variant="destructive"
										onClick={() => {
											setDeleteProjectError("");
											setDeleteProjectTarget({ id: project.id, name: project.name });
										}}
									>
										<Trash2 /> Delete project
									</DropdownMenuItem>
								</DropdownMenuContent>
							</DropdownMenu>
						) : null}
					</div>
				))}
				{projectId ? (
					<div className="mt-3 border-t border-[var(--line)] pt-3">
						<NavLink
							to={`/projects/${projectId}`}
							active={pathname === `/projects/${projectId}`}
							icon={LayoutGrid}
						>
							Board
						</NavLink>
						<NavLink
							to={`/projects/${projectId}/import`}
							active={pathname.endsWith("/import")}
							icon={Upload}
						>
							Import
						</NavLink>
						<NavLink
							to={`/projects/${projectId}/members`}
							active={pathname.endsWith("/members")}
							icon={Users}
						>
							Members
						</NavLink>
					</div>
				) : null}
			</nav>
			<nav
				className="mt-auto border-t border-[var(--line)] p-2 pb-[max(0.5rem,env(safe-area-inset-bottom))]"
				aria-label="Account"
			>
				<NavLink to="/profile/mcp" active={pathname === "/profile/mcp"} icon={Workflow}>
					MCP connection
				</NavLink>
				<NavLink to="/profile/settings" active={pathname === "/profile/settings"} icon={Settings}>
					Settings
				</NavLink>
				<Link
					to="/profile/settings"
					className="mt-2 flex min-h-12 items-center gap-2 rounded-md border-t border-[var(--line)] px-2 py-3 hover:bg-[var(--bg)]"
					aria-label="Open profile settings"
				>
					<Avatar
						initials={profile.initials}
						gradient={profile.gradient}
						name={profile.name}
						imageUrl={profile.avatarUrl}
					/>
					<span className="min-w-0">
						<span className="block truncate text-sm font-semibold">{profile.name}</span>
						<span className="block truncate font-[var(--mono)] text-[10px] text-[var(--ink-soft)]">
							@{profile.username}
						</span>
					</span>
				</Link>
				<button
					type="button"
					onClick={onLogout}
					className="flex min-h-10 w-full items-center gap-2.5 rounded-md border-l-2 border-l-transparent px-2.5 text-sm font-medium text-[var(--ink-soft)] hover:bg-[var(--bg)] hover:text-[var(--ink)]"
				>
					<LogOut className="size-4" aria-hidden="true" />
					Logout
				</button>
			</nav>
		</aside>
	);
}

function NavLink({
	to,
	active,
	icon: Icon,
	children,
}: {
	to: string;
	active: boolean;
	icon: typeof LayoutGrid;
	children: ReactNode;
}) {
	return (
		<Link
			to={to}
			className={cn(
				"flex min-h-10 items-center gap-2.5 rounded-md border-l-2 px-2.5 text-sm font-medium",
				active
					? "border-l-[var(--accent)] bg-[var(--accent-bg)] text-[var(--accent-strong)]"
					: "border-l-transparent text-[var(--ink-soft)] hover:bg-[var(--bg)] hover:text-[var(--ink)]",
			)}
		>
			<Icon className="size-4" aria-hidden="true" />
			{children}
		</Link>
	);
}
