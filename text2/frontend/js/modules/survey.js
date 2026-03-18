import {
  getSamples,
  postSample,
  postAnalyzeJson,
  postAnalyzeForm,
  geocodeCN
} from "../api/request.js";
import { initMap, renderOverlay } from "./map.js";
import {
  applyThemeButtons,
  renderSurveyAuxPanels,
  renderSampleList,
  setAnalyzeResult,
  readEvidenceFiles
} from "../components/survey.js";
import { formatNow } from "../components/utils.js";
import { updateCase, updateCaseFromAnalysis } from "./services/casesService.js";

const el = (id) => document.getElementById(id);

export function createSurveyModule(state, deps = {}) {
  const onCaseMutated = deps.onCaseMutated || (() => {});
  const onReportAction = deps.onReportAction || (() => {});
  const goToMenu = deps.goToMenu || (() => {});

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
      alert(error.message || "\u5730\u56fe\u521d\u59cb\u5316\u5931\u8d25\u3002");
    }
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
      alert("\u672a\u627e\u5230\u4f4d\u7f6e\u3002");
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
      alert("GeoTIFF \u89e3\u6790\u5931\u8d25\u3002");
    }
  }

  async function handleAnalyze() {
    if (!state.selectedCase) {
      alert("\u8bf7\u5148\u5728\u6848\u4ef6\u4e2d\u5fc3\u9009\u62e9\u6848\u4ef6\u3002");
      goToMenu("cases");
      return;
    }
    if (!state.mapApi || !state.mapApi.hasAoi()) {
      alert("\u8bf7\u5148\u7ed8\u5236 AOI\u3002");
      return;
    }

    updateCase(state.selectedCase.id, {
      status: window.AppConfig.caseStatus.analyzing
    }, {
      action: "\u5f00\u59cb\u5206\u6790",
      detail: `${state.user.displayName || state.user.username}\u5f00\u59cb\u6267\u884c\u8015\u5730\u7b5b\u9009\u4e0e\u5206\u5757\u5206\u7c7b\u3002`
    });
    onCaseMutated(state.selectedCase.id);

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
      updateCase(state.selectedCase.id, {
        status: window.AppConfig.caseStatus.pendingSurvey
      }, {
        action: "\u5206\u6790\u5931\u8d25",
        detail: `${state.user.displayName || state.user.username}\u5206\u6790\u5931\u8d25\uff0c\u7b49\u5f85\u91cd\u8bd5\u3002`
      });
      onCaseMutated(state.selectedCase.id);
      alert(result.error || result.data?.error || "\u5206\u6790\u5931\u8d25\u3002");
      return;
    }

    state.currentAnalysis = result.data;
    setAnalyzeResult(result.data, state.selectedCase);
    renderSurveyAuxPanels(state);
    renderOverlay(state.currentAnalysis, state.currentTheme);

    const updatedCase = updateCaseFromAnalysis(
      state.selectedCase.id,
      result.data,
      state.user.displayName || state.user.username
    );
    onCaseMutated(updatedCase ? updatedCase.id : state.selectedCase.id);
    onReportAction({
      type: "analysis",
      title: "\u5206\u6790\u5b8c\u6210",
      detail: `${formatNow()} ${state.selectedCase.id} \u5df2\u5b8c\u6210\u201c\u8015\u5730\u7b5b\u9009 + \u5206\u5757\u5206\u7c7b\u201d\u3002`
    });
  }

  async function handleSaveSample(labelKey) {
    if (!state.currentAnalysis) {
      alert("\u8bf7\u5148\u6267\u884c\u5206\u6790\u3002");
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
      alert(result.error || "\u6837\u672c\u4fdd\u5b58\u5931\u8d25");
      return;
    }
    loadSamples();
  }

  async function handleAddEvidence() {
    const files = Array.from(el("fieldPhotoInput").files || []);
    const note = el("fieldNoteInput").value.trim();
    if (!files.length && !note) {
      alert("\u8bf7\u5148\u4e0a\u4f20\u7167\u7247\u6216\u586b\u5199\u8bf4\u660e\u3002");
      return;
    }

    try {
      const photoItems = await readEvidenceFiles(files, note);
      const items = photoItems.length
        ? photoItems
        : [{ title: `\u5916\u4e1a\u8bf4\u660e ${formatNow()}`, detail: note || "\u5916\u4e1a\u8bc1\u636e", thumbnail: "" }];
      state.evidence = items.concat(state.evidence);
      el("fieldPhotoInput").value = "";
      el("fieldNoteInput").value = "";
      renderSurveyAuxPanels(state);
    } catch (error) {
      alert(error.message || "\u7167\u7247\u8bfb\u53d6\u5931\u8d25\u3002");
    }
  }

  function bindEvents() {
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

  function refreshPanels() {
    applyThemeButtons(state.currentTheme);
    renderSurveyAuxPanels(state);
  }

  return {
    initSurveyTabs,
    ensureMapReady,
    loadSamples,
    bindEvents,
    refreshPanels
  };
}

