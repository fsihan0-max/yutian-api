import { readSource, writeSource } from "./storage.js";

const CASE_SOURCE_KEY = "agri_cases_source_v2";
const DISPUTE_SOURCE_KEY = "agri_disputes_source_v2";

const nowIso = () => new Date().toISOString();

const seedCases = [
  {
    id: "YT-20260316-001",
    town: "\u57ce\u5173\u9547",
    village: "\u4e1c\u5173\u6751",
    crop: "\u5c0f\u9ea6",
    status: "\u5f85\u590d\u6838",
    reporter: "\u738b\u5efa\u56fd",
    surveyor: "\u67e5\u52d8\u54581",
    imageSource: "\u65e0\u4eba\u673a GeoTIFF",
    disasterType: "\u7269\u7406\u5012\u4f0f",
    confidence: 0.84,
    recognizedAreaMu: 18.6,
    result: "\u8bc6\u522b\u9762\u79ef 18.6 \u4ea9\uff0c\u5f85\u590d\u6838\u786e\u8ba4\u3002",
    createdAt: "2026-03-16T01:30:00Z",
    updatedAt: "2026-03-16T06:40:00Z",
    riskScore: 0.76,
    timeline: [
      { action: "\u6848\u4ef6\u521b\u5efa", at: "2026-03-16T01:30:00Z", detail: "\u519c\u6237\u53d1\u8d77\u62a5\u6848\u3002" },
      { action: "\u5206\u6790\u5b8c\u6210", at: "2026-03-16T06:40:00Z", detail: "\u67e5\u52d8\u5206\u6790\u5df2\u63d0\u4ea4\u590d\u6838\u3002" }
    ]
  },
  {
    id: "YT-20260316-002",
    town: "\u67f3\u6cc9\u9547",
    village: "\u5317\u5761\u6751",
    crop: "\u7389\u7c73",
    status: "\u5206\u6790\u4e2d",
    reporter: "\u8d75\u7ea2\u6885",
    surveyor: "\u67e5\u52d8\u54581",
    imageSource: "Sentinel-2",
    disasterType: "\u5f85\u5224\u5b9a",
    confidence: 0.56,
    recognizedAreaMu: 0,
    result: "\u6b63\u5728\u6267\u884c\u8015\u5730\u7b5b\u9009\u4e0e\u50cf\u5143\u5206\u7c7b\u3002",
    createdAt: "2026-03-16T03:20:00Z",
    updatedAt: "2026-03-16T03:30:00Z",
    riskScore: 0.58,
    timeline: [
      { action: "\u6848\u4ef6\u521b\u5efa", at: "2026-03-16T03:20:00Z", detail: "\u519c\u6237\u53d1\u8d77\u62a5\u6848\u3002" },
      { action: "\u5f00\u59cb\u5206\u6790", at: "2026-03-16T03:30:00Z", detail: "\u5df2\u4e0a\u4f20 AOI \u5e76\u5f00\u59cb\u5206\u6790\u3002" }
    ]
  },
  {
    id: "YT-20260316-003",
    town: "\u6cb3\u6e7e\u9547",
    village: "\u897f\u9648\u6751",
    crop: "\u5c0f\u9ea6",
    status: "\u5f85\u67e5\u52d8",
    reporter: "\u9648\u7389\u5170",
    surveyor: "\u67e5\u52d8\u54581",
    imageSource: "\u5f85\u4e0a\u4f20",
    disasterType: "\u5f85\u5224\u5b9a",
    confidence: 0.5,
    recognizedAreaMu: 0,
    result: "\u7b49\u5f85\u5916\u4e1a\u8bc1\u636e\u3002",
    createdAt: "2026-03-16T05:10:00Z",
    updatedAt: "2026-03-16T05:10:00Z",
    riskScore: 0.43,
    timeline: [
      { action: "\u6848\u4ef6\u521b\u5efa", at: "2026-03-16T05:10:00Z", detail: "\u519c\u6237\u53d1\u8d77\u62a5\u6848\u3002" }
    ]
  },
  {
    id: "YT-20260315-009",
    town: "\u57ce\u5173\u9547",
    village: "\u5357\u5c97\u6751",
    crop: "\u5c0f\u9ea6",
    status: "\u5df2\u7ed3\u6848",
    reporter: "\u5b59\u5fd7\u5f3a",
    surveyor: "\u67e5\u52d8\u54581",
    imageSource: "\u65e0\u4eba\u673a GeoTIFF",
    disasterType: "\u75c5\u866b\u5bb3",
    confidence: 0.69,
    recognizedAreaMu: 9.3,
    result: "\u590d\u6838\u7ed3\u6848\uff1a\u75c5\u866b\u5bb3\uff0c9.3 \u4ea9\u3002",
    createdAt: "2026-03-15T00:50:00Z",
    updatedAt: "2026-03-15T08:20:00Z",
    riskScore: 0.31,
    timeline: [
      { action: "\u6848\u4ef6\u521b\u5efa", at: "2026-03-15T00:50:00Z", detail: "\u519c\u6237\u53d1\u8d77\u62a5\u6848\u3002" },
      { action: "\u5206\u6790\u5b8c\u6210", at: "2026-03-15T04:15:00Z", detail: "\u67e5\u52d8\u5206\u6790\u5df2\u63d0\u4ea4\u590d\u6838\u3002" },
      { action: "\u590d\u6838\u7ed3\u6848", at: "2026-03-15T08:20:00Z", detail: "\u590d\u6838\u5458\u5b8c\u6210\u7ed3\u6848\u3002" }
    ]
  }
];

