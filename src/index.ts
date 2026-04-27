import axios, { AxiosError, AxiosInstance, AxiosResponse, isAxiosError } from "axios";
import rateLimit from "axios-rate-limit";
import { getLastPage } from "./lib/pagination";
import { inputOptions, reqOptions } from "./types";
import { getErrorLogLine, getLogLine } from "./lib/logs";
import { FortytwoIntraClientError, isFortytwoIntraClientError } from "./lib/errors";
import { z } from "zod";

export interface FortytwoIntraClientConf {
	redirect_uri: string | null;
	base_url: string;
	token_url: string;
	oauth_url: string;
	token_info_url: string;
	scopes: string[];
	rateLimitMaxRequests: number,
	rateLimitPerMilliseconds: number
	maxRetry: number;
	logLine: boolean;
	errLogBody: boolean;
}

const defaultConf: FortytwoIntraClientConf = {
	redirect_uri: null,
	base_url: "https://api.intra.42.fr/v2/",
	token_url: "https://api.intra.42.fr/oauth/token",
	oauth_url: "https://api.intra.42.fr/oauth/authorize",
	token_info_url: "https://api.intra.42.fr/oauth/token/info",
	scopes: ["public"],
	rateLimitMaxRequests: 2,
	rateLimitPerMilliseconds: 1200,
	maxRetry: 5,
	logLine: true,
	errLogBody: true,
};

export class FortytwoIntraClient {
	private redirect_uri: string | null;
	private base_url: string;
	private token_url: string;
	private oauth_url: string;
	private token_info_url: string;
	private scopes: string[];
	private rateLimitMaxRequests: number;
	private rateLimitPerMilliseconds: number;
	private axiosInstance: AxiosInstance;
	private retryOn: number[];
	private maxRetry: number;
	private logLine: boolean;
	private errLogBody: boolean;

	private access_token: string | null;

	constructor(
		private client_id: string,
		private client_secret: string,
		conf: Partial<FortytwoIntraClientConf>
	) {
		const config: FortytwoIntraClientConf = { ...defaultConf, ...conf };

		this.redirect_uri = config.redirect_uri;
		this.base_url = config.base_url;
		this.token_url = config.token_url;
		this.oauth_url = config.oauth_url;
		this.token_info_url = config.token_info_url;
		this.scopes = config.scopes;

		this.rateLimitMaxRequests = config.rateLimitMaxRequests;
		this.rateLimitPerMilliseconds = config.rateLimitPerMilliseconds;

		// Create axios instance with rate limiting
		const axiosInstance = axios.create();
		this.axiosInstance = rateLimit(axiosInstance, {
			maxRequests: this.rateLimitMaxRequests,
			perMilliseconds: this.rateLimitPerMilliseconds,
		});

		this.retryOn = [401, 429, 500];
		this.maxRetry = config.maxRetry;
		this.logLine = config.logLine;
		this.errLogBody = config.errLogBody;

		this.access_token = null;
	}

	private async generateToken() {
		const res = await this.axiosInstance.post(this.token_url, {
			grant_type: "client_credentials",
			client_id: this.client_id,
			client_secret: this.client_secret,
			scope: this.scopes.join(" "),
		});

		return res.data.access_token;
	}

