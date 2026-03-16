const caseStatusFlow = ["待受理", "待查勘", "分析中", "待复核", "已结案"];

const mockCases = [
    {
        id: "YT-20260316-001",
        town: "城关镇",
        village: "东关村",
        crop: "小麦",
        status: "待复核",
        reporter: "王建国",
        location: "东经 113.6253, 北纬 34.7466",
        disasterTime: "2026-03-14 18:30",
        imageSource: "无人机 GeoTIFF",
        surveyor: "张敏",
        result: "受灾面积 18.6 亩，疑似物理倒伏",
        causeType: "倒伏",
        area: 18.6
    },
    {
        id: "YT-20260316-002",
        town: "柳泉镇",
        village: "北坡村",
        crop: "玉米",
        status: "分析中",
        reporter: "赵红梅",
        location: "东经 113.6684, 北纬 34.7211",
        disasterTime: "2026-03-15 09:20",
        imageSource: "Sentinel-2",
        surveyor: "李凯",
        result: "NDVI 异常斑块明显，病虫害待确认",
        causeType: "病虫害",
        area: 25.2
    },
    {
        id: "YT-20260316-003",
        town: "河湾镇",
        village: "西陈村",
        crop: "花生",
        status: "待查勘",
        reporter: "陈玉兰",
        location: "东经 113.5911, 北纬 34.7842",
        disasterTime: "2026-03-13 14:05",
        imageSource: "待上传",
        surveyor: "王浩",
        result: "等待现场采集",
        causeType: "待判定",
        area: 0
    },
    {
        id: "YT-20260316-004",
        town: "城关镇",
        village: "南岗村",
        crop: "小麦",
        status: "已结案",
        reporter: "孙志强",
        location: "东经 113.6088, 北纬 34.7559",
        disasterTime: "2026-03-10 07:50",
        imageSource: "无人机 GeoTIFF",
        surveyor: "刘晴",
        result: "受灾面积 9.3 亩，病虫害轻度异常",
        causeType: "病虫害",
        area: 9.3
    }
];

const dashboardMetrics = [
    { label: "今日报案数", value: 27, suffix: "件" },
    { label: "今日完成查勘数", value: 11, suffix: "件" },
    { label: "无人机影像上传量", value: 16, suffix: "次" },
    { label: "异常案件预警", value: 5, suffix: "条" },
    { label: "病虫害占比", value: 58, suffix: "%" },
    { label: "倒伏占比", value: 42, suffix: "%" }
];

const townRanking = [
    { town: "城关镇", area: 48.1 },
    { town: "柳泉镇", area: 35.6 },
    { town: "河湾镇", area: 27.4 },
    { town: "双庙镇", area: 19.8 },
    { town: "北关镇", area: 12.5 }
];

const heatData = [
    { name: "城关镇", level: 92, description: "小麦倒伏集中，需优先复核。" },
    { name: "柳泉镇", level: 76, description: "病虫害斑块扩散，建议追加无人机采样。" },
    { name: "河湾镇", level: 63, description: "新增报案较快，查勘资源需前移。" }
];

const riskAlerts = [
    "案件 YT-20260316-002 影像时间距报案时间超过 36 小时，需人工确认时效性。",
    "案件 YT-20260316-001 检测到同地块历史重复报案记录，建议复核历史结果。",
    "案件 YT-20260316-004 框选区域包含疑似非农地物，存在面积高估风险。"
];

let selectedCase = mockCases[0];
let spectralChartInstance = null;
let townRankingChart = null;
let causeChart = null;

function initPlatformUi() {
    const moduleLabels = {
        survey: "智能查勘定损核心模块",
        cases: "案件管理模块",
        reports: "智能报告与证据输出模块",
        dashboard: "风险监管大屏模块"
    };

    document.querySelectorAll(".module-link").forEach((button) => {
        button.addEventListener("click", () => {
            const moduleName = button.dataset.module;
            document.querySelectorAll(".module-link").forEach((item) => item.classList.toggle("active", item === button));
            document.querySelectorAll("[data-module-panel]").forEach((panel) => {
                panel.classList.toggle("active", panel.dataset.modulePanel === moduleName);
            });
            document.getElementById("moduleTitle").textContent = moduleLabels[moduleName];
        });
    });

    document.getElementById("generateReportBtn").addEventListener("click", renderGeneratedReport);
    document.getElementById("exportPdfBtn").addEventListener("click", () => {
        alert("演示环境未接入真实 PDF 服务，可在下一步对接后端导出接口。");
    });
}