const seedDisputes = [
  {
    id: "DSP-20260311-003",
    caseId: "YT-20260316-001",
    title: "YT-20260316-001",
    detail: "\u519c\u6237\u5bf9\u9762\u79ef\u7ed3\u679c\u6709\u5f02\u8bae\uff0c\u7533\u8bf7\u4e8c\u6b21\u590d\u6838\u3002",
    status: "\u5904\u7406\u4e2d",
    createdAt: "2026-03-16T07:20:00Z"
  }
];

export function loadCases() {
  const items = readSource(CASE_SOURCE_KEY, seedCases);
  return items.sort((a, b) => String(b.updatedAt || "").localeCompare(String(a.updatedAt || "")));
}

export function saveCases(cases) {
  writeSource(CASE_SOURCE_KEY, cases);
}

export function loadDisputes() {
  const items = readSource(DISPUTE_SOURCE_KEY, seedDisputes);
  return items.sort((a, b) => String(b.createdAt || "").localeCompare(String(a.createdAt || "")));
}

export function saveDisputes(disputes) {
  writeSource(DISPUTE_SOURCE_KEY, disputes);
}

export function getCaseById(caseId) {
  return loadCases().find((item) => item.id === caseId) || null;
}

export function updateCase(caseId, patch, event) {
  const cases = loadCases();
  const index = cases.findIndex((item) => item.id === caseId);
  if (index < 0) return null;

  const target = cases[index];
  const updated = {
    ...target,
    ...patch,
    updatedAt: nowIso()
  };

  if (event) {
    const timeline = Array.isArray(updated.timeline) ? updated.timeline.slice() : [];
    timeline.push({
      action: event.action || "\u72b6\u6001\u66f4\u65b0",
      detail: event.detail || "",
      at: nowIso()
    });
    updated.timeline = timeline;
  }

  cases[index] = updated;
  saveCases(cases);
  return updated;
}

export function updateCaseFromAnalysis(caseId, analysisResult, operatorName) {
  const label = analysisResult?.final_result?.label || "\u5f85\u5224\u5b9a";
  const confidence = Number(analysisResult?.final_result?.confidence || 0);
  const recognizedAreaMu = Number(analysisResult?.recognized_area_mu || 0);
  const damageRatio = Number(analysisResult?.state_ratios?.damage || 0);

  const riskScore = Math.min(0.99, Math.max(0.1, (damageRatio * 0.65) + (1 - confidence) * 0.35));
  return updateCase(caseId, {
    status: window.AppConfig.caseStatus.pendingReview,
    disasterType: label,
    confidence,
    recognizedAreaMu: Number(recognizedAreaMu.toFixed(2)),
    result: `\u8015\u5730\u7b5b\u9009\u540e\u5224\u5b9a\u4e3a\u201c${label}\u201d\uff0c\u8bc6\u522b\u9762\u79ef ${recognizedAreaMu.toFixed(2)} \u4ea9\u3002`,
    riskScore
  }, {
    action: "\u5206\u6790\u5b8c\u6210",
    detail: `${operatorName || "\u7cfb\u7edf"}\u5b8c\u6210\u5206\u6790\u5e76\u63d0\u4ea4\u590d\u6838\u3002`
  });
}

export function updateCaseFromReview(caseId, payload) {
  const correctedLabel = String(payload.correctedLabel || "").trim();
  const correctedAreaMu = Number(payload.correctedAreaMu || 0);
  const reviewer = payload.reviewer || "\u590d\u6838\u5458";
  const finalLabel = correctedLabel || "\u4eba\u5de5\u590d\u6838";
  const finalArea = correctedAreaMu > 0 ? correctedAreaMu : null;

  return updateCase(caseId, {
    status: window.AppConfig.caseStatus.closed,
    disasterType: finalLabel,
    recognizedAreaMu: finalArea || undefined,
    result: finalArea
      ? `\u590d\u6838\u786e\u8ba4\uff1a${finalLabel}\uff0c${finalArea.toFixed(2)} \u4ea9\u3002`
      : `\u590d\u6838\u786e\u8ba4\uff1a${finalLabel}\u3002`,
    riskScore: 0.2
  }, {
    action: "\u590d\u6838\u7ed3\u6848",
    detail: `${reviewer}\u5df2\u63d0\u4ea4\u590d\u6838\u5e76\u7ed3\u6848\u3002`
  });
}

export function resolveDisputeByCase(caseId, resolverName) {
  const disputes = loadDisputes().map((item) => {
    if (item.caseId !== caseId) return item;
    return {
      ...item,
      status: "\u5df2\u89e3\u51b3",
      resolvedAt: nowIso(),
      detail: `${item.detail}\uff08${resolverName || "\u7cfb\u7edf"}\u5df2\u5904\u7406\uff09`
    };
  });
  saveDisputes(disputes);
}

