import { renderCaseCenter } from "../components/cases.js";

export function renderCasesModule(state, onSelectCase) {
  renderCaseCenter(state, onSelectCase, {
    cases: state.cases,
    disputes: state.disputes
  });
}

