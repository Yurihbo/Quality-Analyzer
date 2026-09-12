# Quality Analyzer

A web-based analyzer for inspecting public websites and generating a structured quality report from the HTML and HTTP response.

The project was built to centralize technical checks that normally require several manual inspections into a single report with scores, evidence, detected technologies, network information and actionable findings.

## Objective

The main objective is to analyze a public website from the outside, using only information that can be obtained from its public response.

The analyzer focuses on:

- Identifying technologies and infrastructure signals.
- Evaluating SEO and accessibility markup.
- Checking security-related HTTP headers and HTTPS usage.
- Measuring basic page and resource characteristics.
- Inspecting HTML structure and important elements.
- Checking referenced resources and network responses.
- Detecting errors and presenting their location and evidence.
- Producing a normalized report with scores from 0 to 100.

## Analysis Areas

| Area | What is evaluated |
| --- | --- |
| Performance | Page size, requests, scripts, stylesheets, images and fonts |
| SEO | Title, description, headings, canonical data, robots, sitemap and social metadata |
| Security | HTTPS and security-related response headers |
| Accessibility | Language, viewport, image alternatives and semantic signals |
| Best Practices | Technical and structural recommendations |
| Errors | Failed or problematic resources with severity and evidence |
| Technologies | Frontend, backend, infrastructure, languages and analytics signals |
| Structure | HTML element counts and a simplified document tree |
| Network | HTTP status, final URL, protocol, content type, compression, server, headers and redirects |

## How It Works

1. The user submits a public website URL.
2. The API validates the URL before making an external request.
3. The analyzer resolves the hostname and blocks private or internal destinations.
4. The page is fetched with a controlled timeout and manual redirect handling.
5. The HTML and response headers are inspected without executing the target website's JavaScript.
6. The analyzer checks the document, metadata and referenced resources.
7. Findings are classified by severity and combined with category scores.
8. The frontend presents the final report with evidence, recommendations and filters.

## Main Features

- Public URL analysis with loading states and validation.
- Overall score plus category scores.
- Technology detection with confidence levels and evidence.
- Performance, SEO, security, accessibility, structure and network reports.
- Error findings with severity, location, HTTP status and source evidence.
- Filters for critical, high, medium and low findings.
- Fix recommendations for common findings.
- Simplified HTML structure visualization.
- PDF report export.
- Dark interface with responsive layout.

## Architecture

The project is divided into a React frontend and a Node.js API.

```text
Quality Analyzer
├── client/
│   └── React interface
│       ├── URL input
│       ├── Analysis progress
│       ├── Score dashboard
│       ├── Findings and filters
│       └── PDF report export
│
├── server/
│   ├── analyzer.ts
│   │   └── Website fetching, parsing, detection and scoring
│   ├── routers.ts
│   │   └── tRPC API, validation and rate limiting
│   └── _core/
│       └── Express/server runtime
│
└── .github/workflows/
    └── GitHub Pages deployment
```

The core analysis logic is concentrated in `server/analyzer.ts`. It defines the report model, performs safe requests, detects technologies, inspects HTML and resources, calculates category scores and returns the final `AnalysisReport`.

The API layer in `server/routers.ts` exposes the `analyzer.analyze` mutation, validates the input with Zod and applies a lightweight in-memory rate limit of six analyses per minute per requester.

The frontend consumes the typed tRPC API and renders the returned report. The application also uses Wouter for routing, React Query through tRPC, Lucide icons and Framer Motion for interface behavior.

## Tech Stack

### Frontend

- React 19
- TypeScript
- Vite
- Tailwind CSS
- Wouter
- TanStack React Query
- Framer Motion
- Lucide React
- Recharts

### Backend

- Node.js
- Express
- tRPC
- Zod
- TypeScript

### Tooling

- pnpm
- Vite
- esbuild
- Vitest
- Prettier
- GitHub Actions

The dependency set also includes libraries inherited from the original project scaffold, such as Drizzle ORM, MySQL, AWS S3 tooling and authentication-related packages. They are not part of the analyzer's core request flow.

## Security

Because the application accepts arbitrary public URLs, the backend includes protections against unsafe server-side requests.

The analyzer:

- Accepts only HTTP and HTTPS URLs.
- Rejects URLs containing embedded credentials.
- Blocks localhost and private/internal IP addresses.
- Resolves hostnames before requesting them and rejects private destinations.
- Validates every redirect destination.
- Limits redirects to five hops.
- Aborts requests that exceed the 10-second timeout.
- Limits the analyzed HTML response to approximately 5 MB.
- Applies an in-memory limit of six analyses per minute per requester.

The analyzer is intentionally passive. It does not authenticate against target websites, execute their JavaScript, brute-force endpoints, exploit vulnerabilities or perform destructive tests.

## Report Data

Each analysis returns a structured report containing:

```text
AnalysisReport
├── URL and hostname
├── Analysis time and duration
├── Overall score and grade
├── Summary counters
├── Category scores
├── Detected technologies
├── Performance metrics and checks
├── SEO checks
├── Security checks
├── Accessibility checks
├── HTML structure
├── Network information
└── Findings and errors
```

Important findings include the category, severity, source location, detected element when available, evidence and HTTP status when applicable.

## Development

Install dependencies:

```bash
pnpm install
```

Start the development server:

```bash
pnpm dev
```

Run the main quality checks:

```bash
pnpm check
pnpm test
pnpm build
```

Format the project:

```bash
pnpm format
```

## Deployment

The application can be deployed as a static frontend plus a Node.js backend.

The frontend is prepared for GitHub Pages through the repository workflow. The backend runs as a long-lived Express process and exposes the analysis API.

The frontend can receive the backend origin through:

```text
VITE_API_URL=https://your-backend.example.com
```

When the frontend and API are hosted on different origins, the backend can use `CORS_ALLOWED_ORIGIN` to restrict the allowed frontend origin.

## API

Health endpoint:

```text
GET /health
```

Analysis endpoint through tRPC:

```text
POST /api/trpc/analyzer.analyze
```

The analysis endpoint receives a URL, validates it and returns the complete `AnalysisReport` generated by the analyzer.

## Project Goals

Quality Analyzer was developed around three practical goals:

1. **Centralize technical inspection** — replace several manual checks with one workflow.
2. **Make findings understandable** — show not only a score, but also evidence and where the problem was detected.
3. **Keep the analysis safe and passive** — inspect public response data without attempting to access protected systems or modify the target website.

The result is a lightweight full-stack application that combines frontend reporting, backend analysis, network inspection, security validation and automated deployment in one project.

## Author

Developed by **Yuri de Sousa Silva**.

[GitHub](https://github.com/Yurihbo) · [Quality Analyzer](https://github.com/Yurihbo/Quality-Analyzer)
