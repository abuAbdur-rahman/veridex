import { Monitor, Moon, Sun } from "lucide-react";
import { useTheme } from "next-themes";
import { useState } from "react";
import { FormField } from "@/components/app/FormField";
import { PageHeader } from "@/components/app/PageHeader";
import { useMe } from "@/queries/session";
import type { UserSettings } from "@/lib/veridex-types";

const themes: Array<{ value: UserSettings["theme"]; label: string; icon: typeof Sun }> = [
	{ value: "light", label: "Light", icon: Sun },
	{ value: "dark", label: "Dark", icon: Moon },
	{ value: "system", label: "System", icon: Monitor },
];

export function SettingsScreen() {
	const me = useMe();
	const { theme, setTheme } = useTheme();
	const [selectedTheme, setSelectedTheme] = useState<UserSettings["theme"]>(
		(theme === "light" || theme === "dark" || theme === "system") ? theme : "system",
	);

	const user = me.data?.user;

	return (
		<div className="mx-auto flex w-full max-w-[840px] flex-col gap-6">
			<PageHeader title="Settings" />
			<div className="flex flex-col gap-6">
				{me.isPending ? (
					<p className="py-4 text-sm text-[var(--ink-soft)]">Loading profile...</p>
				) : me.isError || !user ? (
					<p className="py-4 text-sm text-[var(--ink-soft)]">
						Profile could not load. Refresh the page to try again.
					</p>
				) : (
					<>
						<FormField
							label="Name"
							htmlFor="settings-name"
							hint="Managed by your sign-in provider."
						>
							<input
								id="settings-name"
								value={user.name}
								readOnly
								className="w-full cursor-default rounded-lg border border-[var(--line)] bg-[var(--bg)] px-3.5 py-2.5 text-sm text-[var(--ink)] opacity-70 outline-none"
							/>
						</FormField>
						<FormField
							label="Username"
							htmlFor="settings-username"
							hint="Reserved during onboarding; editing is not available yet."
						>
							<input
								id="settings-username"
								value={user.username ?? ""}
								readOnly
								className="w-full cursor-default rounded-lg border border-[var(--line)] bg-[var(--bg)] px-3.5 py-2.5 text-sm text-[var(--ink)] opacity-70 outline-none"
							/>
						</FormField>
						<FormField
							label="Default role"
							htmlFor="settings-role"
							hint="Set during onboarding; authorization remains project-scoped."
						>
							<input
								id="settings-role"
								value={user.defaultRole ?? ""}
								readOnly
								className="w-full cursor-default rounded-lg border border-[var(--line)] bg-[var(--bg)] px-3.5 py-2.5 text-sm text-[var(--ink)] opacity-70 outline-none"
							/>
						</FormField>
					</>
				)}
				<FormField label="Theme">
					<div
						role="radiogroup"
						aria-label="Theme"
						className="grid grid-cols-3 gap-1 rounded-lg border border-[var(--line)] bg-[var(--bg)] p-1"
					>
						{themes.map((option) => {
							const Icon = option.icon;
							return (
								<button
									key={option.value}
									type="button"
									role="radio"
									aria-checked={selectedTheme === option.value}
									onClick={() => {
										setSelectedTheme(option.value);
										setTheme(option.value);
									}}
									className={`inline-flex min-h-10 cursor-pointer items-center justify-center gap-2 rounded-md px-3 text-xs font-medium transition-colors ${selectedTheme === option.value ? "bg-[var(--accent)] text-white" : "text-[var(--ink-soft)] hover:bg-[var(--surface)] hover:text-[var(--ink)]"}`}
								>
									<Icon className="size-4" aria-hidden="true" />
									{option.label}
								</button>
							);
						})}
					</div>
				</FormField>
			</div>
		</div>
	);
}
