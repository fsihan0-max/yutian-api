import { readSource, writeSource } from "./storage.js";

const WORKBENCH_SOURCE_KEY = "agri_workbench_source_v2";

const QUICK_ACTIONS = {
  surveyor: [
    { text: "\u5f00\u59cb\u67e5\u52d8", route: "survey" },
    { text: "\u6267\u884c\u5206\u6790", route: "survey" },
    { text: "\u8fdb\u5165\u6848\u4ef6\u4e2d\u5fc3", route: "cases" },
    { text: "\u67e5\u770b\u5f85\u529e", route: "workbench" }
  ],
  reviewer: [
    { text: "\u5f85\u590d\u6838\u6848\u4ef6", route: "cases" },
    { text: "\u63d0\u4ea4\u590d\u6838", route: "cases" },
    { text: "\u751f\u6210\u62a5\u544a", route: "reports" },
    { text: "\u5bfc\u51fa PDF", route: "reports" }
  ],
  admin: [
    { text: "\u98ce\u9669\u76d1\u7ba1", route: "risk" },
    { text: "\u8d44\u6e90\u8c03\u5ea6", route: "risk" },
    { text: "\u6570\u636e\u4e2d\u5fc3", route: "data" },
    { text: "\u7cfb\u7edf\u8bbe\u7f6e", route: "settings" }
  ]
};

function isSameDay(isoText) {
  const source = new Date(isoText || 0);
  const now = new Date();
  return source.getFullYear() === now.getFullYear()
    && source.getMonth() === now.getMonth()
    && source.getDate() === now.getDate();
}

function buildRoleTodo(role, cases, user) {
  if (role === "surveyor") {
    return cases
      .filter((item) => item.status !== window.AppConfig.caseStatus.closed)
      .filter((item) => item.surveyor === (user.displayName || user.username))
      .slice(0, 4)
      .map((item) => ({
        title: item.id,
        detail: `${item.town}/${item.village} ${item.status}`
      }));
  }
  if (role === "reviewer") {
    return cases
      .filter((item) => item.status === window.AppConfig.caseStatus.pendingReview)
      .slice(0, 4)
      .map((item) => ({
        title: item.id,
        detail: `${item.disasterType}\uff0c\u5f85\u590d\u6838\u786e\u8ba4`
      }));
  }
  return cases
    .filter((item) => item.status !== window.AppConfig.caseStatus.closed)
    .slice(0, 4)
    .map((item) => ({
      title: item.id,
      detail: `${item.town}/${item.village} ${item.status}`
    }));
}

function buildWarnings(cases, disputes) {
  const fromDisputes = disputes
    .filter((item) => item.status !== "\u5df2\u89e3\u51b3")
    .slice(0, 2)
    .map((item) => ({
      title: `\u4e89\u8bae\u6848\u4ef6 ${item.title}`,
      detail: item.detail
    }));

  const highRisk = cases
    .filter((item) => Number(item.riskScore || 0) >= 0.7 && item.status !== window.AppConfig.caseStatus.closed)
    .slice(0, 2)
    .map((item) => ({
      title: `\u9ad8\u98ce\u9669 ${item.id}`,
      detail: `${item.town}/${item.village}\uff0c\u98ce\u9669\u5206 ${Number(item.riskScore).toFixed(2)}`
    }));

  return fromDisputes.concat(highRisk).slice(0, 4);
}

function buildMetrics(role, cases, disputes, user) {
  const myCases = role === "surveyor"
    ? cases.filter((item) => item.surveyor === (user.displayName || user.username))
    : cases;

  const pending = myCases.filter((item) => item.status !== window.AppConfig.caseStatus.closed).length;
  const todayCount = myCases.filter((item) => isSameDay(item.createdAt)).length;
  const pendingReview = myCases.filter((item) => item.status === window.AppConfig.caseStatus.pendingReview).length;
  const abnormal = disputes.filter((item) => item.status !== "\u5df2\u89e3\u51b3").length
    + myCases.filter((item) => Number(item.riskScore || 0) >= 0.7 && item.status !== window.AppConfig.caseStatus.closed).length;

  return [
    { label: "\u6211\u7684\u5f85\u529e", value: String(pending) },
    { label: "\u4eca\u65e5\u65b0\u589e", value: String(todayCount) },
    { label: "\u5f85\u590d\u6838", value: String(pendingReview) },
    { label: "\u5f02\u5e38\u9884\u8b66", value: String(abnormal) }
  ];
}

export function syncWorkbenchSource({ role, user, cases, disputes }) {
  const recentCases = cases.slice().sort((a, b) => String(b.updatedAt || "").localeCompare(String(a.updatedAt || ""))).slice(0, 5);
  const payload = {
    role,
    generatedAt: new Date().toISOString(),
    metrics: buildMetrics(role, cases, disputes, user),
    todos: buildRoleTodo(role, cases, user),
    warnings: buildWarnings(cases, disputes),
    recentCases,
    quickActions: QUICK_ACTIONS[role] || QUICK_ACTIONS.surveyor
  };

  const all = readSource(WORKBENCH_SOURCE_KEY, {});
  all[role] = payload;
  writeSource(WORKBENCH_SOURCE_KEY, all);
  return payload;
}

export function loadWorkbenchSource(role) {
  const all = readSource(WORKBENCH_SOURCE_KEY, {});
  return all[role] || null;
}

