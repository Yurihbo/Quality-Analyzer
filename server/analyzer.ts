import dns from "node:dns/promises";
import net from "node:net";

export type Severity = "critical" | "high" | "medium" | "low" | "info";
export type CheckStatus = "pass" | "warn" | "fail" | "info";

export interface Finding {
  id: string;
  severity: Severity;
  title: string;
  category: string;
  location: string;
  element?: string;
  evidence: string;
  status?: number;
}

export interface Check {
  label: string;
  status: CheckStatus;
  detail: string;
  evidence?: string;
}

export interface Technology {
  name: string;
  category: "Frontend" | "Languages" | "Backend" | "Infrastructure" | "Analytics";
  confidence: number;
  status: "Detected" | "Likely" | "Possible" | "Not detected" | "Unknown";
  evidence: string;
}

export interface AnalysisReport {
  id: string;
  url: string;
  hostname: string;
  analyzedAt: string;
  durationMs: number;
  overallScore: number;
  grade: string;
  summary: {
    errors: number;
    warnings: number;
    technologies: number;
    elements: number;
    requests: number;
  };
  scores: {
    performance: number;
    seo: number;
    security: number;
    accessibility: number;
    bestPractices: number;
    errors: number;
  };
  technologies: Technology[];
  performance: {
    score: number;
    pageSize: number;
    requests: number;
    scripts: number;
    stylesheets: number;
    images: number;
    fonts: number;
    checks: Check[];
  };
  seo: { score: number; checks: Check[] };
  security: { score: number; checks: Check[] };
  accessibility: { score: number; checks: Check[] };
  structure: {
    counts: { elements: number; links: number; images: number; scripts: number; stylesheets: number };
    tree: string[];
  };
  network: {
    status: number;
    statusText: string;
    finalUrl: string;
    protocol: string;
    contentType: string;
    compression: string;
    server: string;
    responseSize: number;
    redirects: string[];
    headers: Record<string, string>;
  };
  errors: Finding[];
}

const MAX_HTML_BYTES = 3_000_000;
const REQUEST_TIMEOUT_MS = 10_000;
const MAX_REDIRECTS = 5;
const USER_AGENT = "QualityAnalyzer/1.0 (+passive-public-analysis)";

