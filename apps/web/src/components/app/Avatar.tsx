import { useState } from "react";
import { cn } from "@/lib/utils";

interface AvatarProps {
	initials: string;
	gradient: string;
	name: string;
	imageUrl?: string;
	className?: string;
}

export function Avatar({ initials, gradient, name, imageUrl, className }: AvatarProps) {
	const [imageFailedUrl, setImageFailedUrl] = useState<string | undefined>();
	const showImage = Boolean(imageUrl) && imageFailedUrl !== imageUrl;

	return (
		<span
			className={cn(
				"grid size-6 shrink-0 place-items-center overflow-hidden rounded-full font-[var(--mono)] text-[10px] font-bold text-[#171e26]",
				className,
			)}
			style={{ backgroundImage: gradient }}
			role="img"
			aria-label={name}
		>
			{showImage ? (
				<img
					src={imageUrl}
					alt=""
					className="size-full object-cover"
					referrerPolicy="no-referrer"
					onError={() => setImageFailedUrl(imageUrl)}
				/>
			) : (
				initials
			)}
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
