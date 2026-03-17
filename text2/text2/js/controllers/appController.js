import { state, initState } from "../store/global.js";
import { getHealth, getSamples, postSample, postReview, postAnalyzeJson, postAnalyzeForm, geocodeCN } from "../api/request.js";
import { initMap, renderOverlay } from "../gis/map.js";
import { renderWorkbench } from "../views/workbench.js";
import { renderCaseCenter } from "../views/cases.js";
import { renderRiskCenter } from "../views/risk.js";
import { renderDataCenter } from "../views/data.js";
import { renderSettingsCenter } from "../views/settings.js";
import { renderReportCenter, addReportLog, openReportModal, closeReportModal, printReport } from "../views/reports.js";
import { applyThemeButtons, renderSurveyAuxPanels, renderSampleList, setAnalyzeResult, readEvidenceFiles } from "../views/survey.js";
import { formatNow } from "../views/utils.js";

const el = (id) => document.getElementById(id);

function allowedMenus() {
  return window.AppData.menus.filter((menu) => menu.roles.includes(state.user.role));
}

function setDefaultMenuByRole() {
  const hashKey = window.location.hash.replace("#", "").trim();
  const allowed = allowedMenus().map((item) => item.key);
  state.currentMenu = allowed.includes(hashKey) ? hashKey : "workbench";
}

function renderMenu() {
  const menus = allowedMenus();
  el("menuList").innerHTML = menus.map((menu) => `
    <button class="menu-item ${menu.key === state.currentMenu ? "active" : ""}" data-menu-key="${menu.key}" type="button">
      ${menu.label}
    </button>
  `).join("");

  el("menuList").querySelectorAll("[data-menu-key]").forEach((button) => {
    button.addEventListener("click", () => {
      state.currentMenu = button.dataset.menuKey;
      switchPage();
    });
  });
}

function gotoMenu(menuKey) {
  const allowed = allowedMenus().map((menu) => menu.key);
  state.currentMenu = allowed.includes(menuKey) ? menuKey : "workbench";
  switchPage();
}

async function updateHealthBadge() {
  const result = await getHealth();
  el("healthBadge").textContent = result.ok && result.data.status === "ok" ? "服务在线" : "服务异常";
}

function initHeader() {
  const roleName = window.AppData.roleLabel[state.user.role] || state.user.role;
  el("currentUserName").textContent = state.user.displayName || state.user.username;
  el("currentRoleName").textContent = roleName;
  el("roleLabel").textContent = roleName;
  el("dateBadge").textContent = formatNow();
  updateHealthBadge();
}

function initSurveyTabs() {
  document.querySelectorAll("[data-survey-tab]").forEach((button) => {
    button.addEventListener("click", () => {
      const key = button.dataset.surveyTab;
      document.querySelectorAll("[data-survey-tab]").forEach((item) => item.classList.toggle("active", item === button));
      document.querySelectorAll(".subpage").forEach((page) => page.classList.toggle("active", page.dataset.subpage === key));
    });
  });
}

async function ensureMapReady() {
  if (state.mapApi) return;

  try {
    state.mapApi = await initMap({
      onAoiChange: (hasAoi) => {
        el("btnAnalyze").disabled = !hasAoi;
        renderSurveyAuxPanels(state);
      }
    });
    el("btnAnalyze").disabled = !state.mapApi.hasAoi();
  } catch (error) {
    alert(error.message || "地图加载失败。");
  }
}

function selectCase(caseId) {
  state.selectedCase = window.AppData.cases.find((item) => item.id === caseId) || null;
  renderCaseCenter(state, selectCase);
}

async function loadSamples() {
  const result = await getSamples();
  state.samples = result.ok ? (result.data.items || []) : [];
  renderSampleList(state.samples);
}

async function handleSearchLocation() {
  if (!state.mapApi) return;
  const query = el("searchInput").value.trim();
  if (!query) return;

  const result = await geocodeCN(query);
  if (!result.ok || !result.data.length) {
    alert("未找到位置。");
    return;
  }

  const location = result.data[0];
  state.mapApi.goToLonLat(parseFloat(location.lon), parseFloat(location.lat), 16);
}

