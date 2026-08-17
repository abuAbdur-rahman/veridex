import { Loader2 } from "lucide-react";
import { SiGithub, SiGoogle } from "@icons-pack/react-simple-icons";
import { useState } from "react";
import { toast } from "sonner";
import { LogoMark } from "@/components/layout/LogoMark";
import { ThemeToggle } from "@/components/theme/ThemeToggle";
import { signInWithProvider, type SocialProvider } from "@/api/auth";
import { ApiError } from "@/api/client";

export function LoginScreen({ redirectTo = "/dashboard" }: { redirectTo?: string }) {
	const [pendingProvider, setPendingProvider] = useState<SocialProvider | null>(null);

	async function handleSignIn(provider: SocialProvider) {
		if (pendingProvider) return;
		setPendingProvider(provider);
		try {
			await signInWithProvider(provider, redirectTo);
		} catch (error) {
			toast.error(
				error instanceof ApiError ? error.message : "Could not start sign-in flow.",
			);
			setPendingProvider(null);
		}
	}

	return (
		<main className="grid min-h-dvh place-items-center bg-[var(--bg)] px-4">
			<div className="w-full max-w-[400px]">
				<header className="mb-8 flex items-center justify-between">
					<LogoMark />
					<ThemeToggle />
				</header>
				<h1 className="mb-2 font-[var(--mono)] text-2xl font-semibold leading-snug tracking-[-0.02em] text-[var(--ink)]">
					Track bugs like it's not <span className="text-[var(--accent)]">1997</span>.
				</h1>
				<p className="mb-8 text-sm text-[var(--ink-soft)]">
					Sign in with the identity your team already trusts. No passwords, no
					spreadsheets.
				</p>
				<div className="flex flex-col gap-3">
					<button
						type="button"
						disabled={pendingProvider !== null}
						onClick={() => void handleSignIn("google")}
						className="flex min-h-12 items-center justify-center gap-2.5 rounded-lg border border-[var(--line)] bg-[var(--surface)] px-4 text-sm font-semibold text-[var(--ink)] transition-colors duration-150 hover:border-[var(--ink-soft)] hover:bg-[var(--bg-alt)] disabled:cursor-wait disabled:opacity-60"
					>
						{pendingProvider === "google" ? (
							<Loader2 className="size-[18px] animate-spin" aria-hidden="true" />
						) : (
							<SiGoogle className="size-[18px]" aria-hidden="true" />
						)}
						{pendingProvider === "google" ? "Opening Google…" : "Continue with Google"}
					</button>
					<button
						type="button"
						disabled={pendingProvider !== null}
						onClick={() => void handleSignIn("github")}
						className="flex min-h-12 items-center justify-center gap-2.5 rounded-lg border border-[var(--line)] bg-[var(--surface)] px-4 text-sm font-semibold text-[var(--ink)] transition-colors duration-150 hover:border-[var(--ink-soft)] hover:bg-[var(--bg-alt)] disabled:cursor-wait disabled:opacity-60"
					>
						{pendingProvider === "github" ? (
							<Loader2 className="size-[18px] animate-spin" aria-hidden="true" />
						) : (
							<SiGithub className="size-[18px]" aria-hidden="true" />
						)}
						{pendingProvider === "github" ? "Opening GitHub…" : "Continue with GitHub"}
					</button>
				</div>
				<p className="mt-6 text-center text-xs text-[var(--ink-soft)]">
					No password. No spreadsheet.
				</p>
			</div>
		</main>
	);
}
