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

The app uses the WebDev full-stack template: React 19 + TypeScript + Vite + Tailwind CSS on the client, with Express and tRPC on the server. `server/analyzer.ts` contains the modular passive analyzer and returns a normalized report. `server/routers.ts` exposes the public `analyzer.analyze` mutation with input validation and rate limiting. The current MVP does not persist analysis history; the database scaffold remains available for a later history feature.

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
