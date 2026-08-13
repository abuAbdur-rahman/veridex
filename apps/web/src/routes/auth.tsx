import { SiGithub, SiGoogle } from "@icons-pack/react-simple-icons";
import { Link } from "@tanstack/react-router";
import { ArrowLeft } from "lucide-react";
import { LogoMark } from "@/components/layout/LogoMark";
import { ThemeToggle } from "@/components/theme/ThemeToggle";

export function AuthPage() {
	return (
		<main className="min-h-dvh bg-[var(--bg)] lg:bg-[linear-gradient(90deg,transparent_49.9%,var(--line-soft)_50%,transparent_50.1%)]">
			<header className="mx-auto flex min-h-16 w-full max-w-[1120px] items-center justify-between px-[18px] sm:min-h-[72px] sm:px-7">
				<Link
					className="inline-flex no-underline"
					to="/"
					aria-label="Veridex home"
				>
					<LogoMark />
				</Link>
				<ThemeToggle />
			</header>

			<div className="mx-auto grid min-h-[calc(100dvh-100px)] w-[calc(100%-36px)] content-center items-center gap-9 border-t border-[var(--line)] py-11 sm:min-h-[calc(100dvh-144px)] sm:w-[min(960px,calc(100%-56px))] sm:py-14 sm:pb-24 lg:grid-cols-[1fr_minmax(320px,420px)] lg:gap-[72px]">
				<div>
					<span className="eyebrow">Identity check</span>
					<h1 className="max-w-[15ch]" id="auth-title">
						One account. Every issue decision.
					</h1>
					<p className="m-0 max-w-[48ch] text-base text-[var(--ink-soft)]">
						Continue with the identity your engineering team already trusts. No
						passwords to store, reset, or share.
					</p>
				</div>

				<div className="rounded-[var(--radius)] border border-[var(--line)] bg-[var(--surface)] p-[22px] shadow-[0_18px_45px_-34px_rgba(23,30,38,0.7)] sm:p-7">
					<p className="mb-[18px] font-[var(--mono)] text-xs font-semibold uppercase">
						Continue to Veridex
					</p>
					<button
						className="mt-3 flex min-h-12 w-full cursor-pointer items-center justify-center rounded-[7px] border border-[var(--line)] bg-[var(--bg)] px-4 py-2.5 text-sm font-semibold transition duration-150 hover:-translate-y-px hover:border-[var(--ink-soft)] hover:bg-[var(--bg-alt)]"
						type="button"
					>
						<SiGoogle className="mr-2.5 size-[19px]" aria-hidden="true" />
						Continue with Google
					</button>
					<button
						className="mt-3 flex min-h-12 w-full cursor-pointer items-center justify-center rounded-[7px] border border-[var(--line)] bg-[var(--bg)] px-4 py-2.5 text-sm font-semibold transition duration-150 hover:-translate-y-px hover:border-[var(--ink-soft)] hover:bg-[var(--bg-alt)]"
						type="button"
					>
						<SiGithub className="mr-2.5 size-[19px]" aria-hidden="true" />
						Continue with GitHub
					</button>
					<p className="mt-5 text-center text-xs leading-[1.6] text-[var(--ink-soft)]">
						By continuing, you agree to the terms and privacy policy.
					</p>
				</div>

				<Link
					className="flex w-fit items-center gap-2 font-[var(--mono)] text-xs font-medium text-[var(--ink-soft)] no-underline hover:text-[var(--accent)] [&_svg]:size-4"
					to="/"
				>
					<ArrowLeft aria-hidden="true" /> Back to overview
				</Link>
			</div>
		</main>
	);
}
