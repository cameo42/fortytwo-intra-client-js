import { AxiosError } from "axios";

export class FortytwoIntraClientError extends Error {
	public statusCode: number | null;
	public statusText: string | null;
	public data: any;

	constructor(error: AxiosError) {
		const method = error.config?.method?.toUpperCase() ?? null;
		const route = error.config?.url ?? null;

		const statusCode = error.response?.status ?? NaN;
		const statusText = error.response?.statusText ?? "Unknown";

		const message = method && route
			? `${method} ${route} - HTTP ${statusCode} ${statusText}`
			: error.message;

		super(message);
		this.name = "FortytwoIntraClientError";
		this.statusCode = statusCode;
		this.statusText = statusText;
		this.data = error.response?.data;
	}
}

export function simplifyAxiosError(error: AxiosError): FortytwoIntraClientError {
	return new FortytwoIntraClientError(error);
}

export function isFortytwoIntraClientError(error: any) {
	return error instanceof FortytwoIntraClientError;
}
