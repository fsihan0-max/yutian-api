import { listHtml } from "./utils.js";

export function renderWorkbench(state, onQuickRoute, data) {
  const payload = data || state.workbench || {
    metrics: [],
    todos: [],
    warnings: [],
    recentCases: [],
    quickActions: []
  };

  document.getElementById("workbenchTodoTitle").textContent = "\u6211\u7684\u5f85\u529e";
  document.getElementById("workbenchRecentTitle").textContent = "\u6700\u8fd1\u66f4\u65b0\u6848\u4ef6";

  document.getElementById("workbenchMetrics").innerHTML = payload.metrics
    .map((item) => `<div class="metric-card"><span>${item.label}</span><strong>${item.value}</strong></div>`)
    .join("");

  document.getElementById("todoList").innerHTML = listHtml(payload.todos);
  document.getElementById("warningList").innerHTML = listHtml(payload.warnings);

  const recentHtml = (payload.recentCases || [])
    .map((item) => `<tr><td>${item.id}</td><td>${item.town}</td><td>${item.crop}</td><td>${item.status}</td></tr>`)
    .join("");
  document.getElementById("recentCaseRows").innerHTML = recentHtml || `<tr><td colspan="4">\u6682\u65e0\u6570\u636e</td></tr>`;

  const quickContainer = document.getElementById("quickActions");
  quickContainer.innerHTML = payload.quickActions
    .map((item) => `<button class="btn quick-btn" type="button" data-route="${item.route || "workbench"}">${item.text}</button>`)
    .join("");

  quickContainer.querySelectorAll("[data-route]").forEach((button) => {
    button.addEventListener("click", () => onQuickRoute(button.dataset.route));
  });
}
