import { PgBoss } from "pg-boss";
import type { Environment } from "../config.js";

export type Queue = PgBoss;

export async function createQueue(
	unpooledConnectionString: string,
): Promise<Queue> {
	const boss = new PgBoss(unpooledConnectionString);

	await boss.start();
	return boss;
}
