const API_BASE = `${location.protocol}//${location.hostname || "127.0.0.1"}:5000`;
const ENTRY_META = {
    survey: ["查勘定损端", "面向查勘员与理赔员，聚焦地块圈选、多源影像接入、灾害判定、样本标注与外业取证。"],
    review: ["案件复核端", "面向保险公司审核、复核、归档人员，聚焦案件总览、人工修正、报告出证与争议案件处理。"],
    governance: ["监管决策端", "面向管理者，聚焦区域风险态势、资源调度、风控研判和异常预警。"],
};
const STATUS_FLOW = ["待受理", "待查勘", "分析中", "待复核", "已结案"];
const CASES = [
    { id: "YT-20260316-001", town: "城关镇", village: "东关村", crop: "小麦", status: "待复核", reporter: "王建国", surveyor: "张敏", imageSource: "无人机 GeoTIFF", riskLevel: "高风险", disasterType: "物理倒伏", confidence: 0.84, disasterTime: "2026-03-14 18:30", location: "东经 113.6253, 北纬 34.7466", result: "受灾面积 18.6 亩，疑似物理倒伏" },
    { id: "YT-20260316-002", town: "柳泉镇", village: "北坡村", crop: "玉米", status: "分析中", reporter: "赵红梅", surveyor: "李凯", imageSource: "Sentinel-2", riskLevel: "高风险", disasterType: "病虫害", confidence: 0.76, disasterTime: "2026-03-15 09:20", location: "东经 113.6684, 北纬 34.7211", result: "NDVI 异常斑块明显，病虫害待确认" },
    { id: "YT-20260316-003", town: "河湾镇", village: "西陈村", crop: "花生", status: "待查勘", reporter: "陈玉兰", surveyor: "王浩", imageSource: "待上传", riskLevel: "低风险", disasterType: "待判定", confidence: 0.51, disasterTime: "2026-03-13 14:05", location: "东经 113.5911, 北纬 34.7842", result: "等待现场采集" },
    { id: "YT-20260316-004", town: "城关镇", village: "南岗村", crop: "小麦", status: "已结案", reporter: "孙志强", surveyor: "刘晴", imageSource: "无人机 GeoTIFF", riskLevel: "低风险", disasterType: "病虫害", confidence: 0.69, disasterTime: "2026-03-10 07:50", location: "东经 113.6088, 北纬 34.7559", result: "受灾面积 9.3 亩，病虫害轻度异常" },
];
const MINI_STATS = ["今日新增案件 27 件", "待复核案件 8 件", "无人机影像 16 次", "异常预警 5 条"];
const DASHBOARD = [{ label: "今日报案数", value: "27件" }, { label: "今日完成查勘数", value: "11件" }, { label: "无人机影像上传量", value: "16次" }, { label: "异常案件预警", value: "5条" }];
const TOWNS = [{ town: "城关镇", area: 48.1 }, { town: "柳泉镇", area: 35.6 }, { town: "河湾镇", area: 27.4 }, { town: "双庙镇", area: 19.8 }, { town: "北关镇", area: 12.5 }];
const HEAT = [{ name: "城关镇", text: "小麦倒伏集中，需优先复核。", tag: "Ⅰ级热点" }, { name: "柳泉镇", text: "病虫害斑块扩散，建议追加无人机采样。", tag: "Ⅱ级热点" }, { name: "河湾镇", text: "新增报案较快，查勘资源需前移。", tag: "Ⅱ级热点" }];
const TASKS = {
    dispatch: ["张敏 - 城关镇东关村：优先复核倒伏疑似案件。", "李凯 - 柳泉镇北坡村：追加病虫害样本采集。", "刘晴 - 南岗村：完成归档与复核意见。"],
    drone: ["柳泉镇北坡村航线：补飞高分影像。", "城关镇东关村航线：覆盖东侧倒伏斑块。", "河湾镇西陈村航线：待查勘案件，先采集底图。"],
    dispute: ["YT-20260302-013：面积差异 6.2 亩，建议专家会审。", "YT-20260305-021：影像时效争议，需核验采集时间。", "YT-20260308-009：存在重复报案嫌疑。"],
};

