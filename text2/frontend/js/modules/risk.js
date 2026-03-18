import { renderRiskCenter } from "../components/risk.js";
import { syncRiskSource } from "./services/riskService.js";

export function renderRiskModule(state) {
  state.riskSnapshot = syncRiskSource({
    cases: state.cases,
    disputes: state.disputes
  });
  renderRiskCenter(state, state.riskSnapshot);
}

