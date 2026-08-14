import { SiGithub, SiGoogle } from "@icons-pack/react-simple-icons";
import { LogoMark } from "@/components/layout/LogoMark";
import { ThemeToggle } from "@/components/theme/ThemeToggle";

export function LoginScreen() {
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
					<a
						href="/api/auth/sign-in/google"
						className="flex min-h-12 items-center justify-center gap-2.5 rounded-lg border border-[var(--line)] bg-[var(--surface)] px-4 text-sm font-semibold text-[var(--ink)] transition-colors duration-150 hover:border-[var(--ink-soft)] hover:bg-[var(--bg-alt)]"
					>
						<SiGoogle className="size-[18px]" aria-hidden="true" />
						Continue with Google
					</a>
					<a
						href="/api/auth/sign-in/github"
						className="flex min-h-12 items-center justify-center gap-2.5 rounded-lg border border-[var(--line)] bg-[var(--surface)] px-4 text-sm font-semibold text-[var(--ink)] transition-colors duration-150 hover:border-[var(--ink-soft)] hover:bg-[var(--bg-alt)]"
					>
						<SiGithub className="size-[18px]" aria-hidden="true" />
						Continue with GitHub
					</a>
				</div>
				<p className="mt-6 text-center text-xs text-[var(--ink-soft)]">
					No password. No spreadsheet.
				</p>
			</div>
		</main>
	);
}