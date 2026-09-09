import { defineConfig } from "drizzle-kit";

export default defineConfig({
	schema: "./src/db/schema/index.ts",
	out: "./src/db/migrations",
	dialect: "postgresql",
	dbCredentials: {
		url: getDatabaseUrlUnpooled(),
	},
	verbose: true,
	strict: true,
});

function getDatabaseUrlUnpooled(): string {
	const url = process.env.DATABASE_URL_UNPOOLED;
	if (!url) {
		throw new Error("DATABASE_URL_UNPOOLED must be set to run drizzle-kit");
	}
	return url;
}
