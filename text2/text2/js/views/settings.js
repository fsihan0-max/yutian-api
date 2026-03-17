import { listHtml } from "./utils.js";

export function renderSettingsCenter(state) {
  document.getElementById("profileList").innerHTML = listHtml([
    { title: "账号", detail: state.user.username },
    { title: "姓名", detail: state.user.displayName || state.user.username },
    { title: "角色", detail: window.AppData.roleLabel[state.user.role] || state.user.role }
  ]);
  document.getElementById("settingList").innerHTML = listHtml(window.AppData.settings);
}
