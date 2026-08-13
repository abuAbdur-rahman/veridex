import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { ThemeProvider } from "next-themes";
import type { ReactNode } from "react";

const queryClient = new QueryClient();

export function AppProviders({ children }: { children: ReactNode }) {
	return (
		<ThemeProvider attribute="data-theme" defaultTheme="system" enableSystem>
			<QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
		</ThemeProvider>
	);
}
