import { GetObjectCommand, PutObjectCommand, S3Client } from "@aws-sdk/client-s3";
import type { Environment } from "../config.js";
import { AppError, NotFoundError } from "./errors.js";

export interface StoredImage {
	body: Buffer;
	contentType: string;
}

export interface ImageStorage {
	put(key: string, body: Buffer, contentType: string): Promise<void>;
	get(key: string): Promise<StoredImage>;
}

const unavailableStorage: ImageStorage = {
	async put() {
		throw new AppError("IMAGE_STORAGE_UNAVAILABLE", "Image storage is not configured", 503);
	},
	async get() {
		throw new AppError("IMAGE_STORAGE_UNAVAILABLE", "Image storage is not configured", 503);
	},
};

export function createImageStorage(environment: Environment): ImageStorage {
	if (
		!environment.R2_ACCOUNT_ID ||
		!environment.R2_ACCESS_KEY_ID ||
		!environment.R2_SECRET_ACCESS_KEY
	) {
		return unavailableStorage;
	}

	const client = new S3Client({
		region: "auto",
		endpoint:
			environment.R2_ENDPOINT ??
			`https://${environment.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
		credentials: {
			accessKeyId: environment.R2_ACCESS_KEY_ID,
			secretAccessKey: environment.R2_SECRET_ACCESS_KEY,
		},
	});

	return {
		async put(key, body, contentType) {
			await client.send(
				new PutObjectCommand({
					Bucket: environment.R2_BUCKET_NAME,
					Key: key,
					Body: body,
					ContentType: contentType,
				}),
			);
		},
		async get(key) {
			const object = await client.send(
				new GetObjectCommand({ Bucket: environment.R2_BUCKET_NAME, Key: key }),
			);
			if (!object.Body) throw new NotFoundError("Issue image");
			return {
				body: Buffer.from(await object.Body.transformToByteArray()),
				contentType: object.ContentType ?? "application/octet-stream",
			};
		},
	};
}
