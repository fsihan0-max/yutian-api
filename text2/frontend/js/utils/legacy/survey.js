const surveyState = {
    cropMode: "wheat",
    modelMode: "rule",
    themeKey: "ndvi",
    currentAnalysis: null,
    samples: [],
    evidence: [
        { title: "地块边界截图", detail: "由系统自动截取圈选范围，待归档。" },
        { title: "现场照片", detail: "建议补充倒伏区近景照片与田埂照片。" }
    ],
    charts: {},
    map: null
};

function activeResult() {
    if (!surveyState.currentAnalysis) return null;
    return surveyState.modelMode === "ml" ? surveyState.currentAnalysis.ml_result : surveyState.currentAnalysis.rule_result;
}

function recognizedArea() {
    if (!surveyState.currentAnalysis) return 0;
    const total = surveyState.currentAnalysis.total_area_mu;
    const ratios = surveyState.currentAnalysis.state_ratios;
    const key = activeResult()?.label_key;
    if (key === "pest" || key === "lodging") return +(total * ratios.damage).toFixed(2);
    if (key === "harvest") return +(total * ratios.harvest).toFixed(2);
    if (key === "fallow") return +(total * ratios.fallow).toFixed(2);
    if (key === "non_agri") return +(total * Math.max(ratios.non_agri, 0.15)).toFixed(2);
    return 0;
}

function renderHistorySection() {
    const analysis = surveyState.currentAnalysis;
    const result = activeResult();
    AppUI.byId("historyCompareList").innerHTML = AppUI.cardList([
        { title: "同地块历史", detail: `本次判定：${result ? result.label : "待分析"}；2025-09-18 历史记录为病虫害轻度异常。` },
        { title: "同期长势", detail: analysis ? `${surveyState.themeKey.toUpperCase()} 当前均值 ${analysis.thematic_layers[surveyState.themeKey].mean}，去年同期高出约 0.18。` : "完成分析后显示同期长势对比。" },
        { title: "重复报案", detail: "180 天内同位置存在 1 次历史报案，建议进入复核视图。" }
    ], "compare-item");
    AppUI.byId("historyMetrics").innerHTML = AppUI.cardList([
        { title: "长势趋势", detail: "当前地块长势较去年同期有下降。" },
        { title: "历史异常提醒", detail: "同区域已连续两季出现植被异常。" },
        { title: "复核建议", detail: "建议结合历史影像与现场情况联合判定。" }
    ]);
}

function renderEvidenceSection() {
    AppUI.byId("fieldEvidenceList").innerHTML = AppUI.cardList(surveyState.evidence, "evidence-item");
    AppUI.byId("fieldTaskList").innerHTML = AppUI.cardList([
        { title: "照片上传", detail: "到达地块后至少采集 3 组现场照片。" },
        { title: "无人机影像", detail: "优先上传高分正射影像覆盖核心异常区。" },
        { title: "证据清单", detail: "将截图、影像、说明统一加入证据清单。" }
    ]);
}

function renderSamples() {
    AppUI.byId("sampleList").innerHTML = surveyState.samples.length
        ? surveyState.samples.slice().reverse().slice(0, 8).map((item) => `<div class="sample-item"><strong>${item.label} · ${item.crop_mode === "corn" ? "玉米" : "小麦"}</strong><p>${item.notes || "无备注"}</p><p>${item.created_at}</p></div>`).join("")
        : `<div class="sample-item"><strong>暂无样本</strong><p>完成分析后，可将当前图斑保存为训练样本。</p></div>`;
}

function renderFeatures() {
    const features = surveyState.currentAnalysis?.feature_vector;
    AppUI.byId("currentFeatureList").innerHTML = features
        ? Object.entries(features).map(([key, value]) => `<div class="feature-item"><strong>${key.toUpperCase()}</strong><p>${value}</p></div>`).join("")
        : `<div class="feature-item"><strong>暂无分析结果</strong><p>完成一次分析后，这里会显示当前图斑的特征向量。</p></div>`;
}

