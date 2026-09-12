import { jsPDF } from "jspdf";
import type { AnalysisReport, Check, Finding, Technology } from "../../../server/analyzer";

const GREEN = "#d7f36b";
const MUTED = "#64748b";
const DARK = "#0a0a0a";

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

function safeText(value: string | number | undefined, fallback = "—") {
  return value === undefined || value === "" ? fallback : String(value);
}

function addWrapped(doc: jsPDF, text: string, x: number, y: number, width: number, lineHeight = 5) {
  const lines = doc.splitTextToSize(text, width) as string[];
  doc.text(lines, x, y);
  return y + lines.length * lineHeight;
}

function addSectionTitle(doc: jsPDF, title: string, y: number) {
  doc.setDrawColor(215, 243, 107);
  doc.setLineWidth(0.6);
  doc.line(18, y - 5, 192, y - 5);
  doc.setTextColor(DARK);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(13);
  doc.text(title, 18, y);
  return y + 8;
}

function addCheckList(doc: jsPDF, checks: Check[], y: number) {
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  for (const check of checks) {
    if (y > 274) {
      doc.addPage();
      y = 20;
    }
    doc.setTextColor(check.status === "pass" ? "#16803c" : check.status === "fail" ? "#b42318" : "#9a6700");
    doc.setFont("helvetica", "bold");
    doc.text(`[${check.status.toUpperCase()}]`, 20, y);
    doc.setTextColor(DARK);
    doc.setFont("helvetica", "bold");
    doc.text(check.label, 43, y);
    y += 4;
    doc.setFont("helvetica", "normal");
    y = addWrapped(doc, check.detail, 43, y, 145, 4.2) + 3;
  }
  return y;
}

function addFindingList(doc: jsPDF, findings: Finding[], y: number) {
  doc.setFontSize(9);
  for (const finding of findings) {
    if (y > 265) {
      doc.addPage();
      y = 20;
    }
    doc.setTextColor(DARK);
    doc.setFont("helvetica", "bold");
    y = addWrapped(doc, `${finding.severity.toUpperCase()} · ${finding.title}`, 20, y, 170, 4.5) + 1;
    doc.setFont("helvetica", "normal");
    doc.setTextColor(MUTED);
    y = addWrapped(doc, `${finding.category} · ${finding.location}`, 20, y, 170, 4.5) + 1;
    y = addWrapped(doc, `Evidence: ${finding.evidence}`, 20, y, 170, 4.5) + 5;
  }
  return y;
}

