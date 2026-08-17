import { Link } from "@tanstack/react-router";
import { LogoMark } from "./LogoMark";

export function Footer() {
	return (
		<footer>
			<div className="mx-auto flex w-full max-w-[1120px] flex-col items-start justify-between gap-4 px-[18px] sm:flex-row sm:items-center sm:px-7">
				<Link className="inline-flex no-underline" to="/" aria-label="Veridex home">
					<LogoMark />
				</Link>
				<div className="foot-tag">Built for teams who are done trusting a spreadsheet.</div>
			</div>
		</footer>
	);
}
