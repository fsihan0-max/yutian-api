import { listHtml, formatNow, escapeHtml } from "./utils.js";

export function renderReportCenter(state) {
  const logs = state.reportLogs.length ? state.reportLogs : [{ title: "暂无记录", detail: "请先执行报告操作。" }];
  document.getElementById("reportLogList").innerHTML = listHtml(logs);
  document.getElementById("evidenceList").innerHTML = listHtml(window.AppData.evidenceTemplate);
}

export function addReportLog(state, title, detail) {
  state.reportLogs.unshift({ title, detail });
  renderReportCenter(state);
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
  const reportName = type === "archive" ? "归档报告" : "农户告知报告";
  const selected = state.selectedCase;
  if (!selected) {
    return {
      title: reportName,
      html: `<div class="report-line"><strong>暂无选中案件</strong><p>请先到案件中心选择案件后再生成报告。</p></div>`
    };
  }

  const finalResult = state.currentAnalysis?.final_result;
  const evidenceCount = state.evidence.length;
  const imageCount = state.evidence.filter((item) => item.thumbnail).length;
  const evidenceText = evidenceCount ? `${evidenceCount} 条外业证据，含 ${imageCount} 张照片。` : "暂无外业照片。";

  const lines = [
    ["报告类型", reportName],
    ["生成时间", formatNow()],
    ["案件编号", selected.id],
    ["地块位置", `${selected.town}${selected.village}`],
    ["案件状态", selected.status],
    ["灾损类型", selected.disasterType],
    ["案件摘要", selected.result],
    ["模型判定", finalResult ? `${finalResult.label} (${Math.round(finalResult.confidence * 100)}%)` : "暂无分析结果"],
    ["证据说明", evidenceText]
  ];

  const html = lines
    .map(([label, value]) => `<div class="report-line"><strong>${escapeHtml(label)}</strong><p>${escapeHtml(value)}</p></div>`)
    .join("");

  return { title: reportName, html };
}
