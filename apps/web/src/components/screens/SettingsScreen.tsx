import { Monitor, Moon, RotateCcw, Sun } from "lucide-react";
import { useTheme } from "next-themes";
import { useState } from "react";
import { FormField } from "@/components/app/FormField";
import { PageHeader } from "@/components/app/PageHeader";
import { useDemoStore } from "@/lib/demo-store";
import type { UserSettings } from "@/lib/veridex-types";

const themes: Array<{ value: UserSettings["theme"]; label: string; icon: typeof Sun }> = [
	{ value: "light", label: "Light", icon: Sun },
	{ value: "dark", label: "Dark", icon: Moon },
	{ value: "system", label: "System", icon: Monitor },
];

export function SettingsScreen() {
	const profile = useDemoStore((state) => state.profile);
	const settings = useDemoStore((state) => state.settings);
	const saveProfile = useDemoStore((state) => state.saveProfile);
	const saveSettings = useDemoStore((state) => state.saveSettings);
	const reset = useDemoStore((state) => state.reset);
	const { setTheme } = useTheme();
	const [username, setUsername] = useState(profile.username);
	const [defaultRole, setDefaultRole] = useState(settings.defaultRole);
	const [theme, setLocalTheme] = useState(settings.theme);
	const [status, setStatus] = useState("");

	return (
		<div className="mx-auto flex w-full max-w-[840px] flex-col gap-6">
			<PageHeader title="Settings" />
			<form className="flex flex-col gap-6" onSubmit={(event) => {
				event.preventDefault();
				const profileResult = saveProfile({ username });
				if (!profileResult.ok) { setStatus(profileResult.error); return; }
				const settingsResult = saveSettings({ defaultRole, theme });
				if (!settingsResult.ok) { setStatus(settingsResult.error); return; }
				setTheme(theme);
				setStatus("Settings saved.");
			}}>
				<FormField label="Username" htmlFor="settings-username" hint="3-32 letters, numbers, dashes, or underscores."><input id="settings-username" autoComplete="username" value={username} onChange={(event) => setUsername(event.target.value)} className="w-full rounded-lg border border-[var(--line)] bg-[var(--surface)] px-3.5 py-2.5 text-sm text-[var(--ink)] outline-none focus:border-[var(--accent)] focus:ring-2 focus:ring-[var(--accent-ring)]" /></FormField>
				<FormField label="Default role" htmlFor="settings-role" hint="Invite hint only; authorization remains project-scoped."><select id="settings-role" value={defaultRole} onChange={(event) => setDefaultRole(event.target.value as UserSettings["defaultRole"])} className="w-full rounded-lg border border-[var(--line)] bg-[var(--surface)] px-3.5 py-2.5 text-sm text-[var(--ink)] outline-none focus:border-[var(--accent)] focus:ring-2 focus:ring-[var(--accent-ring)]"><option value="dev">Dev</option><option value="qa">QA</option><option value="tester">Tester</option></select></FormField>
				<FormField label="Theme"><div role="radiogroup" aria-label="Theme" className="grid grid-cols-3 gap-1 rounded-lg border border-[var(--line)] bg-[var(--bg)] p-1">{themes.map((option) => { const Icon = option.icon; return <button key={option.value} type="button" role="radio" aria-checked={theme === option.value} onClick={() => { setLocalTheme(option.value); setTheme(option.value); }} className={`inline-flex min-h-10 cursor-pointer items-center justify-center gap-2 rounded-md px-3 text-xs font-medium transition-colors ${theme === option.value ? "bg-[var(--accent)] text-white" : "text-[var(--ink-soft)] hover:bg-[var(--surface)] hover:text-[var(--ink)]"}`}><Icon className="size-4" aria-hidden="true" />{option.label}</button>; })}</div></FormField>
				<p className="min-h-5 text-xs text-[var(--ink-soft)]" role="status" aria-live="polite">{status}</p>
				<div className="flex flex-wrap justify-between gap-3 border-t border-[var(--line)] pt-5">
					<button type="button" onClick={() => { if (!window.confirm("Reset all demo data and settings?")) return; reset(); const state = useDemoStore.getState(); setUsername(state.profile.username); setDefaultRole(state.settings.defaultRole); setLocalTheme(state.settings.theme); setTheme(state.settings.theme); setStatus("Demo data reset."); }} className="inline-flex min-h-10 cursor-pointer items-center gap-2 rounded-lg border border-[var(--line)] bg-[var(--surface)] px-4 text-sm font-semibold text-[var(--ink-soft)] hover:border-[var(--block)] hover:text-[var(--block)]"><RotateCcw className="size-4" aria-hidden="true" /> Reset demo</button>
					<button type="submit" className="inline-flex min-h-10 cursor-pointer items-center justify-center rounded-lg bg-[var(--accent)] px-5 text-sm font-semibold text-white hover:bg-[var(--accent-strong)]">Save changes</button>
				</div>
			</form>
		</div>
	);
}
