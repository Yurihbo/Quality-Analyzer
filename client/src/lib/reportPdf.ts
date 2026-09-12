import { jsPDF } from "jspdf";
import type { AnalysisReport, Check, Finding } from "../../../server/analyzer";

const GREEN = "#d7f36b";
const DARK = "#0a0a0a";
const INK = "#111827";
const MUTED = "#64748b";

async function loadSiteIcon(hostname: string): Promise<string | null> {
  const url = `https://www.google.com/s2/favicons?domain=${encodeURIComponent(hostname)}&sz=128`;
  try {
    const response = await fetch(url, { mode: "cors" });
    if (!response.ok) return null;
    const blob = await response.blob();
    return await new Promise((resolve) => {
      const reader = new FileReader();
      reader.onload = () => resolve(typeof reader.result === "string" ? reader.result : null);
      reader.onerror = () => resolve(null);
      reader.readAsDataURL(blob);
    });
  } catch {
    return null;
  }
}

function wrap(doc: jsPDF, text: string, width: number) {
  return doc.splitTextToSize(text, width) as string[];
}

function compactCheck(check: Check) {
  return `[${check.status.toUpperCase()}] ${check.label}: ${check.detail}`;
}

function allChecks(report: AnalysisReport) {
  return [
    ...report.performance.checks,
    ...report.seo.checks,
    ...report.security.checks,
    ...report.accessibility.checks,
  ];
}

function addFooter(doc: jsPDF, page: number, total: number) {
  doc.setFont("helvetica", "normal");
  doc.setFontSize(8);
  doc.setTextColor("#94a3b8");
  doc.text("Quality Analyzer · Created by Yurihbo", 18, 287);
  doc.text(`${page} / ${total}`, 190, 287, { align: "right" });
}

function addDetailLine(doc: jsPDF, text: string, y: number, color = MUTED) {
  doc.setFont("helvetica", "normal");
  doc.setFontSize(8.5);
  doc.setTextColor(color);
  const lines = wrap(doc, text, 174);
  doc.text(lines, 18, y);
  return y + lines.length * 4.1 + 2.2;
}

