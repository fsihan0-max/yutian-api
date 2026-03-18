import { readSource, writeSource } from "./storage.js";

const RISK_SOURCE_KEY = "agri_risk_source_v2";
const DEFAULT_DAYS = 7;

function dateKey(iso) {
  const d = new Date(iso || Date.now());
  const p = (n) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

function buildTownDistribution(cases) {
  const map = new Map();
  cases.forEach((item) => {
    const value = Number(item.recognizedAreaMu || 0);
    map.set(item.town, (map.get(item.town) || 0) + value);
  });
  return Array.from(map.entries())
    .map(([town, area]) => ({ town, area: Number(area.toFixed(2)) }))
    .sort((a, b) => b.area - a.area);
}

function buildTypeDistribution(cases) {
  const map = new Map();
  cases.forEach((item) => {
    const key = item.disasterType || "\u5f85\u5224\u5b9a";
    map.set(key, (map.get(key) || 0) + 1);
  });
  return Array.from(map.entries())
    .map(([label, value]) => ({ label, value }))
    .sort((a, b) => b.value - a.value);
}

function buildHighRiskCases(cases) {
  return cases
    .filter((item) => Number(item.riskScore || 0) >= 0.7 && item.status !== window.AppConfig.caseStatus.closed)
    .sort((a, b) => Number(b.riskScore || 0) - Number(a.riskScore || 0))
    .slice(0, 5);
}

function buildDailyTrend(cases, days = DEFAULT_DAYS) {
  const today = new Date();
  const labels = [];
  const values = [];

  for (let i = days - 1; i >= 0; i -= 1) {
    const d = new Date(today);
    d.setDate(today.getDate() - i);
    labels.push(dateKey(d.toISOString()));
  }

  labels.forEach((label) => {
    const count = cases.filter((item) => dateKey(item.updatedAt || item.createdAt) === label).length;
    values.push(count);
  });

  return { labels, values };
}

export function syncRiskSource({ cases, disputes }) {
  const townDistribution = buildTownDistribution(cases);
  const typeDistribution = buildTypeDistribution(cases);
  const highRiskCases = buildHighRiskCases(cases);
  const trend = buildDailyTrend(cases, 7);

  const pendingReview = cases.filter((item) => item.status === window.AppConfig.caseStatus.pendingReview).length;
  const newToday = cases.filter((item) => dateKey(item.createdAt) === dateKey(new Date().toISOString())).length;
  const disputeCount = disputes.filter((item) => item.status !== "\u5df2\u89e3\u51b3").length;

  const snapshot = {
    generatedAt: new Date().toISOString(),
    metrics: [
      { label: "\u4eca\u65e5\u62a5\u6848", value: String(newToday) },
      { label: "\u5f85\u590d\u6838", value: String(pendingReview) },
      { label: "\u9ad8\u98ce\u9669", value: String(highRiskCases.length) },
      { label: "\u4e89\u8bae\u6848\u4ef6", value: String(disputeCount) }
    ],
    townDistribution,
    typeDistribution,
    highRiskCases,
    trend,
    regionTrends: [
      {
        title: "\u4e61\u9547\u5206\u5e03",
        detail: townDistribution.length
          ? townDistribution.map((item) => `${item.town} ${item.area}\u4ea9`).join("\uff1b")
          : "\u6682\u65e0\u4e61\u9547\u7edf\u8ba1\u3002"
      },
      {
        title: "\u7c7b\u578b\u5360\u6bd4",
        detail: typeDistribution.length
          ? typeDistribution.map((item) => `${item.label} ${item.value}\u4ef6`).join("\uff1b")
          : "\u6682\u65e0\u7c7b\u578b\u7edf\u8ba1\u3002"
      },
      {
        title: "\u8fd1 7 \u5929\u8d8b\u52bf",
        detail: trend.labels.map((label, i) => `${label}:${trend.values[i]}`).join(" | ")
      }
    ],
    dispatchTasks: highRiskCases.length
      ? highRiskCases.map((item) => ({
        title: item.id,
        detail: `${item.town}/${item.village} \u98ce\u9669\u5206 ${Number(item.riskScore || 0).toFixed(2)}\uff0c\u72b6\u6001 ${item.status}`
      }))
      : [{ title: "\u6682\u65e0\u9ad8\u98ce\u9669\u6848\u4ef6", detail: "\u5f53\u524d\u65e0\u9700\u7d27\u6025\u8c03\u5ea6\u3002" }]
  };

  writeSource(RISK_SOURCE_KEY, snapshot);
  return snapshot;
}

export function loadRiskSource() {
  return readSource(RISK_SOURCE_KEY, null);
}

