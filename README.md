# Quality Analyzer

Quality Analyzer is a developer-focused web tool that performs a **passive analysis of public websites**. Enter a URL to inspect visible technology signals, SEO, security headers, performance indicators, accessibility markup, HTML structure, network metadata, and errors with location and evidence.

## MVP capabilities

- Public URL input with friendly error handling and loading progress.
- Technology detection based only on fetched HTML and response headers.
- Performance, SEO, security, accessibility, structure, network, and error sections.
- Evidence for important findings, including source location and the closest available element.
- Severity filters for critical, high, medium, and low findings.
- SSRF protections: only HTTP/HTTPS, no embedded credentials, private/internal IP blocking, safe redirect validation, request timeout, and a 3 MB page limit.
- In-memory rate limiting of six analyses per minute per requester.

## Architecture

The app uses React 19 + TypeScript + Vite + Tailwind CSS on the client, with a minimal Express and tRPC API on the server. `server/analyzer.ts` contains the modular passive analyzer and returns a normalized report. `server/routers.ts` exposes only the public `analyzer.analyze` mutation with input validation and rate limiting. The backend is stateless: it does not require a database, authentication, file storage, or background worker. Each request enters, is analyzed, and returns JSON; no analysis is persisted.

The original WebDev scaffold files for database and OAuth remain in the repository only as unused template compatibility files. They are not imported by the runtime entry point and are not required to deploy the analyzer API.

## Development

```bash
pnpm install
pnpm dev
```

Quality checks:

```bash
pnpm check
pnpm test -- --run
pnpm build
```

The analyzer intentionally does not execute target-site JavaScript, attempt authentication, exploit endpoints, brute-force, or perform destructive testing. Technology and quality claims are limited to public response evidence.

## Simple backend deployment

The backend can run on any Node.js host that supports a long-running Express process. It only needs `PORT`; no `DATABASE_URL`, OAuth credentials, Firebase Blaze plan, or storage bucket is required. For a frontend hosted on another domain, set `CORS_ALLOWED_ORIGIN` to the exact frontend origin, such as `https://yurihbo.github.io`.

The API exposes `GET /health` and the tRPC mutation at `POST /api/trpc/analyzer.analyze`. The in-memory rate limit is intentionally lightweight and resets when the process restarts. This is suitable for a small stateless deployment; a distributed rate limiter is only needed when running multiple instances.

## GitHub Pages deployment

GitHub Pages hosts the static React frontend through `.github/workflows/deploy-pages.yml`. The analysis API still requires the Node.js/Express server. When the backend is deployed, set `VITE_API_URL` to its public origin during the Pages build, for example:

```bash
VITE_API_URL=https://your-backend.example.com pnpm exec vite build --outDir ../dist-pages
```

If `VITE_API_URL` is not set, the frontend shows a clear connection message instead of attempting to parse the GitHub Pages HTML 404 response as JSON.