export async function downloadReportPdf(report: AnalysisReport) {
  const doc = new jsPDF({ unit: "mm", format: "a4" });
  const host = report.hostname.replace(/^www\./, "");
  const icon = await loadSiteIcon(host);

  // Page 1: clean cover and decision-ready overview.
  doc.setFillColor(DARK);
  doc.rect(0, 0, 210, 297, "F");
  doc.setFillColor(215, 243, 107);
  doc.rect(0, 0, 210, 6, "F");

  if (icon) {
    try {
      doc.addImage(icon, "PNG", 18, 22, 20, 20);
    } catch {
      doc.setFillColor(215, 243, 107);
      doc.circle(28, 32, 10, "F");
    }
  } else {
    doc.setFillColor(215, 243, 107);
    doc.circle(28, 32, 10, "F");
  }

  doc.setTextColor("#ffffff");
  doc.setFont("helvetica", "bold");
  doc.setFontSize(24);
  doc.text("Quality Analyzer", 48, 32);
  doc.setTextColor(GREEN);
  doc.setFontSize(12);
  doc.text(host, 48, 41);

  doc.setTextColor("#cbd5e1");
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.text("Passive website analysis report", 18, 65);
  doc.text(`Analyzed ${new Date(report.analyzedAt).toLocaleString()}`, 18, 72);
  doc.setTextColor(GREEN);
  doc.setFont("helvetica", "bold");
  doc.text("Created by Yurihbo", 18, 84);

  doc.setFillColor("#111827");
  doc.roundedRect(18, 103, 174, 48, 4, 4, "F");
  doc.setTextColor(GREEN);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(32);
  doc.text(String(report.overallScore), 29, 135);
  doc.setFontSize(9);
  doc.setTextColor("#cbd5e1");
  doc.text("OVERALL SCORE / 100", 72, 118);
  doc.setTextColor("#ffffff");
  doc.setFontSize(17);
  doc.text(report.grade, 72, 134);

  doc.setTextColor(GREEN);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(10);
  doc.text("Analyzed website", 18, 174);
  doc.setTextColor("#ffffff");
  doc.setFontSize(15);
  doc.text(wrap(doc, report.url, 174), 18, 184);

  doc.setTextColor("#cbd5e1");
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.text(`${report.summary.errors} errors  ·  ${report.summary.warnings} warnings  ·  ${report.summary.technologies} technologies  ·  ${report.summary.requests} requests`, 18, 204);

  doc.setTextColor(GREEN);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(11);
  doc.text("Score overview", 18, 232);
  const scores: Array<[string, number]> = [
    ["Performance", report.scores.performance],
    ["SEO", report.scores.seo],
    ["Security", report.scores.security],
    ["Accessibility", report.scores.accessibility],
    ["Best practices", report.scores.bestPractices],
    ["Errors", report.scores.errors],
  ];
  let y = 242;
  for (const [label, score] of scores) {
    doc.setTextColor("#ffffff");
    doc.setFont("helvetica", "normal");
    doc.setFontSize(9);
    doc.text(label, 18, y);
    doc.setTextColor(GREEN);
    doc.setFont("helvetica", "bold");
    doc.text(String(score), 190, y, { align: "right" });
    doc.setDrawColor("#334155");
    doc.line(18, y + 3, 190, y + 3);
    y += 7;
  }
  addFooter(doc, 1, 2);

  // Page 2: compact evidence, without forcing one page per section.
  doc.addPage();
  doc.setFillColor("#ffffff");
  doc.rect(0, 0, 210, 297, "F");
  doc.setFillColor(DARK);
  doc.rect(0, 0, 210, 25, "F");
  doc.setTextColor("#ffffff");
  doc.setFont("helvetica", "bold");
  doc.setFontSize(14);
  doc.text("Analysis details", 18, 16);
  doc.setTextColor(GREEN);
  doc.setFontSize(9);
  doc.text(host, 190, 16, { align: "right" });

  y = 38;
  doc.setTextColor(INK);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(12);
  doc.text("Signals and checks", 18, y);
  y += 8;
  const checks = allChecks(report).filter((check) => check.status !== "pass");
  if (!checks.length) {
    y = addDetailLine(doc, "All collected checks passed without warnings.", y, "#16803c");
  } else {
    for (const check of checks.slice(0, 22)) {
      const color = check.status === "fail" ? "#b42318" : check.status === "warn" ? "#9a6700" : MUTED;
      y = addDetailLine(doc, compactCheck(check), y, color);
    }
  }

  y += 4;
  doc.setTextColor(INK);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(12);
  doc.text("Technologies", 18, y);
  y += 8;
  const technologyText = report.technologies.length
    ? report.technologies.map((item) => `${item.name} (${item.category}, ${item.confidence}%)`).join(" · ")
    : "No technology markers detected.";
  y = addDetailLine(doc, technologyText, y);

  y += 4;
  doc.setTextColor(INK);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(12);
  doc.text("Findings and evidence", 18, y);
  y += 8;
  if (report.errors.length) {
    for (const finding of report.errors.slice(0, 14) as Finding[]) {
      const color = finding.severity === "critical" || finding.severity === "high" ? "#b42318" : MUTED;
      y = addDetailLine(doc, `${finding.severity.toUpperCase()} · ${finding.title} · ${finding.location} — ${finding.evidence}`, y, color);
      if (y > 245) break;
    }
  } else {
    y = addDetailLine(doc, "No issues were found in the collected public signals.", y, "#16803c");
  }

  if (y < 245) {
    y += 4;
    doc.setTextColor(INK);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(12);
    doc.text("Network context", 18, y);
    y += 8;
    y = addDetailLine(doc, `${report.network.status} ${report.network.statusText} · ${report.network.protocol} · ${report.network.contentType.split(";")[0]} · ${report.network.compression}`, y);
    y = addDetailLine(doc, `Server: ${report.network.server || "—"} · Response: ${report.network.responseSize} bytes`, y);
    y = addDetailLine(doc, `Final URL: ${report.network.finalUrl}`, y);
  }

  addFooter(doc, 2, 2);
  doc.save(`quality-analyzer-${host.replace(/[^a-z0-9]+/gi, "-")}.pdf`);
}
