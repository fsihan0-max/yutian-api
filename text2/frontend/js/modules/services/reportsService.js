import { readSource, writeSource } from "./storage.js";

const REPORT_SOURCE_KEY = "agri_report_records_source_v2";

const nowIso = () => new Date().toISOString();

export function listReportRecords(caseId = "") {
  const all = readSource(REPORT_SOURCE_KEY, []);
  const rows = caseId ? all.filter((item) => item.caseId === caseId) : all;
  return rows.sort((a, b) => String(b.createdAt || "").localeCompare(String(a.createdAt || "")));
}

export function addReportRecord(payload) {
  const all = readSource(REPORT_SOURCE_KEY, []);
  const record = {
    id: `RPT-${Math.random().toString(36).slice(2, 10)}`,
    caseId: payload.caseId || "",
    caseStatus: payload.caseStatus || "",
    title: payload.title || "鎶ュ憡璁板綍",
    detail: payload.detail || "",
    operator: payload.operator || "绯荤粺",
    type: payload.type || "operation",
    createdAt: nowIso()
  };
  all.push(record);
  writeSource(REPORT_SOURCE_KEY, all);
  return record;
}

