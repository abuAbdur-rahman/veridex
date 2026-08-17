import { Check, Loader2, RefreshCw, Save } from "lucide-react";
import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "@tanstack/react-router";
import { toast } from "sonner";
import { ApiError } from "@/api/client";
import {
	checkUsernameAvailability,
	completeOnboarding,
	deriveUsername,
	isValidUsername,
	normalizeUsername,
} from "@/api/onboarding";
import type { MeResponse } from "@/api/session";
import { FormField } from "@/components/app/FormField";
import { LogoMark } from "@/components/layout/LogoMark";
import { ThemeToggle } from "@/components/theme/ThemeToggle";
import { applyOnboardingResult, meQueryKey, useMe } from "@/queries/session";

/**
 * Username availability is checked against the server with a short
 * debounce so the input doesn't fire a request on every keystroke.
 */
const DEBOUNCE_MS = 500;

export function OnboardingScreen() {
	const queryClient = useQueryClient();
	const navigate = useNavigate();
	const { data: me } = useMe();

	const [username, setUsername] = useState("");
	const [seeded, setSeeded] = useState(false);
	const [debounced, setDebounced] = useState("");
	const [error, setError] = useState("");

	// Pre-fill username from OAuth provider data on first load.
	useEffect(() => {
		if (me?.user && !seeded) {
			const hint = deriveUsername(me.user.email, me.user.name);
			if (hint) setUsername(hint);
			setSeeded(true);
		}
	}, [me?.user, seeded]);

	// Debounced availability check.
	useEffect(() => {
		if (!username.trim()) {
			setDebounced("");
			return;
		}
		const id = setTimeout(() => setDebounced(username), DEBOUNCE_MS);
		return () => clearTimeout(id);
	}, [username]);

	const normalizedInput = normalizeUsername(username);
	const inputValid = !!username.trim() && isValidUsername(username);
	const normalizedLookup = normalizeUsername(debounced);
	const lookupValid = isValidUsername(debounced);
	const lookupMatchesInput = normalizedLookup === normalizedInput;
	const {
		data: availability,
		isFetching: checking,
		isError: availabilityFailed,
		refetch: retryAvailability,
	} = useQuery({
		queryKey: ["username", normalizedLookup],
		queryFn: () => checkUsernameAvailability(normalizedLookup),
		enabled: !!normalizedLookup && lookupValid,
		staleTime: 30_000,
		retry: false,
	});

	const checkingCurrentInput =
		lookupMatchesInput && lookupValid && checking;
	const confirmedAvailable =
		lookupMatchesInput && !checking && !availabilityFailed && availability?.available === true;
	const confirmedUnavailable =
		lookupMatchesInput && !checking && !availabilityFailed && availability?.available === false;
	const currentAvailabilityFailed =
		lookupMatchesInput && lookupValid && availabilityFailed;

	const { mutate: submit, isPending: submitting } = useMutation({
		mutationFn: completeOnboarding,
		onSuccess: async (result) => {
			queryClient.setQueryData<MeResponse | null>(meQueryKey, (current) =>
				applyOnboardingResult(current, result),
			);
			toast.success("Workspace created");
			await navigate({ to: "/dashboard" });
		},
		onError: (error) => {
			const message =
				error instanceof ApiError ? error.message : "Something went wrong. Try again.";
			setError(message);
			toast.error(message);
		},
	});

	function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
		event.preventDefault();
		setError("");

		const trimmed = username.trim();
		const normalized = normalizeUsername(trimmed);

		if (!trimmed) {
			setError("Username is required.");
			return;
		}
		if (!isValidUsername(normalized)) {
			setError(
				"Username must be 3–30 lowercase letters, numbers, underscores, or hyphens.",
			);
			return;
		}
		if (!confirmedAvailable) {
			setError("Wait for username availability to be confirmed.");
			return;
		}

		submit(normalized);
	}

	const canSubmit = inputValid && confirmedAvailable && !submitting;
	const availabilityStatus = checkingCurrentInput
		? "Checking availability"
		: confirmedUnavailable
			? "Username unavailable"
			: confirmedAvailable
				? "Username available"
				: "";

	return (
		<main className="grid min-h-dvh place-items-center bg-[var(--bg)] px-4">
			<div className="w-full max-w-[400px]">
				<header className="mb-10 flex items-center justify-between">
					<LogoMark />
					<ThemeToggle />
				</header>
				<h1 className="mb-2 font-[var(--mono)] text-2xl font-semibold tracking-[-0.02em] text-[var(--ink)]">
					Welcome to Veridex
				</h1>
				<p className="mb-8 text-sm text-[var(--ink-soft)]">
					Choose the username your team will see next to your reports.
				</p>
				<form className="flex flex-col gap-5" onSubmit={handleSubmit}>
					<FormField label="Username" htmlFor="username" required>
						<div className="relative">
							<input
								id="username"
								value={username}
								onChange={(event) => {
									setUsername(event.target.value);
									setError("");
								}}
								placeholder="sarahchen"
								aria-describedby="username-status"
								autoComplete="username"
								className="w-full rounded-lg border border-[var(--line)] bg-[var(--surface)] px-3.5 py-3 text-sm text-[var(--ink)] outline-none transition-[border-color,box-shadow] duration-150 focus:border-[var(--accent)] focus:ring-2 focus:ring-[var(--accent-ring)]"
							/>
							<span
								id="username-status"
								className="absolute right-3.5 top-1/2 -translate-y-1/2"
								role="status"
								aria-live="polite"
							>
								<span className="sr-only">{availabilityStatus}</span>
								{checkingCurrentInput ? (
									<Loader2
										className="size-4 animate-spin text-[var(--ink-soft)]"
										aria-hidden="true"
										strokeWidth={1.5}
									/>
								) : confirmedUnavailable ? (
									<RefreshCw
										className="size-4 text-[var(--block)]"
										aria-hidden="true"
										strokeWidth={1.5}
									/>
								) : confirmedAvailable ? (
									<Check
										className="size-4 text-[var(--pass)]"
										aria-hidden="true"
										strokeWidth={1.5}
									/>
								) : null}
							</span>
						</div>
						{!username.trim() ? (
							<p className="text-xs text-[var(--ink-soft)]">
								3–30 lowercase letters, numbers, underscores, or hyphens.
							</p>
						) : !inputValid ? (
							<p
								role="alert"
								className="text-xs text-[var(--block)]"
							>
								3–30 lowercase letters, numbers, underscores, or hyphens.
							</p>
						) : currentAvailabilityFailed ? (
							<p role="alert" className="text-xs text-[var(--block)]">
								Could not check availability.{" "}
								<button
									type="button"
									onClick={() => void retryAvailability()}
									className="font-semibold underline underline-offset-2"
								>
									Retry
								</button>
							</p>
						) : confirmedUnavailable ? (
							<p
								role="alert"
								className="text-xs text-[var(--block)]"
							>
								Unavailable — try another.
							</p>
						) : confirmedAvailable ? (
							<p className="text-xs text-[var(--pass)]">Available</p>
						) : null}
					</FormField>
					{error ? (
						<p
							role="alert"
							className="text-xs text-[var(--block)]"
						>
							{error}
						</p>
					) : null}
					<button
						type="submit"
						disabled={!canSubmit}
						className="flex min-h-12 cursor-pointer items-center justify-center rounded-lg bg-[var(--accent)] px-4 text-sm font-semibold text-white transition-colors duration-150 hover:bg-[var(--accent-strong)] disabled:opacity-50"
					>
						{submitting ? (
							<>
								<Loader2
									className="mr-2 size-4 animate-spin"
									aria-hidden="true"
									strokeWidth={1.5}
								/>
								Creating your workspace…
							</>
						) : (
							<>
								<Save
									className="mr-2 size-4"
									aria-hidden="true"
									strokeWidth={1.5}
								/>
								Continue
							</>
						)}
					</button>
				</form>
			</div>
		</main>
	);
}
