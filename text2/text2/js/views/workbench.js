import { WORKBENCH_TITLES, QUICK_ROUTE_BY_ROLE } from "../store/global.js";
import { listHtml } from "./utils.js";

export function renderWorkbench(state, onQuickRoute) {
  const data = window.AppData.workbenchByRole[state.user.role];
  const titleMeta = WORKBENCH_TITLES[state.user.role] || WORKBENCH_TITLES.surveyor;

  document.getElementById("workbenchTodoTitle").textContent = titleMeta.todo;
  document.getElementById("workbenchRecentTitle").textContent = titleMeta.recent;

  document.getElementById("workbenchMetrics").innerHTML = data.metrics
    .map((item) => `<div class="metric-card"><span>${item.label}</span><strong>${item.value}</strong></div>`)
    .join("");

  document.getElementById("todoList").innerHTML = listHtml(data.todos);
  document.getElementById("warningList").innerHTML = listHtml(data.warnings);

  const recentHtml = window.AppData.cases.slice(0, 5)
    .map((item) => `<tr><td>${item.id}</td><td>${item.town}</td><td>${item.crop}</td><td>${item.status}</td></tr>`)
    .join("");
  document.getElementById("recentCaseRows").innerHTML = recentHtml || `<tr><td colspan="4">暂无数据</td></tr>`;

  const routes = QUICK_ROUTE_BY_ROLE[state.user.role] || [];
  const quickContainer = document.getElementById("quickActions");
  quickContainer.innerHTML = data.quickActions
    .map((text, index) => `<button class="btn quick-btn" type="button" data-route="${routes[index] || "workbench"}">${text}</button>`)
    .join("");

  quickContainer.querySelectorAll("[data-route]").forEach((button) => {
    button.addEventListener("click", () => onQuickRoute(button.dataset.route));
  });
}
