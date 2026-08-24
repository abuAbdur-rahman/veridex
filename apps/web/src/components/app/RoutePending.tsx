export function RoutePending() {
	return (
		<div
			role="status"
			aria-live="polite"
			className="grid h-full min-h-[200px] w-full place-items-center"
		>
			<div className="flex items-center gap-2 text-sm text-[var(--ink-soft)]">
				<span
					aria-hidden="true"
					className="size-4 animate-spin rounded-full border-2 border-[var(--line)] border-t-[var(--accent)] motion-reduce:animate-none"
				/>
				Loading...
			</div>
		</div>
	);
}
