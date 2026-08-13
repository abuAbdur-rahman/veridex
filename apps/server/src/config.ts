import { z } from "zod";

const environmentSchema = z.object({
	HOST: z.string().min(1).default("127.0.0.1"),
	PORT: z.coerce.number().int().min(1).max(65_535).default(3001),
	NODE_ENV: z
		.enum(["development", "test", "production"])
		.default("development"),
});

export type Environment = z.infer<typeof environmentSchema>;

export function parseEnvironment(input: NodeJS.ProcessEnv): Environment {
	return environmentSchema.parse(input);
}
