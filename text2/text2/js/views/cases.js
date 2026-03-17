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

export function initCaseFilters() {
  const cases = window.AppData.cases;
  fillSelect(document.getElementById("caseFilterTown"), [...new Set(cases.map((item) => item.town))], "全部乡镇");
  fillSelect(document.getElementById("caseFilterStatus"), [...new Set(cases.map((item) => item.status))], "全部状态");
  fillSelect(document.getElementById("caseFilterCrop"), [...new Set(cases.map((item) => item.crop))], "全部作物");
}

export function filteredCases() {
  const town = document.getElementById("caseFilterTown").value;
  const status = document.getElementById("caseFilterStatus").value;
  const crop = document.getElementById("caseFilterCrop").value;

  return window.AppData.cases.filter((item) => {
    return (!town || item.town === town)
      && (!status || item.status === status)
      && (!crop || item.crop === crop);
  });
}

export function renderCaseCenter(state, onSelectCase) {
  initCaseFilters();
  const rows = filteredCases();

  if (rows.length && (!state.selectedCase || !rows.some((item) => item.id === state.selectedCase.id))) {
    state.selectedCase = rows[0];
  }
  if (!rows.length) {
    state.selectedCase = null;
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
  `).join("") || `<tr><td colspan="5">暂无符合条件的案件</td></tr>`;

  tableBody.querySelectorAll("[data-case-id]").forEach((row) => {
    row.addEventListener("click", () => onSelectCase(row.dataset.caseId));
  });

  const detail = document.getElementById("caseDetail");
  if (state.selectedCase) {
    const item = state.selectedCase;
    detail.innerHTML = listHtml([
      { title: "报案人", detail: item.reporter },
      { title: "影像来源", detail: item.imageSource },
      { title: "模型结果", detail: `${item.disasterType} (${Math.round(item.confidence * 100)}%)` },
      { title: "结果摘要", detail: item.result }
    ]);
  } else {
    detail.innerHTML = "";
  }

  const canReview = state.user.role !== "surveyor";
  document.getElementById("reviewActionPanel").classList.toggle("hidden", !canReview);
  document.getElementById("reviewReadonlyHint").classList.toggle("hidden", canReview);
  document.getElementById("disputeList").innerHTML = listHtml(window.AppData.disputes);
}
