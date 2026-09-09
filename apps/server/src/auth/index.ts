import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { user, session, account, verification } from "../db/schema/index.js";
import type { Database } from "../db/client.js";
import type { Environment } from "../config.js";

type SocialProviders = NonNullable<
	Parameters<typeof betterAuth>[0]["socialProviders"]
>;

export function createAuth(db: Database, environment: Environment) {
	const socialProviders: SocialProviders = {};
	if (environment.GOOGLE_CLIENT_ID && environment.GOOGLE_CLIENT_SECRET) {
		socialProviders.google = {
			clientId: environment.GOOGLE_CLIENT_ID,
			clientSecret: environment.GOOGLE_CLIENT_SECRET,
		};
	}
	if (environment.GITHUB_CLIENT_ID && environment.GITHUB_CLIENT_SECRET) {
		socialProviders.github = {
			clientId: environment.GITHUB_CLIENT_ID,
			clientSecret: environment.GITHUB_CLIENT_SECRET,
		};
	}

	return betterAuth({
		database: drizzleAdapter(db, {
			provider: "pg",
			schema: { user, session, account, verification },
		}),
		baseURL: environment.BETTER_AUTH_URL,
		trustedOrigins: [environment.WEB_ORIGIN],
		secret: environment.BETTER_AUTH_SECRET,
		advanced: {
			useSecureCookies: environment.NODE_ENV === "production",
			// TODO(domain-migration): once custom domain exists (app.<domain> + api.<domain>),
			// switch to crossSubDomainCookies with domain: ".<domain>" to make this same-site.
			// Until then, frontend (Vercel) and backend (Render) are cross-site, so we need
			// SameSite=None; Secure for cookies to be sent. Do not set an explicit domain.
			database: {
				// Veridex schemas validate user ids as UUID strings; Better Auth's
				// default ids are alphanumeric and would fail those checks. A
				// function is required because auth.user.id is a plain text
				// column without a gen_random_uuid() database default.
				generateId: () => crypto.randomUUID(),
			},
			cookies: {
				session_token: {
					attributes: {
						sameSite: environment.NODE_ENV === "production" ? "none" : "lax",
						secure: environment.NODE_ENV === "production",
						httpOnly: true,
					},
				},
			},
		},
		emailAndPassword: {
			enabled: environment.DEV_AUTH_ENABLED,
		},
		user: {
			additionalFields: {
				username: { type: "string", required: false },
				defaultRole: { type: "string", required: false },
			},
		},
		socialProviders,
	});
}