function renderSummary() {
    const analysis = surveyState.currentAnalysis;
    const result = activeResult();
    AppUI.byId("analysisSummaryCards").innerHTML = [
        ["当前作物模式", analysis.crop_mode_label, "支持小麦 / 玉米模式切换"],
        ["当前判定", result.label, `当前使用${surveyState.modelMode === "ml" ? "机器学习" : "规则"}结果`],
        ["识别面积", `${recognizedArea()} 亩`, "按当前判定口径统计"],
        ["判定置信度", `${Math.round(result.confidence * 100)}%`, "结果可用于复核与归档"]
    ].map(([label, value, hint]) => `<div class="summary-card"><span>${label}</span><strong>${value}</strong><span>${hint}</span></div>`).join("");
}

function renderResultCards() {
    const analysis = surveyState.currentAnalysis;
    const result = activeResult();
    const card = (item, title) => `<div class="detail-item"><strong>${title}</strong><p>类别：${item.label}</p><p>置信度：${Math.round(item.confidence * 100)}%</p><p>Top3 特征依据：${item.top_features.map((x) => x.label).join(" / ") || "暂无"}</p></div>`;
    AppUI.byId("ruleResultCard").innerHTML = card(analysis.rule_result, "规则判定");
    AppUI.byId("mlResultCard").innerHTML = card(analysis.ml_result, "机器学习判定");
    AppUI.byId("finalExplainCard").innerHTML = `<strong>分析结果</strong><br>${result.explanation}<br>支持解释为什么判成灾害、收割或休耕。`;
}

function renderThematic() {
    AppUI.byId("thematicCardGrid").innerHTML = Object.entries(surveyState.currentAnalysis.thematic_layers).map(([key, item]) => `
        <div class="detail-item" style="${key === surveyState.themeKey ? "border-color: rgba(31,92,62,0.35);" : ""}">
            <strong>${item.label}</strong>
            <p>均值：${item.mean}</p>
            <p>区间：${item.low} ~ ${item.high}</p>
            <p>状态：${item.status}</p>
        </div>
    `).join("");
}

function renderChart() {
    const ctx = AppUI.byId("spectralChart").getContext("2d");
    if (surveyState.charts.spectral) surveyState.charts.spectral.destroy();
    const data = surveyState.currentAnalysis.spectral_data;
    surveyState.charts.spectral = new Chart(ctx, {
        type: "line",
        data: {
            labels: ["蓝光", "绿光", "红光", "近红外"],
            datasets: [
                { label: "正常像素均值", data: data.healthy, borderColor: "#1f5c3e", backgroundColor: "rgba(31,92,62,0.14)", fill: true, tension: 0.34 },
                { label: "异常像素均值", data: data.damaged, borderColor: "#b2432f", backgroundColor: "rgba(178,67,47,0.12)", fill: true, tension: 0.34 }
            ]
        },
        options: { responsive: true, maintainAspectRatio: false, plugins: { title: { display: true, text: "分析结果" } } }
    });
}

function renderAnalysis() {
    if (!surveyState.currentAnalysis) {
        AppUI.byId("analysisReportPanel").hidden = true;
        renderFeatures();
        renderHistorySection();
        return;
    }
    AppUI.byId("analysisReportPanel").hidden = false;
    renderSummary();
    renderResultCards();
    renderThematic();
    renderChart();
    renderFeatures();
    renderHistorySection();
}

async function loadSamples() {
    try {
        const result = await fetch(`${AppUI.apiBase}/api/samples`).then((res) => res.json());
        surveyState.samples = result.items || [];
    } catch (error) {
        surveyState.samples = [];
    }
    renderSamples();
}