function renderMiniStats() {
    document.getElementById("miniStatList").innerHTML = [
        "今日新增案件 27 件",
        "待复核案件 8 件",
        "无人机影像 16 次",
        "高风险乡镇 3 个"
    ].map((item) => `<div class="mini-stat-item">${item}</div>`).join("");
}

function initCaseFilters() {
    const setOptions = (elementId, items, placeholder) => {
        const select = document.getElementById(elementId);
        select.innerHTML = [`<option value="">${placeholder}</option>`].concat(items.map((item) => `<option value="${item}">${item}</option>`)).join("");
    };

    setOptions("filterTown", [...new Set(mockCases.map((item) => item.town))], "全部乡镇");
    setOptions("filterVillage", [...new Set(mockCases.map((item) => item.village))], "全部行政村");
    setOptions("filterCrop", [...new Set(mockCases.map((item) => item.crop))], "全部作物");
    setOptions("filterStatus", caseStatusFlow, "全部状态");

    ["filterTown", "filterVillage", "filterCrop", "filterStatus"].forEach((id) => {
        document.getElementById(id).addEventListener("change", renderCaseTable);
    });
}

function getFilteredCases() {
    const filters = {
        town: document.getElementById("filterTown").value,
        village: document.getElementById("filterVillage").value,
        crop: document.getElementById("filterCrop").value,
        status: document.getElementById("filterStatus").value
    };

    return mockCases.filter((item) => {
        return (!filters.town || item.town === filters.town)
            && (!filters.village || item.village === filters.village)
            && (!filters.crop || item.crop === filters.crop)
            && (!filters.status || item.status === filters.status);
    });
}

function renderCaseTable() {
    const tbody = document.getElementById("caseTableBody");
    const filteredCases = getFilteredCases();
    if (!filteredCases.find((item) => item.id === selectedCase.id)) {
        selectedCase = filteredCases[0] || mockCases[0];
    }

    tbody.innerHTML = filteredCases.map((item) => `
        <tr data-case-id="${item.id}" class="${selectedCase && selectedCase.id === item.id ? "active" : ""}">
            <td>${item.id}</td>
            <td>${item.town} / ${item.village}</td>
            <td>${item.crop}</td>
            <td>${item.status}</td>
            <td>${item.surveyor}</td>
            <td>${item.disasterTime}</td>
        </tr>
    `).join("") || `<tr><td colspan="6">暂无符合条件的案件。</td></tr>`;

    tbody.querySelectorAll("tr[data-case-id]").forEach((row) => {
        row.addEventListener("click", () => {
            selectedCase = mockCases.find((item) => item.id === row.dataset.caseId);
            renderCaseTable();
            renderCaseDetail();
            renderGeneratedReport();
            renderHistoryCompare();
            renderRiskChecks();
        });
    });

    renderCaseDetail();
}

function renderCaseDetail() {
    const title = document.getElementById("caseDetailTitle");
    const detailGrid = document.getElementById("caseDetailGrid");
    const statusFlow = document.getElementById("statusFlow");

    if (!selectedCase) {
        title.textContent = "暂无案件";
        detailGrid.innerHTML = "";
        statusFlow.innerHTML = "";
        return;
    }

    title.textContent = selectedCase.id;
    const details = [
        ["报案人", selectedCase.reporter],
        ["地块位置", selectedCase.location],
        ["作物类型", selectedCase.crop],
        ["受灾时间", selectedCase.disasterTime],
        ["影像来源", selectedCase.imageSource],
        ["查勘员", selectedCase.surveyor],
        ["分析结果", selectedCase.result],
        ["当前状态", selectedCase.status]
    ];

    detailGrid.innerHTML = details.map(([label, value]) => `
        <div class="detail-item">
            <span>${label}</span>
            <strong>${value}</strong>
        </div>
    `).join("");

    const activeIndex = caseStatusFlow.indexOf(selectedCase.status);
    statusFlow.innerHTML = caseStatusFlow.map((status, index) => `
        <div class="status-step ${index <= activeIndex ? "active" : ""}">${status}</div>
    `).join("");
}

