import { loadCases, loadDisputes } from "./casesService.js";
import { getDataCenterAssets } from "./dataCenterService.js";
import { syncWorkbenchSource, loadWorkbenchSource } from "./workbenchService.js";
import { syncRiskSource, loadRiskSource } from "./riskService.js";
import { listReportRecords } from "./reportsService.js";

export function loadDomainState(state) {
  state.cases = loadCases();
  state.disputes = loadDisputes();
  state.resources = getDataCenterAssets();
  state.reportLogs = listReportRecords(state.selectedCaseId || "");
}

export function syncDerivedState(state) {
  state.workbench = syncWorkbenchSource({
    role: state.user.role,
    user: state.user,
    cases: state.cases,
    disputes: state.disputes
  });
  state.riskSnapshot = syncRiskSource({
    cases: state.cases,
    disputes: state.disputes
  });
}

export function restoreDerivedState(state) {
  state.workbench = loadWorkbenchSource(state.user.role);
  state.riskSnapshot = loadRiskSource();
}

