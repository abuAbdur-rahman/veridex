import { create } from "zustand";
import { createStore, type StateCreator, type StoreApi } from "zustand/vanilla";
import { createJSONStorage, persist, type StateStorage } from "zustand/middleware";

import {
	currentUser,
	issueComments,
	issueHistory,
	issues,
	mcpActivity,
	mcpTokens,
	pendingInvites,
	projectMembers,
	projects,
	teamMembers,
	teams,
} from "@/lib/veridex-fixtures";
import type {
	ImportRecord,
	DemoImportOptions,
	Issue,
	IssueComment,
	IssueHistoryEntry,
	IssueStatus,
	McpActivity,
	McpToken,
	PendingInvite,
	Project,
	ProjectMember,
	ProjectRole,
	Severity,
	Team,
	TeamMember,
	TeamRole,
	UserProfile,
	UserSettings,
} from "@/lib/veridex-types";

export const DEMO_STORE_KEY = "veridex-demo-store";
export const DEMO_STORE_VERSION = 1;

export type ActionResult<T> = { ok: true; value: T } | { ok: false; error: string };

type IssueMap<T> = Record<string, T[]>;

export interface DemoDomainState {
	currentTeamId: string;
	currentUser: UserProfile;
	profile: UserProfile;
	settings: UserSettings;
	teams: Team[];
	projects: Project[];
	issues: Issue[];
	issueHistory: IssueMap<IssueHistoryEntry>;
	issueComments: IssueMap<IssueComment>;
	projectMembers: ProjectMember[];
	teamMembers: TeamMember[];
	pendingInvites: PendingInvite[];
	imports: ImportRecord[];
	mcpTokens: McpToken[];
	mcpActivity: McpActivity[];
}

export interface DemoStoreActions {
	setCurrentTeam: (teamId: string) => ActionResult<Team>;
	createProject: (input: { name: string }) => ActionResult<Project>;
	createIssue: (input: {
		projectId: string;
		title: string;
		severity: Severity;
		description?: string;
		environment?: string;
		stepsToReproduce?: string[];
		testCaseRef?: string;
	}) => ActionResult<Issue>;
	updateIssue: (
		issueId: string,
		input: Partial<
			Pick<
				Issue,
				| "title"
				| "summary"
				| "severity"
				| "description"
				| "environment"
				| "developerAssignees"
				| "qaAssignees"
				| "tags"
			>
		>,
	) => ActionResult<Issue>;
	changeIssueStatus: (issueId: string, toStatus: IssueStatus, note?: string) => ActionResult<Issue>;
	addComment: (issueId: string, body: string) => ActionResult<IssueComment>;
	addProjectMember: (input: {
		projectId: string;
		name: string;
		role: ProjectRole;
		initials?: string;
		gradient?: string;
	}) => ActionResult<ProjectMember>;
	setProjectMemberRole: (memberId: string, role: ProjectRole) => ActionResult<ProjectMember>;
	removeProjectMember: (memberId: string) => ActionResult<ProjectMember>;
	inviteTeamMember: (email: string, role?: TeamRole) => ActionResult<PendingInvite>;
	revokeTeamInvite: (inviteId: string) => ActionResult<PendingInvite>;
	saveProfile: (input: { username: string }) => ActionResult<UserProfile>;
	saveSettings: (settings: Partial<UserSettings>) => ActionResult<UserSettings>;
	importDemoIssues: (projectId: string, options: DemoImportOptions) => ActionResult<Issue[]>;
	createToken: (name: string) => ActionResult<{ token: McpToken; rawToken: string }>;
	revokeToken: (tokenId: string) => ActionResult<McpToken>;
	reset: () => void;
}

export type DemoStore = DemoDomainState & DemoStoreActions;

const defaultSettings: UserSettings = {
	theme: "system",
	defaultRole: "dev",
	compactIssues: false,
	emailUpdates: true,
};

function clone<T>(value: T): T {
	return structuredClone(value);
}

function groupByIssue<T extends { issueId: string }>(entries: T[]): IssueMap<T> {
	return entries.reduce<IssueMap<T>>((grouped, entry) => {
		(grouped[entry.issueId] ??= []).push(entry);
		return grouped;
	}, {});
}

export function createFixtureState(): DemoDomainState {
	return clone({
		currentTeamId: teams[0]?.id ?? "",
		currentUser,
		profile: currentUser,
		settings: defaultSettings,
		teams,
		projects,
		issues,
		issueHistory: groupByIssue(issueHistory),
		issueComments: groupByIssue(issueComments),
		projectMembers,
		teamMembers,
		pendingInvites,
		imports: [],
		mcpTokens,
		mcpActivity,
	});
}

