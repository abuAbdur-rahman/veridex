import { Bot, Check, Copy, KeyRound, Plus, Shield, Trash2 } from "lucide-react";
import { useState } from "react";
import { PageHeader } from "@/components/app/PageHeader";
import { SectionLabel } from "@/components/app/FormField";
import { NewTokenModal } from "@/components/screens/NewTokenModal";
import { useDemoStore } from "@/stores/demo-store";
import { mcpProjectAccess, mcpTools } from "@/lib/veridex-fixtures";

const endpoint = "https://api.veridex.app/mcp";

export function McpScreen() {
	const tokens = useDemoStore((state) => state.mcpTokens);
	const activity = useDemoStore((state) => state.mcpActivity);
	const createToken = useDemoStore((state) => state.createToken);
	const revokeToken = useDemoStore((state) => state.revokeToken);
	const [modalOpen, setModalOpen] = useState(false);
	const [rawToken, setRawToken] = useState<string | null>(null);
	const [status, setStatus] = useState("");
	const activeTokens = tokens.filter((token) => !token.revokedAt);
	const config = rawToken
		? JSON.stringify(
				{
					mcpServers: {
						veridex: { url: endpoint, headers: { Authorization: `Bearer ${rawToken}` } },
					},
				},
				null,
				2,
			)
		: null;

	async function copy(value: string, label: string) {
		try {
			await navigator.clipboard.writeText(value);
			setStatus(`${label} copied.`);
		} catch {
			setStatus(`Could not copy ${label.toLowerCase()}.`);
		}
	}

	return (
		<div className="mx-auto flex w-full max-w-[840px] flex-col gap-8">
			<PageHeader title="MCP connection" count={String(activeTokens.length)} />
			<p className="sr-only" role="status" aria-live="polite">
				{status}
			</p>
			<section aria-label="Connect an agent">
				<SectionLabel>Connect an agent</SectionLabel>
				<div className="mt-3 flex flex-col gap-5 rounded-[10px] border border-[var(--line)] bg-[var(--surface)] p-5">
					<CopyRow
						label="Endpoint"
						value={endpoint}
						feedback={status === "Endpoint copied."}
						onCopy={() => copy(endpoint, "Endpoint")}
					/>
					{config ? (
						<div>
							<div className="mb-1.5 flex items-center justify-between">
								<span className="font-[var(--mono)] text-[10px] font-semibold uppercase tracking-[0.08em] text-[var(--ink-soft)]">
									Claude Code config
								</span>
								<button
									type="button"
									onClick={() => copy(config, "Config")}
									className="inline-flex min-h-8 cursor-pointer items-center gap-1.5 rounded-[6px] px-2 text-xs text-[var(--ink)] hover:bg-[var(--bg-alt)]"
								>
									<Copy className="size-3.5" aria-hidden="true" /> Copy JSON
								</button>
							</div>
							<pre className="overflow-x-auto rounded-lg border border-[var(--line)] bg-[var(--bg-alt)] p-4 font-[var(--mono)] text-xs leading-6 text-[var(--ink)]">
								{config}
							</pre>
						</div>
					) : (
						<p className="text-[13px] text-[var(--ink-soft)]">
							Create a token to generate a ready-to-copy client config. Config remains visible only
							while the fresh token is open.
						</p>
					)}
				</div>
			</section>
			<section aria-label="Your tokens">
				<div className="flex items-center justify-between">
					<SectionLabel>Your tokens</SectionLabel>
					<button
						type="button"
						onClick={() => setModalOpen(true)}
						className="inline-flex min-h-9 cursor-pointer items-center gap-1.5 rounded-[6px] border border-[var(--line)] bg-[var(--surface)] px-3 text-xs font-semibold text-[var(--ink)] hover:border-[var(--accent)] hover:text-[var(--accent)]"
					>
						<Plus className="size-3.5" aria-hidden="true" /> New token
					</button>
				</div>
				{tokens.length === 0 ? (
					<Empty
						icon={KeyRound}
						title="No API tokens"
						body="Create a token to connect an MCP client."
					/>
				) : (
					<ul className="mt-3 overflow-hidden rounded-[10px] border border-[var(--line)] bg-[var(--surface)]">
						{tokens.map((token) => (
							<li
								key={token.id}
								className="flex flex-wrap items-center gap-3 border-b border-[var(--line-soft)] px-4 py-3 last:border-b-0"
							>
								<span className="grid size-8 place-items-center rounded-[6px] bg-[var(--bg-alt)]">
									<KeyRound className="size-4 text-[var(--ink-soft)]" aria-hidden="true" />
								</span>
								<span className="min-w-[140px] flex-1">
									<span className="block text-sm font-medium text-[var(--ink)]">{token.name}</span>
									<span className="block font-[var(--mono)] text-xs text-[var(--ink-soft)]">
										Created {new Date(token.createdAt).toLocaleDateString()}
									</span>
								</span>
								{token.revokedAt ? (
									<span className="rounded-[6px] bg-[var(--block-bg)] px-2.5 py-1 font-[var(--mono)] text-xs text-[var(--block)]">
										revoked
									</span>
								) : (
									<button
										type="button"
										aria-label={`Revoke ${token.name}`}
										onClick={() => {
											if (!window.confirm(`Revoke token ${token.name}?`)) return;
											const result = revokeToken(token.id);
											setStatus(result.ok ? `${token.name} revoked.` : result.error);
										}}
										className="inline-flex min-h-9 cursor-pointer items-center gap-1.5 rounded-[6px] px-2.5 text-xs font-medium text-[var(--ink-soft)] hover:bg-[var(--block-bg)] hover:text-[var(--block)]"
									>
										<Trash2 className="size-3.5" aria-hidden="true" /> Revoke
									</button>
								)}
							</li>
						))}
					</ul>
				)}
			</section>
			<section aria-label="Project access">
				<SectionLabel>
					<Shield className="size-3.5" aria-hidden="true" /> Project access
				</SectionLabel>
				<div className="mt-3 overflow-x-auto rounded-[10px] border border-[var(--line)] bg-[var(--surface)]">
					<table className="w-full border-collapse text-left">
						<thead>
							<tr className="border-b border-[var(--line)] font-[var(--mono)] text-[10px] uppercase text-[var(--ink-soft)]">
								<th className="px-4 py-2.5 font-medium">Project</th>
								<th className="px-4 py-2.5 font-medium">Role</th>
								<th className="px-4 py-2.5 text-right font-medium">Tools</th>
							</tr>
						</thead>
						<tbody>
							{mcpProjectAccess.map((access) => (
								<tr
									key={access.project}
									className="border-b border-[var(--line-soft)] last:border-0"
								>
									<td className="px-4 py-3 text-sm text-[var(--ink)]">{access.project}</td>
									<td className="px-4 py-3 font-[var(--mono)] text-xs text-[var(--ink-soft)]">
										{access.role}
									</td>
									<td className="px-4 py-3 text-right font-[var(--mono)] text-xs text-[var(--ink-soft)]">
										{access.toolsAvailable}
									</td>
								</tr>
							))}
						</tbody>
					</table>
				</div>
			</section>
			<section aria-label="Available tools">
				<SectionLabel>Available tools</SectionLabel>
				<ul className="mt-3 overflow-hidden rounded-[10px] border border-[var(--line)] bg-[var(--surface)]">
					{mcpTools.map((tool) => (
						<li
							key={tool.name}
							className="grid grid-cols-[1fr_auto_auto] items-center gap-4 border-b border-[var(--line-soft)] px-4 py-2.5 last:border-0"
						>
							<code className="text-xs text-[var(--ink)]">{tool.name}</code>
							<span className="font-[var(--mono)] text-xs text-[var(--ink-soft)]">
								{tool.minRole}
							</span>
							<span className="rounded-[6px] bg-[var(--bg-alt)] px-2.5 py-1 font-[var(--mono)] text-xs text-[var(--ink-soft)]">
								{tool.kind}
							</span>
						</li>
					))}
				</ul>
			</section>
			<section aria-label="Recent agent activity">
				<SectionLabel>Recent agent activity</SectionLabel>
				{activity.length === 0 ? (
					<Empty
						icon={Bot}
						title="No agent activity"
						body="Activity appears after an MCP client uses a tool."
					/>
				) : (
					<ul className="mt-3 overflow-hidden rounded-[10px] border border-[var(--line)] bg-[var(--surface)]">
						{activity.map((item) => (
							<li
								key={item.id}
								className="flex items-center gap-3 border-b border-[var(--line-soft)] px-4 py-3 last:border-0"
							>
								<Bot className="size-4 shrink-0 text-[var(--ink-soft)]" aria-hidden="true" />
								<span className="min-w-0 flex-1 font-[var(--mono)] text-xs text-[var(--ink)]">
									{item.action}
								</span>
								<span className="font-[var(--mono)] text-xs text-[var(--ink-soft)]">{item.at}</span>
							</li>
						))}
					</ul>
				)}
			</section>
			<NewTokenModal
				open={modalOpen}
				rawToken={rawToken}
				config={config}
				onCreate={(name) => {
					const result = createToken(name);
					if (!result.ok) return result.error;
					setRawToken(result.value.rawToken);
					setStatus("Token created. Copy it before closing.");
					return null;
				}}
				onClose={() => {
					setRawToken(null);
					setModalOpen(false);
				}}
			/>
		</div>
	);
}