function normalizeUrl(raw: string) {
  const trimmed = raw.trim();
  return /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`;
}

function isPrivateIp(address: string) {
  const ip = address.toLowerCase();
  if (net.isIPv4(ip)) {
    const [a, b] = ip.split(".").map(Number);
    return (
      a === 10 ||
      a === 127 ||
      a === 0 ||
      (a === 169 && b === 254) ||
      (a === 172 && b >= 16 && b <= 31) ||
      (a === 192 && b === 168) ||
      (a === 100 && b >= 64 && b <= 127)
    );
  }
  if (net.isIPv6(ip)) {
    return (
      ip === "::1" ||
      ip === "::" ||
      ip.startsWith("fc") ||
      ip.startsWith("fd") ||
      ip.startsWith("fe80") ||
      ip.startsWith("::ffff:127.") ||
      ip.startsWith("::ffff:10.") ||
      ip.startsWith("::ffff:192.168.")
    );
  }
  return true;
}

async function assertSafeUrl(raw: string) {
  const parsed = new URL(raw);
  if (!['http:', 'https:'].includes(parsed.protocol)) throw new Error("Only HTTP and HTTPS URLs are supported.");
  if (parsed.username || parsed.password) throw new Error("URLs with embedded credentials are not allowed.");
  const hostname = parsed.hostname.toLowerCase().replace(/^\[|\]$/g, "");
  if (
    hostname === "localhost" ||
    hostname.endsWith(".localhost") ||
    hostname === "metadata.google.internal" ||
    hostname === "metadata.google.internal." ||
    (net.isIP(hostname) > 0 && isPrivateIp(hostname))
  ) {
    throw new Error("Private and internal network addresses are not allowed.");
  }
  try {
    const addresses = await dns.lookup(hostname, { all: true, verbatim: true });
    if (!addresses.length || addresses.some((entry) => isPrivateIp(entry.address))) {
      throw new Error("The destination resolves to a private or internal network.");
    }
  } catch (error) {
    if (error instanceof Error && error.message.includes("private or internal")) throw error;
    throw new Error("The hostname could not be resolved.");
  }
}

interface SafeResponse {
  response: Response;
  finalUrl: string;
  redirects: string[];
}

async function fetchSafe(rawUrl: string, init: RequestInit = {}): Promise<SafeResponse> {
  let current = rawUrl;
  const redirects: string[] = [];
  for (let hop = 0; hop <= MAX_REDIRECTS; hop++) {
    await assertSafeUrl(current);
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
    try {
      const response = await fetch(current, {
        ...init,
        redirect: "manual",
        signal: controller.signal,
        headers: {
          "user-agent": USER_AGENT,
          accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
          ...(init.headers || {}),
        },
      });
      if (response.status >= 300 && response.status < 400) {
        const location = response.headers.get("location");
        if (!location) return { response, finalUrl: current, redirects };
        if (hop === MAX_REDIRECTS) throw new Error("The website redirected too many times.");
        const next = new URL(location, current).toString();
        redirects.push(`${response.status} → ${next}`);
        current = next;
        continue;
      }
      return { response, finalUrl: current, redirects };
    } catch (error) {
      if (error instanceof Error && error.name === "AbortError") throw new Error("The website took too long to respond.");
      throw error;
    } finally {
      clearTimeout(timeout);
    }
  }
  throw new Error("The website redirected too many times.");
}

async function readLimited(response: Response) {
  const length = Number(response.headers.get("content-length") || 0);
  if (length > MAX_HTML_BYTES) throw new Error("The page is larger than the 3 MB analysis limit.");
  const buffer = await response.arrayBuffer();
  if (buffer.byteLength > MAX_HTML_BYTES) throw new Error("The page is larger than the 3 MB analysis limit.");
  return { html: new TextDecoder().decode(buffer), bytes: buffer.byteLength };
}

function count(html: string, tag: string) {
  return (html.match(new RegExp(`<${tag}\\b`, "gi")) || []).length;
}

function attr(tag: string, name: string) {
  const match = tag.match(new RegExp(`${name}\\s*=\\s*["']([^"']*)["']`, "i"));
  return match?.[1]?.trim() || "";
}

function textContent(value: string) {
  return value.replace(/<[^>]*>/g, " ").replace(/&nbsp;/gi, " ").replace(/\s+/g, " ").trim();
}

function lineAt(html: string, index: number) {
  return html.slice(0, Math.max(index, 0)).split("\n").length;
}

function check(label: string, status: CheckStatus, detail: string, evidence?: string): Check {
  return { label, status, detail, evidence };
}

function issue(
  id: string,
  severity: Severity,
  title: string,
  category: string,
  location: string,
  evidence: string,
  element?: string,
  status?: number,
): Finding {
  return { id, severity, title, category, location, evidence, element, status };
}

function severityWeight(severity: Severity) {
  return { critical: 4, high: 3, medium: 2, low: 1, info: 0 }[severity];
}

async function probeResource(url: string) {
  try {
    const result = await fetchSafe(url, { method: "HEAD", headers: { accept: "*/*" } });
    return { url, status: result.response.status, statusText: result.response.statusText, redirects: result.redirects };
  } catch (error) {
    return { url, status: 0, statusText: error instanceof Error ? error.message : "Request failed", redirects: [] as string[] };
  }
}

function resourceRefs(html: string, baseUrl: string) {
  const refs: Array<{ kind: string; url: string; element: string; index: number }> = [];
  const tagRegex = /<(img|script|link|source|video|audio|iframe)\b[^>]*>/gi;
  let match: RegExpExecArray | null;
  while ((match = tagRegex.exec(html))) {
    const element = match[0];
    const tag = match[1].toLowerCase();
    const raw = tag === "link" ? attr(element, "href") : attr(element, "src");
    if (!raw || /^(data:|blob:|mailto:|tel:|javascript:|#)/i.test(raw)) continue;
    try {
      const resolved = new URL(raw, baseUrl).toString();
      if (/^https?:/i.test(resolved)) refs.push({ kind: tag, url: resolved, element, index: match.index });
    } catch {
      // Ignore malformed references; the source HTML is still reported by other checks.
    }
  }
  return refs;
}

function detectTechnologies(html: string, headers: Record<string, string>): Technology[] {
  const lower = html.toLowerCase();
  const scriptSrcs = Array.from(html.matchAll(/<script\b[^>]*src=["']([^"']+)["']/gi)).map((m) => m[1].toLowerCase());
  const detections: Technology[] = [];
  const add = (name: string, category: Technology["category"], confidence: number, evidence: string, status: Technology["status"] = confidence >= 80 ? "Detected" : confidence >= 55 ? "Likely" : "Possible") => detections.push({ name, category, confidence, status, evidence });

  add("HTML", "Languages", 100, "HTML document successfully fetched and parsed.");
  add("CSS", "Languages", /<style\b|<link[^>]+stylesheet/i.test(html) ? 96 : 70, /<style\b|<link[^>]+stylesheet/i.test(html) ? "Stylesheet or style block detected." : "No stylesheet reference found; CSS support is not directly observable.");
  add("JavaScript", "Languages", /<script\b/i.test(html) ? 98 : 35, /<script\b/i.test(html) ? "Script elements detected in the document." : "No script element detected.", /<script\b/i.test(html) ? "Detected" : "Possible");
  if (lower.includes("__next_data__") || /(?:^|\/)__next(?:\/|$)|_next\//i.test(lower)) add("Next.js", "Frontend", 98, "Detected Next.js runtime markers or _next assets.");
  if (lower.includes("data-reactroot") || lower.includes("reactdom") || lower.includes("react.") || lower.includes("__reactfiber")) add("React", "Frontend", 93, "Detected React-specific DOM or runtime markers.");
  if (lower.includes("ng-version") || lower.includes("ng-app") || lower.includes("angular")) add("Angular", "Frontend", 88, "Detected Angular attributes or runtime references.");
  if (lower.includes("data-v-") || lower.includes("__vue__") || scriptSrcs.some((src) => src.includes("vue"))) add("Vue", "Frontend", 90, "Detected Vue DOM markers or runtime reference.");
  if (scriptSrcs.some((src) => src.includes("jquery")) || lower.includes("jquery")) add("jQuery", "Frontend", 94, "Detected a jQuery script reference or global marker.");
  if (headers["x-powered-by"]?.toLowerCase().includes("express")) add("Node.js", "Backend", 86, `X-Powered-By header reports ${headers["x-powered-by"]}.`);
  if (headers["x-powered-by"]?.toLowerCase().includes("php")) add("PHP", "Backend", 90, `X-Powered-By header reports ${headers["x-powered-by"]}.`);
  if (headers.server?.toLowerCase().includes("nginx")) add("Nginx", "Infrastructure", 93, `Server header reports ${headers.server}.`);
  if (headers.server?.toLowerCase().includes("apache")) add("Apache", "Infrastructure", 93, `Server header reports ${headers.server}.`);
  if (headers["cf-ray"] || headers.server?.toLowerCase().includes("cloudflare")) add("Cloudflare", "Infrastructure", 96, "Cloudflare response headers were detected.");
  if (headers["x-vercel-id"] || headers.server?.toLowerCase().includes("vercel")) add("Vercel", "Infrastructure", 96, "Vercel response headers were detected.");
  if (headers["x-nf-request-id"]) add("Netlify", "Infrastructure", 96, "Netlify response headers were detected.");
  if (lower.includes("googletagmanager.com")) add("Google Tag Manager", "Analytics", 98, "googletagmanager.com script detected.");
  if (lower.includes("google-analytics.com") || lower.includes("gtag(")) add("Google Analytics", "Analytics", 98, "Google Analytics script or gtag marker detected.");
  if (lower.includes("connect.facebook.net") || lower.includes("fbq(")) add("Meta Pixel", "Analytics", 96, "Meta Pixel script or fbq marker detected.");
  if (lower.includes("hotjar")) add("Hotjar", "Analytics", 92, "Hotjar script marker detected.");
  return detections;
}

function buildTree(html: string) {
  const tags = Array.from(html.matchAll(/<(header|main|nav|section|article|aside|footer|form|h1|h2|h3|title|meta|link|script|body|head)\b/gi)).map((m) => m[1].toLowerCase());
  const unique = tags.filter((tag, index) => index < 22);
  const lines = ["html"];
  const hasHead = unique.includes("head");
  const hasBody = unique.includes("body");
  if (hasHead) {
    lines.push("├── head");
    if (unique.includes("title")) lines.push("│   ├── title");
    if (unique.includes("meta")) lines.push("│   ├── meta");
    if (unique.includes("link")) lines.push("│   └── link");
  }
  if (hasBody) {
    lines.push("└── body");
    ["header", "nav", "main", "section", "article", "aside", "footer"].filter((tag) => unique.includes(tag)).forEach((tag, index, list) => lines.push(`    ${index === list.length - 1 ? "└──" : "├──"} ${tag}`));
  }
  return lines;
}

export async function analyzeWebsite(rawUrl: string): Promise<AnalysisReport> {
  const started = Date.now();
  const normalized = normalizeUrl(rawUrl);
  let parsed: URL;
  try {
    parsed = new URL(normalized);
  } catch {
    throw new Error("Enter a valid website URL.");
  }
  await assertSafeUrl(parsed.toString());

  const page = await fetchSafe(parsed.toString());
  const response = page.response;
  const headerMap: Record<string, string> = {};
  response.headers.forEach((value, key) => { headerMap[key.toLowerCase()] = value; });
  const { html, bytes } = await readLimited(response);
  const finalUrl = page.finalUrl;
  const finalParsed = new URL(finalUrl);
  const refs = resourceRefs(html, finalUrl);
  const images = Array.from(html.matchAll(/<img\b[^>]*>/gi)).map((m) => ({ element: m[0], index: m.index ?? 0, alt: attr(m[0], "alt"), src: attr(m[0], "src") }));
  const scripts = Array.from(html.matchAll(/<script\b[^>]*>/gi)).map((m) => ({ element: m[0], index: m.index ?? 0, src: attr(m[0], "src") }));
  const links = Array.from(html.matchAll(/<a\b[^>]*>/gi)).map((m) => ({ element: m[0], index: m.index ?? 0, href: attr(m[0], "href") }));
  const metaTags = Array.from(html.matchAll(/<meta\b[^>]*>/gi)).map((m) => m[0]);
  const title = textContent(html.match(/<title\b[^>]*>([\s\S]*?)<\/title>/i)?.[1] || "");
  const description = metaTags.find((tag) => attr(tag, "name").toLowerCase() === "description");
  const canonical = Array.from(html.matchAll(/<link\b[^>]*>/gi)).map((m) => m[0]).find((tag) => attr(tag, "rel").toLowerCase().split(/\s+/).includes("canonical"));
  const h1Count = count(html, "h1");
  const headings = count(html, "h1") + count(html, "h2") + count(html, "h3") + count(html, "h4") + count(html, "h5") + count(html, "h6");
  const contentType = headerMap["content-type"] || "Unknown";
  const compression = headerMap["content-encoding"] || (headerMap["transfer-encoding"] || "none");
  const responseSize = bytes;

  const errors: Finding[] = [];
  const performanceChecks: Check[] = [];
  const seoChecks: Check[] = [];
  const securityChecks: Check[] = [];
  const accessibilityChecks: Check[] = [];

  const missingAlt = images.filter((image) => !image.alt);
  const unlabeledButtons = Array.from(html.matchAll(/<button\b[^>]*>([\s\S]*?)<\/button>/gi)).filter((m) => !textContent(m[1]) && !attr(m[0], "aria-label") && !attr(m[0], "title"));
  const inputs = Array.from(html.matchAll(/<input\b[^>]*>/gi)).map((m) => m[0]);
  const unlabeledInputs = inputs.filter((input) => !attr(input, "aria-label") && !attr(input, "title") && !attr(input, "id"));
  missingAlt.slice(0, 20).forEach((image, index) => errors.push(issue(`a11y-image-${index}`, "low", "Image without alt attribute", "Accessibility", `HTML line ${lineAt(html, image.index)}`, `The image element has no alt attribute.`, image.element)));
  unlabeledButtons.slice(0, 10).forEach((button, index) => errors.push(issue(`a11y-button-${index}`, "medium", "Button without accessible name", "Accessibility", `HTML line ${lineAt(html, button.index ?? 0)}`, "No visible text, aria-label, or title was detected.", button[0])));
  if (!title) errors.push(issue("seo-title", "high", "Missing page title", "SEO", "head", "No <title> element with readable text was detected."));
  if (!description) errors.push(issue("seo-description", "medium", "Missing meta description", "SEO", "head", "No meta name=description tag was detected."));
  if (response.status >= 400) errors.push(issue(`http-${response.status}`, response.status >= 500 ? "critical" : "high", `${response.status} ${response.statusText || "HTTP response"}`, "HTTP", finalUrl, `The analyzed page returned HTTP ${response.status}.`, undefined, response.status));

  const toProbe = refs.filter((ref) => ref.kind === "img" || ref.kind === "script" || ref.kind === "link").slice(0, 12);
  const probeResults = await Promise.all(toProbe.map((ref) => probeResource(ref.url)));
  probeResults.forEach((result, index) => {
    if (result.status >= 400 || result.status === 0) {
      const ref = toProbe[index];
      errors.push(issue(`resource-${index}`, result.status >= 500 ? "high" : "medium", `Broken ${ref.kind} resource`, "Assets", `HTML line ${lineAt(html, ref.index)}`, `${ref.url} → ${result.status || "request failed"} ${result.statusText}`.trim(), ref.element, result.status || undefined));
    }
  });

  const performanceScore = Math.max(0, Math.min(100, 100 - (bytes > 1_000_000 ? 25 : bytes > 500_000 ? 12 : bytes > 250_000 ? 5 : 0) - (scripts.length > 18 ? 12 : scripts.length > 10 ? 6 : 0) - (missingAlt.length > 12 ? 4 : 0)));
  performanceChecks.push(check("Page size", bytes <= 500_000 ? "pass" : "warn", `${Math.round(bytes / 1024)} KB transferred`, `Content-Length observed: ${bytes.toLocaleString()} bytes`));
  performanceChecks.push(check("JavaScript requests", scripts.length > 10 ? "warn" : "pass", `${scripts.length} script elements detected`));
  performanceChecks.push(check("Compression", /br|gzip|deflate/i.test(compression) ? "pass" : "warn", /br|gzip|deflate/i.test(compression) ? `${compression} compression enabled` : "No content compression header detected"));
  const cache = headerMap["cache-control"] || headerMap.expires;
  performanceChecks.push(check("Browser caching", cache ? "pass" : "warn", cache ? "Cache headers detected" : "No cache-control or expires header detected", cache || undefined));
  const blockingScripts = scripts.filter((script) => script.src && !/\basync\b|\bdefer\b/i.test(script.element));
  performanceChecks.push(check("Render-blocking scripts", blockingScripts.length > 3 ? "warn" : "pass", blockingScripts.length ? `${blockingScripts.length} external script(s) may block parsing` : "No obvious render-blocking scripts detected"));
  performanceChecks.push(check("Modern image loading", images.length === 0 || images.every((image) => /loading=["']lazy["']/i.test(image.element)) ? "pass" : "warn", images.length ? `${images.filter((image) => /loading=["']lazy["']/i.test(image.element)).length}/${images.length} images use lazy loading` : "No images detected"));

  let seoScore = 100;
  if (!title) seoScore -= 20;
  if (!description) seoScore -= 15;
  if (!canonical) seoScore -= 8;
  if (!h1Count) seoScore -= 12;
  if (h1Count > 1) seoScore -= 4;
  const viewport = metaTags.find((tag) => attr(tag, "name").toLowerCase() === "viewport");
  if (!viewport) seoScore -= 10;
  const ogTitle = metaTags.find((tag) => attr(tag, "property").toLowerCase() === "og:title");
  const ogDescription = metaTags.find((tag) => attr(tag, "property").toLowerCase() === "og:description");
  const ogImage = metaTags.find((tag) => attr(tag, "property").toLowerCase() === "og:image");
  if (!title) seoChecks.push(check("Title", "fail", "Missing <title>")); else seoChecks.push(check("Title", "pass", title.slice(0, 100)));
  if (!description) seoChecks.push(check("Meta description", "fail", "Missing meta description")); else seoChecks.push(check("Meta description", "pass", "Meta description detected"));
  seoChecks.push(check("Canonical", canonical ? "pass" : "warn", canonical ? "Canonical URL detected" : "No canonical link detected"));
  seoChecks.push(check("Viewport", viewport ? "pass" : "warn", viewport ? "Responsive viewport configured" : "No viewport meta tag detected"));
  seoChecks.push(check("H1 structure", h1Count === 1 ? "pass" : h1Count === 0 ? "fail" : "warn", `${h1Count} H1 element(s) detected`));
  seoChecks.push(check("Open Graph", ogTitle && ogDescription && ogImage ? "pass" : "warn", ogTitle && ogDescription && ogImage ? "Title, description and image detected" : "Open Graph metadata is incomplete"));
  if (!h1Count) errors.push(issue("seo-h1", "medium", "Missing H1 heading", "SEO", "body", "No H1 element was detected in the document."));

  const robots = await probeResource(new URL("/robots.txt", finalUrl).toString());
  const sitemap = await probeResource(new URL("/sitemap.xml", finalUrl).toString());
  seoChecks.push(check("robots.txt", robots.status === 200 ? "pass" : "warn", robots.status === 200 ? "robots.txt is reachable" : "robots.txt was not found or not reachable"));
  seoChecks.push(check("sitemap.xml", sitemap.status === 200 ? "pass" : "warn", sitemap.status === 200 ? "sitemap.xml is reachable" : "sitemap.xml was not found or not reachable"));
  if (sitemap.status >= 400 || sitemap.status === 0) errors.push(issue("seo-sitemap", "low", "Missing sitemap", "SEO", "/sitemap.xml", `GET /sitemap.xml → ${sitemap.status || "request failed"}`));

  let securityScore = finalParsed.protocol === "https:" ? 35 : 10;
  const securityHeaders = [
    ["Strict-Transport-Security", "strict-transport-security", 20],
    ["Content-Security-Policy", "content-security-policy", 18],
    ["X-Content-Type-Options", "x-content-type-options", 10],
    ["X-Frame-Options", "x-frame-options", 9],
    ["Referrer-Policy", "referrer-policy", 8],
  ] as const;
  securityHeaders.forEach(([label, key, points]) => {
    if (headerMap[key]) { securityScore += points; securityChecks.push(check(label, "pass", "Header detected", headerMap[key])); }
    else { securityChecks.push(check(label, "warn", "Header not detected")); }
  });
  securityChecks.unshift(check("HTTPS", finalParsed.protocol === "https:" ? "pass" : "fail", finalParsed.protocol === "https:" ? "Secure transport detected" : "The final URL is not using HTTPS"));
  securityScore = Math.max(0, Math.min(100, securityScore));
  if (finalParsed.protocol !== "https:") errors.push(issue("security-https", "high", "Connection is not using HTTPS", "Security", finalUrl, "The final analyzed URL uses HTTP instead of HTTPS."));
  if (!headerMap["content-security-policy"]) errors.push(issue("security-csp", "low", "Missing Content-Security-Policy", "Security", "response headers", "No Content-Security-Policy response header was detected."));

  let accessibilityScore = 100;
  accessibilityScore -= Math.min(30, missingAlt.length * 5);
  accessibilityScore -= Math.min(20, unlabeledButtons.length * 8);
  accessibilityScore -= Math.min(12, unlabeledInputs.length * 4);
  if (!viewport) accessibilityScore -= 8;
  accessibilityChecks.push(check("Image alternatives", missingAlt.length ? "warn" : "pass", missingAlt.length ? `${missingAlt.length} image(s) without alt` : "All detected images have alt attributes"));
  accessibilityChecks.push(check("Button names", unlabeledButtons.length ? "warn" : "pass", unlabeledButtons.length ? `${unlabeledButtons.length} button(s) without an accessible name` : "Buttons have text or accessible names"));
  accessibilityChecks.push(check("Form labels", unlabeledInputs.length ? "warn" : "pass", unlabeledInputs.length ? `${unlabeledInputs.length} input(s) without an observable label association` : "Inputs expose a label, id, or accessible name"));
  accessibilityChecks.push(check("Semantic landmarks", /<main\b/i.test(html) && /<nav\b/i.test(html) ? "pass" : "warn", /<main\b/i.test(html) && /<nav\b/i.test(html) ? "main and nav landmarks detected" : "Main/nav landmarks are incomplete"));
  accessibilityScore = Math.max(0, Math.min(100, accessibilityScore));

  const technologies = detectTechnologies(html, headerMap);
  const errorScore = Math.max(0, 100 - errors.reduce((sum, item) => sum + severityWeight(item.severity) * 7, 0));
  const bestPractices = Math.round((securityScore + accessibilityScore + Math.min(100, seoScore + 5)) / 3);
  const scores = { performance: performanceScore, seo: Math.max(0, seoScore), security: securityScore, accessibility: accessibilityScore, bestPractices, errors: errorScore };
  const overallScore = Math.round(scores.performance * 0.2 + scores.seo * 0.2 + scores.security * 0.2 + scores.accessibility * 0.15 + scores.bestPractices * 0.15 + scores.errors * 0.1);
  const grade = overallScore >= 90 ? "Excellent" : overallScore >= 75 ? "Good" : overallScore >= 60 ? "Needs attention" : "Critical";
  const headers = Object.fromEntries(Object.entries(headerMap).filter(([key]) => ["cache-control", "content-encoding", "content-type", "server", "strict-transport-security", "content-security-policy", "x-frame-options", "x-content-type-options", "referrer-policy"].includes(key)));
  const structureCounts = { elements: count(html, "div") + count(html, "section") + count(html, "header") + count(html, "main") + count(html, "footer") + count(html, "article") + count(html, "nav") + count(html, "form") + count(html, "button"), links: links.length, images: images.length, scripts: scripts.length, stylesheets: refs.filter((ref) => ref.kind === "link").length };
  const id = `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
  return {
    id,
    url: finalUrl,
    hostname: finalParsed.hostname,
    analyzedAt: new Date().toISOString(),
    durationMs: Date.now() - started,
    overallScore,
    grade,
    summary: { errors: errors.length, warnings: errors.filter((error) => error.severity === "medium" || error.severity === "low").length, technologies: technologies.length, elements: structureCounts.elements, requests: refs.length + 1 },
    scores,
    technologies,
    performance: { score: performanceScore, pageSize: bytes, requests: refs.length + 1, scripts: scripts.length, stylesheets: structureCounts.stylesheets, images: images.length, fonts: refs.filter((ref) => ref.kind === "link" && /font|woff|ttf/i.test(ref.url)).length, checks: performanceChecks },
    seo: { score: Math.max(0, seoScore), checks: seoChecks },
    security: { score: securityScore, checks: securityChecks },
    accessibility: { score: accessibilityScore, checks: accessibilityChecks },
    structure: { counts: structureCounts, tree: buildTree(html) },
    network: { status: response.status, statusText: response.statusText || (response.ok ? "OK" : "HTTP response"), finalUrl, protocol: headerMap[":protocol"] || (headerMap["alt-svc"]?.includes("h3") ? "HTTP/3 capable" : "HTTP"), contentType, compression, server: headerMap.server || "Not disclosed", responseSize, redirects: page.redirects, headers },
    errors: errors.sort((a, b) => severityWeight(b.severity) - severityWeight(a.severity)),
  };
}

export function validatePublicUrl(raw: string) {
  const trimmed = raw.trim();
  if (/^[a-z][a-z0-9+.-]*:/i.test(trimmed) && !/^https?:\/\//i.test(trimmed)) {
    throw new Error("Only HTTP and HTTPS URLs are supported.");
  }
  const normalized = normalizeUrl(trimmed);
  const parsed = new URL(normalized);
  if (!['http:', 'https:'].includes(parsed.protocol)) throw new Error("Only HTTP and HTTPS URLs are supported.");
  const hostname = parsed.hostname.toLowerCase().replace(/^\[|\]$/g, "");
  if (hostname === "localhost" || hostname.endsWith(".localhost") || hostname === "metadata.google.internal" || (net.isIP(hostname) > 0 && isPrivateIp(hostname))) {
    throw new Error("Private and internal network addresses are not allowed.");
  }
  return normalized;
}
