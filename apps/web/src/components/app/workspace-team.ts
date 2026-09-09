import { createContext, useContext } from "react";

interface WorkspaceTeamContextValue {
	teamId: string;
	setTeamId: (teamId: string) => void;
}

export const WorkspaceTeamContext = createContext<WorkspaceTeamContextValue>({
	teamId: "",
	setTeamId: () => undefined,
});
export function useWorkspaceTeam() {
	return useContext(WorkspaceTeamContext);
}
