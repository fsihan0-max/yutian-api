import { listHtml } from "./utils.js";

export function renderDataCenter() {
  document.getElementById("imageryList").innerHTML = listHtml(window.AppData.imageryAssets);
  document.getElementById("modelList").innerHTML = listHtml(window.AppData.modelAssets);
}