	private async fetch(url: URL, options: reqOptions) {
		const { method, body, query } = options;

		if (!options.token && !this.access_token) {
			this.access_token = await this.generateToken();
		}

		// Attach access_token
		const accessToken = options.token
			? options.token.access_token
			: this.access_token;

		// Extract query parameters from URL and combine with options.query
		const urlParams: Record<string, any> = {};
		url.searchParams.forEach((value, key) => {
			urlParams[key] = value;
		});

		// Combine URL params with query params (query params take precedence)
		const combinedParams = { ...urlParams, ...query };

		// Create clean URL without query parameters
		const cleanUrl = new URL(url);
		cleanUrl.search = '';

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
						this.access_token = null;
					}
					options.attempt++;
					return this.reqHandler(url, options);
				} else {
					throw new FortytwoIntraClientError(err)
				}
			} else {
				throw err;
			}
		}
	}

	private logSuccess(res: AxiosResponse, options: reqOptions) {
		if (!options.logLine)
			return;

		const line = getLogLine(res, options);
		console.log(line);
	}

	private logError(err: AxiosError, options: reqOptions) {
		if (!options.logLine)
			return;

		const line = getErrorLogLine(err, options);
		const body = err.response?.data;
		const logBody = options.errLogBody && body && Object.keys(body).length;
		try {
			console.log(line, logBody ? JSON.stringify(body, null, 2) : "");
		} catch {
			console.log(line, logBody ? body : "");
		}

	}

	// Public methods
	public async get(
		endpoint: URL | string,
		options?: Omit<inputOptions, "body" | "perPage" | "maxPages">
	): Promise<any>;
	public async get<S extends z.ZodType>(
		endpoint: URL | string,
		options: Omit<inputOptions, "body" | "perPage" | "maxPages"> & { schema: S }
	): Promise<z.infer<S>>;
	public async get<S extends z.ZodType | undefined = undefined>(
		endpoint: URL | string,
		options: Omit<inputOptions, "body" | "perPage" | "maxPages"> & { schema?: S } = {}
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

		if (options.schema) {
			return options.schema.parse(res.data);
		}
		return res.data;
	}

	public async post(
		endpoint: URL | string,
		options?: Omit<inputOptions, "perPage" | "maxPages">,
	): Promise<any>;
	public async post<S extends z.ZodType>(
		endpoint: URL | string,
		options: Omit<inputOptions, "perPage" | "maxPages"> & { schema: S }
	): Promise<z.infer<S>>;
	public async post<S extends z.ZodType | undefined = undefined>(
		endpoint: URL | string,
		options: Omit<inputOptions, "perPage" | "maxPages"> & { schema?: S } = {}
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

		if (options.schema) {
			return options.schema.parse(res.data);
		}
		return res.data;
	}

	public async put(
		endpoint: URL | string,
		options?: Omit<inputOptions, "perPage" | "maxPages">
	): Promise<any>;
	public async put<S extends z.ZodType>(
		endpoint: URL | string,
		options: Omit<inputOptions, "perPage" | "maxPages"> & { schema: S }
	): Promise<z.infer<S>>;
	public async put<S extends z.ZodType | undefined = undefined>(
		endpoint: URL | string,
		options: Omit<inputOptions, "perPage" | "maxPages"> & { schema?: S } = {}
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

		if (options.schema) {
			return options.schema.parse(res.data);
		}
		return res.data;
	}

	public async patch(
		endpoint: URL | string,
		options?: Omit<inputOptions, "perPage" | "maxPages">
	): Promise<any>;
	public async patch<S extends z.ZodType>(
		endpoint: URL | string,
		options: Omit<inputOptions, "perPage" | "maxPages"> & { schema: S }
	): Promise<z.infer<S>>;
	public async patch<S extends z.ZodType | undefined = undefined>(
		endpoint: URL | string,
		options: Omit<inputOptions, "perPage" | "maxPages"> & { schema?: S } = {}
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

		if (options.schema) {
			return options.schema.parse(res.data);
		}
		return res.data;
	}

	public async delete(
		endpoint: URL | string,
		options?: Omit<inputOptions, "perPage" | "maxPages">
	): Promise<any>;
	public async delete<S extends z.ZodType>(
		endpoint: URL | string,
		options: Omit<inputOptions, "perPage" | "maxPages"> & { schema: S }
	): Promise<z.infer<S>>;
	public async delete<S extends z.ZodType | undefined = undefined>(
		endpoint: URL | string,
		options: Omit<inputOptions, "perPage" | "maxPages"> & { schema?: S } = {}
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

		if (options.schema) {
			return options.schema.parse(res.data);
		}
		return res.data;
	}

	public async getAll(
		endpoint: URL | string,
		options?: Omit<inputOptions, "body">
	): Promise<any>;
	public async getAll<S extends z.ZodType>(
		endpoint: URL | string,
		options: Omit<inputOptions, "body"> & { schema: S }
	): Promise<z.infer<S>>;
	public async getAll<S extends z.ZodType | undefined = undefined>(
		endpoint: URL | string,
		options: Omit<inputOptions, "body"> & { schema?: S } = {}
	) {
		if (endpoint instanceof URL === false) {
			endpoint = new URL(endpoint, this.base_url);
		}

		const perPage = options.perPage || 100;

		let url = new URL(endpoint);
		const firstPage = await this.reqHandler(url, {
			method: "GET",
			attempt: 0,
			currpage: 1,
			lastPage: Infinity,
			maxRetry: this.maxRetry,
			logLine: this.logLine,
			errLogBody: this.errLogBody,
			...options,
			query: {
				...options.query,
				page: 1,
				per_page: perPage,
			}
		});

		if (!Array.isArray(firstPage.data)) {
			if (options.schema) {
				return options.schema.parse(firstPage.data);
			}
			return firstPage.data;
		}

		let lastPage: number;
		try {
			lastPage = Math.min(getLastPage(firstPage.headers["link"]), options.maxPages || Infinity);
		} catch (err) {
			if (options.schema) {
				return options.schema.parse(firstPage.data);
			}
			return firstPage.data;
		}

		const promises = Array.from({ length: lastPage - 1 }, (_, i) => i + 2)
			.map(pageNumber => this.reqHandler(url, {
				method: "GET",
				attempt: 0,
				currpage: pageNumber,
				lastPage: lastPage,
				maxRetry: this.maxRetry,
				logLine: this.logLine,
				errLogBody: this.errLogBody,
				...options,
				query: {
					...options.query,
					page: pageNumber,
					per_page: perPage,
				}
			}));

		const otherPages = await Promise.all(promises);
		const allData = [...firstPage.data, ...otherPages.flatMap((res) => res.data)];

		if (options.schema) {
			return options.schema.parse(allData);
		}
		return allData;
	}

	public URL(endpoint: string) {
		return new URL(endpoint, this.base_url);
	}

	public getOAuthUrl(
		options: {
			redirect_uri?: string,
			state?: string,
		} = {}
	) {
		const redirectUri = options.redirect_uri || this.redirect_uri;
		if (!redirectUri) {
			throw new Error(`Missing redirect_uri parameter`);
		}

		const url = new URL(this.oauth_url);
		url.searchParams.set("client_id", this.client_id);
		url.searchParams.set("redirect_uri", redirectUri);
		url.searchParams.set("response_type", "code");
		url.searchParams.set("scope", this.scopes.join(" "));

		const state = options.state ?? null;
		if (state !== null) {
			url.searchParams.set("state", state);
		}

		return { url: url.toString(), state };
	}

	public async exchangeOAuthCode(code: string, redirect_uri?: string) {
		const res = await this.axiosInstance.post(this.token_url, {
			grant_type: "authorization_code",
			client_id: this.client_id,
			client_secret: this.client_secret,
			redirect_uri: redirect_uri ? redirect_uri : this.redirect_uri,
			code: code,
		});

		return res.data;
	}

	public async tokenInfos(
		options: Omit<inputOptions, "body" | "perPage" | "maxPages"> = {}
	) {
		return this.get(this.token_info_url, options);
	}
}

export { FortytwoIntraClientError, isFortytwoIntraClientError };