function renderGeneratedReport() {
    if (!selectedCase) return;

    document.getElementById("reportPreview").innerHTML = `
        <div class="preview-block">
            <h4>自动生成查勘结论</h4>
            <p>${selectedCase.id} 涉及 ${selectedCase.crop} 地块，当前综合判定为${selectedCase.result}。建议将地块遥感异常结果与现场抽样结果联合归档，并进入 ${selectedCase.status} 流程。</p>
        </div>
        <div class="preview-block">
            <h4>农户可读版说明</h4>
            <p>系统识别到您报案地块存在明显异常区域，初步估算受影响范围为 ${selectedCase.area || "待核定"} 亩。我们将结合无人机或卫星影像与现场核查情况，给出最终定损建议。</p>
        </div>
        <div class="preview-block">
            <h4>保险公司归档版报告</h4>
            <p>报告将包含原始影像、受灾范围图、面积统计、致灾成因说明、时间与地块信息，以及后续定损建议，便于归档与复核。</p>
        </div>
    `;

    document.getElementById("evidenceList").innerHTML = [
        "原始影像文件",
        "地块圈选范围",
        "受灾面积统计图",
        "致灾原因说明",
        "时间与地块信息",
        "定损建议与查勘员签名位"
    ].map((item) => `<div class="evidence-item"><strong>${item}</strong><p>已纳入自动报告模板，可对接 PDF 导出。</p></div>`).join("");
}

function renderDashboard() {
    document.getElementById("dashboardMetricCards").innerHTML = dashboardMetrics.map((metric) => `
        <div class="metric-tile">
            <h4>${metric.label}</h4>
            <strong>${metric.value}${metric.suffix}</strong>
        </div>
    `).join("");

    document.getElementById("heatList").innerHTML = heatData.map((item) => `
        <div class="heat-item">
            <div>
                <strong>${item.name}</strong>
                <p>${item.description}</p>
            </div>
            <div class="heat-bar"><span style="width:${item.level}%"></span></div>
        </div>
    `).join("");

    document.getElementById("alertList").innerHTML = riskAlerts.map((item) => `
        <div class="alert-item">
            <strong>预警</strong>
            <p>${item}</p>
        </div>
    `).join("");
}

function renderHistoryCompare() {
    if (!selectedCase) return;
    document.getElementById("historyCompare").innerHTML = `
        <div class="compare-item">
            <strong>本次查勘结果</strong>
            <p>${selectedCase.result}</p>
        </div>
        <div class="compare-item">
            <strong>历史查勘记录</strong>
            <p>2025-09-18 同地块记录：受灾面积 7.4 亩，判定为病虫害轻度异常。</p>
        </div>
        <div class="compare-item">
            <strong>去年同期对比</strong>
            <p>2025 年同期 NDVI 均值高于本次 0.18，地块长势波动明显，建议进入重点复核名单。</p>
        </div>
    `;
}

function renderRiskChecks() {
    if (!selectedCase) return;
    document.getElementById("riskChecks").innerHTML = [
        `非耕地区域提醒：${selectedCase.id} 当前框选区域存在 6% 疑似道路/裸土混入风险。`,
        `历史植被异常提醒：${selectedCase.town}${selectedCase.village} 地块已出现连续两季植被异常。`,
        `疑似重复报案提醒：系统检测到同一位置 180 天内存在 1 次历史报案。`,
        `影像时间核验：${selectedCase.imageSource} 与报案时间 ${selectedCase.disasterTime} 匹配度待人工确认。`
    ].map((item) => `<div class="risk-item"><strong>风控校验</strong><p>${item}</p></div>`).join("");
}

