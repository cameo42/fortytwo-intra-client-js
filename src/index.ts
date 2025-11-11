import axios, { AxiosError, AxiosInstance, AxiosResponse } from "axios";
import rateLimit from "axios-rate-limit";
import { getLastPage } from "./utils";
import { inputOptions, perPage, reqOptions } from "./types";
import { getErrorLogLine, getLogLine } from "./log";

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
  errLogLine: boolean;
  errLogBody: boolean;
  throwOnError: boolean;
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
  errLogLine: true,
  errLogBody: true,
  throwOnError: true,
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
  private errLogLine: boolean;
  private errLogBody: boolean;
  private throwOnError : boolean;

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
    this.errLogLine = config.errLogLine;
    this.errLogBody = config.errLogBody;
    this.throwOnError = config.throwOnError;

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

  private async reqHandler(url: URL, options: reqOptions): Promise<any> {
    try {
      const res = await this.fetch(url, options);
      this.logSuccess(res, options);

      return res;
    } catch (err: any) {
      if (err.isAxiosError) {
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
          if (this.throwOnError) throw err;
        }
      } else {
        throw err;
      }
    }
  }

  private logSuccess(res: AxiosResponse, options: reqOptions) {
    if (this.logLine) {
      const logLine = getLogLine(res, options);
      console.log(logLine);
    }
  }

  private logError(err: AxiosError, options: reqOptions) {
    if (this.errLogLine) {
      const logLine = getErrorLogLine(err, options);
      const errBody = err.response?.data;
      const logErrBody = this.errLogBody && errBody && Object.keys(errBody).length;
      console.log(logLine, logErrBody ? JSON.stringify(errBody, null, 2) : undefined);
    }
  }

  // Public methods
  public async get(
    endpoint: URL | string,
    options: Omit<inputOptions, "body"> = {}
  ) {
    if (endpoint instanceof URL === false) {
      endpoint = new URL(endpoint, this.base_url);
    }

    const res = await this.reqHandler(endpoint, {
      method: "GET",
      attempt: 0,
      maxRetry: this.maxRetry,
      ...options,
    });

    return res?.data;
  }

  public async post(endpoint: URL | string, options: inputOptions = {}) {
    if (endpoint instanceof URL === false) {
      endpoint = new URL(endpoint, this.base_url);
    }
    const res = await this.reqHandler(endpoint, {
      method: "POST",
      attempt: 0,
      maxRetry: this.maxRetry,
      ...options,
    });

    return res?.data;
  }

  public async put(endpoint: URL | string, options: inputOptions = {}) {
    if (endpoint instanceof URL === false) {
      endpoint = new URL(endpoint, this.base_url);
    }
    const res = await this.reqHandler(endpoint, {
      method: "PUT",
      attempt: 0,
      maxRetry: this.maxRetry,
      ...options,
    });

    return res?.data;
  }

  public async patch(endpoint: URL | string, options: inputOptions) {
    if (endpoint instanceof URL === false) {
      endpoint = new URL(endpoint, this.base_url);
    }
    const res = await this.reqHandler(endpoint, {
      method: "PATCH",
      attempt: 0,
      maxRetry: this.maxRetry,
      ...options,
    });

    return res?.data;
  }

  public async delete(endpoint: URL | string, options: inputOptions) {
    if (endpoint instanceof URL === false) {
      endpoint = new URL(endpoint, this.base_url);
    }
    const res = await this.reqHandler(endpoint, {
      method: "DELETE",
      attempt: 0,
      maxRetry: this.maxRetry,
      ...options,
    });

    return res?.data;
  }

  public async getAll(
    endpoint: URL | string,
    options: Omit<inputOptions, "body"> & perPage = {}
  ) {
    if (endpoint instanceof URL === false) {
      endpoint = new URL(endpoint, this.base_url);
    }

    const perPage = options.perPage || 100;

    let url = new URL(endpoint);
    const initialRes = await this.reqHandler(url, {
      method: "GET",
      attempt: 0,
      maxRetry: this.maxRetry,
      ...options,
      query: {
        ...options.query,
        page: 1,
        per_page: perPage,
      }
    });

    let lastPage: number;
    try {
      lastPage = getLastPage(initialRes.headers["link"]);
    } catch (err) {
      return initialRes?.data;
    }

    const promises = [];
    for (let i = 2; i <= lastPage; i++) {
      url = new URL(endpoint);

      promises.push(
        this.reqHandler(url, {
          method: "GET",
          attempt: 0,
          maxRetry: this.maxRetry,
          ...options,
          query: {
            ...options.query,
            page: i,
            per_page: perPage,
          }
        })
      );
    }

    return Promise.all(promises).then((values) => {
      return initialRes?.data.concat(...values.map((value) => value.data));
    });
  }

  public URL(endpoint: string) {
    return new URL(endpoint, this.base_url);
  }

  public getOAuthUrl(redirect_uri: string | null = null) {
    redirect_uri ??= this.redirect_uri;
    if (!redirect_uri) {
      throw new Error(`undefined redirect_uri`);
    }

    const url = new URL(this.oauth_url);
    url.searchParams.set("client_id", this.client_id);
    url.searchParams.set("redirect_uri", redirect_uri);
    url.searchParams.set("response_type", "code");
    url.searchParams.set("scope", this.scopes.join(" "));

    return url.toString();
  }

  public async exchangeOAuthCode(code: string, redirect_uri?: string) {
    const res = await this.axiosInstance.post(this.token_url, {
      grant_type: "authorization_code",
      client_id: this.client_id,
      client_secret: this.client_secret,
      redirect_uri: redirect_uri ? redirect_uri : this.redirect_uri,
      code: code,
    });

    return res?.data;
  }

  public async tokenInfos() {
    return this.get(this.token_info_url);
  }
}
