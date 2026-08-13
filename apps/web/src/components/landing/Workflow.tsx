import { boardColumns } from "@/lib/landing-data";
import { SectionHead } from "./SectionHead";

export function Workflow() {
	return (
		<section id="workflow">
			<div className="wrap">
				<SectionHead
					label="The workflow"
					title="One board, three ways of looking at it"
					subtitle="The same ticket data, filtered by role — a dev sees what's assigned to them, QA sees what's awaiting verification, a tester sees what needs a retest."
				/>
				<div className="board">
					{boardColumns.map((column) => (
						<div className="col" key={column.title}>
							<div className="col-title">
								{column.title}
								<span className="count">{column.count}</span>
							</div>
							{column.cards.map((card) => (
								<button className="board-card" type="button" key={card.id}>
									<div className="ticket-id">{card.id}</div>
									<div className="card-title">{card.title}</div>
									<span className={`chip ${card.kind}`}>{card.chip}</span>
								</button>
							))}
						</div>
					))}
				</div>
				<div className="role-row">
					<button className="role-pill" type="button">
						<b>Dev view</b> — assigned to me
					</button>
					<button className="role-pill" type="button">
						<b>QA view</b> — awaiting verification
					</button>
					<button className="role-pill" type="button">
						<b>Tester view</b> — needs retest
					</button>
				</div>
			</div>
		</section>
	);
}