const state = {
    entry: "survey",
    subpage: { survey: "survey-workspace", review: "review-overview", governance: "governance-risk" },
    selectedCase: CASES[0],
    cropMode: "wheat",
    modelMode: "rule",
    themeKey: "ndvi",
    currentAnalysis: null,
    samples: [],
    reviews: [],
    evidence: [
        { title: "地块边界截图", detail: "由系统自动截取圈选范围，待归档。" },
        { title: "航拍现场照片", detail: "建议补充倒伏区近景照片与田埂照片。" },
    ],
    charts: {},
    map: null,
};

const el = (id) => document.getElementById(id);
const htmlList = (items, cls = "task-item") => items.map((item) => `<div class="${cls}"><strong>${item.title || item.name || item.label || "信息"}</strong><p>${item.detail || item.text || item.value || item}</p>${item.tag ? `<p>${item.tag}</p>` : ""}</div>`).join("");
const activeResult = () => state.currentAnalysis ? (state.modelMode === "ml" ? state.currentAnalysis.ml_result : state.currentAnalysis.rule_result) : null;
function recognizedArea() {
    if (!state.currentAnalysis) return 0;
    const total = state.currentAnalysis.total_area_mu;
    const ratios = state.currentAnalysis.state_ratios;
    const key = activeResult()?.label_key;
    if (key === "pest" || key === "lodging") return +(total * ratios.damage).toFixed(2);
    if (key === "harvest") return +(total * ratios.harvest).toFixed(2);
    if (key === "fallow") return +(total * ratios.fallow).toFixed(2);
    if (key === "non_agri") return +(total * Math.max(ratios.non_agri, 0.15)).toFixed(2);
    return 0;
}

function setHero() {
    el("entryTitle").textContent = ENTRY_META[state.entry][0];
    el("entryDesc").textContent = ENTRY_META[state.entry][1];
}

function switchEntry(entry) {
    state.entry = entry;
    document.querySelectorAll(".entry-card").forEach((n) => n.classList.toggle("active", n.dataset.entry === entry));
    document.querySelectorAll("[data-entry-panel]").forEach((n) => n.classList.toggle("active", n.dataset.entryPanel === entry));
    setHero();
}

function switchSubpage(key) {
    const entry = key.split("-")[0];
    state.subpage[entry] = key;
    document.querySelectorAll(`[data-entry-panel="${entry}"] .subnav-link`).forEach((n) => n.classList.toggle("active", n.dataset.subnav === key));
    document.querySelectorAll(`[data-entry-panel="${entry}"] [data-subpage]`).forEach((n) => n.classList.toggle("active", n.dataset.subpage === key));
}

function initNav() {
    document.querySelectorAll(".entry-card").forEach((n) => n.addEventListener("click", () => switchEntry(n.dataset.entry)));
    document.querySelectorAll(".subnav-link").forEach((n) => n.addEventListener("click", () => switchSubpage(n.dataset.subnav)));
    document.querySelectorAll("[data-model-mode]").forEach((n) => n.addEventListener("click", () => {
        state.modelMode = n.dataset.modelMode;
        document.querySelectorAll("[data-model-mode]").forEach((x) => x.classList.toggle("active", x === n));
        if (state.currentAnalysis) { renderAnalysis(); rerenderOverlay(); }
    }));
    document.querySelectorAll("[data-theme-key]").forEach((n) => n.addEventListener("click", () => {
        state.themeKey = n.dataset.themeKey;
        document.querySelectorAll("[data-theme-key]").forEach((x) => x.classList.toggle("active", x === n));
        if (state.currentAnalysis) { renderThematic(); rerenderOverlay(); renderHistory(); }
    }));
    el("cropModeSelect").addEventListener("change", (e) => { state.cropMode = e.target.value; });
}

function initFilters() {
    const build = (id, list, first) => { el(id).innerHTML = [`<option value="">${first}</option>`].concat(list.map((v) => `<option value="${v}">${v}</option>`)).join(""); };
    build("filterTown", [...new Set(CASES.map((x) => x.town))], "全部乡镇");
    build("filterCrop", [...new Set(CASES.map((x) => x.crop))], "全部作物");
    build("filterStatus", STATUS_FLOW, "全部状态");
    build("filterRisk", ["高风险", "低风险"], "全部风险");
    build("filterSource", [...new Set(CASES.map((x) => x.imageSource))], "全部来源");
    ["filterTown", "filterCrop", "filterStatus", "filterRisk", "filterSource"].forEach((id) => el(id).addEventListener("change", renderCases));
}

