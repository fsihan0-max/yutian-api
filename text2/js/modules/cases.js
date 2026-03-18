import { renderCaseCenter } from "../views/cases.js";

export function renderCasesModule(state, onSelectCase) {
  renderCaseCenter(state, onSelectCase, {
    cases: state.cases,
    disputes: state.disputes
  });
}
