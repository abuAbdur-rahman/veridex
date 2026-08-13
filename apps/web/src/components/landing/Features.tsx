import { features } from "@/lib/landing-data";
import { SectionHead } from "./SectionHead";

export function Features() {
	return (
		<section id="features">
			<div className="wrap">
				<SectionHead
					label="What's in it"
					title="Built around how bugs actually get fixed"
				/>
				<div className="grid-features">
					{features.map((feature) => (
						<article className="feature" key={feature.index}>
							<div className="f-index">{feature.index}</div>
							<h3>{feature.title}</h3>
							<p>{feature.body}</p>
						</article>
					))}
				</div>
			</div>
		</section>
	);
}