async function saveSample(labelKey) {
    if (!surveyState.currentAnalysis) {
        alert("请先完成一次分析，再保存训练样本。");
        return;
    }
    const body = {
        label_key: labelKey,
        crop_mode: surveyState.currentAnalysis.crop_mode,
        feature_vector: surveyState.currentAnalysis.feature_vector,
        notes: AppUI.byId("sampleNotesInput").value.trim(),
        geometry: surveyState.map?.geometry ? surveyState.map.geometry.toJSON() : null
    };
    const result = await fetch(`${AppUI.apiBase}/api/samples`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body)
    }).then((res) => res.json()).catch(() => ({ error: "样本保存失败" }));
    if (result.error) {
        alert(result.error);
        return;
    }
    surveyState.samples.push(result.item);
    renderSamples();
    alert("样本保存成功。");
}

function bindSurveyControls() {
    AppUI.byId("cropModeSelect").addEventListener("change", (event) => {
        surveyState.cropMode = event.target.value;
    });
    document.querySelectorAll("[data-model-mode]").forEach((button) => {
        button.addEventListener("click", () => {
            surveyState.modelMode = button.dataset.modelMode;
            document.querySelectorAll("[data-model-mode]").forEach((item) => item.classList.toggle("active", item === button));
            if (surveyState.currentAnalysis) {
                renderAnalysis();
                if (surveyState.map?.rerender) surveyState.map.rerender();
            }
        });
    });
    document.querySelectorAll("[data-theme-key]").forEach((button) => {
        button.addEventListener("click", () => {
            surveyState.themeKey = button.dataset.themeKey;
            document.querySelectorAll("[data-theme-key]").forEach((item) => item.classList.toggle("active", item === button));
            if (surveyState.currentAnalysis) {
                renderThematic();
                renderHistorySection();
                if (surveyState.map?.rerender) surveyState.map.rerender();
            }
        });
    });
    document.querySelectorAll("[data-sample-label]").forEach((button) => {
        button.addEventListener("click", () => saveSample(button.dataset.sampleLabel));
    });
    AppUI.byId("saveSampleBtn").addEventListener("click", () => saveSample("pest"));
    AppUI.byId("addEvidenceBtn").addEventListener("click", () => {
        surveyState.evidence.push({ title: "新增证据", detail: AppUI.byId("evidenceRemarkInput").value.trim() || "现场补充取证材料" });
        AppUI.byId("evidenceRemarkInput").value = "";
        renderEvidenceSection();
    });
}

function initSurveyPage() {
    AppUI.initSectionNav("surveyPageTitle", {
        workspace: "智能定损工作台",
        samples: "样本标注",
        history: "历史对比",
        evidence: "外业取证"
    });
    AppUI.updateHealthBadge("surveyHealthBadge");
    bindSurveyControls();
    renderFeatures();
    renderHistorySection();
    renderEvidenceSection();
    loadSamples();
}

initSurveyPage();

