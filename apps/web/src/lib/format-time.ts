const relativeTime = new Intl.RelativeTimeFormat("en", { numeric: "auto" });

export function formatRelativeTime(value: string, currentTime = Date.now()): string {
	const timestamp = Date.parse(value);
	if (Number.isNaN(timestamp)) return value;

	const elapsedSeconds = Math.round((currentTime - timestamp) / 1000);
	const direction = elapsedSeconds < 0 ? 1 : -1;
	const absoluteSeconds = Math.abs(elapsedSeconds);
	if (absoluteSeconds < 45) return "just now";
	if (absoluteSeconds < 3_600) return relativeTime.format(direction * Math.max(1, Math.round(absoluteSeconds / 60)), "minute");
	if (absoluteSeconds < 86_400) return relativeTime.format(direction * Math.round(absoluteSeconds / 3_600), "hour");
	if (absoluteSeconds < 604_800) return relativeTime.format(direction * Math.round(absoluteSeconds / 86_400), "day");
	return new Intl.DateTimeFormat("en", { dateStyle: "medium" }).format(timestamp);
}