function filteredCases() {
    return CASES.filter((x) => (!el("filterTown").value || x.town === el("filterTown").value)
        && (!el("filterCrop").value || x.crop === el("filterCrop").value)
        && (!el("filterStatus").value || x.status === el("filterStatus").value)
        && (!el("filterRisk").value || x.riskLevel === el("filterRisk").value)
        && (!el("filterSource").value || x.imageSource === el("filterSource").value));
}

function renderCases() {
    const items = filteredCases();
    if (!items.find((x) => x.id === state.selectedCase.id)) state.selectedCase = items[0] || CASES[0];
    el("caseTableBody").innerHTML = items.map((x) => `<tr data-case-id="${x.id}" class="${x.id === state.selectedCase.id ? "active" : ""}"><td>${x.id}</td><td>${x.town} / ${x.village}</td><td>${x.crop}</td><td>${x.disasterType}</td><td>${Math.round(x.confidence * 100)}%</td><td>${x.imageSource}</td><td>${x.status}</td></tr>`).join("") || `<tr><td colspan="7">暂无符合条件的案件。</td></tr>`;
    el("caseTableBody").querySelectorAll("tr[data-case-id]").forEach((n) => n.addEventListener("click", () => { state.selectedCase = CASES.find((x) => x.id === n.dataset.caseId) || CASES[0]; renderCases(); renderCaseDetail(); renderReview(); renderReport(); }));
    renderCaseDetail();
}

function renderCaseDetail() {
    const c = state.selectedCase;
    el("caseDetailTitle").textContent = c.id;
    el("caseDetailList").innerHTML = [["报案人", c.reporter], ["地块位置", c.location], ["作物类型", c.crop], ["受灾时间", c.disasterTime], ["影像来源", c.imageSource], ["查勘员", c.surveyor], ["风险等级", c.riskLevel], ["分析结果", c.result]].map(([a, b]) => `<div class="detail-item"><strong>${a}</strong><p>${b}</p></div>`).join("");
    const idx = STATUS_FLOW.indexOf(c.status);
    el("statusFlow").innerHTML = STATUS_FLOW.map((x, i) => `<div class="status-step ${i <= idx ? "active" : ""}">${x}</div>`).join("");
}

function renderStaticSections() {
    el("miniStatList").innerHTML = MINI_STATS.map((x) => `<div>${x}</div>`).join("");
    el("dashboardMetricCards").innerHTML = DASHBOARD.map((x) => `<div class="metric-card"><span>${x.label}</span><strong>${x.value}</strong></div>`).join("");
    el("heatList").innerHTML = htmlList(HEAT);
    el("dispatchTaskList").innerHTML = htmlList(TASKS.dispatch);
    el("droneTaskList").innerHTML = htmlList(TASKS.drone);
    el("disputeCaseList").innerHTML = htmlList(TASKS.dispute);
    renderEvidence();
    renderHistory();
    renderReview();
    renderReport();
    renderRiskLab();
}

function renderEvidence() {
    el("fieldEvidenceList").innerHTML = htmlList(state.evidence, "evidence-item");
    el("fieldTaskList").innerHTML = htmlList(["到达地块后记录查勘轨迹起点与终点。", "采集 3 组近景照片覆盖灾损核心区。", "补充上传机载影像、现场照片与人工说明。"]);
    el("archiveEvidenceList").innerHTML = htmlList(["原始影像文件", "地块边界与受灾图层截图", "面积统计表", "人工复核记录", "现场取证照片", "导出报告与证据清单"], "evidence-item");
}