function CopyRow({
	label,
	value,
	feedback,
	onCopy,
}: {
	label: string;
	value: string;
	feedback: boolean;
	onCopy: () => void;
}) {
	return (
		<div>
			<p className="mb-1.5 font-[var(--mono)] text-[10px] font-semibold uppercase text-[var(--ink-soft)]">
				{label}
			</p>
			<div className="flex">
				<code className="min-w-0 flex-1 truncate rounded-l-lg border border-r-0 border-[var(--line)] bg-[var(--bg)] px-3 py-2.5 text-xs text-[var(--ink)]">
					{value}
				</code>
				<button
					type="button"
					onClick={onCopy}
					aria-label={`Copy ${label}`}
					className="inline-flex min-w-11 cursor-pointer items-center justify-center rounded-r-lg border border-[var(--line)] bg-[var(--surface)] text-[var(--ink-soft)] hover:bg-[var(--bg-alt)]"
				>
					{feedback ? (
						<Check className="size-4 text-[var(--pass)]" aria-hidden="true" />
					) : (
						<Copy className="size-4" aria-hidden="true" />
					)}
				</button>
			</div>
		</div>
	);
}

function Empty({ icon: Icon, title, body }: { icon: typeof Bot; title: string; body: string }) {
	return (
		<div className="mt-3 grid place-items-center gap-2 rounded-[10px] border border-[var(--line)] bg-[var(--surface)] px-6 py-10 text-center">
			<Icon className="size-7 text-[var(--ink-soft)]" aria-hidden="true" />
			<p className="text-sm font-semibold text-[var(--ink)]">{title}</p>
			<p className="text-[13px] text-[var(--ink-soft)]">{body}</p>
		</div>
	);
}
