import { z } from "zod";

const optionalTrimmedString = z.preprocess(
	(value) =>
		typeof value === "string" && value.trim() === ""
			? undefined
			: typeof value === "string"
				? value.trim()
				: value,
	z.string().min(1).optional(),
);

const booleanFromEnv = z.preprocess(
	(value) => value === "true" || value === "1",
	z.boolean(),
);

const httpOrigin = z
	.string()
	.trim()
	.min(1)
	.superRefine((value, context) => {
		let url: URL;
		try {
			url = new URL(value);
		} catch {
			context.addIssue({ code: "custom", message: "Must be a valid URL origin" });
			return;
		}

		if (
			(url.protocol !== "http:" && url.protocol !== "https:") ||
			url.username !== "" ||
			url.password !== "" ||
			url.pathname !== "/" ||
			url.search !== "" ||
			url.hash !== ""
		) {
			context.addIssue({
				code: "custom",
				message: "Must be an HTTP(S) origin without credentials, path, query, or fragment",
			});
		}
	})
	.transform((value) => new URL(value).origin);

const postgresUrl = z.string().url().superRefine((value, context) => {
	const protocol = new URL(value).protocol;
	if (protocol === "postgres:" || protocol === "postgresql:") return;

	context.addIssue({
		code: "custom",
		message: "Must be a PostgreSQL connection URL",
	});
});

const oauthProviderPairs = [
	["GOOGLE_CLIENT_ID", "GOOGLE_CLIENT_SECRET"],
	["GITHUB_CLIENT_ID", "GITHUB_CLIENT_SECRET"],
] as const;

const environmentSchema = z
	.object({
		HOST: z.string().min(1).default("127.0.0.1"),
		PORT: z.coerce.number().int().min(1).max(65_535).default(3001),
		NODE_ENV: z
			.enum(["development", "test", "production"])
			.default("development"),
		WEB_ORIGIN: httpOrigin,
		DATABASE_URL: postgresUrl,
		DATABASE_URL_UNPOOLED: postgresUrl,
		BETTER_AUTH_SECRET: z.string().min(16),
		BETTER_AUTH_URL: z.string().url(),
		GOOGLE_CLIENT_ID: optionalTrimmedString,
		GOOGLE_CLIENT_SECRET: optionalTrimmedString,
		GITHUB_CLIENT_ID: optionalTrimmedString,
		GITHUB_CLIENT_SECRET: optionalTrimmedString,
		R2_ACCOUNT_ID: optionalTrimmedString,
		R2_ACCESS_KEY_ID: optionalTrimmedString,
		R2_SECRET_ACCESS_KEY: optionalTrimmedString,
		R2_BUCKET_NAME: z.string().trim().min(1).default("veridex-uploads"),
		R2_ENDPOINT: z.string().url().optional(),
		TRUST_PROXY: booleanFromEnv.default(false),
	})
	.superRefine((environment, context) => {
		for (const [idKey, secretKey] of oauthProviderPairs) {
			if (Boolean(environment[idKey]) === Boolean(environment[secretKey])) continue;

			context.addIssue({
				code: "custom",
				path: [environment[idKey] ? secretKey : idKey],
				message: `${idKey} and ${secretKey} must be configured together`,
			});
		}
	});

export type Environment = z.infer<typeof environmentSchema>;

export function parseEnvironment(input: NodeJS.ProcessEnv): Environment {
	return environmentSchema.parse(input);
}
