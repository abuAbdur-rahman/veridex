import { Check, Copy, KeyRound, Plus, Trash2 } from "lucide-react";
import { useState } from "react";
import { PageHeader } from "@/components/app/PageHeader";
import { SectionLabel } from "@/components/app/FormField";
import { NewTokenModal } from "@/components/screens/NewTokenModal";
import { useApiTokens, useCreateApiToken, useRevokeApiToken } from "@/queries/tokens";
import { useMcpAccessSummary, useMcpActivity } from "@/queries/mcp";

const endpoint = import.meta.env.VITE_MCP_URL as string | undefined;

export function McpScreen() {
	const tokensQuery = useApiTokens();
	const createMutation = useCreateApiToken();
	const revokeMutation = useRevokeApiToken();
	const accessQuery = useMcpAccessSummary();
	const activityQuery = useMcpActivity();
	const [modalOpen, setModalOpen] = useState(false);
	const [rawToken, setRawToken] = useState<string | null>(null);
	const [status, setStatus] = useState("");
	const tokens = tokensQuery.data ?? [];
	const activeTokens = tokens.filter((token) => !token.revokedAt);
	const config = rawToken && endpoint
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
					{endpoint ? (
						<CopyRow
							label="Endpoint"
							value={endpoint}
							feedback={status === "Endpoint copied."}
							onCopy={() => copy(endpoint, "Endpoint")}
						/>
					) : (
						<p className="text-[13px] text-[var(--ink-soft)]">
							MCP transport is not configured yet. Tokens can be managed now; client config will
							appear when <code>VITE_MCP_URL</code> is set.
						</p>
					)}
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
			<section aria-label="Project access">
				<SectionLabel>Project access</SectionLabel>
				{accessQuery.isPending ? <p className="mt-3 text-sm text-[var(--ink-soft)]">Loading access...</p> : null}
				{accessQuery.isError ? <p role="alert" className="mt-3 text-sm text-[var(--block)]">{accessQuery.error.message}</p> : null}
				{accessQuery.data?.summary.length === 0 ? <p className="mt-3 text-sm text-[var(--ink-soft)]">No project access.</p> : null}
				{accessQuery.data?.summary.length ? (
					<ul className="mt-3 overflow-hidden rounded-[10px] border border-[var(--line)] bg-[var(--surface)]">
						{accessQuery.data.summary.map((access) => (
							<li key={access.projectId} className="flex flex-wrap items-center gap-3 border-b border-[var(--line-soft)] px-4 py-3 last:border-b-0">
								<span className="min-w-0 flex-1"><span className="block text-sm font-medium">{access.projectName}</span><span className="font-[var(--mono)] text-xs text-[var(--ink-soft)]">{access.role} · {access.totalTools} tools</span></span>
								<span className="text-xs text-[var(--ink-soft)]">{access.availableTools.join(", ")}</span>
							</li>
						))}
					</ul>
				) : null}
			</section>
			<section aria-label="MCP activity">
				<SectionLabel>Recent MCP activity</SectionLabel>
				{activityQuery.isPending ? <p className="mt-3 text-sm text-[var(--ink-soft)]">Loading activity...</p> : null}
				{activityQuery.isError ? <p role="alert" className="mt-3 text-sm text-[var(--block)]">{activityQuery.error.message}</p> : null}
				{activityQuery.data?.activity.length === 0 ? <p className="mt-3 text-sm text-[var(--ink-soft)]">No MCP activity yet.</p> : null}
				{activityQuery.data?.activity.length ? (
					<ul className="mt-3 overflow-hidden rounded-[10px] border border-[var(--line)] bg-[var(--surface)]">
						{activityQuery.data.activity.map((entry) => (
							<li key={entry.id} className="border-b border-[var(--line-soft)] px-4 py-3 last:border-b-0">
								<p className="text-sm font-medium">{entry.ticketRef} · {entry.title}</p>
								<p className="mt-1 font-[var(--mono)] text-xs text-[var(--ink-soft)]">{entry.fromStatus ?? "new"} → {entry.toStatus}{entry.changedAt ? ` · ${new Date(entry.changedAt).toLocaleString()}` : ""}</p>
								{entry.note ? <p className="mt-1 text-xs text-[var(--ink-soft)]">{entry.note}</p> : null}
							</li>
						))}
					</ul>
				) : null}
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
				{tokensQuery.isPending ? (
					<p className="mt-3 py-8 text-center text-sm text-[var(--ink-soft)]">Loading tokens...</p>
				) : tokensQuery.isError ? (
					<p
						className="mt-3 rounded-[10px] border border-[var(--block)] bg-[var(--block-bg)] px-4 py-3 text-sm text-[var(--block)]"
						role="alert"
					>
						{tokensQuery.error.message}
					</p>
				) : tokens.length === 0 ? (
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
										{token.tokenPrefix}... · Created {new Date(token.createdAt).toLocaleDateString()}
									</span>
									{token.lastUsedAt ? (
										<span className="block text-xs text-[var(--ink-soft)]">
											Last used {new Date(token.lastUsedAt).toLocaleString()}
										</span>
									) : null}
								</span>
								{token.revokedAt ? (
									<span className="rounded-[6px] bg-[var(--block-bg)] px-2.5 py-1 font-[var(--mono)] text-xs text-[var(--block)]">
										revoked
									</span>
								) : (
									<button
										type="button"
										aria-label={`Revoke ${token.name}`}
										disabled={revokeMutation.isPending}
										onClick={async () => {
											if (!window.confirm(`Revoke token ${token.name}?`)) return;
											try {
												await revokeMutation.mutateAsync(token.id);
												setStatus(`${token.name} revoked.`);
											} catch (value) {
												setStatus(
													value instanceof Error ? value.message : "Could not revoke token.",
												);
											}
										}}
										className="inline-flex min-h-9 cursor-pointer items-center gap-1.5 rounded-[6px] px-2.5 text-xs font-medium text-[var(--ink-soft)] hover:bg-[var(--block-bg)] hover:text-[var(--block)] disabled:cursor-not-allowed disabled:opacity-60"
									>
										<Trash2 className="size-3.5" aria-hidden="true" /> Revoke
									</button>
								)}
							</li>
						))}
					</ul>
				)}
			</section>
			<NewTokenModal
				open={modalOpen}
				rawToken={rawToken}
				config={config}
				pending={createMutation.isPending}
				onCreate={async (name) => {
					try {
						const result = await createMutation.mutateAsync(name);
						setRawToken(result.token);
						setStatus("Token created. Copy it before closing.");
						return null;
					} catch (value) {
						return value instanceof Error ? value.message : "Could not create token.";
					}
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

function Empty({ icon: Icon, title, body }: { icon: typeof KeyRound; title: string; body: string }) {
	return (
		<div className="mt-3 grid place-items-center gap-2 rounded-[10px] border border-[var(--line)] bg-[var(--surface)] px-6 py-10 text-center">
			<Icon className="size-7 text-[var(--ink-soft)]" aria-hidden="true" />
			<p className="text-sm font-semibold text-[var(--ink)]">{title}</p>
			<p className="text-[13px] text-[var(--ink-soft)]">{body}</p>
		</div>
	);
}
