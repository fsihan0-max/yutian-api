export const state = {
  user: null,
  currentMenu: "workbench",
  selectedCase: null,
  currentAnalysis: null,
  currentTheme: "ndvi",
  mapApi: null,
  charts: {},
  evidence: [],
  reportLogs: [],
  reportType: "farmer",
  droneFile: null,
  samples: []
};

export const WORKBENCH_TITLES = {
  surveyor: { todo: "我的待办", recent: "最近处理案件" },
  reviewer: { todo: "我的待办", recent: "最近处理案件" },
  admin: { todo: "各分中心待办积压", recent: "各分中心近期案件" }
};

export const QUICK_ROUTE_BY_ROLE = {
  surveyor: ["survey", "survey", "survey", "cases"],
  reviewer: ["cases", "cases", "reports", "reports"],
  admin: ["risk", "risk", "data", "settings"]
};

export function initState(session) {
  state.user = session;
  state.selectedCase = window.AppData.cases[0] || null;
}
