import { ZodError } from "zod";

export class FortytwoIntraClientValidationError extends Error {
	public schemaErrors: ZodError;
	public data: unknown;

	constructor(schemaErrors: ZodError, data: unknown) {
		super("Schema validation failed");
		this.name = "FortytwoIntraClientValidationError";
		this.schemaErrors = schemaErrors;
		this.data = data;
	}
}

export function isFortytwoIntraClientValidationError(
	error: unknown,
): error is FortytwoIntraClientValidationError {
	return error instanceof FortytwoIntraClientValidationError;
}
