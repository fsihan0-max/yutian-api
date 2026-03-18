import { renderReportCenter } from "../components/reports.js";
import { addReportRecord, listReportRecords } from "./services/reportsService.js";

export function refreshReportCenterModule(state) {
  const caseId = state.selectedCase ? state.selectedCase.id : "";
  state.reportLogs = listReportRecords(caseId);
  renderReportCenter(state, {
    records: state.reportLogs,
    evidenceTemplate: window.AppConfig.evidenceTemplate
  });
}

export function appendReportAction(state, payload) {
  if (!state.selectedCase) return null;
  const selectedCase = state.selectedCase;
  const record = addReportRecord({
    caseId: selectedCase.id,
    caseStatus: selectedCase.status,
    operator: state.user.displayName || state.user.username,
    ...payload
  });
  refreshReportCenterModule(state);
  return record;
}

