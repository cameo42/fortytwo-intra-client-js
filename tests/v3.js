import { FortytwoIntraV3Client } from "../dist/index.js";
import { configDotenv } from "dotenv";

configDotenv();

const missing = [];

const INTRA_V3_CLIENT_ID = process.env.INTRA_V3_CLIENT_ID;
if (!INTRA_V3_CLIENT_ID) missing.push("INTRA_V3_CLIENT_ID");

const INTRA_V3_CLIENT_SECRET = process.env.INTRA_V3_CLIENT_SECRET;
if (!INTRA_V3_CLIENT_SECRET) missing.push("INTRA_V3_CLIENT_SECRET");

const INTRA_V3_USERNAME = process.env.INTRA_V3_USERNAME;
if (!INTRA_V3_USERNAME) missing.push("INTRA_V3_USERNAME");

const INTRA_V3_PASSWORD = process.env.INTRA_V3_PASSWORD;
if (!INTRA_V3_PASSWORD) missing.push("INTRA_V3_PASSWORD");

if (missing.length) {
	console.error(`Missing environment variable: ${missing.join(", ")}`);
	process.exit(1);
}

const client = new FortytwoIntraV3Client(
	{
		client_id: INTRA_V3_CLIENT_ID,
		client_secret: INTRA_V3_CLIENT_SECRET,
		username: INTRA_V3_USERNAME,
		password: INTRA_V3_PASSWORD,
	},
	{
		base_url: "https://pace-system.42.fr/api/v1/",
	},
);

const test = await client.get("milestones");
console.log(test);
