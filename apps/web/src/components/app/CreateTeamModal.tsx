import { useEffect, useState, type FormEvent } from "react";
import { FormField } from "@/components/app/FormField";
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogHeader,
	DialogTitle,
} from "@/components/ui/dialog";

const SLUG_PATTERN = /^[a-z0-9][a-z0-9_-]{2,29}$/;

function suggestSlug(name: string) {
	return name
		.toLowerCase()
		.replace(/[^a-z0-9_-]+/g, "-")
		.replace(/^-+|-+$/g, "")
		.slice(0, 30);
}

export interface CreateTeamValues {
	name: string;
	slug: string;
}

interface CreateTeamModalProps {
	open: boolean;
	pending?: boolean;
	error?: string;
	onClose?: () => void;
	onSubmit?: (values: CreateTeamValues) => void | Promise<void>;
}

export function CreateTeamModal({
	open,
	pending = false,
	error,
	onClose,
	onSubmit,
}: CreateTeamModalProps) {
	const [name, setName] = useState("");
	const [slug, setSlug] = useState("");
	const [slugTouched, setSlugTouched] = useState(false);
	const [slugError, setSlugError] = useState("");

	useEffect(() => {
		if (open) {
			setName("");
			setSlug("");
			setSlugTouched(false);
			setSlugError("");
		}
	}, [open]);

	function handleNameChange(value: string) {
		setName(value);
		if (!slugTouched) setSlug(suggestSlug(value));
	}

	function handleSubmit(event: FormEvent<HTMLFormElement>) {
		event.preventDefault();
		if (!SLUG_PATTERN.test(slug)) {
			setSlugError(
				"Slug must start with a letter or number and use 3–30 lowercase letters, numbers, dashes, or underscores.",
			);
			return;
		}
		void onSubmit?.({ name: name.trim(), slug });
	}

	const inputClass =
		"w-full rounded-lg border border-[var(--line)] bg-[var(--bg)] px-3.5 py-2.5 text-sm text-[var(--ink)] outline-none transition-[border-color,box-shadow] duration-150 placeholder:text-[var(--ink-soft)] focus:border-[var(--accent)] focus:ring-2 focus:ring-[var(--accent-ring)]";
	const slugInvalid = slug.length > 0 && !SLUG_PATTERN.test(slug);
	return (
		<Dialog
			open={open}
			onOpenChange={(next) => {
				if (!next && !pending) onClose?.();
			}}
		>
			<DialogContent className="w-full max-w-[560px] gap-0 overflow-hidden rounded-[12px] border border-[var(--line)] bg-[var(--surface)] p-0 text-[var(--ink)] sm:max-w-[560px]">
				<DialogHeader className="border-b border-[var(--line)] px-6 py-4 pr-14">
					<DialogTitle className="font-[var(--mono)] text-base font-semibold">
						Create a team
					</DialogTitle>
					<DialogDescription className="sr-only">
						Create a new team for your organization.
					</DialogDescription>
				</DialogHeader>
				<form className="flex flex-col gap-5 p-6" onSubmit={handleSubmit}>
					{error ? (
						<p
							role="alert"
							className="rounded-md border border-[var(--block)] bg-[var(--block-bg)] px-3 py-2 text-sm text-[var(--block)]"
						>
							{error}
						</p>
					) : null}
					<FormField label="Name" htmlFor="create-team-name" required>
						<input
							id="create-team-name"
							name="name"
							value={name}
							onChange={(event) => handleNameChange(event.target.value)}
							required
							maxLength={100}
							placeholder="Product engineering"
							className={inputClass}
						/>
					</FormField>
					<FormField
						label="Slug"
						htmlFor="create-team-slug"
						required
						hint="Lowercase letters, numbers, dashes, or underscores. 3–30 characters."
						error={
							slugError ||
							(slugInvalid
								? "Slug must start with a letter or number and use 3–30 lowercase letters, numbers, dashes, or underscores."
								: undefined)
						}
					>
						<input
							id="create-team-slug"
							name="slug"
							value={slug}
							onChange={(event) => {
								setSlugTouched(true);
								setSlugError("");
								setSlug(event.target.value.toLowerCase());
							}}
							required
							maxLength={30}
							placeholder="product-engineering"
							className={inputClass}
						/>
					</FormField>
					<div className="flex justify-end gap-3 border-t border-[var(--line)] pt-5">
						<button
							type="button"
							disabled={pending}
							onClick={onClose}
							className="inline-flex min-h-10 items-center justify-center rounded-lg border border-[var(--line)] px-4 text-sm font-semibold disabled:opacity-50"
						>
							Cancel
						</button>
						<button
							type="submit"
							disabled={pending}
							className="inline-flex min-h-10 items-center justify-center rounded-lg bg-[var(--accent)] px-4 text-sm font-semibold text-white disabled:opacity-50"
						>
							{pending ? "Creating..." : "Create Team"}
						</button>
					</div>
				</form>
			</DialogContent>
		</Dialog>
	);
}
