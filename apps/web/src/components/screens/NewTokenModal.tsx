import { AlertTriangle, Check, Copy } from "lucide-react";
import { useState } from "react";
import { FormField } from "@/components/app/FormField";
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogHeader,
	DialogTitle,
} from "@/components/ui/dialog";

interface NewTokenModalProps {
	open: boolean;
	rawToken: string | null;
	config: string | null;
	pending: boolean;
	onCreate: (name: string) => Promise<string | null>;
	onClose: () => void;
}

export function NewTokenModal({
	open,
	rawToken,
	config,
	pending,
	onCreate,
	onClose,
}: NewTokenModalProps) {
	const [name, setName] = useState("");
	const [error, setError] = useState("");
	const [copied, setCopied] = useState(false);

	function close() {
		setName("");
		setError("");
		setCopied(false);
		onClose();
	}

	async function copyValue(value: string, label: string) {
		try {
			await navigator.clipboard.writeText(value);
			setCopied(true);
			setError(`${label} copied.`);
			window.setTimeout(() => setCopied(false), 1600);
		} catch {
			setError(`Could not copy ${label.toLowerCase()}.`);
		}
	}

	return (
		<Dialog
			open={open}
			onOpenChange={(nextOpen) => {
				if (!nextOpen && !pending) close();
			}}
		>
			<DialogContent className="w-full max-w-[440px] gap-0 overflow-hidden rounded-[12px] border border-[var(--line)] bg-[var(--surface)] p-0 text-[var(--ink)] shadow-[0_24px_60px_rgba(0,0,0,0.4)] sm:max-w-[440px]">
				<DialogHeader className="border-b border-[var(--line)] px-6 py-4">
					<DialogTitle className="font-[var(--mono)] text-base font-semibold">
						{rawToken ? "Token generated" : "New API token"}
					</DialogTitle>
					<DialogDescription className="sr-only">
						{rawToken
							? "Copy the new token before closing this dialog."
							: "Create a named MCP API token."}
					</DialogDescription>
				</DialogHeader>
				{rawToken ? (
					<div className="flex flex-col gap-5 p-6">
						<div className="flex items-start gap-3 rounded-lg border border-[var(--pending)] bg-[var(--pending-bg)] p-4">
							<AlertTriangle
								className="mt-0.5 size-4 shrink-0 text-[var(--pending)]"
								aria-hidden="true"
							/>
							<p className="text-sm leading-6 text-[var(--ink)]">
								Copy this token now. It will not be shown again.
							</p>
						</div>
						<div className="flex items-stretch">
							<code className="min-w-0 flex-1 break-all rounded-l-lg border border-r-0 border-[var(--line)] bg-[var(--bg)] px-3 py-2.5 font-[var(--mono)] text-xs">
								{rawToken}
							</code>
							<button
								type="button"
								onClick={() => copyValue(rawToken, "Token")}
								aria-label="Copy token"
								className="inline-flex min-w-11 cursor-pointer items-center justify-center rounded-r-lg border border-[var(--line)] bg-[var(--surface)] text-[var(--ink-soft)] hover:bg-[var(--bg-alt)]"
							>
								{copied ? (
									<Check className="size-4 text-[var(--pass)]" aria-hidden="true" />
								) : (
									<Copy className="size-4" aria-hidden="true" />
								)}
							</button>
						</div>
						{config ? (
							<div>
								<div className="mb-1.5 flex items-center justify-between">
									<span className="font-[var(--mono)] text-[10px] font-semibold uppercase text-[var(--ink-soft)]">
										Claude Code config
									</span>
									<button
										type="button"
										onClick={() => copyValue(config, "Config")}
										className="inline-flex min-h-8 cursor-pointer items-center gap-1.5 rounded-[6px] px-2 text-xs text-[var(--ink)] hover:bg-[var(--bg-alt)]"
									>
										<Copy className="size-3.5" aria-hidden="true" /> Copy JSON
									</button>
								</div>
								<pre className="max-h-44 overflow-auto rounded-lg border border-[var(--line)] bg-[var(--bg-alt)] p-3 font-[var(--mono)] text-[11px] leading-5 text-[var(--ink)]">
									{config}
								</pre>
							</div>
						) : null}
						<p className="min-h-5 text-xs text-[var(--ink-soft)]" role="status">
							{error}
						</p>
						<div className="flex justify-end">
							<button
								type="button"
								onClick={close}
								className="inline-flex min-h-10 cursor-pointer items-center rounded-lg bg-[var(--accent)] px-5 text-sm font-semibold text-white hover:bg-[var(--accent-strong)]"
							>
								Done
							</button>
						</div>
					</div>
				) : (
					<form
						className="flex flex-col gap-5 p-6"
						onSubmit={async (event) => {
							event.preventDefault();
							const message = await onCreate(name);
							setError(message ?? "");
						}}
					>
						<FormField label="Name" htmlFor="token-name" required error={error || undefined}>
							<input
								id="token-name"
								autoFocus
								required
								value={name}
								onChange={(event) => {
									setName(event.target.value);
									setError("");
								}}
								disabled={pending}
								placeholder="Claude Code - laptop"
								className="w-full rounded-lg border border-[var(--line)] bg-[var(--bg)] px-3.5 py-2.5 text-sm text-[var(--ink)] outline-none focus:border-[var(--accent)] focus:ring-2 focus:ring-[var(--accent-ring)]"
							/>
						</FormField>
						<div className="flex justify-end gap-3">
							<button
								type="button"
								onClick={close}
								disabled={pending}
								className="inline-flex min-h-10 cursor-pointer items-center rounded-lg border border-[var(--line)] bg-[var(--bg)] px-4 text-sm font-semibold text-[var(--ink)] hover:bg-[var(--bg-alt)]"
							>
								Cancel
							</button>
							<button
								type="submit"
								disabled={pending}
								className="inline-flex min-h-10 cursor-pointer items-center gap-2 rounded-lg bg-[var(--accent)] px-4 text-sm font-semibold text-white hover:bg-[var(--accent-strong)] disabled:cursor-not-allowed disabled:opacity-60"
							>
								<Check className="size-4" aria-hidden="true" />
								{pending ? "Generating..." : "Generate"}
							</button>
						</div>
					</form>
				)}
			</DialogContent>
		</Dialog>
	);
}
