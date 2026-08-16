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
