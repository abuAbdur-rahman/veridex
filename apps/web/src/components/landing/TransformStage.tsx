import { useEffect, useState } from "react";

export function TransformStage() {
	const [flipped, setFlipped] = useState(false);

	useEffect(() => {
		const start = window.setTimeout(() => setFlipped(true), 900);
		const timer = window.setInterval(() => setFlipped((value) => !value), 3200);

		return () => {
			window.clearTimeout(start);
			window.clearInterval(timer);
		};
	}, []);

	return (
		<div
			className={`transform-stage ${flipped ? "flipped" : ""}`}
			aria-label="Spreadsheet row transformed into a structured ticket"
		>
			<div className="sheet-row">
				<div className="cell-label">issues_master_FINAL_v3.xlsx — row 47</div>
				<div className="sheet-grid">
					<div>
						<div className="cell-label">Bug</div>
						Login button unresponsive
					</div>
					<div>
						<div className="cell-label">Owner</div>
						<b className="qmark">???</b>
					</div>
					<div>
						<div className="cell-label">Severity</div>
						<b className="qmark">???</b>
					</div>
					<div>
						<div className="cell-label">Status</div>
						&quot;ask Sarah&quot;
					</div>
				</div>
			</div>

			<div className="ticket-card">
				<div className="ticket-id">TICKET-047</div>
				<div className="ticket-title">Login button unresponsive on Safari</div>
				<span className="chip pending">SEVERITY: HIGH</span>
				<span className="chip dev">DEV: OWNED</span>
				<div className="ticket-meta">
					Env: Safari 18 · macOS · Linked to TC-112
					<br />
					Status changed 3× · last: In QA
				</div>
			</div>
		</div>
	);
}
