import axios, { AxiosError, AxiosInstance, AxiosResponse, isAxiosError } from "axios";
import { z } from "zod";
import { inputOptions, reqOptions } from "../types";
import { getErrorLogLine, getLogLine } from "../lib/logs";
import { FortytwoIntraClientHttpError } from "../errors/httpError";
import { FortytwoIntraClientValidationError } from "../errors/validationError";
import { Token, tokenSchema } from "./schemas";

export * from "../errors/httpError";
export * from "../errors/validationError";

export interface FortytwoIntraClientConf {
	redirect_uri: string | null;
	base_url: string;
	token_url: string;
	maxRetry: number;
	logLine: boolean;
	errLogBody: boolean;
}

const defaultConf: FortytwoIntraClientConf = {
	redirect_uri: null,
	base_url: "https://api.intra.42.fr/v2/",
	token_url: "https://auth.42.fr/auth/realms/staff-42/protocol/openid-connect/token",
	maxRetry: 5,
	logLine: true,
	errLogBody: true,
};

type Credentials = {
	client_id: string;
	client_secret: string;
	username: string;
	password: string;
};

export class FortytwoIntraV3Client {
	private base_url: string;
	private token_url: string;
	private axiosInstance: AxiosInstance;
	private retryOn: number[];
	private maxRetry: number;
	private logLine: boolean;
	private errLogBody: boolean;

	private authorization: Token | null;

	constructor(
		private credentials: Credentials,
		conf: Partial<FortytwoIntraClientConf>,
	) {
		const config: FortytwoIntraClientConf = { ...defaultConf, ...conf };

		this.base_url = config.base_url;
		this.token_url = config.token_url;

		this.axiosInstance = axios.create();

		this.retryOn = [401, 429, 500];
		this.maxRetry = config.maxRetry;
		this.logLine = config.logLine;
		this.errLogBody = config.errLogBody;

		this.authorization = null;
	}

	private async generateToken() {
		const data =
			this.authorization && this.isRefreshTokenValid()
				? new URLSearchParams({
						grant_type: "refresh_token",
						refresh_token: this.authorization.refresh_token,
					})
				: new URLSearchParams({
						grant_type: "password",
						username: this.credentials.username,
						password: this.credentials.password,
					});

		const res = await this.axiosInstance.post(this.token_url, data, {
			headers: {
				Authorization: `Basic ${Buffer.from(`${this.credentials.client_id}:${this.credentials.client_secret}`).toString("base64")}`,
				"Content-Type": "application/x-www-form-urlencoded",
			},
		});

		return tokenSchema.parse(res.data);
	}

	private isTokenValid(): boolean {
		return this.authorization !== null && this.authorization.expires_at - 30000 > Date.now();
	}

	private isRefreshTokenValid(): boolean {
		return (
			this.authorization !== null && this.authorization.refresh_expires_at - 30000 > Date.now()
		);
	}

	private async fetch(url: URL, options: reqOptions) {
		const { method, body, query } = options;

		if (!this.isTokenValid()) {
			this.authorization = await this.generateToken();
		}

		// Attach access_token
		const accessToken = this.authorization?.access_token;

		// Extract query parameters from URL and combine with options.query
		const urlParams: Record<string, any> = {};
		url.searchParams.forEach((value, key) => {
			urlParams[key] = value;
		});

		// Combine URL params with query params (query params take precedence)
		const combinedParams = { ...urlParams, ...query };

		// Create clean URL without query parameters
		const cleanUrl = new URL(url);
		cleanUrl.search = "";

		// Use the rate-limited axios instance
		return this.axiosInstance.request({
			method: method.toLowerCase(),
			url: cleanUrl.toString(),
			headers: {
				Authorization: `Bearer ${accessToken}`,
			},
			params: combinedParams,
			data: body ? body : undefined,
		});
	}

	private async reqHandler(url: URL, options: reqOptions): Promise<AxiosResponse> {
		try {
			const res = await this.fetch(url, options);
			this.logSuccess(res, options);

			return res;
		} catch (err) {
			if (isAxiosError(err)) {
				this.logError(err, options);

				const { attempt, maxRetry } = options;
				const status = err.response?.status;

				if (maxRetry > 0 && attempt < maxRetry && status && this.retryOn.includes(status)) {
					if (status === 401) {
						this.authorization = null;
					}
					options.attempt++;
					return this.reqHandler(url, options);
				} else {
					throw new FortytwoIntraClientHttpError(err);
				}
			} else {
				throw err;
			}
		}
	}

	private logSuccess(res: AxiosResponse, options: reqOptions) {
		if (!options.logLine) return;

		const line = getLogLine(res, options);
		console.log(line);
	}

	private logError(err: AxiosError, options: reqOptions) {
		if (!options.logLine) return;

		const line = getErrorLogLine(err, options);
		const body = err.response?.data;
		const logBody = options.errLogBody && body && Object.keys(body).length;
		try {
			console.log(line, logBody ? JSON.stringify(body, null, 2) : "");
		} catch {
			console.log(line, logBody ? body : "");
		}
	}

