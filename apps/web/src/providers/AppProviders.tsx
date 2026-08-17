import { QueryClientProvider } from "@tanstack/react-query";
import { ThemeProvider } from "next-themes";
import type { ReactNode } from "react";
import { Toaster } from "@/components/ui/toaster";
import { queryClient } from "@/lib/query-client";

export function AppProviders({ children }: { children: ReactNode }) {
	return (
		<ThemeProvider attribute="data-theme" defaultTheme="system" enableSystem>
			<QueryClientProvider client={queryClient}>
				{children}
				<Toaster />
			</QueryClientProvider>
		</ThemeProvider>
	);
}