require([
    "esri/Map",
    "esri/views/MapView",
    "esri/layers/WebTileLayer",
    "esri/Basemap",
    "esri/layers/GraphicsLayer",
    "esri/widgets/Sketch",
    "esri/geometry/geometryEngine",
    "esri/Graphic",
    "esri/geometry/Point",
    "esri/geometry/Extent",
    "esri/geometry/support/webMercatorUtils"
], function(Map, MapView, WebTileLayer, Basemap, GraphicsLayer, Sketch, geometryEngine, Graphic, Point, Extent, webMercatorUtils) {
    const tk = "851ea4614a87e8397c5f56693d2fb73b";
    const vec = new WebTileLayer({ urlTemplate: `https://t0.tianditu.gov.cn/vec_w/wmts?SERVICE=WMTS&REQUEST=GetTile&VERSION=1.0.0&LAYER=vec&STYLE=default&TILEMATRIXSET=w&FORMAT=tiles&TILEMATRIX={level}&TILEROW={row}&TILECOL={col}&tk=${tk}` });
    const cva = new WebTileLayer({ urlTemplate: `https://t0.tianditu.gov.cn/cva_w/wmts?SERVICE=WMTS&REQUEST=GetTile&VERSION=1.0.0&LAYER=cva&STYLE=default&TILEMATRIXSET=w&FORMAT=tiles&TILEMATRIX={level}&TILEROW={row}&TILECOL={col}&tk=${tk}` });
    const img = new WebTileLayer({ urlTemplate: `https://t0.tianditu.gov.cn/img_w/wmts?SERVICE=WMTS&REQUEST=GetTile&VERSION=1.0.0&LAYER=img&STYLE=default&TILEMATRIXSET=w&FORMAT=tiles&TILEMATRIX={level}&TILEROW={row}&TILECOL={col}&tk=${tk}` });
    const cia = new WebTileLayer({ urlTemplate: `https://t0.tianditu.gov.cn/cia_w/wmts?SERVICE=WMTS&REQUEST=GetTile&VERSION=1.0.0&LAYER=cia&STYLE=default&TILEMATRIXSET=w&FORMAT=tiles&TILEMATRIX={level}&TILEROW={row}&TILECOL={col}&tk=${tk}` });
    const resultLayer = new GraphicsLayer();
    const drawLayer = new GraphicsLayer();
    const map = new Map({ basemap: new Basemap({ baseLayers: [vec, cva] }), layers: [resultLayer, drawLayer] });
    const view = new MapView({ container: "viewDiv", map, center: [113.6253, 34.7466], zoom: 13, constraints: { maxZoom: 17 }, ui: { components: ["zoom", "compass"] } });
    let droneFile = null;

    surveyState.map = { geometry: null, rerender: renderOverlay };

    AppUI.byId("btn-upload-drone").addEventListener("click", () => AppUI.byId("drone-upload-input").click());
    AppUI.byId("drone-upload-input").addEventListener("change", async (event) => {
        droneFile = event.target.files[0];
        if (!droneFile) return;
        const button = AppUI.byId("btn-upload-drone");
        button.textContent = "解析 GeoTIFF 中...";
        try {
            const image = await (await GeoTIFF.fromArrayBuffer(await droneFile.arrayBuffer())).getImage();
            const bbox = image.getBoundingBox();
            const geoKeys = image.getGeoKeys();
            const wkid = geoKeys?.ProjectedCSTypeGeoKey || geoKeys?.GeographicTypeGeoKey || 4326;
            await view.goTo(new Extent({ xmin: bbox[0], ymin: bbox[1], xmax: bbox[2], ymax: bbox[3], spatialReference: { wkid } }), { duration: 1800 });
            button.textContent = "无人机影像已挂载";
        } catch (error) {
            droneFile = null;
            button.textContent = "上传无人机影像";
            alert("GeoTIFF 解析失败，请检查文件。");
        }
    });

    AppUI.byId("btnSearch").addEventListener("click", async () => {
        const query = AppUI.byId("searchInput").value.trim();
        if (!query) return;
        const button = AppUI.byId("btnSearch");
        button.textContent = "检索中...";
        try {
            const result = await fetch(`https://nominatim.openstreetmap.org/search?format=json&q=${query}&countrycodes=cn`).then((res) => res.json());
            if (result?.length) {
                view.goTo({ center: [parseFloat(result[0].lon), parseFloat(result[0].lat)], zoom: 16 });
            } else {
                alert("未找到该位置。");
            }
        } finally {
            button.textContent = "定位";
        }
    });

    AppUI.byId("btn-vector").addEventListener("click", () => {
        map.basemap = new Basemap({ baseLayers: [vec, cva] });
        AppUI.byId("btn-vector").classList.add("active");
        AppUI.byId("btn-satellite").classList.remove("active");
    });
    AppUI.byId("btn-satellite").addEventListener("click", () => {
        map.basemap = new Basemap({ baseLayers: [img, cia] });
        AppUI.byId("btn-satellite").classList.add("active");
        AppUI.byId("btn-vector").classList.remove("active");
    });

    view.when(() => {
        const sketch = new Sketch({ layer: drawLayer, view, creationMode: "update", availableCreateTools: ["polygon", "rectangle", "circle"] });
        view.ui.add(sketch, "top-right");
        sketch.on("create", (event) => {
            if (event.state === "complete") {
                surveyState.map.geometry = drawLayer.graphics.getItemAt(0)?.geometry || event.graphic.geometry;
                resultLayer.removeAll();
                AppUI.byId("btn-analyze").disabled = false;
            }
        });
    });

    AppUI.byId("btn-analyze").addEventListener("click", async () => {
        const geometry = drawLayer.graphics.getItemAt(0)?.geometry;
        if (!geometry) return;
        const button = AppUI.byId("btn-analyze");
        button.disabled = true;
        const wgsGeometry = webMercatorUtils.webMercatorToGeographic(geometry);
        const areaMu = Math.abs(geometryEngine.geodesicArea(geometry, "square-meters")) * 0.0015;
        try {
            let response;
            if (droneFile) {
                const formData = new FormData();
                formData.append("file", droneFile);
                formData.append("geometry", JSON.stringify(wgsGeometry.toJSON()));
                formData.append("area_mu", areaMu);
                formData.append("crop_mode", surveyState.cropMode);
                formData.append("model_mode", surveyState.modelMode);
                button.textContent = "解析本地高分影像中...";
                response = await fetch(`${AppUI.apiBase}/api/analyze`, { method: "POST", body: formData });
            } else {
                button.textContent = "请求 Sentinel-2 数据中...";
                response = await fetch(`${AppUI.apiBase}/api/analyze`, {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({
                        geometry: JSON.stringify(wgsGeometry.toJSON()),
                        area_mu: areaMu,
                        crop_mode: surveyState.cropMode,
                        model_mode: surveyState.modelMode
                    })
                });
            }
            const result = await response.json();
            if (!response.ok || result.status !== "success") {
                throw new Error(result.error || "分析失败");
            }
            surveyState.currentAnalysis = result;
            renderAnalysis();
            renderOverlay();
        } catch (error) {
            alert(error.message || "无法连接分析服务。");
        } finally {
            button.disabled = false;
            button.textContent = "提交分析";
        }
    });

    function renderOverlay() {
        resultLayer.removeAll();
        const polygon = drawLayer.graphics.getItemAt(0)?.geometry;
        if (!polygon || !surveyState.currentAnalysis) return;
        const palette = surveyState.currentAnalysis.thematic_layers[surveyState.themeKey]?.palette || ["#b2432f", "#d7892f", "#1f5c3e"];
        const ratios = surveyState.currentAnalysis.state_ratios;
        const key = activeResult()?.label_key;
        const ratioMap = { pest: ratios.damage, lodging: ratios.damage, harvest: ratios.harvest, fallow: ratios.fallow, non_agri: ratios.non_agri, healthy: 0 };
        const ratio = ratioMap[key] ?? ratios.damage;
        const extent = polygon.extent;
        const xStep = (extent.xmax - extent.xmin) / 18;
        const yStep = (extent.ymax - extent.ymin) / 18;
        for (let x = extent.xmin; x < extent.xmax; x += xStep) {
            for (let y = extent.ymin; y < extent.ymax; y += yStep) {
                const point = new Point({ x, y, spatialReference: view.spatialReference });
                if (!geometryEngine.contains(polygon, point)) continue;
                const color = Math.random() < ratio ? rgba(palette[0], 0.58) : rgba(palette[2], 0.28);
                resultLayer.add(new Graphic({
                    geometry: { type: "polygon", rings: [[[x, y], [x + xStep, y], [x + xStep, y + yStep], [x, y + yStep], [x, y]]], spatialReference: view.spatialReference },
                    symbol: { type: "simple-fill", color, outline: { color: [0, 0, 0, 0], width: 0 } }
                }));
            }
        }
        drawLayer.graphics.getItemAt(0).symbol = { type: "simple-fill", color: [0, 0, 0, 0], outline: { color: "#1f5c3e", width: 2 } };
    }
});

function rgba(hex, alpha) {
    const value = parseInt(hex.replace("#", ""), 16);
    return [(value >> 16) & 255, (value >> 8) & 255, value & 255, alpha];
}
