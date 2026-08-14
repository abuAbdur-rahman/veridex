import { cn } from "@/lib/utils";
import type { RoleView } from "@/lib/veridex-types";

const views: { value: RoleView; label: string }[] = [
	{ value: "dev", label: "Dev" },
	{ value: "qa", label: "QA" },
	{ value: "tester", label: "Tester" },
	{ value: "all", label: "All" },
];

interface ViewSwitcherProps {
	value: RoleView;
	onChange?: (view: RoleView) => void;
	label?: string;
}

export function ViewSwitcher({ value, onChange, label = "View" }: ViewSwitcherProps) {
	return (
		<div role="group" aria-label={label} className="flex items-center gap-0.5 rounded-lg border border-[var(--line)] bg-[var(--bg)] p-0.5">
			{views.map((view) => {
				const active = view.value === value;
				return (
					<button
						key={view.value}
						type="button"
						aria-pressed={active}
						onClick={() => onChange?.(view.value)}
						className={cn(
							"rounded-md px-2.5 py-1 font-[var(--mono)] text-[11px] font-medium transition-colors duration-150",
							active
								? "bg-[var(--accent)] text-white"
								: "text-[var(--ink-soft)] hover:text-[var(--ink)]",
						)}
					>
						{view.label}
					</button>
				);
			})}
		</div>
	);
}