function renderHistory() {
    const a = state.currentAnalysis;
    const c = state.selectedCase;
    const result = activeResult();
    const label = result?.label || c.disasterType;
    const conf = result ? `${Math.round(result.confidence * 100)}%` : `${Math.round(c.confidence * 100)}%`;
    el("historyCompareList").innerHTML = htmlList([
        { title: "本次查勘结果", detail: `${label}，当前判定置信度 ${conf}。` },
        { title: "历史查勘记录", detail: "2025-09-18 同地块记录：受灾面积 7.4 亩，判定为病虫害轻度异常。" },
        { title: "同期长势对比", detail: `去年同期 NDVI 高于本次 0.18；${a ? `${state.themeKey.toUpperCase()} 均值 ${a.thematic_layers[state.themeKey].mean}。` : "等待分析后展示专题指标。 "}` },
    ], "compare-item");
    el("historyMetrics").innerHTML = htmlList([
        "重复报案核查：180 天内同位置存在 1 次历史报案。",
        `历史植被异常提醒：${c.town}${c.village} 地块已出现连续两季植被异常。`,
        "同一地块对比支持引出风控与复核故事。"
    ]);
}

function renderReview() {
    const a = state.currentAnalysis;
    const c = state.selectedCase;
    const result = activeResult();
    el("reviewCompareList").innerHTML = htmlList([
        { title: "初判结果", detail: a ? `${result.label}，识别面积 ${recognizedArea()} 亩。` : c.result },
        { title: "模型结果 vs 人工意见", detail: a ? `规则：${a.rule_result.label} (${Math.round(a.rule_result.confidence * 100)}%)；机器学习：${a.ml_result.label} (${Math.round(a.ml_result.confidence * 100)}%)。` : "等待当前案件关联的分析结果。" },
        { title: "人工修正入口", detail: "可修正面积、灾害原因，并决定是否进入复勘流程。" },
    ], "compare-item");
    el("reviewLogList").innerHTML = (state.reviews.length ? state.reviews.slice().reverse().slice(0, 6).map((x) => ({ title: `${x.case_id || "未绑定案件"} · ${x.corrected_label || "待定"}`, detail: `${x.comment || "无附加说明"} / ${x.reviewer || "系统用户"} / ${x.created_at || ""}` })) : [{ title: "暂无复核记录", detail: "提交人工复核后会写入这里。" }]).map((x) => `<div class="log-item"><strong>${x.title}</strong><p>${x.detail}</p></div>`).join("");
}

function renderReport() {
    const a = state.currentAnalysis;
    const c = state.selectedCase;
    const result = activeResult();
    const label = result?.label || c.disasterType;
    const area = a ? `${recognizedArea()} 亩` : "待核定";
    const engine = a?.engine_type || c.imageSource;
    el("reportPreview").innerHTML = htmlList([
        { title: "农户说明书", detail: `系统识别到地块存在“${label}”特征，当前估算影响面积约 ${area}。` },
        { title: "保险归档报告", detail: `分析引擎：${engine}；案件编号：${c.id}；支持附加原始影像、专题图层、面积统计与复核意见。` },
        { title: "证据包下载内容", detail: "包含受灾图层截图、专题指数摘要、机器学习判定卡、人工复核记录与现场证据清单。" },
    ], "compare-item");
}

function renderRiskLab() {
    const alerts = ["重复报案识别：当前案件周边 180 天内存在 1 次历史报案。", "非农地物排异：建议对地块边缘道路与建筑区域做人工排除。", "影像时效核验：需核验采集影像是否与报案时间一致。"];
    const result = activeResult();
    if (result?.label_key === "harvest" || result?.label_key === "fallow") alerts.unshift(`非灾害状态识别：系统当前识别为“${result.label}”，建议避免误判。`);
    el("riskCheckList").innerHTML = htmlList(alerts);
    if (!state.currentAnalysis) { el("nonDisasterList").innerHTML = `<div class="detail-item"><strong>等待分析结果</strong><p>分析后展示收割 / 休耕 / 非农地物识别占比。</p></div>`; }
    else {
        const r = state.currentAnalysis.state_ratios;
        el("nonDisasterList").innerHTML = [["正常收割识别", `${Math.round(r.harvest * 100)}%`], ["休耕识别", `${Math.round(r.fallow * 100)}%`], ["非农地物识别", `${Math.round(r.non_agri * 100)}%`]].map(([a, b]) => `<div class="detail-item"><strong>${a}</strong><p>${b}</p></div>`).join("");
    }
    el("alertList").innerHTML = htmlList(alerts.slice(0, 3));
}

