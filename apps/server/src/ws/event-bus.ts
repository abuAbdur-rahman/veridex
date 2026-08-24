import postgres from "postgres";

export interface PostgresEventBus {
	publish(payload: string): Promise<void>;
	close(): Promise<void>;
}

export interface CreateEventBusOptions {
	channel: string;
	onPayload: (payload: string) => void;
	onError?: (error: unknown) => void;
}

/**
 * Dedicated LISTEN/NOTIFY client. Uses its own direct (unpooled) connection
 * because statement pooling (PgBouncer) breaks LISTEN — a pooled connection is
 * shared and would drop the subscription. The pg-boss connection is reused
 * conceptually but kept separate here so the broadcaster stays the only caller.
 */
export async function createPostgresEventBus(
	connectionString: string,
	options: CreateEventBusOptions,
): Promise<PostgresEventBus> {
	const sql = postgres(connectionString, { prepare: false });

	await sql.listen(options.channel, (payload) => {
		try {
			options.onPayload(payload);
		} catch (error) {
			options.onError?.(error);
		}
	});

	return {
		async publish(payload) {
			await sql.notify(options.channel, payload);
		},
		async close() {
			await sql.end({ timeout: 5 });
		},
	};
}