async function handleDroneUpload(event) {
  if (!state.mapApi) return;
  const file = event.target.files[0];
  state.droneFile = file || null;
  if (!file) return;

  try {
    await state.mapApi.zoomToGeoTiff(file);
  } catch {
    state.droneFile = null;
    el("droneUploadInput").value = "";
    alert("GeoTIFF 解析失败。");
  }
}

async function handleAnalyze() {
  if (!state.mapApi || !state.mapApi.hasAoi()) {
    alert("请先绘制 AOI。");
    return;
  }

  const geometry = state.mapApi.getGeometryWgsJson();
  const areaMu = state.mapApi.getAreaMu();
  const cropMode = el("cropModeSelect").value;
  const modelMode = el("modelModeSelect").value;

  let result;
  if (state.droneFile) {
    const form = new FormData();
    form.append("file", state.droneFile);
    form.append("geometry", JSON.stringify(geometry));
    form.append("area_mu", areaMu);
    form.append("crop_mode", cropMode);
    form.append("model_mode", modelMode);
    result = await postAnalyzeForm(form);
  } else {
    result = await postAnalyzeJson({
      geometry: JSON.stringify(geometry),
      area_mu: areaMu,
      crop_mode: cropMode,
      model_mode: modelMode
    });
  }

  if (!result.ok || result.data.status !== "success") {
    alert(result.error || result.data?.error || "分析失败。");
    return;
  }

  state.currentAnalysis = result.data;
  setAnalyzeResult(result.data);
  renderSurveyAuxPanels(state);
  renderOverlay(state.currentAnalysis, state.currentTheme);
}

async function handleSaveSample(labelKey) {
  if (!state.currentAnalysis) {
    alert("请先完成一次分析。");
    return;
  }

  const payload = {
    label_key: labelKey,
    crop_mode: state.currentAnalysis.crop_mode,
    feature_vector: state.currentAnalysis.feature_vector,
    notes: el("sampleNoteInput").value.trim(),
    geometry: state.mapApi ? state.mapApi.getGeometryWgsJson() : null
  };

  const result = await postSample(payload);
  if (!result.ok) {
    alert(result.error || "样本保存失败");
    return;
  }

  loadSamples();
}

async function handleAddEvidence() {
  const files = Array.from(el("fieldPhotoInput").files || []);
  const note = el("fieldNoteInput").value.trim();
  if (!files.length && !note) {
    alert("请先选择照片或填写说明。");
    return;
  }

  try {
    const photoItems = await readEvidenceFiles(files, note);
    const items = photoItems.length ? photoItems : [{ title: `外业说明 ${formatNow()}`, detail: note || "现场补充材料", thumbnail: "" }];
    state.evidence = items.concat(state.evidence);
    el("fieldPhotoInput").value = "";
    el("fieldNoteInput").value = "";
    renderSurveyAuxPanels(state);
  } catch (error) {
    alert(error.message || "照片读取失败。");
  }
}

async function handleSubmitReview() {
  if (state.user.role === "surveyor") {
    alert("查勘员无复核权限。");
    return;
  }
  if (!state.selectedCase) {
    alert("请先选择案件。");
    return;
  }

  const correctedLabel = el("reviewLabelSelect").value;
  const correctedArea = el("reviewAreaInput").value;
  const payload = {
    case_id: state.selectedCase.id,
    reviewer: state.user.displayName || state.user.username,
    corrected_label: correctedLabel,
    corrected_area_mu: correctedArea,
    comment: el("reviewCommentInput").value
  };

  const result = await postReview(payload);
  if (!result.ok) {
    alert(result.error || "提交失败");
    return;
  }

  state.selectedCase.status = "已结案";
  if (correctedLabel) {
    state.selectedCase.disasterType = correctedLabel;
  }
  state.selectedCase.result = correctedArea
    ? `人工复核面积 ${correctedArea} 亩，类型：${correctedLabel || state.selectedCase.disasterType}`
    : `人工复核完成，类型：${correctedLabel || state.selectedCase.disasterType}`;

  el("reviewAreaInput").value = "";
  el("reviewCommentInput").value = "";

  renderCaseCenter(state, selectCase);
  renderWorkbench(state, gotoMenu);
  addReportLog(state, "复核结案", `${formatNow()} ${state.selectedCase.id} 已更新为“已结案”。`);
  alert("复核已提交并结案。列表状态已更新。");
}

