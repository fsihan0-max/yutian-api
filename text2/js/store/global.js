export const state = {
  user: null,
  currentMenu: "workbench",
  selectedCase: null,
  selectedCaseId: "",
  cases: [],
  disputes: [],
  resources: { imagery: [], models: [] },
  workbench: null,
  riskSnapshot: null,
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

export function initState(session) {
  state.user = session;
}

export function bindSelectedCase(caseId = "") {
  if (caseId) {
    state.selectedCaseId = caseId;
  }
  state.selectedCase = state.cases.find((item) => item.id === state.selectedCaseId) || state.cases[0] || null;
  state.selectedCaseId = state.selectedCase ? state.selectedCase.id : "";
  return state.selectedCase;
}