function nextId(prefix: string, values: { id: string }[]): string {
	const max = values.reduce((current, value) => {
		const suffix = Number(value.id.match(/(\d+)$/)?.[1] ?? 0);
		return Math.max(current, suffix);
	}, 0);
	return `${prefix}_${max + 1}`;
}

function now(): string {
	return new Date().toISOString();
}

function initialsFor(name: string): string {
	return name
		.split(/\s+/)
		.slice(0, 2)
		.map((part) => part[0]?.toUpperCase() ?? "")
		.join("");
}

const allowedTransitions: Record<IssueStatus, IssueStatus[]> = {
	backlog: ["in_progress"],
	in_progress: ["in_qa", "backlog"],
	in_qa: ["verified", "in_progress", "rejected"],
	verified: ["in_qa"],
	rejected: ["backlog"],
};

export function getAllowedTransitions(status: IssueStatus): IssueStatus[] {
	return allowedTransitions[status];
}

const statusPosition: Record<IssueStatus, number> = {
	backlog: 0,
	in_progress: 1,
	in_qa: 2,
	verified: 3,
	rejected: 4,
};

export function isBackwardTransition(fromStatus: IssueStatus, toStatus: IssueStatus): boolean {
	return statusPosition[toStatus] < statusPosition[fromStatus];
}

