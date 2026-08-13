import { SectionHead } from "./SectionHead";

export function Mcp() {
	return (
		<section id="mcp">
			<div className="wrap">
				<SectionHead
					label="MCP support"
					title="Also operable by an AI agent, not just a browser tab"
					subtitle="Veridex ships an MCP server so tools like Claude Code can create, read, update, or close tickets directly — useful for devs who'd rather stay in their editor."
				/>
				<div className="terminal">
					<div>
						<span className="prompt">&gt;</span> mark TICKET-047 as verified and
						reassign TICKET-051 to QA
					</div>
					<div className="dim">&nbsp;</div>
					<div>
						<span className="call">→ calling</span> update_issue_status(id:
						&quot;047&quot;, status: &quot;verified&quot;)
					</div>
					<div>
						<span className="call">→ calling</span> assign_issue(id:
						&quot;051&quot;, role: &quot;qa&quot;)
					</div>
					<div className="dim">&nbsp;</div>
					<div>
						<span className="ok">✓ Done.</span> 2 tickets updated.
					</div>
				</div>
			</div>
		</section>
	);
}