function renderFeatures() {
    const f = state.currentAnalysis?.feature_vector;
    el("currentFeatureList").innerHTML = f ? Object.entries(f).map(([k, v]) => `<div class="feature-item"><strong>${k.toUpperCase()}</strong><p>${v}</p></div>`).join("") : `<div class="feature-item"><strong>暂无分析结果</strong><p>完成一次分析后，这里会显示当前图斑的特征向量。</p></div>`;
}

function renderThematic() {
    const a = state.currentAnalysis;
    el("thematicCardGrid").innerHTML = Object.entries(a.thematic_layers).map(([k, v]) => `<div class="detail-item" style="${k === state.themeKey ? "border-color: rgba(31,91,61,0.35);" : ""}"><strong>${v.label}</strong><p>均值：${v.mean}</p><p>区间：${v.low} ~ ${v.high}</p><p>状态：${v.status}</p></div>`).join("");
}

function renderResultCards() {
    const a = state.currentAnalysis;
    const result = activeResult();
    const card = (r, t) => `<div class="detail-item"><strong>${t}</strong><p>类别：${r.label}</p><p>置信度：${Math.round(r.confidence * 100)}%</p><p>Top3 特征依据：${r.top_features.map((x) => x.label).join(" / ") || "暂无"}</p></div>`;
    el("ruleResultCard").innerHTML = card(a.rule_result, "规则判定");
    el("mlResultCard").innerHTML = card(a.ml_result, "机器学习判定");
    el("finalExplainCard").innerHTML = `<strong>结果解释卡</strong><br>${result.explanation}<br>使用 ${state.modelMode === "ml" ? "机器学习判定" : "规则判定"} 作为当前工作台默认结果。`;
}

function renderSummary() {
    const a = state.currentAnalysis, result = activeResult();
    el("analysisSummaryCards").innerHTML = [
        ["当前作物模式", a.crop_mode_label, "支持小麦 / 玉米模式切换"],
        ["最终判定", result.label, `当前使用${state.modelMode === "ml" ? "机器学习" : "规则"}结果`],
        ["识别面积", `${recognizedArea()} 亩`, "按当前最终判定口径统计"],
        ["判定置信度", `${Math.round(result.confidence * 100)}%`, "结果可用于复核与归档"],
    ].map(([l, v, h]) => `<div class="summary-card"><span>${l}</span><strong>${v}</strong><span>${h}</span></div>`).join("");
}

function renderChart() {
    const ctx = el("spectralChart").getContext("2d");
    if (state.charts.spectral) state.charts.spectral.destroy();
    const a = state.currentAnalysis;
    state.charts.spectral = new Chart(ctx, { type: "line", data: { labels: ["蓝光", "绿光", "红光", "近红外"], datasets: [{ label: "正常像素均值", data: a.spectral_data.healthy, borderColor: "#1f5b3d", backgroundColor: "rgba(31,91,61,0.14)", fill: true, tension: 0.34 }, { label: "异常像素均值", data: a.spectral_data.damaged, borderColor: "#b3422f", backgroundColor: "rgba(179,66,47,0.12)", fill: true, tension: 0.34 }] }, options: { responsive: true, maintainAspectRatio: false, plugins: { title: { display: true, text: "光谱分析面板" } } } });
}

function renderAnalysis() {
    if (!state.currentAnalysis) { el("analysisReportPanel").hidden = true; renderFeatures(); return; }
    el("analysisReportPanel").hidden = false;
    renderSummary();
    renderResultCards();
    renderThematic();
    renderChart();
    renderFeatures();
    renderHistory();
    renderReview();
    renderReport();
    renderRiskLab();
}

