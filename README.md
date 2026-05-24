# API SLI + SEM

A small **Express** API that protects endpoints with two Redis-backed controls:

| Layer | Name | What it does |
|-------|------|----------------|
| **SLI** | Sliding window | Limits how many requests an IP can make in a time window |
| **SEM** | Semaphore | Limits how many requests from an IP can run at the same time |

Together they reduce abuse from burst traffic and from too many slow, in-flight requests.

## Limits (defaults)

| Setting | Value |
|---------|--------|
| Sliding window | 60 seconds |
| Max requests per window (per IP) | 5 |
| Max concurrent requests (per IP) | 3 |

When a limit is exceeded:

- **429** — rate limit (too many requests in the window)
- **503** — concurrency limit (too many active requests)

Successful responses may include:

- `X-RateLimit-Limit`
- `X-RateLimit-Remaining`

## Project structure

```
src/
├── index.js              # Express app and routes
├── config/
│   └── redis.js          # Redis client connection
├── logic/
│   └── ratelimiter.js    # Sliding window + semaphore middleware
└── tester/
    ├── unit_test.js      # Jest integration tests
    └── load_test.js      # Manual parallel load script
```

## Prerequisites

- **Node.js** (v18+ recommended)
- **Redis** — local or hosted (the app stores limiter state in Redis)

## Setup

1. Clone the repository and install dependencies:

   ```bash
   npm install
   ```

2. Configure Redis in `src/config/redis.js` (host, port, username, password). Use your own instance; do not commit real credentials to version control.

3. Start Redis and ensure the app can connect before handling traffic.

## Run the server

```bash
node src/index.js
```

The server listens on **port 3001**.

## API

### `GET /`

Simulates slow work (~3 seconds), then returns:

```json
{
  "success": true,
  "message": "Hello from server"
}
```

Subject to both rate limiting and concurrency limiting.

### `GET /health`

Returns immediately:

```json
{
  "status": "OK"
}
```

> **Note:** `/health` bypasses the rate limiter so monitoring probes are not throttled.

## How the limiter works

For each client IP (`req.ip`), Redis keys are used:

| Key pattern | Purpose |
|-------------|---------|
| `SLIDING_WINDOW:{ip}` | Sorted set of request timestamps in the window |
| `CONCURRENT_REQUESTS:{ip}` | Active in-flight request count |
| `TOTAL_REQUESTS:{ip}` | Total requests (analytics) |
| `BLOCKED_REQUESTS:{ip}` | Blocked attempts (analytics) |

`/health` skips the limiter entirely.

Rough flow per request (non-health routes):

1. Increment total-request counter.
2. Reserve a concurrency slot (`INCR`). If over the cap → **503** and release.
3. Drop expired entries from the sliding window.
4. Count requests in the current window. If at or over the cap → **429** and release concurrency.
5. Record the request in the sliding window and call `next()`.
6. On response `finish` or `close`, decrement the concurrency counter.

The slow `GET /` handler is intentional so concurrency behavior is easy to test and observe.

## Tests

Integration tests use **Jest** and **Supertest**. Redis must be running and configured in `src/config/redis.js`. Keys are flushed before each test.

```bash
npm test
```

Tests cover:

- A single successful request
- Rate limiting after repeated requests
- Concurrency limiting under parallel slow requests
- Window reset after ~61 seconds (slow test; full suite takes ~1–2 minutes)
- Burst traffic
- Health endpoint responses

## Manual load test

With the server running on port 3001:

```bash
node src/tester/load_test.js
```

Edit `TOTAL_REQUESTS` and `URL` in that file to change load shape.

## Tech stack

- [Express](https://expressjs.com/) 
- [redis](https://github.com/redis/node-redis) 
- [Jest](https://jestjs.io/) + [Supertest](https://github.com/ladjs/supertest) for tests


