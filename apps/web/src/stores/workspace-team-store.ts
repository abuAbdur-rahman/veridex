import { create } from "zustand";
import { createJSONStorage, persist, type StateStorage } from "zustand/middleware";

interface WorkspaceTeamStore {
	activeTeamId: string;
	setActiveTeamId: (teamId: string) => void;
}

const browserStorage: StateStorage = {
	getItem: (name) => globalThis.localStorage?.getItem(name) ?? null,
	setItem: (name, value) => globalThis.localStorage?.setItem(name, value),
	removeItem: (name) => globalThis.localStorage?.removeItem(name),
};

export const useWorkspaceTeamStore = create<WorkspaceTeamStore>()(
	persist(
		(set) => ({
			activeTeamId: "",
			setActiveTeamId: (activeTeamId) => set({ activeTeamId }),
		}),
		{
			name: "veridex-workspace-team",
			version: 1,
			storage: createJSONStorage(() => browserStorage),
		},
	),
);