function storeCreator(
	storage: StateStorage,
): StateCreator<DemoStore, [], [["zustand/persist", DemoDomainState]]> {
	return persist(
		(set, get) => ({
			...createFixtureState(),
			setCurrentTeam: (teamId) => {
				const team = get().teams.find(({ id }) => id === teamId);
				if (!team) return { ok: false, error: "Team not found" };
				set({ currentTeamId: teamId });
				return { ok: true, value: team };
			},
			createProject: ({ name }) => {
				const trimmedName = name.trim();
				if (!trimmedName) return { ok: false, error: "Project name is required" };
				const project: Project = {
					id: nextId("proj", get().projects),
					teamId: get().currentTeamId,
					name: trimmedName,
					role: "admin",
					openIssueCount: 0,
				};
				set((state) => ({ projects: [...state.projects, project] }));
				return { ok: true, value: project };
			},
			createIssue: (input) => {
				const title = input.title.trim();
				if (!title) return { ok: false, error: "Issue title is required" };
				if (!get().projects.some(({ id }) => id === input.projectId)) {
					return { ok: false, error: "Project not found" };
				}
				const projectIssues = get().issues.filter(({ projectId }) => projectId === input.projectId);
				const nextReference =
					projectIssues.reduce((max, issue) => {
						return Math.max(max, Number(issue.ticketRef.match(/(\d+)$/)?.[1] ?? 0));
					}, 0) + 1;
				const timestamp = now();
				const issue: Issue = {
					id: nextId("iss", get().issues),
					projectId: input.projectId,
					ticketRef: `VER-${String(nextReference).padStart(3, "0")}`,
					title,
					status: "backlog",
					severity: input.severity,
					description: input.description?.trim() || undefined,
					environment: input.environment?.trim() || undefined,
					stepsToReproduce: input.stepsToReproduce?.map((step) => step.trim()).filter(Boolean),
					testCaseRef: input.testCaseRef?.trim() || undefined,
					developerAssignees: [],
					qaAssignees: [],
					reporter: clone(get().currentUser),
					createdAt: timestamp,
					updatedAt: timestamp,
				};
				const history: IssueHistoryEntry = {
					id: nextId("hist", Object.values(get().issueHistory).flat()),
					issueId: issue.id,
					projectId: issue.projectId,
					fromStatus: null,
					toStatus: "backlog",
					by: get().currentUser.name,
					at: timestamp,
					source: "web",
				};
				set((state) => ({
					issues: [...state.issues, issue],
					issueHistory: { ...state.issueHistory, [issue.id]: [history] },
					projects: state.projects.map((project) =>
						project.id === issue.projectId
							? { ...project, openIssueCount: project.openIssueCount + 1 }
							: project,
					),
				}));
				return { ok: true, value: issue };
			},
			updateIssue: (issueId, input) => {
				const issue = get().issues.find(({ id }) => id === issueId);
				if (!issue) return { ok: false, error: "Issue not found" };
				const title = input.title === undefined ? undefined : input.title.trim();
				if (title === "") return { ok: false, error: "Issue title is required" };
				const updated: Issue = {
					...issue,
					...input,
					...(title === undefined ? {} : { title }),
					updatedAt: now(),
				};
				set((state) => ({
					issues: state.issues.map((item) => (item.id === issueId ? updated : item)),
				}));
				return { ok: true, value: updated };
			},
			changeIssueStatus: (issueId, toStatus, note) => {
				const issue = get().issues.find(({ id }) => id === issueId);
				if (!issue) return { ok: false, error: "Issue not found" };
				if (!(allowedTransitions[issue.status] ?? []).includes(toStatus)) {
					return { ok: false, error: "Invalid status transition" };
				}
				const trimmedNote = note?.trim();
				if (isBackwardTransition(issue.status, toStatus) && !trimmedNote) {
					return { ok: false, error: "A note is required when moving an issue backward" };
				}
				const timestamp = now();
				const updated = { ...issue, status: toStatus, updatedAt: timestamp };
				const history: IssueHistoryEntry = {
					id: nextId("hist", Object.values(get().issueHistory).flat()),
					issueId,
					projectId: issue.projectId,
					fromStatus: issue.status,
					toStatus,
					by: get().currentUser.name,
					at: timestamp,
					note: trimmedNote,
					source: "web",
				};
				set((state) => ({
					issues: state.issues.map((item) => (item.id === issueId ? updated : item)),
					issueHistory: {
						...state.issueHistory,
						[issueId]: [...(state.issueHistory[issueId] ?? []), history],
					},
				}));
				return { ok: true, value: updated };
			},
			addComment: (issueId, body) => {
				const issue = get().issues.find(({ id }) => id === issueId);
				if (!issue) return { ok: false, error: "Issue not found" };
				const trimmedBody = body.trim();
				if (!trimmedBody) return { ok: false, error: "Comment is required" };
				const comment: IssueComment = {
					id: nextId("cmt", Object.values(get().issueComments).flat()),
					issueId,
					projectId: issue.projectId,
					author: clone(get().currentUser),
					body: trimmedBody,
					at: now(),
				};
				set((state) => ({
					issueComments: {
						...state.issueComments,
						[issueId]: [...(state.issueComments[issueId] ?? []), comment],
					},
				}));
				return { ok: true, value: comment };
			},
			addProjectMember: (input) => {
				const name = input.name.trim();
				if (!name) return { ok: false, error: "Member name is required" };
				if (!get().projects.some(({ id }) => id === input.projectId)) {
					return { ok: false, error: "Project not found" };
				}
				if (
					get().projectMembers.some(
						(member) =>
							member.projectId === input.projectId &&
							member.name.toLowerCase() === name.toLowerCase(),
					)
				) {
					return { ok: false, error: "Member already belongs to this project" };
				}
				const member: ProjectMember = {
					id: nextId("pm", get().projectMembers),
					projectId: input.projectId,
					name,
					initials: input.initials?.trim() || initialsFor(name),
					role: input.role,
					gradient: input.gradient ?? "linear-gradient(135deg, #5FC9C9, #7FA0E0)",
				};
				set((state) => ({ projectMembers: [...state.projectMembers, member] }));
				return { ok: true, value: member };
			},
			setProjectMemberRole: (memberId, role) => {
				const member = get().projectMembers.find(({ id }) => id === memberId);
				if (!member) return { ok: false, error: "Project member not found" };
				const updated = { ...member, role };
				set((state) => ({
					projectMembers: state.projectMembers.map((item) =>
						item.id === memberId ? updated : item,
					),
				}));
				return { ok: true, value: updated };
			},
			removeProjectMember: (memberId) => {
				const member = get().projectMembers.find(({ id }) => id === memberId);
				if (!member) return { ok: false, error: "Project member not found" };
				set((state) => ({
					projectMembers: state.projectMembers.filter(({ id }) => id !== memberId),
				}));
				return { ok: true, value: member };
			},
			inviteTeamMember: (email, role = "member") => {
				const normalizedEmail = email.trim().toLowerCase();
				if (!/^\S+@\S+\.\S+$/.test(normalizedEmail)) {
					return { ok: false, error: "Valid email is required" };
				}
				if (
					get().teamMembers.some(
						(member) =>
							member.teamId === get().currentTeamId &&
							member.email?.toLowerCase() === normalizedEmail,
					)
				) {
					return { ok: false, error: "User already belongs to this team" };
				}
				if (
					get().pendingInvites.some(
						(invite) => invite.teamId === get().currentTeamId && invite.email === normalizedEmail,
					)
				) {
					return { ok: false, error: "Invite already pending" };
				}
				const invite: PendingInvite = {
					id: nextId("inv", get().pendingInvites),
					teamId: get().currentTeamId,
					email: normalizedEmail,
					role,
					expiresInDays: 7,
				};
				set((state) => ({ pendingInvites: [...state.pendingInvites, invite] }));
				return { ok: true, value: invite };
			},
			revokeTeamInvite: (inviteId) => {
				const invite = get().pendingInvites.find(({ id }) => id === inviteId);
				if (!invite) return { ok: false, error: "Invite not found" };
				set((state) => ({
					pendingInvites: state.pendingInvites.filter(({ id }) => id !== inviteId),
				}));
				return { ok: true, value: invite };
			},
			saveProfile: ({ username }) => {
				const normalizedUsername = username.trim();
				if (!/^[a-zA-Z0-9_-]{3,32}$/.test(normalizedUsername)) {
					return {
						ok: false,
						error: "Username must be 3-32 letters, numbers, dashes, or underscores",
					};
				}
				const profile = { ...get().profile, username: normalizedUsername };
				set({ profile, currentUser: profile });
				return { ok: true, value: profile };
			},
			saveSettings: (settings) => {
				const updated = { ...get().settings, ...settings };
				set({ settings: updated });
				return { ok: true, value: updated };
			},
			importDemoIssues: (projectId, options) => {
				if (!get().projects.some(({ id }) => id === projectId)) {
					return { ok: false, error: "Project not found" };
				}
				if (!options.targetStatuses.every((status) => Object.hasOwn(allowedTransitions, status))) {
					return { ok: false, error: "Invalid import status" };
				}
				const imported: Issue[] = [];
				const demoRows: Array<readonly [string, Severity]> = [
					["Imported checkout defect", "high"],
					["Imported copy issue", "low"],
				];
				for (const [index, [title, severity]] of demoRows.entries()) {
					const result = get().createIssue({ projectId, title, severity });
					if (result.ok) {
						const status =
							options.targetStatuses[index % options.targetStatuses.length] ?? "backlog";
						const updated = { ...result.value, status };
						set((state) => ({
							issues: state.issues.map((issue) => (issue.id === updated.id ? updated : issue)),
							issueHistory: {
								...state.issueHistory,
								[updated.id]: [
									{
										...(state.issueHistory[updated.id]?.[0] as IssueHistoryEntry),
										toStatus: status,
										source: "import",
									},
								],
							},
						}));
						imported.push(updated);
					}
				}
				const record: ImportRecord = {
					id: nextId("imp", get().imports),
					projectId,
					fileName: options.fileName,
					importedCount: imported.length,
					createdAt: now(),
				};
				set((state) => ({ imports: [...state.imports, record] }));
				return { ok: true, value: imported };
			},
			createToken: (name) => {
				const trimmedName = name.trim();
				if (!trimmedName) return { ok: false, error: "Token name is required" };
				const token: McpToken = {
					id: nextId("tok", get().mcpTokens),
					name: trimmedName,
					createdAt: now(),
				};
				const rawToken = `vdx_demo_${crypto.randomUUID().replaceAll("-", "")}`;
				set((state) => ({ mcpTokens: [...state.mcpTokens, token] }));
				return { ok: true, value: { token, rawToken } };
			},
			revokeToken: (tokenId) => {
				const token = get().mcpTokens.find(({ id }) => id === tokenId);
				if (!token) return { ok: false, error: "Token not found" };
				const revoked = { ...token, revokedAt: now() };
				set((state) => ({
					mcpTokens: state.mcpTokens.map((item) => (item.id === tokenId ? revoked : item)),
				}));
				return { ok: true, value: revoked };
			},
			reset: () => set(createFixtureState()),
		}),
		{
			name: DEMO_STORE_KEY,
			version: DEMO_STORE_VERSION,
			storage: createJSONStorage(() => storage),
			partialize: (state): DemoDomainState => ({
				currentTeamId: state.currentTeamId,
				currentUser: state.currentUser,
				profile: state.profile,
				settings: state.settings,
				teams: state.teams,
				projects: state.projects,
				issues: state.issues,
				issueHistory: state.issueHistory,
				issueComments: state.issueComments,
				projectMembers: state.projectMembers,
				teamMembers: state.teamMembers,
				pendingInvites: state.pendingInvites,
				imports: state.imports,
				mcpTokens: state.mcpTokens,
				mcpActivity: state.mcpActivity,
			}),
		},
	);
}

const browserStorage: StateStorage = {
	getItem: (name) => globalThis.localStorage?.getItem(name) ?? null,
	setItem: (name, value) => globalThis.localStorage?.setItem(name, value),
	removeItem: (name) => globalThis.localStorage?.removeItem(name),
};

export function createDemoStore(storage: StateStorage = browserStorage): StoreApi<DemoStore> {
	return createStore<DemoStore>()(storeCreator(storage));
}

export const useDemoStore = create<DemoStore>()(storeCreator(browserStorage));

export const selectProjectIssues = (projectId: string) => (state: DemoStore) =>
	state.issues.filter((issue) => issue.projectId === projectId);

export const selectIssueHistory = (issueId: string) => (state: DemoStore) =>
	state.issueHistory[issueId] ?? [];

export const selectIssueComments = (issueId: string) => (state: DemoStore) =>
	state.issueComments[issueId] ?? [];