export async function downloadReportPdf(report: AnalysisReport) {
  const doc = new jsPDF({ unit: "mm", format: "a4" });
  const host = report.hostname.replace(/^www\./, "");
  const icon = await loadSiteIcon(host);

  doc.setFillColor(DARK);
  doc.rect(0, 0, 210, 297, "F");
  doc.setFillColor(215, 243, 107);
  doc.rect(0, 0, 210, 7, "F");

  if (icon) {
    try {
      doc.addImage(icon, "PNG", 18, 22, 18, 18);
    } catch {
      doc.setFillColor(215, 243, 107);
      doc.circle(27, 31, 9, "F");
    }
  } else {
    doc.setFillColor(215, 243, 107);
    doc.circle(27, 31, 9, "F");
  }

  doc.setTextColor("#ffffff");
  doc.setFont("helvetica", "bold");
  doc.setFontSize(24);
  doc.text("Quality Analyzer", 45, 31);
  doc.setFontSize(12);
  doc.setTextColor(GREEN);
  doc.text(host, 45, 39);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.setTextColor("#cbd5e1");
  doc.text("Passive website intelligence report", 18, 62);
  doc.text(`Analyzed: ${new Date(report.analyzedAt).toLocaleString()}`, 18, 69);
  doc.text("Created by Yurihbo", 18, 83);

  doc.setFillColor("#111827");
  doc.roundedRect(18, 96, 174, 38, 4, 4, "F");
  doc.setTextColor(GREEN);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(28);
  doc.text(String(report.overallScore), 28, 121);
  doc.setFontSize(9);
  doc.setTextColor("#cbd5e1");
  doc.text("OVERALL SCORE / 100", 61, 111);
  doc.setTextColor("#ffffff");
  doc.setFontSize(15);
  doc.text(report.grade, 61, 124);
  doc.setFontSize(9);
  doc.setTextColor("#cbd5e1");
  doc.text(`${report.summary.errors} errors · ${report.summary.warnings} warnings · ${report.summary.technologies} technologies`, 112, 119);

  let y = 154;
  y = addSectionTitle(doc, "Score overview", y);
  doc.setTextColor(DARK);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  const scoreRows = [
    ["Performance", report.scores.performance],
    ["SEO", report.scores.seo],
    ["Security", report.scores.security],
    ["Accessibility", report.scores.accessibility],
    ["Best practices", report.scores.bestPractices],
    ["Errors", report.scores.errors],
  ];
  for (const [label, score] of scoreRows) {
    doc.setFont("helvetica", "bold");
    doc.text(String(label), 22, y);
    doc.setFont("helvetica", "normal");
    doc.text(String(score), 172, y);
    doc.setDrawColor(226, 232, 240);
    doc.line(22, y + 2, 178, y + 2);
    y += 8;
  }

  doc.addPage();
  y = 22;
  y = addSectionTitle(doc, "Performance checks", y);
  y = addCheckList(doc, report.performance.checks, y);
  y += 5;
  y = addSectionTitle(doc, "SEO checks", y);
  y = addCheckList(doc, report.seo.checks, y);
  y += 5;
  y = addSectionTitle(doc, "Security checks", y);
  y = addCheckList(doc, report.security.checks, y);

  doc.addPage();
  y = 22;
  y = addSectionTitle(doc, "Detected technologies", y);
  doc.setFontSize(9);
  for (const technology of report.technologies as Technology[]) {
    if (y > 270) { doc.addPage(); y = 22; }
    doc.setTextColor(DARK);
    doc.setFont("helvetica", "bold");
    doc.text(`${technology.name} · ${technology.category}`, 20, y);
    doc.setFont("helvetica", "normal");
    doc.setTextColor(MUTED);
    y = addWrapped(doc, `${technology.status} (${technology.confidence}%) — ${technology.evidence}`, 20, y + 4, 170, 4.5) + 6;
  }
  y += 4;
  y = addSectionTitle(doc, "Findings and evidence", y);
  if (report.errors.length) addFindingList(doc, report.errors, y);
  else {
    doc.setTextColor(MUTED);
    doc.setFontSize(10);
    doc.text("No issues were found in the collected public signals.", 20, y);
  }

  doc.addPage();
  y = 22;
  y = addSectionTitle(doc, "Network context", y);
  doc.setFontSize(9);
  doc.setTextColor(DARK);
  const networkRows = [
    ["Status", `${report.network.status} ${report.network.statusText}`],
    ["Protocol", report.network.protocol],
    ["Content type", report.network.contentType],
    ["Compression", report.network.compression],
    ["Server", report.network.server],
    ["Response size", `${report.network.responseSize} bytes`],
    ["Final URL", report.network.finalUrl],
  ];
  for (const [label, value] of networkRows) {
    doc.setFont("helvetica", "bold");
    doc.text(label, 20, y);
    doc.setFont("helvetica", "normal");
    y = addWrapped(doc, safeText(value), 65, y, 125, 4.5) + 7;
  }
  y += 5;
  y = addSectionTitle(doc, "Document structure", y);
  doc.setFont("courier", "normal");
  doc.setFontSize(8);
  doc.setTextColor(MUTED);
  y = addWrapped(doc, report.structure.tree.join("\n"), 20, y, 170, 4) + 8;
  doc.setTextColor("#94a3b8");
  doc.setFont("helvetica", "normal");
  doc.setFontSize(8);
  doc.text("Quality Analyzer · Created by Yurihbo", 18, 288);

  doc.save(`quality-analyzer-${host.replace(/[^a-z0-9]+/gi, "-")}.pdf`);
}
