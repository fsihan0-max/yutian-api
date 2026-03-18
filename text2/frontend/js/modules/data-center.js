import { renderDataCenter } from "../components/data.js";
import { getDataCenterAssets } from "./services/dataCenterService.js";

export function renderDataCenterModule(state) {
  state.resources = getDataCenterAssets();
  renderDataCenter(state.resources);
}