async function loadApiData() {
    try {
        const h = await fetch(`${API_BASE}/api/health`).then((r) => r.json());
        if (h.status === "ok") el("apiHealthBadge").textContent = "后端状态：在线";
    } catch { el("apiHealthBadge").textContent = "后端状态：未连接"; }
    try { state.samples = (await fetch(`${API_BASE}/api/samples`).then((r) => r.json())).items || []; } catch { state.samples = []; }
    try { state.reviews = (await fetch(`${API_BASE}/api/reviews`).then((r) => r.json())).items || []; } catch { state.reviews = []; }
    el("sampleList").innerHTML = state.samples.length ? state.samples.slice().reverse().slice(0, 8).map((x) => `<div class="sample-item"><strong>${x.label} · ${x.crop_mode === "corn" ? "玉米" : "小麦"}</strong><p>${x.notes || "无备注"}</p><p>${x.created_at}</p></div>`).join("") : `<div class="sample-item"><strong>暂无样本</strong><p>完成分析后，可将当前图斑保存为训练样本。</p></div>`;
    renderReview();
}

function initButtons() {
    el("generateReportBtn").addEventListener("click", renderReport);
    el("exportPdfBtn").addEventListener("click", () => alert("当前为演示环境，PDF 导出接口待接到后端文档服务。"));
    el("addEvidenceBtn").addEventListener("click", () => { state.evidence.push({ title: "新增外业证据", detail: el("evidenceRemarkInput").value.trim() || "现场补充取证材料" }); el("evidenceRemarkInput").value = ""; renderEvidence(); });
    el("saveSampleBtn").addEventListener("click", () => saveSample());
    el("saveSampleQuickBtn").addEventListener("click", () => saveSample(activeResult()?.label_key || "pest"));
    el("submitReviewBtn").addEventListener("click", submitReview);
}

async function saveSample(labelKey) {
    if (!state.currentAnalysis) return alert("请先完成一次分析，再保存训练样本。");
    const body = { label_key: labelKey || el("sampleLabelSelect").value, crop_mode: state.currentAnalysis.crop_mode, feature_vector: state.currentAnalysis.feature_vector, notes: el("sampleNotesInput").value.trim(), geometry: state.map?.geometry ? state.map.geometry.toJSON() : null };
    const res = await fetch(`${API_BASE}/api/samples`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) }).then((r) => r.json()).catch(() => null);
    if (!res || res.error) return alert(res?.error || "样本保存失败。");
    state.samples.push(res.item);
    el("sampleList").innerHTML = state.samples.slice().reverse().slice(0, 8).map((x) => `<div class="sample-item"><strong>${x.label} · ${x.crop_mode === "corn" ? "玉米" : "小麦"}</strong><p>${x.notes || "无备注"}</p><p>${x.created_at}</p></div>`).join("");
    alert("样本保存成功。");
}

async function submitReview() {
    const body = { case_id: state.selectedCase.id, reviewer: el("reviewerInput").value.trim() || "系统用户", corrected_label: el("reviewLabelSelect").value, corrected_area_mu: el("reviewAreaInput").value, comment: el("reviewCommentInput").value.trim(), requires_resurvey: el("reviewResurveyCheckbox").checked };
    const res = await fetch(`${API_BASE}/api/reviews`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) }).then((r) => r.json()).catch(() => null);
    if (!res || res.error) return alert(res?.error || "提交复核失败。");
    state.reviews.push(res.item); renderReview(); alert("人工复核已提交。");
}

function initCharts() {
    state.charts.town = new Chart(el("townRankingChart").getContext("2d"), { type: "bar", data: { labels: TOWNS.map((x) => x.town), datasets: [{ label: "受灾面积(亩)", data: TOWNS.map((x) => x.area), backgroundColor: ["#1f5b3d", "#327455", "#5a9277", "#94ab6a", "#d68a2f"], borderRadius: 10 }] }, options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false } } } });
    state.charts.cause = new Chart(el("causeChart").getContext("2d"), { type: "doughnut", data: { labels: ["病虫害", "物理倒伏"], datasets: [{ data: [58, 42], backgroundColor: ["#1f5b3d", "#d68a2f"] }] }, options: { responsive: true, maintainAspectRatio: false } });
}

function initPage() { setHero(); initNav(); initFilters(); initButtons(); renderCases(); renderStaticSections(); initCharts(); loadApiData(); }
initPage();