	private validate<S extends z.ZodType>(data: any, schema: S): z.infer<S>;
	private validate<S extends z.ZodType | undefined>(data: any, schema?: S): any;
	private validate<S extends z.ZodType | undefined>(data: any, schema?: S): any {
		if (!schema) {
			return data;
		}

		try {
			return schema.parse(data);
		} catch (err) {
			if (err instanceof z.ZodError) {
				throw new FortytwoIntraClientValidationError(err, data);
			}
			throw err;
		}
	}

	// Public methods
	public async get(
		endpoint: URL | string,
		options?: Omit<inputOptions, "body" | "perPage" | "maxPages" | "token">,
	): Promise<any>;
	public async get<S extends z.ZodType>(
		endpoint: URL | string,
		options: Omit<inputOptions, "body" | "perPage" | "maxPages" | "token"> & { schema: S },
	): Promise<z.infer<S>>;
	public async get<S extends z.ZodType | undefined = undefined>(
		endpoint: URL | string,
		options: Omit<inputOptions, "body" | "perPage" | "maxPages" | "token"> & { schema?: S } = {},
	): Promise<any> {
		if (endpoint instanceof URL === false) {
			endpoint = new URL(endpoint, this.base_url);
		}

		const res = await this.reqHandler(endpoint, {
			method: "GET",
			attempt: 0,
			maxRetry: this.maxRetry,
			logLine: this.logLine,
			errLogBody: this.errLogBody,
			...options,
		});

		return this.validate(res.data, options.schema);
	}

	public async post(
		endpoint: URL | string,
		options?: Omit<inputOptions, "perPage" | "maxPages">,
	): Promise<any>;
	public async post<S extends z.ZodType>(
		endpoint: URL | string,
		options: Omit<inputOptions, "perPage" | "maxPages"> & { schema: S },
	): Promise<z.infer<S>>;
	public async post<S extends z.ZodType | undefined = undefined>(
		endpoint: URL | string,
		options: Omit<inputOptions, "perPage" | "maxPages"> & { schema?: S } = {},
	) {
		if (endpoint instanceof URL === false) {
			endpoint = new URL(endpoint, this.base_url);
		}

		const res = await this.reqHandler(endpoint, {
			method: "POST",
			attempt: 0,
			maxRetry: this.maxRetry,
			logLine: this.logLine,
			errLogBody: this.errLogBody,
			...options,
		});

		return this.validate(res.data, options.schema);
	}

	public async put(
		endpoint: URL | string,
		options?: Omit<inputOptions, "perPage" | "maxPages">,
	): Promise<any>;
	public async put<S extends z.ZodType>(
		endpoint: URL | string,
		options: Omit<inputOptions, "perPage" | "maxPages"> & { schema: S },
	): Promise<z.infer<S>>;
	public async put<S extends z.ZodType | undefined = undefined>(
		endpoint: URL | string,
		options: Omit<inputOptions, "perPage" | "maxPages"> & { schema?: S } = {},
	) {
		if (endpoint instanceof URL === false) {
			endpoint = new URL(endpoint, this.base_url);
		}

		const res = await this.reqHandler(endpoint, {
			method: "PUT",
			attempt: 0,
			maxRetry: this.maxRetry,
			logLine: this.logLine,
			errLogBody: this.errLogBody,
			...options,
		});

		return this.validate(res.data, options.schema);
	}

	public async patch(
		endpoint: URL | string,
		options?: Omit<inputOptions, "perPage" | "maxPages">,
	): Promise<any>;
	public async patch<S extends z.ZodType>(
		endpoint: URL | string,
		options: Omit<inputOptions, "perPage" | "maxPages"> & { schema: S },
	): Promise<z.infer<S>>;
	public async patch<S extends z.ZodType | undefined = undefined>(
		endpoint: URL | string,
		options: Omit<inputOptions, "perPage" | "maxPages"> & { schema?: S } = {},
	) {
		if (endpoint instanceof URL === false) {
			endpoint = new URL(endpoint, this.base_url);
		}

		const res = await this.reqHandler(endpoint, {
			method: "PATCH",
			attempt: 0,
			maxRetry: this.maxRetry,
			logLine: this.logLine,
			errLogBody: this.errLogBody,
			...options,
		});

		return this.validate(res.data, options.schema);
	}

	public async delete(
		endpoint: URL | string,
		options?: Omit<inputOptions, "perPage" | "maxPages">,
	): Promise<any>;
	public async delete<S extends z.ZodType>(
		endpoint: URL | string,
		options: Omit<inputOptions, "perPage" | "maxPages"> & { schema: S },
	): Promise<z.infer<S>>;
	public async delete<S extends z.ZodType | undefined = undefined>(
		endpoint: URL | string,
		options: Omit<inputOptions, "perPage" | "maxPages"> & { schema?: S } = {},
	) {
		if (endpoint instanceof URL === false) {
			endpoint = new URL(endpoint, this.base_url);
		}

		const res = await this.reqHandler(endpoint, {
			method: "DELETE",
			attempt: 0,
			maxRetry: this.maxRetry,
			logLine: this.logLine,
			errLogBody: this.errLogBody,
			...options,
		});

		return this.validate(res.data, options.schema);
	}

	public URL(endpoint: string) {
		return new URL(endpoint, this.base_url);
	}
}
