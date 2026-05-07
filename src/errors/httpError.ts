import { AxiosError } from "axios";

export class FortytwoIntraClientHttpError extends Error {
	public statusCode: number;
	public statusText: string;
	public data: unknown;

	constructor(error: AxiosError) {
		const method = error.config?.method?.toUpperCase() ?? null;
		const route = error.config?.url ?? null;

		const statusCode = error.response?.status ?? NaN;
		const statusText = error.response?.statusText ?? "Unknown";

		const message =
			method && route ? `${method} ${route} - HTTP ${statusCode} ${statusText}` : error.message;

		super(message);
		this.name = "FortytwoIntraClientHttpError";
		this.statusCode = statusCode;
		this.statusText = statusText;
		this.data = error.response?.data;
	}
}

export function isFortytwoIntraClientHttpError(
	error: unknown,
): error is FortytwoIntraClientHttpError {
	return error instanceof FortytwoIntraClientHttpError;
}
