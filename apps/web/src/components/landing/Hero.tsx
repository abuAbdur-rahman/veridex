import { Link } from "@tanstack/react-router";
import { Eyebrow } from "./SectionHead";
import { TransformStage } from "./TransformStage";

export function Hero() {
	return (
		<section className="hero wrap" id="top">
			<div>
				<Eyebrow>Still tracking bugs in a spreadsheet?</Eyebrow>
				<h1>
					Turn scattered rows into <em>a record every role can trust.</em>
				</h1>
				<p className="lede">
					Veridex is a QA-aware issue tracker for dev, QA, and test teams — one
					board, three views, no forgotten column. Built after watching a real
					team run bug tracking out of a shared Excel file.
				</p>
				<div className="cta-row">
					<Link className="btn" to="/auth">
						Get started
					</Link>
					<a className="text-link" href="#workflow">
						Explore the workflow
					</a>
				</div>
			</div>
			<TransformStage />
		</section>
	);
}
