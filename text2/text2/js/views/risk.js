import { listHtml } from "./utils.js";

export function renderRiskCenter(state) {
  document.getElementById("riskMetrics").innerHTML = window.AppData.riskMetrics
    .map((item) => `<div class="metric-card"><span>${item.label}</span><strong>${item.value}</strong></div>`)
    .join("");

  document.getElementById("regionTrendList").innerHTML = listHtml(window.AppData.regionTrends);
  document.getElementById("dispatchList").innerHTML = listHtml(window.AppData.dispatchTasks);

  const areaCanvas = document.getElementById("riskAreaChart").getContext("2d");
  const typeCanvas = document.getElementById("riskTypeChart").getContext("2d");

  if (state.charts.area) state.charts.area.destroy();
  if (state.charts.type) state.charts.type.destroy();

  state.charts.area = new Chart(areaCanvas, {
    type: "bar",
    data: {
      labels: ["城关镇", "柳泉镇", "河湾镇", "北关镇"],
      datasets: [{
        label: "受灾面积(亩)",
        data: [48.1, 35.6, 27.4, 12.5],
        backgroundColor: ["#265f4a", "#36745b", "#4f8b6d", "#7ea678"],
        borderRadius: 8
      }]
    },
    options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false } } }
  });

  state.charts.type = new Chart(typeCanvas, {
    type: "doughnut",
    data: {
      labels: ["病虫害", "物理倒伏", "正常收割", "非农地物"],
      datasets: [{ data: [41, 33, 18, 8], backgroundColor: ["#2d6a4f", "#d07a36", "#8f9b5a", "#5b6770"] }]
    },
    options: { responsive: true, maintainAspectRatio: false }
  });
}