function initDashboardCharts() {
    const rankingCtx = document.getElementById("townRankingChart").getContext("2d");
    const causeCtx = document.getElementById("causeChart").getContext("2d");

    if (townRankingChart) townRankingChart.destroy();
    if (causeChart) causeChart.destroy();

    townRankingChart = new Chart(rankingCtx, {
        type: "bar",
        data: {
            labels: townRanking.map((item) => item.town),
            datasets: [{
                label: "受灾面积(亩)",
                data: townRanking.map((item) => item.area),
                backgroundColor: ["#245c3e", "#346f4d", "#4d8964", "#91a85d", "#d2872c"],
                borderRadius: 10
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: { legend: { display: false } }
        }
    });

    causeChart = new Chart(causeCtx, {
        type: "doughnut",
        data: {
            labels: ["病虫害", "物理倒伏"],
            datasets: [{ data: [58, 42], backgroundColor: ["#245c3e", "#d2872c"] }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false
        }
    });
}

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
    const tiandituTk = "851ea4614a87e8397c5f56693d2fb73b";
    const vecLayer = new WebTileLayer({ urlTemplate: `https://t0.tianditu.gov.cn/vec_w/wmts?SERVICE=WMTS&REQUEST=GetTile&VERSION=1.0.0&LAYER=vec&STYLE=default&TILEMATRIXSET=w&FORMAT=tiles&TILEMATRIX={level}&TILEROW={row}&TILECOL={col}&tk=${tiandituTk}` });
    const cvaLayer = new WebTileLayer({ urlTemplate: `https://t0.tianditu.gov.cn/cva_w/wmts?SERVICE=WMTS&REQUEST=GetTile&VERSION=1.0.0&LAYER=cva&STYLE=default&TILEMATRIXSET=w&FORMAT=tiles&TILEMATRIX={level}&TILEROW={row}&TILECOL={col}&tk=${tiandituTk}` });
    const imgLayer = new WebTileLayer({ urlTemplate: `https://t0.tianditu.gov.cn/img_w/wmts?SERVICE=WMTS&REQUEST=GetTile&VERSION=1.0.0&LAYER=img&STYLE=default&TILEMATRIXSET=w&FORMAT=tiles&TILEMATRIX={level}&TILEROW={row}&TILECOL={col}&tk=${tiandituTk}` });
    const ciaLayer = new WebTileLayer({ urlTemplate: `https://t0.tianditu.gov.cn/cia_w/wmts?SERVICE=WMTS&REQUEST=GetTile&VERSION=1.0.0&LAYER=cia&STYLE=default&TILEMATRIXSET=w&FORMAT=tiles&TILEMATRIX={level}&TILEROW={row}&TILECOL={col}&tk=${tiandituTk}` });
    const vectorBasemap = new Basemap({ baseLayers: [vecLayer, cvaLayer], title: "天地图矢量" });
    const satelliteBasemap = new Basemap({ baseLayers: [imgLayer, ciaLayer], title: "天地图影像" });
    const drawLayer = new GraphicsLayer();
    const resultLayer = new GraphicsLayer();
    const map = new Map({ basemap: vectorBasemap, layers: [resultLayer, drawLayer] });

    const view = new MapView({
        container: "viewDiv",
        map,
        center: [113.6253, 34.7466],
        zoom: 13,
        constraints: { maxZoom: 17 },
        ui: { components: ["zoom", "compass"] }
    });

    let globalTiffFile = null;

    initPlatformUi();
    renderMiniStats();
    initCaseFilters();
    renderCaseTable();
    renderGeneratedReport();
    renderDashboard();
    renderHistoryCompare();
    renderRiskChecks();
    initDashboardCharts();

    document.getElementById("btn-upload-drone").addEventListener("click", () => {
        document.getElementById("drone-upload-input").click();
    });

    document.getElementById("drone-upload-input").addEventListener("change", async (event) => {
        globalTiffFile = event.target.files[0];
        if (!globalTiffFile) return;

        const btn = document.getElementById("btn-upload-drone");
        btn.textContent = "前端抽取 TIF 空间元数据中...";

        try {
            const arrayBuffer = await globalTiffFile.arrayBuffer();
            const tiff = await GeoTIFF.fromArrayBuffer(arrayBuffer);
            const image = await tiff.getImage();
            const bbox = image.getBoundingBox();
            const geoKeys = image.getGeoKeys();

            let wkid = 4326;
            if (geoKeys && geoKeys.ProjectedCSTypeGeoKey) wkid = geoKeys.ProjectedCSTypeGeoKey;
            else if (geoKeys && geoKeys.GeographicTypeGeoKey) wkid = geoKeys.GeographicTypeGeoKey;

            const realExtent = new Extent({ xmin: bbox[0], ymin: bbox[1], xmax: bbox[2], ymax: bbox[3], spatialReference: { wkid } });
            await view.goTo(realExtent, { duration: 1800, easing: "ease-in-out" });
            btn.textContent = "无人机影像已挂载";
            alert("影像挂载成功，后续分析将优先使用上传的高分影像。");
        } catch (error) {
            btn.textContent = "上传无人机正射影像 (GeoTIFF)";
            globalTiffFile = null;
            alert("GeoTIFF 解析失败，请检查文件格式。");
        }
    });

    document.getElementById("btnSearch").addEventListener("click", async () => {
        const query = document.getElementById("searchInput").value.trim();
        if (!query) return;

        const btn = document.getElementById("btnSearch");
        btn.textContent = "检索中...";

        try {
            const response = await fetch(`https://nominatim.openstreetmap.org/search?format=json&q=${query}&countrycodes=cn`);
            const data = await response.json();
            if (data && data.length > 0) {
                view.goTo({ center: [parseFloat(data[0].lon), parseFloat(data[0].lat)], zoom: 16 });
            } else {
                alert("未找到目标位置。");
            }
        } catch (error) {
            console.error(error);
        } finally {
            btn.textContent = "定位";
        }
    });

    view.when(() => {
        const sketch = new Sketch({
            layer: drawLayer,
            view,
            creationMode: "update",
            availableCreateTools: ["polygon", "rectangle", "circle"]
        });
        view.ui.add(sketch, "top-right");

        sketch.on("create", (event) => {
            if (event.state === "complete") {
                resultLayer.removeAll();
                document.getElementById("report-panel").hidden = true;
                document.getElementById("btn-analyze").disabled = false;
            }
        });
    });

    document.getElementById("btn-analyze").addEventListener("click", async () => {
        if (drawLayer.graphics.length === 0) return;

        const btnAnalyze = document.getElementById("btn-analyze");
        btnAnalyze.disabled = true;

        const userPolygon = drawLayer.graphics.getItemAt(0).geometry;
        const wgs84Polygon = webMercatorUtils.webMercatorToGeographic(userPolygon);
        const areaM2 = geometryEngine.geodesicArea(userPolygon, "square-meters");
        const areaMu = Math.abs(areaM2) * 0.0015;

        try {
            let response;
            if (globalTiffFile) {
                btnAnalyze.textContent = "读取本地高分像素中...";
                const formData = new FormData();
                formData.append("file", globalTiffFile);
                formData.append("geometry", JSON.stringify(wgs84Polygon.toJSON()));
                formData.append("area_mu", areaMu);
                response = await fetch("https://yutian-api.onrender.com/api/analyze", { method: "POST", body: formData });
            } else {
                btnAnalyze.textContent = "请求 Sentinel-2 数据中...";
                response = await fetch("https://yutian-api.onrender.com/api/analyze", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ geometry: JSON.stringify(wgs84Polygon.toJSON()), area_mu: areaMu })
                });
            }

            const result = await response.json();
            if (result.status === "success") {
                renderDamageGrid(userPolygon, result.damage_ratio_float);
                showReport(result);
            } else {
                alert(result.error || "算法分析异常");
            }
        } catch (error) {
            alert("无法连接分析服务，请检查网络或后端服务状态。");
        } finally {
            btnAnalyze.textContent = "提交智能定损分析";
            btnAnalyze.disabled = false;
        }
    });

    document.getElementById("btn-vector").addEventListener("click", () => {
        map.basemap = vectorBasemap;
        document.getElementById("btn-vector").classList.add("active");
        document.getElementById("btn-satellite").classList.remove("active");
    });

    document.getElementById("btn-satellite").addEventListener("click", () => {
        map.basemap = satelliteBasemap;
        document.getElementById("btn-satellite").classList.add("active");
        document.getElementById("btn-vector").classList.remove("active");
    });

    function renderDamageGrid(polygon, damageRatio) {
        resultLayer.removeAll();
        const extent = polygon.extent;
        const xStep = (extent.xmax - extent.xmin) / 20;
        const yStep = (extent.ymax - extent.ymin) / 20;
        const healthySymbol = { type: "simple-fill", color: [47, 138, 87, 0.32], outline: { color: [47, 138, 87, 0], width: 0 } };
        const damagedSymbol = { type: "simple-fill", color: [179, 67, 47, 0.52], outline: { color: [179, 67, 47, 0], width: 0 } };

        for (let x = extent.xmin; x < extent.xmax; x += xStep) {
            for (let y = extent.ymin; y < extent.ymax; y += yStep) {
                const point = new Point({ x, y, spatialReference: view.spatialReference });
                if (geometryEngine.contains(polygon, point)) {
                    const pixelGeom = { type: "polygon", rings: [[[x, y], [x + xStep, y], [x + xStep, y + yStep], [x, y + yStep], [x, y]]], spatialReference: view.spatialReference };
                    resultLayer.add(new Graphic({ geometry: pixelGeom, symbol: Math.random() < damageRatio ? damagedSymbol : healthySymbol }));
                }
            }
        }

        drawLayer.graphics.getItemAt(0).symbol = { type: "simple-fill", color: [0, 0, 0, 0], outline: { color: "#245c3e", width: 2 } };
    }

    function showReport(result) {
        const panel = document.getElementById("report-panel");
        const content = document.getElementById("report-content");
        const explanation = document.getElementById("report-explanation");
        const glcm = result.glcm_metrics;
        const levelText = result.damage_ratio_float > 0.5 ? "重度异常" : (result.damage_ratio_float < 0.01 ? "正常健康" : "轻微异常");
        const causeLabel = glcm.cause_type === "disaster" ? "物理倒伏" : "病虫害";

        content.innerHTML = `
            <p><strong>分析引擎：</strong>${result.engine_type}</p>
            <p><strong>影像时间：</strong>${result.image_date || "实时获取"}</p>
            <p>测区总面积约 <strong>${result.total_area_mu} 亩</strong>，其中异常面积约 <span class="highlight-text">${result.damaged_area_mu} 亩</span>。</p>
            <p>整体异常占比 <span class="highlight-text">${result.damage_ratio}</span>，等级判定为 <strong>${levelText}</strong>。</p>
            <p><strong>致灾成因判别：</strong>${causeLabel}，结论为 ${glcm.cause_analysis}。</p>
        `;

        explanation.innerHTML = `
            <strong>技术诊断依据</strong><br>
            1. 基于 NDVI 识别植被长势异常区域。<br>
            2. 基于 GLCM 纹理分析识别物理形态变化。<br>
            3. 地图叠加展示异常斑块，支持后续案件归档、报告生成与风险监管调用。
        `;

        panel.hidden = false;

        const ctx = document.getElementById("spectralChart").getContext("2d");
        if (spectralChartInstance) spectralChartInstance.destroy();

        const datasets = [];
        if (result.damage_ratio_float < 1.0) {
            datasets.push({
                label: "正常植被光谱 (均值)",
                data: result.spectral_data.healthy,
                borderColor: "#245c3e",
                backgroundColor: "rgba(36, 92, 62, 0.15)",
                tension: 0.35,
                fill: true
            });
        }
        if (result.damage_ratio_float >= 0.01) {
            datasets.push({
                label: "异常光谱特征 (均值)",
                data: result.spectral_data.damaged,
                borderColor: "#b3432f",
                backgroundColor: "rgba(179, 67, 47, 0.14)",
                tension: 0.35,
                fill: true
            });
        }

        spectralChartInstance = new Chart(ctx, {
            type: "line",
            data: { labels: ["蓝光", "绿光", "红光", "近红外"], datasets },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: { title: { display: true, text: "图斑光谱反射率分析" } },
                scales: { y: { min: 0, suggestedMax: 100 } }
            }
        });
    }
});
