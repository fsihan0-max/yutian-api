import { listHtml } from "./utils.js";

export function renderRiskCenter(state, snapshot) {
  const source = snapshot || state.riskSnapshot || {
    metrics: [],
    townDistribution: [],
    typeDistribution: [],
    regionTrends: [],
    dispatchTasks: []
  };

  document.getElementById("riskMetrics").innerHTML = source.metrics
    .map((item) => `<div class="metric-card"><span>${item.label}</span><strong>${item.value}</strong></div>`)
    .join("");

  const highRiskRows = (source.dispatchTasks || []).slice(0, 5);
  document.getElementById("regionTrendList").innerHTML = listHtml(source.regionTrends || []);
  document.getElementById("dispatchList").innerHTML = listHtml(highRiskRows);

  const areaCanvas = document.getElementById("riskAreaChart").getContext("2d");
  const typeCanvas = document.getElementById("riskTypeChart").getContext("2d");

  if (state.charts.area) state.charts.area.destroy();
  if (state.charts.type) state.charts.type.destroy();

  state.charts.area = new Chart(areaCanvas, {
    type: "bar",
    data: {
      labels: (source.townDistribution || []).map((item) => item.town),
      datasets: [{
        label: "\u53d7\u707e\u9762\u79ef(\u4ea9)",
        data: (source.townDistribution || []).map((item) => item.area),
        backgroundColor: ["#265f4a", "#36745b", "#4f8b6d", "#7ea678", "#b0c19f"],
        borderRadius: 8
      }]
    },
    options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false } } }
  });

  state.charts.type = new Chart(typeCanvas, {
    type: "doughnut",
    data: {
      labels: (source.typeDistribution || []).map((item) => item.label),
      datasets: [{
        data: (source.typeDistribution || []).map((item) => item.value),
        backgroundColor: ["#2d6a4f", "#d07a36", "#8f9b5a", "#5b6770", "#5c8ba3", "#93a8ac"]
      }]
    },
    options: { responsive: true, maintainAspectRatio: false }
  });
}