require(["esri/Map", "esri/views/MapView", "esri/layers/WebTileLayer", "esri/Basemap", "esri/layers/GraphicsLayer", "esri/widgets/Sketch", "esri/geometry/geometryEngine", "esri/Graphic", "esri/geometry/Point", "esri/geometry/Extent", "esri/geometry/support/webMercatorUtils"], function(Map, MapView, WebTileLayer, Basemap, GraphicsLayer, Sketch, geometryEngine, Graphic, Point, Extent, webMercatorUtils) {
    const tk = "851ea4614a87e8397c5f56693d2fb73b";
    const vec = new WebTileLayer({ urlTemplate: `https://t0.tianditu.gov.cn/vec_w/wmts?SERVICE=WMTS&REQUEST=GetTile&VERSION=1.0.0&LAYER=vec&STYLE=default&TILEMATRIXSET=w&FORMAT=tiles&TILEMATRIX={level}&TILEROW={row}&TILECOL={col}&tk=${tk}` });
    const cva = new WebTileLayer({ urlTemplate: `https://t0.tianditu.gov.cn/cva_w/wmts?SERVICE=WMTS&REQUEST=GetTile&VERSION=1.0.0&LAYER=cva&STYLE=default&TILEMATRIXSET=w&FORMAT=tiles&TILEMATRIX={level}&TILEROW={row}&TILECOL={col}&tk=${tk}` });
    const img = new WebTileLayer({ urlTemplate: `https://t0.tianditu.gov.cn/img_w/wmts?SERVICE=WMTS&REQUEST=GetTile&VERSION=1.0.0&LAYER=img&STYLE=default&TILEMATRIXSET=w&FORMAT=tiles&TILEMATRIX={level}&TILEROW={row}&TILECOL={col}&tk=${tk}` });
    const cia = new WebTileLayer({ urlTemplate: `https://t0.tianditu.gov.cn/cia_w/wmts?SERVICE=WMTS&REQUEST=GetTile&VERSION=1.0.0&LAYER=cia&STYLE=default&TILEMATRIXSET=w&FORMAT=tiles&TILEMATRIX={level}&TILEROW={row}&TILECOL={col}&tk=${tk}` });
    const map = new Map({ basemap: new Basemap({ baseLayers: [vec, cva] }), layers: [new GraphicsLayer(), new GraphicsLayer()] });
    const resultLayer = map.layers.getItemAt(0), drawLayer = map.layers.getItemAt(1);
    const view = new MapView({ container: "viewDiv", map, center: [113.6253, 34.7466], zoom: 13, constraints: { maxZoom: 17 }, ui: { components: ["zoom", "compass"] } });
    let globalTiffFile = null;
    state.map = { geometry: null, rerender: renderOverlay };

    el("btn-upload-drone").addEventListener("click", () => el("drone-upload-input").click());
    el("drone-upload-input").addEventListener("change", async (e) => {
        globalTiffFile = e.target.files[0]; if (!globalTiffFile) return;
        const btn = el("btn-upload-drone"); btn.textContent = "解析 GeoTIFF 中...";
        try {
            const image = await (await GeoTIFF.fromArrayBuffer(await globalTiffFile.arrayBuffer())).getImage();
            const box = image.getBoundingBox(), keys = image.getGeoKeys(); let wkid = keys?.ProjectedCSTypeGeoKey || keys?.GeographicTypeGeoKey || 4326;
            await view.goTo(new Extent({ xmin: box[0], ymin: box[1], xmax: box[2], ymax: box[3], spatialReference: { wkid } }), { duration: 1600 });
            btn.textContent = "无人机影像已挂载";
        } catch { globalTiffFile = null; btn.textContent = "上传无人机正射影像"; alert("GeoTIFF 解析失败，请检查文件。"); }
    });
    el("btnSearch").addEventListener("click", async () => {
        const q = el("searchInput").value.trim(); if (!q) return;
        el("btnSearch").textContent = "检索中...";
        try {
            const d = await fetch(`https://nominatim.openstreetmap.org/search?format=json&q=${q}&countrycodes=cn`).then((r) => r.json());
            if (d?.length) view.goTo({ center: [parseFloat(d[0].lon), parseFloat(d[0].lat)], zoom: 16 }); else alert("未找到该位置。");
        } finally { el("btnSearch").textContent = "定位"; }
    });
    el("btn-vector").addEventListener("click", () => { map.basemap = new Basemap({ baseLayers: [vec, cva] }); el("btn-vector").classList.add("active"); el("btn-satellite").classList.remove("active"); });
    el("btn-satellite").addEventListener("click", () => { map.basemap = new Basemap({ baseLayers: [img, cia] }); el("btn-satellite").classList.add("active"); el("btn-vector").classList.remove("active"); });
    view.when(() => {
        const sketch = new Sketch({ layer: drawLayer, view, creationMode: "update", availableCreateTools: ["polygon", "rectangle", "circle"] });
        view.ui.add(sketch, "top-right");
        sketch.on("create", (e) => { if (e.state === "complete") { state.map.geometry = drawLayer.graphics.getItemAt(0)?.geometry || e.graphic.geometry; resultLayer.removeAll(); el("btn-analyze").disabled = false; } });
    });
    el("btn-analyze").addEventListener("click", async () => {
        const geom = drawLayer.graphics.getItemAt(0)?.geometry; if (!geom) return;
        const btn = el("btn-analyze"); btn.disabled = true;
        const wgs = webMercatorUtils.webMercatorToGeographic(geom), areaMu = Math.abs(geometryEngine.geodesicArea(geom, "square-meters")) * 0.0015;
        try {
            let response;
            if (globalTiffFile) {
                const fd = new FormData(); fd.append("file", globalTiffFile); fd.append("geometry", JSON.stringify(wgs.toJSON())); fd.append("area_mu", areaMu); fd.append("crop_mode", state.cropMode); fd.append("model_mode", state.modelMode);
                btn.textContent = "解析本地高分影像中..."; response = await fetch(`${API_BASE}/api/analyze`, { method: "POST", body: fd });
            } else {
                btn.textContent = "请求 Sentinel-2 数据中...";
                response = await fetch(`${API_BASE}/api/analyze`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ geometry: JSON.stringify(wgs.toJSON()), area_mu: areaMu, crop_mode: state.cropMode, model_mode: state.modelMode }) });
            }
            const result = await response.json(); if (!response.ok || result.status !== "success") throw new Error(result.error || "分析失败");
            state.currentAnalysis = result; renderAnalysis(); renderOverlay(); renderStaticSections();
        } catch (e) { alert(e.message || "无法连接分析服务。"); } finally { btn.textContent = "提交智能定损分析"; btn.disabled = false; }
    });

    function renderOverlay() {
        resultLayer.removeAll(); const polygon = drawLayer.graphics.getItemAt(0)?.geometry; if (!polygon || !state.currentAnalysis) return;
        const palette = state.currentAnalysis.thematic_layers[state.themeKey]?.palette || ["#b3422f", "#d68a2f", "#1f5b3d"];
        const key = activeResult()?.label_key, ratios = state.currentAnalysis.state_ratios, ratio = ({ pest: ratios.damage, lodging: ratios.damage, harvest: ratios.harvest, fallow: ratios.fallow, non_agri: ratios.non_agri, healthy: 0 })[key] ?? ratios.damage;
        const ex = polygon.extent, xs = (ex.xmax - ex.xmin) / 18, ys = (ex.ymax - ex.ymin) / 18;
        for (let x = ex.xmin; x < ex.xmax; x += xs) for (let y = ex.ymin; y < ex.ymax; y += ys) {
            const point = new Point({ x, y, spatialReference: view.spatialReference }); if (!geometryEngine.contains(polygon, point)) continue;
            const color = Math.random() < ratio ? rgba(palette[0], 0.58) : rgba(palette[2], 0.28);
            resultLayer.add(new Graphic({ geometry: { type: "polygon", rings: [[[x, y], [x + xs, y], [x + xs, y + ys], [x, y + ys], [x, y]]], spatialReference: view.spatialReference }, symbol: { type: "simple-fill", color, outline: { color: [0, 0, 0, 0], width: 0 } } }));
        }
        drawLayer.graphics.getItemAt(0).symbol = { type: "simple-fill", color: [0, 0, 0, 0], outline: { color: "#1f5b3d", width: 2 } };
    }

    function rerenderOverlay() { renderOverlay(); }
});

function rgba(hex, a) { const v = parseInt(hex.replace("#", ""), 16); return [(v >> 16) & 255, (v >> 8) & 255, v & 255, a]; }
