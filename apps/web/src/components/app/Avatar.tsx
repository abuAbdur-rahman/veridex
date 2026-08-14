import { cn } from "@/lib/utils";

interface AvatarProps {
	initials: string;
	gradient: string;
	name: string;
	className?: string;
}

export function Avatar({ initials, gradient, name, className }: AvatarProps) {
	return (
		<span
			className={cn(
				"grid size-6 shrink-0 place-items-center rounded-full font-[var(--mono)] text-[10px] font-bold text-[#171e26]",
				className,
			)}
			style={{ backgroundImage: gradient }}
			role="img"
			aria-label={name}
		>
			{initials}
		</span>
	);
}

export function BotAvatar({ className }: { className?: string }) {
	return (
		<span
			className={cn(
				"grid size-6 shrink-0 place-items-center rounded-full border border-[var(--line)] bg-[var(--bg-alt)] font-[var(--mono)] text-[10px] font-semibold text-[var(--ink-soft)]",
				className,
			)}
			role="img"
			aria-label="Agent activity"
		>
			{"\u2728"}
		</span>
	);
}
