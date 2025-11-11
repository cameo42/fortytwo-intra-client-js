export type Method = "GET" | "POST" | "PUT" | "PATCH" | "DELETE";

export type userToken = {
  access_token: string;
};

export type reqOptions = {
  method: Method;
  maxRetry: number;
  attempt: number;
  body?: any;
  token?: userToken;
  query?: querystring;
};

export type querystring = Record<string, string | number | boolean | Array<string | number | boolean>>;

export type perPage = { perPage?: number };

type internal = "method" | "attempt";
type optional = "maxRetry";

export type inputOptions = Omit<reqOptions, internal | optional> &
  Partial<Pick<reqOptions, optional>>;
