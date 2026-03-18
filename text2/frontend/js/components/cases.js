import { listHtml } from "./utils.js";

function fillSelect(target, values, placeholder) {
  const current = target.value;
  target.innerHTML = [`<option value="">${placeholder}</option>`]
    .concat(values.map((value) => `<option value="${value}">${value}</option>`))
    .join("");
  if (current && values.includes(current)) {
    target.value = current;
  }
}

function initCaseFilters(cases) {
  fillSelect(document.getElementById("caseFilterTown"), [...new Set(cases.map((item) => item.town))], "\u5168\u90e8\u4e61\u9547");
  fillSelect(document.getElementById("caseFilterStatus"), [...new Set(cases.map((item) => item.status))], "\u5168\u90e8\u72b6\u6001");
  fillSelect(document.getElementById("caseFilterCrop"), [...new Set(cases.map((item) => item.crop))], "\u5168\u90e8\u4f5c\u7269");
}

function filteredCases(cases) {
  const town = document.getElementById("caseFilterTown").value;
  const status = document.getElementById("caseFilterStatus").value;
  const crop = document.getElementById("caseFilterCrop").value;

  return cases.filter((item) => {
    return (!town || item.town === town)
      && (!status || item.status === status)
      && (!crop || item.crop === crop);
  });
}

export function renderCaseCenter(state, onSelectCase, source) {
  const allCases = (source && source.cases) || [];
  const disputes = (source && source.disputes) || [];
  initCaseFilters(allCases);
  const rows = filteredCases(allCases);

  if (rows.length && (!state.selectedCase || !rows.some((item) => item.id === state.selectedCase.id))) {
    state.selectedCase = rows[0];
    state.selectedCaseId = rows[0].id;
  }
  if (!rows.length) {
    state.selectedCase = null;
    state.selectedCaseId = "";
  }

  const tableBody = document.getElementById("caseRows");
  tableBody.innerHTML = rows.map((item) => `
    <tr class="${state.selectedCase && item.id === state.selectedCase.id ? "active" : ""}" data-case-id="${item.id}">
      <td>${item.id}</td>
      <td>${item.town}/${item.village}</td>
      <td>${item.crop}</td>
      <td>${item.surveyor}</td>
      <td>${item.status}</td>
    </tr>
  `).join("") || `<tr><td colspan="5">\u6682\u65e0\u7b26\u5408\u6761\u4ef6\u7684\u6848\u4ef6</td></tr>`;

  tableBody.querySelectorAll("[data-case-id]").forEach((row) => {
    row.addEventListener("click", () => onSelectCase(row.dataset.caseId));
  });

  const detail = document.getElementById("caseDetail");
  if (state.selectedCase) {
    const item = state.selectedCase;
    detail.innerHTML = listHtml([
      { title: "\u62a5\u6848\u4eba", detail: item.reporter },
      { title: "\u5f71\u50cf\u6765\u6e90", detail: item.imageSource },
      { title: "\u6a21\u578b\u7ed3\u679c", detail: `${item.disasterType} (${Math.round(Number(item.confidence || 0) * 100)}%)` },
      { title: "\u8bc6\u522b\u9762\u79ef", detail: `${Number(item.recognizedAreaMu || 0).toFixed(2)} \u4ea9` },
      { title: "\u7ed3\u679c\u6458\u8981", detail: item.result }
    ]);
  } else {
    detail.innerHTML = "";
  }

  const canReview = state.user.role !== "surveyor";
  document.getElementById("reviewActionPanel").classList.toggle("hidden", !canReview);
  document.getElementById("reviewReadonlyHint").classList.toggle("hidden", canReview);
  document.getElementById("disputeList").innerHTML = listHtml(disputes.map((item) => ({
    title: item.title,
    detail: `${item.detail}${item.status ? ` (${item.status})` : ""}`
  })));
}
