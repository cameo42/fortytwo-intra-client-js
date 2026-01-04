# FortytwoIntraClient

A TypeScript library for interacting with the 42API with built-in rate limiting, automatic token management, and retry logic.

## Installation

```bash
npm install @ibertran/fortytwo-intra-client
```

## Quick Start

```typescript
import { FortytwoIntraClient } from '@ibertran/fortytwo-intra-client';

const client = new FortytwoIntraClient('your_client_id', 'your_client_secret');


// Get a specific user by login
const user = await client.get('users/ibertran');
console.log(user);
```

## Configuration

The `FortytwoIntraClient` class accepts three parameters:

1. `client_id` (required): Your 42 API client ID
2. `client_secret` (required): Your 42 API client secret  
3. `config` (optional): Configuration object

### Configuration Options

```typescript
interface FortytwoIntraClientConf {
  redirect_uri: string | null;           // OAuth redirect URI (default: null)
  base_url: string;                      // API base URL (default: "https://api.intra.42.fr/v2/")
  token_url: string;                     // Token endpoint (default: "https://api.intra.42.fr/oauth/token")
  oauth_url: string;                     // OAuth endpoint (default: "https://api.intra.42.fr/oauth/authorize")
  token_info_url: string;                // Token info endpoint (default: "https://api.intra.42.fr/oauth/token/info")
  scopes: string[];                      // OAuth scopes (default: ["public"])
  rateLimitMaxRequests: number;          // Max requests per time window (default: 2)
  rateLimitPerMilliseconds: number;      // Time window in milliseconds (default: 1200)
  maxRetry: number;                      // Max retry attempts (default: 5)
  logLine: boolean;                      // Enable request logging (default: true)
  errLogBody: boolean;                   // Log error response bodies (default: true)
}
```

### Example with Custom Configuration

```typescript
const client = new FortytwoIntraClient('your_client_id', 'your_client_secret', {
  rateLimitMaxRequests: 1,              // 1 request per 1200ms
  rateLimitPerMilliseconds: 1200,       // Time window
  maxRetry: 3,                          // Retry up to 3 times
  logLine: false,                       // Disable logging
  errLogBody: false,                    // Disable error body logging
  scopes: ['public', 'projects']        // Extended scopes
});
```

## API Methods

### GET Requests

```typescript
// Get all campuses
const campuses = await client.get('campus');
console.log(`Found ${campuses.length} campuses`);

// Get a specific campus
const lyonCampus = await client.get('campus/9');
console.log(`${lyonCampus.name}: ${lyonCampus.users_count} users`);
```

### POST Requests

```typescript
// Create a team for a project
const team = await client.post('teams', {
  body: {
    name: 'awesome-team',
    project_id: 42
  }
});
```

### PATCH Requests

```typescript
// Update a team name
const updatedTeam = await client.patch('teams/123', {
  body: {
		team: {
			name: "updated-team-name"
		}
  }
});
```

### DELETE Requests

```typescript
// Delete a team
await client.delete('teams/123');
```

### Get All Pages (Pagination Helper)

The `getAll` method automatically handles pagination and returns all results:

```typescript
// Get all users from 42Lyon (handles pagination automatically)
const lyonUsers = await client.getAll('campus/9/users');
console.log(`42Lyon campus has ${lyonUsers.length} users`);

// Get all projects with custom page size
const allProjects = await client.getAll('projects', {
  perPage: 50  // 50 items per page (default: 100)
});
```

## OAuth Authentication

### Authorization Flow

```typescript
// 1. Get OAuth authorization URL
const authUrl = client.getOAuthUrl('http://localhost:3000/callback');
// Redirect user to authUrl

// 2. Exchange authorization code for tokens
const tokens = await client.exchangeOAuthCode(code, 'http://localhost:3000/callback');
// tokens contains: access_token, refresh_token, expires_in, etc.

// 3. Use tokens for authenticated requests (USER-SPECIFIC DATA)
const currentUser = await client.get('users/me', {
  token: tokens
});
console.log(`Welcome ${currentUser.displayname}!`);
```

### Using Custom Redirect URI

```typescript
// Set redirect URI in constructor
const client = new IntraApiProxy('client_id', 'client_secret', {
  redirect_uri: 'http://localhost:3000/callback'
});

// Or pass it to getOAuthUrl
const authUrl = client.getOAuthUrl('http://localhost:3000/callback');
```

## Utility Methods

### URL Builder

```typescript
// Create a URL object for the API
const userUrl = client.URL('users/jdoe');
console.log(userUrl.toString()); // "https://api.intra.42.fr/v2/users/jdoe"

// Build URLs for specific endpoints
const campusUrl = client.URL('campus/1/users');
const projectUrl = client.URL('projects/libft');
const coalitionUrl = client.URL('coalitions/1/users');
```

## Error Handling

The library includes automatic retry logic for rate limiting (429) and authentication (401) errors:

```typescript
try {
  const user = await client.get('users/jdoe');
  console.log(`Found user: ${user.displayname}`);
} catch (error) {
  if (error.status === 404) {
    console.error('User not found');
  } else if (error.status === 403) {
    console.error('Access forbidden - check your token permissions');
  } else {
    console.error('Request failed after retries:', error.message);
  }
}
```

## Rate Limiting

Requests are automatically throttled based on the configured rate limit. The default is 2 requests per second to comply with 42's API limits.

## Logging

By default, the library logs all requests with colored status codes and formatted parameters:

```
200 GET    /v2/users/jdoe
200 GET    /v2/campus { filter: { city: 'lyon' } }
429 GET    /v2/projects
200 GET    /v2/projects retry 1/5
```

Disable logging by setting `logLine: false` in the configuration. Control error body logging with `errLogBody: false`.

## TypeScript Support

This library is written in TypeScript and includes full type definitions:

```typescript
import { FortytwoIntraClient } from '@ibertran/fortytwo-intra-client';

// Types are automatically inferred
const client = new FortytwoIntraClient('client_id', 'client_secret');
```

### OAuth Flow Example

```typescript
import express from 'express';
import { FortytwoIntraClient } from '@ibertran/fortytwo-intra-client';

const app = express();
const client = new FortytwoIntraClient(
  process.env.INTRA_CLIENT_ID!,
  process.env.INTRA_CLIENT_SECRET!,
  { 
    redirect_uri: 'http://localhost:3000/callback',
    oauth_scope: ['public']
  }
);

// Redirect to 42 OAuth
app.get('/login', (req, res) => {
  const authUrl = client.getOAuthUrl();
  res.redirect(authUrl);
});

// Handle OAuth callback
app.get('/callback', async (req, res) => {
  try {
    const { code } = req.query;
    const token = await client.exchangeOAuthCode(code as string);
    
    // Use tokens to make authenticated requests (accessing personal data)
    const userData = await client.get('users/me', { token: token });
        
    res.json({ 
      user: {
        login: userData.login,
        displayname: userData.displayname,
        email: userData.email,
        level: userData.cursus_users[0]?.level || 0,
        wallet: userData.wallet,
        campus: userData.campus[0]?.name
      },
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.listen(3000, () => {
  console.log('Server running on http://localhost:3000');
  console.log('Visit http://localhost:3000/login to start OAuth flow');
});
```
