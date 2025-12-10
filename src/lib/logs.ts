import { reqOptions } from "../types";
import { AxiosResponse, AxiosError } from "axios";
import { inspect } from "util";

const green = "\x1b[42m";
const red = "\x1b[41m";
const reset = "\x1b[0m";

function formatQueryParams(params: Record<string, any>): string {
	const { per_page, page, ...filteredParams } = params;
	const keys = Object.keys(filteredParams);

	if (keys.length === 0) return "";

	return inspect(filteredParams, {
		depth: Infinity,
		compact: true,
		breakLength: Infinity,
		colors: true
	});
}

export function getLogLine(res: AxiosResponse, options: reqOptions) {
	const tokens: string[] = [];
	const queryParams = res.config?.params || {};

	tokens.push(`${green}${res.status}${reset}`);
	tokens.push(options.method.padEnd(6, " "));

	// Add the base URL path
	if (res.config?.url) {
		const url = new URL(res.config.url);
		tokens.push(url.pathname);
	}

	// Add query parameters
	const formattedParams = formatQueryParams(queryParams);
	if (formattedParams) {
		tokens.push(formattedParams);
	}

	// Add pagination info
	if (options.currpage) {
		tokens.push(`| ${options.currpage}/${options.lastPage === Infinity ? "..." : options.lastPage}`);
	}

	return tokens.join(" ");
}

export function getErrorLogLine(err: AxiosError, options: reqOptions) {
	const tokens: string[] = [];
	const queryParams = err.config?.params || {};

	tokens.push(`${red}${err.status}${reset}`);
	tokens.push(options.method.padEnd(6, " "));

	// Add the base URL path
	if (err.config?.url) {
		const url = new URL(err.config.url);
		tokens.push(url.pathname);
	}

	// Add query parameters
	const formattedParams = formatQueryParams(queryParams);
	if (formattedParams) {
		tokens.push(formattedParams);
	}

	return tokens.join(" ");
}
