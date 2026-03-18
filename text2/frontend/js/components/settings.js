import { listHtml } from "./utils.js";

export function renderSettingsCenter(state) {
  document.getElementById("profileList").innerHTML = listHtml([
    { title: "\u8d26\u53f7", detail: state.user.username },
    { title: "\u59d3\u540d", detail: state.user.displayName || state.user.username },
    { title: "\u89d2\u8272", detail: window.AppConfig.roleLabel[state.user.role] || state.user.role }
  ]);
  document.getElementById("settingList").innerHTML = listHtml(window.AppConfig.settings);
}
