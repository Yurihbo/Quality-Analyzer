import { FormEvent, useMemo, useState } from "react";
import type { AnalysisReport, Check, Finding, Technology } from "../../../server/analyzer";
import {
  AlertCircle,
  ArrowUpRight,
  CheckCircle2,
  ChevronDown,
  CircleDot,
  Code2,
  ExternalLink,
  FileCode2,
  Gauge,
  Globe2,
  Hash,
  Info,
  Layers3,
  Link2,
  Loader2,
  LockKeyhole,
  Network,
  Radar,
  RefreshCw,
  Search,
  ShieldCheck,
  Sparkles,
  TerminalSquare,
  TriangleAlert,
  XCircle,
} from "lucide-react";
import { trpc } from "@/lib/trpc";

const loadingSteps = ["Fetching page", "Reading HTML", "Inspecting headers", "Detecting technologies", "Checking SEO", "Checking security", "Checking performance", "Finding errors"];
const severityOrder = ["all", "critical", "high", "medium", "low"] as const;
type SeverityFilter = (typeof severityOrder)[number];

type CheckStatus = Check["status"];

function formatBytes(bytes: number) {
  if (!bytes) return "0 B";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function scoreTone(score: number) {
  if (score >= 90) return "text-emerald-300";
  if (score >= 75) return "text-lime-300";
  if (score >= 60) return "text-amber-300";
  return "text-red-300";
}

function scoreBar(score: number) {
  if (score >= 90) return "bg-emerald-400";
  if (score >= 75) return "bg-lime-400";
  if (score >= 60) return "bg-amber-400";
  return "bg-red-400";
}

function StatusIcon({ status }: { status: CheckStatus }) {
  if (status === "pass") return <CheckCircle2 className="h-4 w-4 text-emerald-300" />;
  if (status === "fail") return <XCircle className="h-4 w-4 text-red-300" />;
  if (status === "warn") return <TriangleAlert className="h-4 w-4 text-amber-300" />;
  return <Info className="h-4 w-4 text-sky-300" />;
}

function CheckList({ checks }: { checks: Check[] }) {
  return (
    <div className="divide-y divide-white/[0.06]">
      {checks.map((item) => (
        <div className="flex gap-3 py-3 first:pt-0 last:pb-0" key={`${item.label}-${item.detail}`}>
          <div className="mt-0.5 shrink-0"><StatusIcon status={item.status} /></div>
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-baseline justify-between gap-2">
              <span className="text-sm font-medium text-zinc-200">{item.label}</span>
              <span className={`text-[10px] font-semibold uppercase tracking-[0.18em] ${item.status === "pass" ? "text-emerald-300" : item.status === "fail" ? "text-red-300" : item.status === "warn" ? "text-amber-300" : "text-sky-300"}`}>{item.status}</span>
            </div>
            <p className="mt-1 text-xs leading-5 text-zinc-500">{item.detail}</p>
            {item.evidence && <p className="mt-1 break-words font-mono text-[11px] leading-5 text-zinc-600">{item.evidence}</p>}
          </div>
        </div>
      ))}
    </div>
  );
}

function SectionHeader({ icon: Icon, eyebrow, title, score, description }: { icon: typeof Gauge; eyebrow: string; title: string; score?: number; description?: string }) {
  return (
    <div className="mb-6 flex flex-col gap-4 border-b border-white/[0.08] pb-5 sm:flex-row sm:items-end sm:justify-between">
      <div className="flex gap-3">
        <div className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-white/10 bg-white/[0.03] text-zinc-300"><Icon className="h-4 w-4" /></div>
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-zinc-600">{eyebrow}</p>
          <h2 className="mt-1 text-xl font-semibold tracking-tight text-zinc-100">{title}</h2>
          {description && <p className="mt-1 max-w-xl text-sm leading-6 text-zinc-500">{description}</p>}
        </div>
      </div>
      {typeof score === "number" && <div className={`text-3xl font-semibold tracking-tight ${scoreTone(score)}`}><span className="text-sm font-normal text-zinc-600">score </span>{score}<span className="text-sm font-normal text-zinc-600"> / 100</span></div>}
    </div>
  );
}

function TechnologyItem({ technology }: { technology: Technology }) {
  return (
    <div className="rounded-xl border border-white/[0.08] bg-black/20 p-4 transition-colors hover:border-white/15 hover:bg-white/[0.03]">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="font-medium text-zinc-100">{technology.name}</p>
          <p className="mt-1 text-[10px] font-semibold uppercase tracking-[0.16em] text-zinc-600">{technology.category}</p>
        </div>
        <span className={`rounded-full border px-2 py-1 text-[10px] font-semibold uppercase tracking-[0.12em] ${technology.status === "Detected" ? "border-emerald-400/20 bg-emerald-400/10 text-emerald-300" : "border-amber-400/20 bg-amber-400/10 text-amber-300"}`}>{technology.status}</span>
      </div>
      <div className="mt-4 flex items-center gap-3">
        <div className="h-1 flex-1 overflow-hidden rounded-full bg-white/[0.07]"><div className="h-full rounded-full bg-zinc-300" style={{ width: `${technology.confidence}%` }} /></div>
        <span className="font-mono text-xs text-zinc-400">{technology.confidence}%</span>
      </div>
      <p className="mt-3 text-xs leading-5 text-zinc-500">{technology.evidence}</p>
    </div>
  );
}

function ErrorCard({ error }: { error: Finding }) {
  const styles = {
    critical: "border-red-400/30 bg-red-400/[0.06] text-red-300",
    high: "border-orange-400/25 bg-orange-400/[0.05] text-orange-300",
    medium: "border-amber-400/20 bg-amber-400/[0.04] text-amber-300",
    low: "border-sky-400/20 bg-sky-400/[0.04] text-sky-300",
    info: "border-zinc-400/20 bg-zinc-400/[0.04] text-zinc-300",
  }[error.severity];
  return (
    <article className="rounded-xl border border-white/[0.08] bg-black/20 p-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2"><span className={`rounded-md border px-2 py-1 text-[10px] font-bold uppercase tracking-[0.16em] ${styles}`}>{error.severity}</span><span className="text-[10px] uppercase tracking-[0.16em] text-zinc-600">{error.category}</span></div>
        {typeof error.status === "number" && error.status > 0 && <span className="font-mono text-xs text-zinc-500">HTTP {error.status}</span>}
      </div>
      <h3 className="mt-4 text-sm font-semibold text-zinc-100">{error.title}</h3>
      <div className="mt-4 grid gap-3 text-xs sm:grid-cols-2">
        <div><p className="uppercase tracking-[0.16em] text-zinc-600">Location</p><p className="mt-1 break-words font-mono text-zinc-300">{error.location}</p></div>
        <div><p className="uppercase tracking-[0.16em] text-zinc-600">Evidence</p><p className="mt-1 break-words font-mono leading-5 text-zinc-400">{error.evidence}</p></div>
      </div>
      {error.element && <div className="mt-4 rounded-lg border border-white/[0.06] bg-black/30 p-3"><p className="mb-1 text-[10px] uppercase tracking-[0.16em] text-zinc-600">Element</p><code className="block break-all text-[11px] leading-5 text-zinc-500">{error.element}</code></div>}
    </article>
  );
}

function ScoreCard({ label, score, icon: Icon, detail, onClick }: { label: string; score: number; icon: typeof Gauge; detail: string; onClick?: () => void }) {
  const Wrapper = onClick ? "button" : "div";
  return <Wrapper type={onClick ? "button" : undefined} onClick={onClick} title={onClick ? "View the detected errors" : undefined} className={`w-full rounded-xl border border-white/[0.08] bg-black/20 p-4 text-left transition-colors ${onClick ? "hover:border-lime-300/30 hover:bg-lime-300/[0.03]" : ""}`}><div className="flex items-center justify-between"><div className="flex items-center gap-2 text-xs font-medium text-zinc-400"><Icon className={`h-4 w-4 ${onClick ? "text-amber-300" : "text-zinc-600"}`} />{label}</div><span className={`font-mono text-lg font-medium ${scoreTone(score)}`}>{score}</span></div><div className="mt-4 h-1 overflow-hidden rounded-full bg-white/[0.07]"><div className={`h-full rounded-full ${scoreBar(score)}`} style={{ width: `${score}%` }} /></div><p className="mt-3 text-[10px] uppercase tracking-[0.13em] text-zinc-600">{detail}</p></Wrapper>;
}

function ReportView({ report }: { report: AnalysisReport }) {
  const [filter, setFilter] = useState<SeverityFilter>("all");
  const filteredErrors = useMemo(() => filter === "all" ? report.errors : report.errors.filter((error) => error.severity === filter), [filter, report.errors]);
  const counts = severityOrder.slice(1).reduce<Record<string, number>>((acc, severity) => { acc[severity] = report.errors.filter((error) => error.severity === severity).length; return acc; }, {});
  const hostLabel = report.hostname.replace(/^www\./, "");
  return (
    <main className="mx-auto max-w-6xl px-5 pb-24 pt-8 sm:px-8 lg:px-10">
      <div className="flex flex-col gap-5 border-b border-white/[0.08] pb-7 sm:flex-row sm:items-end sm:justify-between">
        <div><p className="text-[10px] font-semibold uppercase tracking-[0.22em] text-zinc-600">Analysis report</p><h1 className="mt-2 break-all text-2xl font-semibold tracking-tight text-zinc-100 sm:text-3xl">{hostLabel}</h1><p className="mt-2 flex flex-wrap items-center gap-2 text-xs text-zinc-500"><span>Analyzed just now</span><span className="text-zinc-700">/</span><span>{(report.durationMs / 1000).toFixed(1)}s</span><span className="text-zinc-700">/</span><a className="inline-flex items-center gap-1 transition-colors hover:text-zinc-200" href={report.url} target="_blank" rel="noreferrer">Open site <ExternalLink className="h-3 w-3" /></a></p></div>
        <div className="flex items-center gap-3"><div className="score-ring" style={{ background: `conic-gradient(#d7f36b ${report.overallScore * 3.6}deg, rgba(255,255,255,.08) 0deg)` }}><div className="score-ring-inner"><span className={`text-2xl font-semibold ${scoreTone(report.overallScore)}`}>{report.overallScore}</span><span className="text-[10px] uppercase tracking-widest text-zinc-600">/ 100</span></div></div><div><p className="text-xs uppercase tracking-[0.18em] text-zinc-600">Quality score</p><p className={`mt-1 text-lg font-medium ${scoreTone(report.overallScore)}`}>{report.grade}</p></div></div>
      </div>

      <section className="border-b border-white/[0.08] py-8" id="overview"><div className="mb-5 flex items-center justify-between"><div><p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-zinc-600">Overview</p><h2 className="mt-1 text-xl font-semibold text-zinc-100">Signal, not noise.</h2></div><span className="font-mono text-xs text-zinc-600">{report.summary.requests} requests observed</span></div><div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3"><ScoreCard label="Performance" score={report.scores.performance} icon={Gauge} detail={`${report.performance.checks.length} live checks`} /><ScoreCard label="SEO" score={report.scores.seo} icon={Search} detail={`${report.seo.checks.length} live checks`} /><ScoreCard label="Security" score={report.scores.security} icon={ShieldCheck} detail={`${report.security.checks.length} header checks`} /><ScoreCard label="Accessibility" score={report.scores.accessibility} icon={Sparkles} detail={`${report.accessibility.checks.length} markup checks`} /><ScoreCard label="Best practices" score={report.scores.bestPractices} icon={Radar} detail="Weighted from measured categories" /><ScoreCard label="Errors" score={report.scores.errors} icon={AlertCircle} detail={`${report.summary.errors} issues found · click to inspect`} onClick={() => document.getElementById("errors")?.scrollIntoView({ behavior: "smooth" })} /></div><div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4"><div className="stat-cell"><span>Issues found</span><strong>{report.summary.errors}</strong></div><div className="stat-cell"><span>Warnings found</span><strong>{report.summary.warnings}</strong></div><div className="stat-cell"><span>Technologies detected</span><strong>{report.summary.technologies}</strong></div><div className="stat-cell"><span>HTML elements</span><strong>{report.summary.elements}</strong></div></div></section>

      <section className="border-b border-white/[0.08] py-10" id="technologies"><SectionHeader icon={Layers3} eyebrow="01 / detection" title="Technologies" description="Only signals visible in the public response are reported. Confidence shows how strong the evidence is." /><div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">{report.technologies.map((technology) => <TechnologyItem key={`${technology.category}-${technology.name}`} technology={technology} />)}</div>{!report.technologies.length && <EmptyState text="No technology markers were detected with enough confidence." />}</section>

      <section className="grid gap-10 border-b border-white/[0.08] py-10 lg:grid-cols-2" id="performance"><div><SectionHeader icon={Gauge} eyebrow="02 / speed" title="Performance" score={report.performance.score} description="Measured from the fetched document and its publicly referenced resources." /><div className="grid grid-cols-2 gap-3"><Metric label="Page size" value={formatBytes(report.performance.pageSize)} /><Metric label="Requests" value={String(report.performance.requests)} /><Metric label="Scripts" value={String(report.performance.scripts)} /><Metric label="Images" value={String(report.performance.images)} /></div></div><div className="lg:pt-14"><CheckList checks={report.performance.checks} /></div></section>

      <section className="grid gap-10 border-b border-white/[0.08] py-10 lg:grid-cols-2" id="seo"><div><SectionHeader icon={Search} eyebrow="03 / discoverability" title="SEO" score={report.seo.score} /></div><div><CheckList checks={report.seo.checks} /></div></section>
      <section className="grid gap-10 border-b border-white/[0.08] py-10 lg:grid-cols-2" id="security"><div><SectionHeader icon={LockKeyhole} eyebrow="04 / public headers" title="Security" score={report.security.score} description="Passive checks only. No exploitation, brute force, or destructive testing is performed." /></div><div><CheckList checks={report.security.checks} /></div></section>
      <section className="grid gap-10 border-b border-white/[0.08] py-10 lg:grid-cols-2" id="accessibility"><div><SectionHeader icon={Sparkles} eyebrow="05 / inclusive markup" title="Accessibility" score={report.accessibility.score} /></div><div><CheckList checks={report.accessibility.checks} /></div></section>

      <section className="border-b border-white/[0.08] py-10" id="structure"><SectionHeader icon={FileCode2} eyebrow="06 / document model" title="HTML structure" description="A compact view of the semantic elements observed in the fetched page." /><div className="grid gap-6 lg:grid-cols-[1fr_1.2fr]"><div className="rounded-xl border border-white/[0.08] bg-black/20 p-5"><div className="mb-4 flex items-center gap-2 text-xs uppercase tracking-[0.16em] text-zinc-600"><Code2 className="h-4 w-4" /> outline</div><pre className="overflow-x-auto font-mono text-xs leading-7 text-zinc-400">{report.structure.tree.join("\n")}</pre></div><div className="grid grid-cols-2 gap-3 sm:grid-cols-3"><Metric label="Elements" value={String(report.structure.counts.elements)} /><Metric label="Links" value={String(report.structure.counts.links)} /><Metric label="Images" value={String(report.structure.counts.images)} /><Metric label="Scripts" value={String(report.structure.counts.scripts)} /><Metric label="Stylesheets" value={String(report.structure.counts.stylesheets)} /><Metric label="Page size" value={formatBytes(report.performance.pageSize)} /></div></div></section>

      <section className="border-b border-white/[0.08] py-10" id="network"><SectionHeader icon={Network} eyebrow="07 / response" title="HTTP / network" /><div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4"><Metric label="Status" value={`${report.network.status} ${report.network.statusText}`} /><Metric label="Protocol" value={report.network.protocol} /><Metric label="Content type" value={report.network.contentType.split(";")[0]} /><Metric label="Compression" value={report.network.compression} /><Metric label="Server" value={report.network.server} /><Metric label="Response size" value={formatBytes(report.network.responseSize)} /><Metric label="Redirects" value={String(report.network.redirects.length)} /><Metric label="Final URL" value={report.network.finalUrl} /></div>{report.network.redirects.length > 0 && <div className="mt-4 rounded-xl border border-white/[0.08] bg-black/20 p-4 font-mono text-xs leading-6 text-zinc-500">{report.network.redirects.map((redirect) => <div key={redirect}>{redirect}</div>)}</div>}</section>

      <section className="py-10" id="errors"><SectionHeader icon={AlertCircle} eyebrow="08 / findings" title="Errors" description="Issues are sorted by severity and include the closest available location and evidence." /><div className="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-5">{severityOrder.slice(1).map((severity) => <button key={severity} className={`severity-summary ${filter === severity ? "severity-summary-active" : ""}`} onClick={() => setFilter(filter === severity ? "all" : severity)}><span className="capitalize">{severity}</span><strong>{counts[severity] || 0}</strong></button>)}</div><div className="mb-5 flex flex-wrap items-center gap-2"><span className="text-xs text-zinc-600">Show</span>{severityOrder.map((severity) => <button key={severity} onClick={() => setFilter(severity)} className={`rounded-full px-3 py-1.5 text-xs transition-colors ${filter === severity ? "bg-zinc-100 text-zinc-950" : "border border-white/10 text-zinc-500 hover:text-zinc-200"}`}>{severity === "all" ? `All (${report.errors.length})` : severity}</button>)}</div>{filteredErrors.length ? <div className="grid gap-3">{filteredErrors.map((error) => <ErrorCard key={error.id} error={error} />)}</div> : <EmptyState text={filter === "all" ? "No issues were found in the public signals collected." : `No ${filter} issues found.`} success />}</section>
    </main>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return <div className="metric-cell"><span>{label}</span><strong title={value}>{value}</strong></div>;
}

function EmptyState({ text, success }: { text: string; success?: boolean }) {
  return <div className="rounded-xl border border-dashed border-white/10 bg-black/10 p-8 text-center"><CheckCircle2 className={`mx-auto h-6 w-6 ${success ? "text-emerald-300" : "text-zinc-600"}`} /><p className="mx-auto mt-3 max-w-md text-sm leading-6 text-zinc-500">{text}</p></div>;
}

function LoadingState() {
  return <div className="mx-auto flex min-h-[60vh] max-w-2xl flex-col justify-center px-5 py-20 sm:px-8"><div className="mb-8 flex items-center gap-3"><div className="flex h-10 w-10 items-center justify-center rounded-xl border border-lime-300/20 bg-lime-300/10"><Loader2 className="h-5 w-5 animate-spin text-lime-300" /></div><div><p className="text-sm font-medium text-zinc-200">Analyzing website…</p><p className="mt-1 text-xs text-zinc-600">Collecting public signals without intrusive testing</p></div></div><div className="space-y-2">{loadingSteps.map((step, index) => <div className="loading-row" key={step}><span className={`flex h-5 w-5 items-center justify-center rounded-full border ${index < 3 ? "border-emerald-400/30 bg-emerald-400/10 text-emerald-300" : "border-white/10 text-zinc-600"}`}>{index < 3 ? <CheckCircle2 className="h-3 w-3" /> : <CircleDot className="h-3 w-3" />}</span><span>{step}</span><span className="ml-auto font-mono text-[10px] uppercase tracking-[0.16em] text-zinc-700">{index < 3 ? "done" : index === 3 ? "running" : "queued"}</span></div>)}</div></div>;
}

export default function Home() {
  const [url, setUrl] = useState("https://example.com");
  const [report, setReport] = useState<AnalysisReport | null>(null);
  const mutation = trpc.analyzer.analyze.useMutation({ onSuccess: (data) => setReport(data as AnalysisReport) });

  const submit = (event: FormEvent) => {
    event.preventDefault();
    if (!url.trim() || mutation.isPending) return;
    mutation.mutate({ url });
  };

  if (mutation.isPending) return <><TopBar onReset={() => undefined} /><LoadingState /></>;
  if (report) return <><TopBar onReset={() => { setReport(null); mutation.reset(); }} /><ReportView report={report} /></>;

  return <div className="min-h-screen"><TopBar onReset={() => undefined} /><main className="hero-shell"><div className="hero-copy"><div className="eyebrow-pill"><span className="eyebrow-dot" />Passive website intelligence</div><h1>Understand what<br /><span className="text-zinc-500">your site is doing.</span></h1><p>Analyze the public surface of any website. Detect its stack, inspect quality signals, and locate issues with evidence you can act on.</p></div><form onSubmit={submit} className="analyze-form"><div className="url-input-wrap"><Globe2 className="h-5 w-5 shrink-0 text-zinc-600" /><input aria-label="Website URL" value={url} onChange={(event) => setUrl(event.target.value)} placeholder="https://example.com" type="text" autoComplete="url" /><button type="submit" className="analyze-button"><span>Analyze</span><ArrowUpRight className="h-4 w-4" /></button></div><div className="form-note"><span><LockKeyhole className="h-3 w-3" />No account required</span><span><Radar className="h-3 w-3" />Public signals only</span><span><TerminalSquare className="h-3 w-3" />Free to try</span></div></form>{mutation.error && <div className="error-banner"><AlertCircle className="h-4 w-4 shrink-0" /><span>{mutation.error.message}</span><button onClick={() => mutation.reset()} aria-label="Dismiss error">×</button></div>}<div className="home-grid"><div className="home-grid-label"><span>What you get</span><span className="hidden sm:block">01 — 05</span></div><div className="capability-grid"><Capability icon={Layers3} title="Technology detection" description="Evidence-backed stack signals." /><Capability icon={Gauge} title="Quality scores" description="Performance, SEO, security." /><Capability icon={AlertCircle} title="Errors with location" description="Severity, element and proof." /><Capability icon={Network} title="Network context" description="Headers, redirects, response." /><Capability icon={Sparkles} title="Accessibility" description="Markup issues that matter." /></div></div><div className="hero-foot"><span>Built for developers</span><span className="h-px flex-1 bg-white/[0.08]" /><span>Quality Analyzer / 01</span></div></main></div>;
}

function TopBar({ onReset }: { onReset: () => void }) {
  return <header className="topbar"><button onClick={onReset} className="brand-mark" aria-label="Quality Analyzer home"><span className="brand-square">Q</span><span>Quality <em>Analyzer</em></span></button><nav className="topnav"><button className="topnav-active" onClick={onReset}>Analyze</button></nav><div className="topbar-status"><span className="status-pulse" />Passive mode</div></header>;
}

function Capability({ icon: Icon, title, description }: { icon: typeof Gauge; title: string; description: string }) {
  return <div className="capability"><Icon className="h-4 w-4 text-zinc-500" /><div><p>{title}</p><span>{description}</span></div></div>;
}
