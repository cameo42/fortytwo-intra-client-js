export type Method = "GET" | "POST" | "PUT" | "PATCH" | "DELETE";

export type userToken = {
	access_token: string;
};

export type reqOptions = {
	// internal
	method: Method;
	attempt: number;
	currpage?: number;
	lastPage?: number;

	maxRetry: number;

	perPage?: number;
	maxPages?: number;
	body?: any;
	token?: userToken;
	query?: querystring;
	logLine?: boolean;
	errLogBody?: boolean;
};

export type querystring = Record<string, string | number | boolean | Array<string | number | boolean>>;

export type perPage = { perPage?: number };

type internal = "method" | "attempt" | "page";
type optional = "maxRetry";

export type inputOptions = Omit<reqOptions, internal | optional> &
	Partial<Pick<reqOptions, optional>>;
