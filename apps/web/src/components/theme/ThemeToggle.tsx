import { Moon, Sun } from "lucide-react";
import { useTheme } from "next-themes";

export function ThemeToggle() {
	const { resolvedTheme, setTheme } = useTheme();
	const isDark = resolvedTheme === "dark";

	return (
		<button
			className="flex size-11 cursor-pointer items-center justify-center rounded-[7px] border border-transparent bg-transparent p-0 text-[var(--ink-soft)] transition-colors duration-150 hover:bg-[var(--bg-alt)] hover:text-[var(--ink)] [&_svg]:size-[19px]"
			type="button"
			aria-label={`Switch to ${isDark ? "light" : "dark"} mode`}
			onClick={() => setTheme(isDark ? "light" : "dark")}
		>
			{isDark ? <Sun aria-hidden="true" /> : <Moon aria-hidden="true" />}
		</button>
	);
}