function bindSurveyEvents() {
  el("btnSearch").addEventListener("click", handleSearchLocation);
  el("droneUploadInput").addEventListener("change", handleDroneUpload);
  el("btnAnalyze").addEventListener("click", handleAnalyze);
  el("addFieldEvidenceBtn").addEventListener("click", handleAddEvidence);

  document.querySelectorAll("[data-theme-key]").forEach((button) => {
    button.addEventListener("click", () => {
      state.currentTheme = button.dataset.themeKey;
      applyThemeButtons(state.currentTheme);
      renderOverlay(state.currentAnalysis, state.currentTheme);
    });
  });

  document.querySelectorAll("[data-sample-label]").forEach((button) => {
    button.addEventListener("click", () => handleSaveSample(button.dataset.sampleLabel));
  });
}

function bindGlobalEvents() {
  el("logoutBtn").addEventListener("click", () => {
    window.Auth.logout();
    window.location.href = "index.html";
  });

  ["caseFilterTown", "caseFilterStatus", "caseFilterCrop"].forEach((id) => {
    el(id).addEventListener("change", () => renderCaseCenter(state, selectCase));
  });

  el("submitReviewBtn").addEventListener("click", handleSubmitReview);

  el("generateFarmerReportBtn").addEventListener("click", () => {
    openReportModal(state, "farmer");
    addReportLog(state, "农户报告", `${formatNow()} 已生成预览。`);
  });

  el("generateArchiveReportBtn").addEventListener("click", () => {
    openReportModal(state, "archive");
    addReportLog(state, "归档报告", `${formatNow()} 已生成预览。`);
  });

  el("exportPdfBtn").addEventListener("click", () => {
    printReport(state);
    addReportLog(state, "PDF 导出", `${formatNow()} 已触发浏览器打印。`);
  });

  el("closeReportModalBtn").addEventListener("click", closeReportModal);
  el("closeReportModalMask").addEventListener("click", closeReportModal);

  window.addEventListener("afterprint", () => {
    document.body.classList.remove("print-report-mode");
  });

  bindSurveyEvents();
}

function switchPage() {
  const menus = allowedMenus();
  if (!menus.some((item) => item.key === state.currentMenu)) {
    state.currentMenu = "workbench";
  }

  if (window.location.hash !== `#${state.currentMenu}`) {
    window.location.hash = state.currentMenu;
  }

  const menuRecord = menus.find((item) => item.key === state.currentMenu);
  el("pageTitle").textContent = (menuRecord && menuRecord.label) || "工作台";

  document.querySelectorAll(".page").forEach((page) => {
    page.classList.toggle("active", page.dataset.page === state.currentMenu);
  });

  renderMenu();

  if (state.currentMenu === "workbench") renderWorkbench(state, gotoMenu);
  if (state.currentMenu === "cases") renderCaseCenter(state, selectCase);
  if (state.currentMenu === "reports") renderReportCenter(state);
  if (state.currentMenu === "risk") renderRiskCenter(state);
  if (state.currentMenu === "data") renderDataCenter();
  if (state.currentMenu === "settings") renderSettingsCenter(state);
  if (state.currentMenu === "survey") {
    ensureMapReady();
    applyThemeButtons(state.currentTheme);
    renderSurveyAuxPanels(state);
  }
}

export function bootstrapApp() {
  const session = window.Auth.currentSession();
  if (!session) {
    window.location.href = "index.html";
    return;
  }

  initState(session);
  initHeader();
  initSurveyTabs();
  bindGlobalEvents();
  setDefaultMenuByRole();
  switchPage();
  loadSamples();
}

