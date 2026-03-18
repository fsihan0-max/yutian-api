import { listHtml, formatNow, escapeHtml } from "./utils.js";

export function renderReportCenter(state, source) {
  const records = (source && source.records) || [];
  const logs = records.length
    ? records.map((item) => ({
      title: `${item.title} - ${item.caseId || "\u672a\u7ed1\u5b9a\u6848\u4ef6"}`,
      detail: `${item.detail} (${formatDisplayTime(item.createdAt)})`
    }))
    : [{ title: "\u6682\u65e0\u8bb0\u5f55", detail: "\u8bf7\u5148\u6267\u884c\u62a5\u544a\u64cd\u4f5c\u3002" }];

  document.getElementById("reportLogList").innerHTML = listHtml(logs);
  document.getElementById("evidenceList").innerHTML = listHtml((source && source.evidenceTemplate) || []);
}

export function openReportModal(state, type) {
  state.reportType = type;
  const preview = buildReportPreview(state, type);
  document.getElementById("reportModalTitle").textContent = preview.title;
  document.getElementById("reportPreviewContent").innerHTML = preview.html;
  document.getElementById("reportModal").classList.remove("hidden");
}

export function closeReportModal() {
  document.getElementById("reportModal").classList.add("hidden");
}

export function printReport(state) {
  const modal = document.getElementById("reportModal");
  if (modal.classList.contains("hidden")) {
    openReportModal(state, state.reportType || "archive");
  }
  document.body.classList.add("print-report-mode");
  window.print();
  setTimeout(() => document.body.classList.remove("print-report-mode"), 300);
}

function buildReportPreview(state, type) {
  const reportName = type === "archive" ? "\u5f52\u6863\u62a5\u544a" : "\u519c\u6237\u62a5\u544a";
  const selected = state.selectedCase;
  if (!selected) {
    return {
      title: reportName,
      html: `<div class="report-line"><strong>\u6682\u65e0\u9009\u4e2d\u6848\u4ef6</strong><p>\u8bf7\u5148\u9009\u62e9\u6848\u4ef6\u3002</p></div>`
    };
  }

  const finalResult = state.currentAnalysis?.final_result;
  const evidenceCount = state.evidence.length;
  const imageCount = state.evidence.filter((item) => item.thumbnail).length;
  const evidenceText = evidenceCount ? `${evidenceCount} \u6761\u8bb0\u5f55\uff0c${imageCount} \u5f20\u7167\u7247` : "\u6682\u65e0\u5916\u4e1a\u7167\u7247";

  const lines = [
    ["\u62a5\u544a\u7c7b\u578b", reportName],
    ["\u751f\u6210\u65f6\u95f4", formatNow()],
    ["\u6848\u4ef6\u7f16\u53f7", selected.id],
    ["\u4f4d\u7f6e", `${selected.town}/${selected.village}`],
    ["\u72b6\u6001", selected.status],
    ["\u707e\u635f\u7c7b\u578b", selected.disasterType],
    ["\u6848\u4ef6\u6458\u8981", selected.result],
    ["\u8bc6\u522b\u9762\u79ef", `${Number(selected.recognizedAreaMu || 0).toFixed(2)} \u4ea9`],
    ["\u6a21\u578b\u7ed3\u679c", finalResult ? `${finalResult.label} (${Math.round(finalResult.confidence * 100)}%)` : "\u6682\u65e0\u5206\u6790\u7ed3\u679c"],
    ["\u8bc1\u636e", evidenceText]
  ];

  const html = lines
    .map(([label, value]) => `<div class="report-line"><strong>${escapeHtml(label)}</strong><p>${escapeHtml(value)}</p></div>`)
    .join("");

  return { title: reportName, html };
}

function formatDisplayTime(value) {
  if (!value) return formatNow();
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return formatNow();
  const p = (n) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}`;
}
