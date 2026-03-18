import { listHtml } from "./utils.js";

export function renderDataCenter(resources) {
  document.getElementById("imageryList").innerHTML = listHtml(resources.imagery || []);
  document.getElementById("modelList").innerHTML = listHtml(resources.models || []);
}
