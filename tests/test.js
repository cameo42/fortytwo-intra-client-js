import { FortytwoIntraClient } from '../dist/index.js';
import { configDotenv } from 'dotenv';

configDotenv();

const missing = [];

const FORTYTWO_CLIENT_ID = process.env.FORTYTWO_CLIENT_ID;
if (!FORTYTWO_CLIENT_ID) missing.push("FORTYTWO_CLIENT_ID");

const FORTYTWO_CLIENT_SECRET = process.env.FORTYTWO_CLIENT_SECRET;
if (!FORTYTWO_CLIENT_SECRET) missing.push("FORTYTWO_CLIENT_SECRET");

if (missing.length) {
	console.error(`Missing environment variable: ${missing.join(", ")}`);
	process.exit(1);
}

const RATE = Number(process.env.FORTYTWO_CLIENT_RATE) || 8;

const client = new FortytwoIntraClient(
	FORTYTWO_CLIENT_ID,
	FORTYTWO_CLIENT_SECRET,
	{ rate: RATE }
);

const test = await client.get('users', { perPage: 100, maxPages: Infinity, query: { filter: { login: "ibertran", primary_campus_id: 9 } } });
console.log(test.length);
