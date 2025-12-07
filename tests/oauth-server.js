import express from 'express';
import { configDotenv } from 'dotenv';
import { FortytwoIntraClient } from '../dist/index.js';

configDotenv();

const PORT = process.env.OAUTH_SERVER_PORT || 3000;
const REDIRECT_URI_PATH = '/api/auth/callback';

const missing = [];
const FORTYTWO_CLIENT_ID = process.env.FORTYTWO_CLIENT_ID;
if (!FORTYTWO_CLIENT_ID) missing.push('FORTYTWO_CLIENT_ID');
const FORTYTWO_CLIENT_SECRET = process.env.FORTYTWO_CLIENT_SECRET;
if (!FORTYTWO_CLIENT_SECRET) missing.push('FORTYTWO_CLIENT_SECRET');

if (missing.length) {
	console.error(`Missing environment variable: ${missing.join(', ')}`);
	process.exit(1);
}

const client = new FortytwoIntraClient(FORTYTWO_CLIENT_ID, FORTYTWO_CLIENT_SECRET, {
	redirect_uri: `http://localhost:${PORT}${REDIRECT_URI_PATH}`,
});

const app = express();

app.get('/', (req, res) => {
	const { url } = client.getOAuthUrl();
	res.send(`<html><body>
	<h1>42 OAuth Test</h1>
	<p><a href="${url}">Authorize with 42</a></p>
  </body></html>`);
});

app.get('/health', async (req, res) => {
	try {
		const token = await client.tokenInfos({ logLine: true });
		res.send(token);
	} catch (err) {
		console.error(err);
		res.status(500).send('Token healthcheck failed');
	}
});

app.get(REDIRECT_URI_PATH, async (req, res) => {
	const { code, state } = req.query;
	if (!code) return res.status(400).send('Missing code parameter');

	try {
		const token = await client.exchangeOAuthCode(String(code));
		const me = await client.get('/v2/me', { token: token });
		res.send(`<pre> Welcome ${me.login}</pre>`);
	} catch (err) {
		console.error('Exchange failed', err);
		res.status(500).send('Token exchange failed');
	}
});

app.listen(PORT, () => {
	console.log('--------------------------------------------------');
	console.log(`OAuth test server running on http://localhost:${PORT}`);
	console.log('--------------------------------------------------');
});
