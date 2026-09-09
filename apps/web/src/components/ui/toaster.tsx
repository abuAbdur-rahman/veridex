import { Toaster as SonnerToaster } from "sonner";
import { useTheme } from "next-themes";

export function Toaster() {
	const { resolvedTheme } = useTheme();

	return (
		<SonnerToaster
			theme={resolvedTheme === "dark" ? "dark" : "light"}
			position="bottom-right"
			closeButton
			richColors
			toastOptions={{
				classNames: {
					toast: "font-[var(--sans)]",
					title: "text-sm font-semibold",
					description: "text-xs",
				},
			}}
		/>
	);
}
