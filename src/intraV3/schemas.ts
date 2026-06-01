import z from "zod";

export const tokenSchema = z
	.strictObject({
		access_token: z.string(),
		expires_in: z.number(),
		refresh_expires_in: z.number(),
		refresh_token: z.string(),
		token_type: z.string(),
		"not-before-policy": z.number(),
		session_state: z.string(),
		scope: z.string(),
	})
	.transform((obj) => {
		const now = Date.now();

		return {
			access_token: obj.access_token,
			expires_at: now + obj.expires_in * 1000,
			refresh_token: obj.refresh_token,
			refresh_expires_at: now + obj.refresh_expires_in * 1000,
			token_type: obj.token_type,
		};
	});

export type Token = z.infer<typeof tokenSchema>;
