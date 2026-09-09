import { createRootRouteWithContext, Outlet, redirect } from "@tanstack/react-router";
import type { QueryClient } from "@tanstack/react-query";
import { RootLayout } from "@/components/app/AppShell";
import { meQueryOptions } from "@/queries/session";
import type { MeResponse } from "@/api/session";

export interface RouterContext {
	queryClient: QueryClient;
}

/** Route prefixes that do not require authentication. */
const PUBLIC_PATH_PREFIXES = ["/", "/login", "/auth", "/join/team"];

function isPublicPath(pathname: string): boolean {
	return PUBLIC_PATH_PREFIXES.some(
		(prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`),
	);
}

function isOnboarded(me: MeResponse): boolean {
	return Boolean(me.user.username) && me.hasPersonalTeam;
}

function RootView() {
	return (
		<RootLayout>
			<Outlet />
		</RootLayout>
	);
}

/**
 * Root route with an auth guard.
 *
 * The guard fetches `GET /api/me` when the cached session is stale and
 * redirects unauthenticated users to `/login`, and users who are authenticated
 * but not yet onboarded to `/onboarding`. Public routes (landing, login,
 * invite) are skipped so the landing experience works without a backend.
 */
export const rootRoute = createRootRouteWithContext<RouterContext>()({
	beforeLoad: async ({ context, location }) => {
		const pathname = location.pathname;

		if (isPublicPath(pathname)) {
			return;
		}

		let me: MeResponse | null;
		try {
			me = await context.queryClient.fetchQuery(meQueryOptions);
		} catch {
			// Backend unreachable — cannot prove authentication, so redirect.
			throw redirect({ to: "/login" });
		}

		if (!me || !me.session) {
			throw redirect({ to: "/login" });
		}

		const onboarded = isOnboarded(me);

		if (!onboarded && pathname !== "/onboarding") {
			throw redirect({ to: "/onboarding" });
		}

		if (onboarded && pathname === "/onboarding") {
			throw redirect({ to: "/dashboard" });
		}

		return { me };
	},
	component: RootView,
});
