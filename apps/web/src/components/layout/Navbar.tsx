import { Link } from "@tanstack/react-router";
import { LogoMark } from "./LogoMark";
import { ThemeToggle } from "@/components/theme/ThemeToggle";

export function Navbar() {
	return (
		<header className="nav">
			<div className="mx-auto flex min-h-16 w-full max-w-[1120px] items-center justify-between px-[18px] sm:min-h-[72px] sm:px-7">
				<Link
					className="inline-flex no-underline"
					to="/"
					aria-label="Veridex home"
				>
					<LogoMark />
				</Link>
				<nav className="links" aria-label="Primary navigation">
					<a href="#problem">Why</a>
					<a href="#workflow">Workflow</a>
					<a href="#mcp">MCP</a>
					<a href="#features">Features</a>
				</nav>
				<div className="flex items-center gap-2.5 sm:gap-3.5">
					<ThemeToggle />
					<Link
						className="hidden text-[13px] font-semibold text-[var(--ink-soft)] no-underline hover:text-[var(--accent)] sm:inline"
						to="/auth"
					>
						Log in
					</Link>
					<Link className="btn px-3 sm:px-4" to="/auth">
						Get started
					</Link>
				</div>
			</div>
		</header>
	);
}
