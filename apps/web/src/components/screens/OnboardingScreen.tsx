import { Check, Loader2 } from "lucide-react";
import { useState } from "react";
import { FormField } from "@/components/app/FormField";
import { LogoMark } from "@/components/layout/LogoMark";
import { ThemeToggle } from "@/components/theme/ThemeToggle";
import { useDemoStore } from "@/lib/demo-store";
import { useNavigate } from "@tanstack/react-router";

export function OnboardingScreen() {
	const navigate = useNavigate();
	const saveProfile = useDemoStore((state) => state.saveProfile);
	const [username, setUsername] = useState("sarahchen");
	const [checked, setChecked] = useState<"available" | "busy" | null>("available");
	const [error, setError] = useState("");

	function handleChange(value: string) {
		setUsername(value);
		setChecked("busy");
		window.setTimeout(() => setChecked("available"), 400);
	}

	return (
		<main className="grid min-h-dvh place-items-center bg-[var(--bg)] px-4">
			<div className="w-full max-w-[400px]">
				<header className="mb-10 flex items-center justify-between">
					<LogoMark />
					<ThemeToggle />
				</header>
				<h1 className="mb-2 font-[var(--mono)] text-2xl font-semibold tracking-[-0.02em] text-[var(--ink)]">
					Welcome to Veridex
				</h1>
				<p className="mb-8 text-sm text-[var(--ink-soft)]">
					Choose the username your team will see next to your reports.
				</p>
				<form className="flex flex-col gap-5" onSubmit={(event) => {
					event.preventDefault();
					const result = saveProfile({ username });
					if (!result.ok) { setError(result.error); return; }
					void navigate({ to: "/dashboard" });
				}}>
					<FormField label="Username" htmlFor="username" required>
						<div className="relative">
							<input
								id="username"
								value={username}
								onChange={(e) => handleChange(e.target.value)}
								placeholder="sarahchen"
								aria-describedby="username-status"
								autoComplete="username"
								className="w-full rounded-lg border border-[var(--line)] bg-[var(--surface)] px-3.5 py-3 text-sm text-[var(--ink)] outline-none transition-[border-color,box-shadow] duration-150 focus:border-[var(--accent)] focus:ring-2 focus:ring-[var(--accent-ring)]"
							/>
							<span
								id="username-status"
								className="absolute right-3.5 top-1/2 -translate-y-1/2"
								aria-live="polite"
							>
								{checked === "busy" ? (
									<Loader2
										className="size-4 animate-spin text-[var(--ink-soft)]"
										aria-hidden="true"
										strokeWidth={1.5}
									/>
								) : checked === "available" && username.trim() ? (
									<Check
										className="size-4 text-[var(--pass)]"
										aria-hidden="true"
										strokeWidth={1.5}
									/>
								) : null}
							</span>
						</div>
						<p className="text-xs text-[var(--ink-soft)]">Available</p>
						{error ? <p role="alert" className="text-xs text-[var(--block)]">{error}</p> : null}
					</FormField>
					<button
						type="submit"
						className="flex min-h-12 cursor-pointer items-center justify-center rounded-lg bg-[var(--accent)] px-4 text-sm font-semibold text-white transition-colors duration-150 hover:bg-[var(--accent-strong)]"
					>
						Continue
					</button>
				</form>
			</div>
		</main>
	);
}
