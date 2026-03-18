import { listHtml, escapeHtml } from "./utils.js";

export function applyThemeButtons(themeKey) {
  document.querySelectorAll("[data-theme-key]").forEach((button) => {
    button.classList.toggle("active", button.dataset.themeKey === themeKey);
  });
}

export function renderSurveyAuxPanels(state) {
  const hasAoi = Boolean(state.mapApi && state.mapApi.hasAoi());

  if (!hasAoi) {
    document.getElementById("historyList").innerHTML = listHtml([
      { title: "请先圈选地块", detail: "完成 AOI 圈选后再查看历史对比。" }
    ]);
    document.getElementById("featureList").innerHTML = `<div class="list-item"><strong>请先圈选地块</strong><p>完成 AOI 圈选后再查看同地块特征。</p></div>`;
  } else {
    document.getElementById("historyList").innerHTML = listHtml([
      { title: "同地块历史", detail: "2025-09-18 记录为轻度病虫害。" },
      { title: "同期长势", detail: "当前 NDVI 比去年同期低 0.18。" },
      { title: "重复报案", detail: "近 180 天内同地块报案 1 次。" }
    ]);

    const features = state.currentAnalysis ? state.currentAnalysis.feature_vector : null;
    document.getElementById("featureList").innerHTML = features
      ? Object.entries(features).map(([key, value]) => `<div class="list-item"><strong>${escapeHtml(key)}</strong><p>${escapeHtml(value)}</p></div>`).join("")
      : `<div class="list-item"><strong>暂无分析结果</strong><p>完成一次分析后显示同地块特征。</p></div>`;
  }

  document.getElementById("fieldEvidenceList").innerHTML = renderEvidenceList(state.evidence);
  document.getElementById("fieldChecklist").innerHTML = listHtml([
    { title: "照片上传", detail: "至少上传 3 张现场照片。" },
    { title: "无人机影像", detail: "优先覆盖异常斑块区域。" },
    { title: "证据清单", detail: "截图、影像、备注统一入库。" }
  ]);
}

export function renderSampleList(samples) {
  const container = document.getElementById("sampleList");
  container.innerHTML = samples.length
    ? samples.slice().reverse().slice(0, 8).map((item) => `<div class="list-item"><strong>${escapeHtml(item.label)}</strong><p>${escapeHtml(item.notes || "无备注")}</p></div>`).join("")
    : `<div class="list-item"><strong>暂无样本</strong><p>完成分析后可新增样本。</p></div>`;
}

export function setAnalyzeResult(result, selectedCase) {
  if (!result) {
    document.getElementById("analyzeResult").innerHTML = "";
    return;
  }

  const finalResult = result.final_result;
  const topBlock = (result.block_class_summary || [])[0];
  const caseLine = selectedCase ? `<div class="list-item"><strong>案件编号</strong><p>${escapeHtml(selectedCase.id)}</p></div>` : "";
  document.getElementById("analyzeResult").innerHTML = `
    ${caseLine}
    <div class="list-item"><strong>判定结果</strong><p>${escapeHtml(finalResult.label)} (${Math.round(finalResult.confidence * 100)}%)</p></div>
    <div class="list-item"><strong>识别面积</strong><p>${escapeHtml(result.recognized_area_mu)} 亩</p></div>
    <div class="list-item"><strong>有效耕地区</strong><p>${escapeHtml(result.effective_area_mu || 0)} 亩（剔除非农地物 ${escapeHtml(result.filtered_non_agri_area_mu || 0)} 亩）</p></div>
    <div class="list-item"><strong>分块主导类型</strong><p>${topBlock ? `${escapeHtml(topBlock.label)} (${Math.round(topBlock.ratio * 100)}%)` : "暂无分块统计"}</p></div>
    <div class="list-item"><strong>结果说明</strong><p>${escapeHtml(finalResult.explanation)}</p></div>
  `;
}

export async function readEvidenceFiles(files, note) {
  const entries = await Promise.all(files.map(async (file) => {
    const base64 = await readFileAsDataUrl(file);
    return {
      title: `现场照片 - ${file.name}`,
      detail: note || "现场照片上传",
      thumbnail: base64
    };
  }));

  return entries;
}

function renderEvidenceList(evidence) {
  if (!evidence.length) {
    return `<div class="list-item"><strong>暂无证据</strong><p>请上传现场照片并添加说明。</p></div>`;
  }

  return evidence.map((item) => `
    <div class="evidence-item">
      ${item.thumbnail ? `<img class="evidence-thumb" src="${item.thumbnail}" alt="现场照片">` : `<div class="evidence-thumb"></div>`}
      <div class="evidence-meta">
        <strong>${escapeHtml(item.title)}</strong>
        <p>${escapeHtml(item.detail)}</p>
      </div>
    </div>
  `).join("");
}

function readFileAsDataUrl(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = () => reject(new Error("照片读取失败"));
    reader.readAsDataURL(file);
  });
}
