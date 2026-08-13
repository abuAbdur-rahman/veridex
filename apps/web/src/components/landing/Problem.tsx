import { compareBad, compareGood } from "@/lib/landing-data";
import { SectionHead } from "./SectionHead";

function CompareList({
	items,
	good,
}: {
	items: readonly string[];
	good: boolean;
}) {
	return (
		<ul className="compare-list">
			{items.map((item) => (
				<li key={item}>
					<span className="mark">{good ? "✓" : "×"}</span>
					{item}
				</li>
			))}
		</ul>
	);
}

export function Problem() {
	return (
		<section id="problem">
			<div className="wrap">
				<SectionHead
					label="The problem"
					title="Excel wasn't built for this"
					subtitle="A shared spreadsheet works for a week. Then ownership blurs, history disappears, and everyone's looking at a different saved version."
				/>
				<div className="compare">
					<div className="compare-col bad">
						<div className="compare-head">The spreadsheet</div>
						<CompareList items={compareBad} good={false} />
					</div>
					<div className="compare-col good">
						<div className="compare-head">Veridex</div>
						<CompareList items={compareGood} good />
					</div>
				</div>
			</div>
		</section>
	);
}
