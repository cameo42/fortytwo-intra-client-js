import { reqOptions } from "../types";
import { AxiosResponse, AxiosError } from "axios";

const green = "\x1b[42m";
const red = "\x1b[41m";
const reset = "\x1b[0m";

export function getLogLine(res: AxiosResponse, options: reqOptions) {
	const tokens: string[] = [];

	// Get query parameters as object
	const queryParams = res.config?.params || {};

	if (process.stdout.isTTY) {
		tokens.push(`${green}${res.status}${reset}`);
	} else {
		tokens.push(`${res.status}`);
	}

	tokens.push(options.method.padEnd(6, " "));

	// Add the base URL path
	if (res.config?.url) {
		const url = new URL(res.config.url);
		tokens.push(url.pathname);
	}

	// Add query parameters as object if they exist
	console.log(queryParams);
	if (Object.keys(queryParams).length > 0) {
		delete queryParams.per_page;
		delete queryParams.page; 
		tokens.push(JSON.stringify(queryParams));
	}
	if (options.currpage) {
		tokens.push(`| page: ${options.currpage}/${options.lastPage === Infinity ? "unknown" : options.lastPage}`)
	}

	return tokens.join(" ");
}

export function getErrorLogLine(err: AxiosError, options: reqOptions) {
	const tokens: string[] = [];

	// Get query parameters as object
	const queryParams = err.config?.params || {};

	if (process.stdout.isTTY) {
		tokens.push(`${red}${err.status}${reset}`);
	} else {
		tokens.push(`${err.status}`);
	}

	tokens.push(options.method.padEnd(6, " "));

	// Add the base URL path
	if (err.config?.url) {
		const url = new URL(err.config.url);
		tokens.push(url.pathname);
	}

	// Add query parameters as object if they exist
	if (Object.keys(queryParams).length > 0) {
		tokens.push(JSON.stringify(queryParams));
	}

	return tokens.join(" ");
}
