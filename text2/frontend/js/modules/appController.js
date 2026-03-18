import { state, initState, bindSelectedCase } from "../utils/globalStore.js";
import { getHealth, postReview } from "../api/request.js";
import { createAppRouter } from "../utils/appRouter.js";
import { createSurveyModule } from "../modules/survey.js";
import { renderWorkbenchModule } from "../modules/workbench.js";
import { renderCasesModule } from "../modules/cases.js";
import { refreshReportCenterModule, appendReportAction } from "../modules/reports.js";
import { renderRiskModule } from "../modules/risk.js";
import { renderDataCenterModule } from "../modules/data-center.js";
import { renderSettingsCenter } from "../components/settings.js";
import { openReportModal, closeReportModal, printReport } from "../components/reports.js";
import { formatNow } from "../components/utils.js";
import { loadDomainState, syncDerivedState } from "./services/domainService.js";
import { updateCaseFromReview, resolveDisputeByCase } from "./services/casesService.js";

const el = (id) => document.getElementById(id);

let router;
let surveyModule;

async function updateHealthBadge() {
  const result = await getHealth();
  el("healthBadge").textContent = result.ok && result.data.status === "ok" ? "\u670d\u52a1\u5728\u7ebf" : "\u670d\u52a1\u5f02\u5e38";
}

function initHeader() {
  const roleName = window.AppConfig.roleLabel[state.user.role] || state.user.role;
  el("currentUserName").textContent = state.user.displayName || state.user.username;
  el("currentRoleName").textContent = roleName;
  el("roleLabel").textContent = roleName;
  el("dateBadge").textContent = formatNow();
  updateHealthBadge();
}

function refreshDomain(caseId = "") {
  loadDomainState(state);
  bindSelectedCase(caseId || state.selectedCaseId);
  syncDerivedState(state);
}

function refreshCurrentPage() {
  if (state.currentMenu === "workbench") renderWorkbenchModule(state, (menu) => router.go(menu));
  if (state.currentMenu === "cases") renderCasesModule(state, selectCase);
  if (state.currentMenu === "reports") refreshReportCenterModule(state);
  if (state.currentMenu === "risk") renderRiskModule(state);
  if (state.currentMenu === "data") renderDataCenterModule(state);
  if (state.currentMenu === "settings") renderSettingsCenter(state);
  if (state.currentMenu === "survey") {
    surveyModule.ensureMapReady();
    surveyModule.refreshPanels();
  }
}

function rerenderLinkedViews() {
  if (state.currentMenu === "cases") renderCasesModule(state, selectCase);
  if (state.currentMenu === "reports") refreshReportCenterModule(state);
  if (state.currentMenu === "risk") renderRiskModule(state);
  if (state.currentMenu === "workbench") renderWorkbenchModule(state, (menu) => router.go(menu));
}

function selectCase(caseId) {
  bindSelectedCase(caseId);
  refreshReportCenterModule(state);
  if (state.currentMenu === "cases") {
    renderCasesModule(state, selectCase);
  }
}

function appendCaseReport(payload) {
  appendReportAction(state, payload);
}

async function handleSubmitReview() {
  if (state.user.role === "surveyor") {
    alert("\u67e5\u52d8\u5458\u65e0\u590d\u6838\u6743\u9650\u3002");
    return;
  }
  if (!state.selectedCase) {
    alert("\u8bf7\u5148\u9009\u62e9\u6848\u4ef6\u3002");
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
    alert(result.error || "\u63d0\u4ea4\u5931\u8d25");
    return;
  }

  updateCaseFromReview(state.selectedCase.id, {
    correctedLabel,
    correctedAreaMu: correctedArea,
    reviewer: payload.reviewer
  });
  resolveDisputeByCase(state.selectedCase.id, payload.reviewer);
  appendCaseReport({
    type: "review",
    title: "\u590d\u6838\u7ed3\u6848",
    detail: `${formatNow()} ${state.selectedCase.id} \u5df2\u590d\u6838\u7ed3\u6848\u3002`
  });

  el("reviewAreaInput").value = "";
  el("reviewCommentInput").value = "";

  refreshDomain(state.selectedCase.id);
  rerenderLinkedViews();
  alert("\u590d\u6838\u5df2\u63d0\u4ea4\uff0c\u6848\u4ef6\u72b6\u6001\u4e0e\u7edf\u8ba1\u5df2\u540c\u6b65\u3002");
}

function bindGlobalEvents() {
  el("logoutBtn").addEventListener("click", () => {
    window.Auth.logout();
    window.location.href = "../login/index.html";
  });

  ["caseFilterTown", "caseFilterStatus", "caseFilterCrop"].forEach((id) => {
    el(id).addEventListener("change", () => renderCasesModule(state, selectCase));
  });

  el("submitReviewBtn").addEventListener("click", handleSubmitReview);

  el("generateFarmerReportBtn").addEventListener("click", () => {
    if (!state.selectedCase) {
      alert("\u8bf7\u5148\u9009\u62e9\u6848\u4ef6\u3002");
      return;
    }
    openReportModal(state, "farmer");
    appendCaseReport({
      type: "report",
      title: "\u519c\u6237\u62a5\u544a",
      detail: `${formatNow()} \u5df2\u751f\u6210 ${state.selectedCase.id} \u519c\u6237\u62a5\u544a\u9884\u89c8\u3002`
    });
  });

  el("generateArchiveReportBtn").addEventListener("click", () => {
    if (!state.selectedCase) {
      alert("\u8bf7\u5148\u9009\u62e9\u6848\u4ef6\u3002");
      return;
    }
    openReportModal(state, "archive");
    appendCaseReport({
      type: "report",
      title: "\u5f52\u6863\u62a5\u544a",
      detail: `${formatNow()} \u5df2\u751f\u6210 ${state.selectedCase.id} \u5f52\u6863\u62a5\u544a\u9884\u89c8\u3002`
    });
  });

  el("exportPdfBtn").addEventListener("click", () => {
    if (!state.selectedCase) {
      alert("\u8bf7\u5148\u9009\u62e9\u6848\u4ef6\u3002");
      return;
    }
    printReport(state);
    appendCaseReport({
      type: "export",
      title: "PDF \u5bfc\u51fa",
      detail: `${formatNow()} \u5df2\u5bfc\u51fa ${state.selectedCase.id} \u62a5\u544a PDF\u3002`
    });
  });

  el("closeReportModalBtn").addEventListener("click", closeReportModal);
  el("closeReportModalMask").addEventListener("click", closeReportModal);

  window.addEventListener("afterprint", () => {
    document.body.classList.remove("print-report-mode");
  });
}

function initRouter() {
  router = createAppRouter(state, (menuKey) => {
    state.currentMenu = menuKey;
    refreshCurrentPage();
  });
  window.addEventListener("hashchange", () => router.setFromHash());
}

export function bootstrapApp() {
  const session = window.Auth.currentSession();
  if (!session) {
    window.location.href = "../login/index.html";
    return;
  }

  initState(session);
  refreshDomain();
  initHeader();
  initRouter();

  surveyModule = createSurveyModule(state, {
    onCaseMutated: (caseId) => {
      refreshDomain(caseId);
      rerenderLinkedViews();
    },
    onReportAction: appendCaseReport,
    goToMenu: (menu) => router.go(menu)
  });
  surveyModule.initSurveyTabs();
  surveyModule.bindEvents();
  surveyModule.loadSamples();

  bindGlobalEvents();
  router.setFromHash();
}


