(function initApp() {
    const session = window.Auth.currentSession();
    if (!session) {
        window.location.href = "index.html";
        return;
    }

    const state = {
        user: session,
        currentMenu: "workbench",
        selectedCase: window.AppData.cases[0] || null,
        currentAnalysis: null,
        currentTheme: "ndvi",
        mapReady: false,
        mapContext: null,
        charts: {},
        evidence: [],
        reportLogs: []
    };

    const el = (id) => document.getElementById(id);
    const listHtml = (items) => items.map(
        (item) => `<div class="list-item"><strong>${item.title}</strong><p>${item.detail}</p></div>`
    ).join("");

    function formatNow() {
        const now = new Date();
        const y = now.getFullYear();
        const m = String(now.getMonth() + 1).padStart(2, "0");
        const d = String(now.getDate()).padStart(2, "0");
        const hh = String(now.getHours()).padStart(2, "0");
        const mm = String(now.getMinutes()).padStart(2, "0");
        return `${y}-${m}-${d} ${hh}:${mm}`;
    }

    async function updateHealthBadge() {
        const badge = el("healthBadge");
        try {
            const res = await fetch(`${window.AppData.apiBase}/api/health`);
            const json = await res.json();
            badge.textContent = json.status === "ok" ? "服务在线" : "服务异常";
        } catch (error) {
            badge.textContent = "服务未连接";
        }
    }

    function initHeader() {
        const roleName = window.AppData.roleLabel[state.user.role] || state.user.role;
        el("currentUserName").textContent = state.user.displayName || state.user.username;
        el("currentRoleName").textContent = roleName;
        el("roleLabel").textContent = roleName;
        el("dateBadge").textContent = formatNow();
        updateHealthBadge();
    }

    function allowedMenus() {
        return window.AppData.menus.filter((menu) => menu.roles.includes(state.user.role));
    }

    function renderMenu() {
        const menus = allowedMenus();
        el("menuList").innerHTML = menus.map((menu) => `
            <button class="menu-item ${menu.key === state.currentMenu ? "active" : ""}" data-menu-key="${menu.key}" type="button">
                ${menu.label}
            </button>
        `).join("");
        el("menuList").querySelectorAll("[data-menu-key]").forEach((button) => {
            button.addEventListener("click", () => {
                state.currentMenu = button.dataset.menuKey;
                switchPage();
            });
        });
    }

    function switchPage() {
        const menus = allowedMenus();
        if (!menus.some((item) => item.key === state.currentMenu)) {
            state.currentMenu = "workbench";
        }
        if (window.location.hash !== `#${state.currentMenu}`) {
            window.location.hash = state.currentMenu;
        }
        const menuRecord = menus.find((item) => item.key === state.currentMenu);
        const currentMenuLabel = (menuRecord && menuRecord.label) || "工作台";
        el("pageTitle").textContent = currentMenuLabel;
        document.querySelectorAll(".page").forEach((page) => {
            page.classList.toggle("active", page.dataset.page === state.currentMenu);
        });
        renderMenu();

        if (state.currentMenu === "workbench") renderWorkbench();
        if (state.currentMenu === "cases") renderCaseCenter();
        if (state.currentMenu === "reports") renderReportCenter();
        if (state.currentMenu === "risk") renderRiskCenter();
        if (state.currentMenu === "data") renderDataCenter();
        if (state.currentMenu === "settings") renderSettingsCenter();
        if (state.currentMenu === "survey") {
            initSurveyModule();
            renderSurveyAuxPanels();
        }
    }

    function renderWorkbench() {
        const data = window.AppData.workbenchByRole[state.user.role];
        el("workbenchMetrics").innerHTML = data.metrics.map((item) => `
            <div class="metric-card"><span>${item.label}</span><strong>${item.value}</strong></div>
        `).join("");
        el("todoList").innerHTML = listHtml(data.todos);
        el("warningList").innerHTML = listHtml(data.warnings);

        const recent = window.AppData.cases.slice(0, 5).map((item) => `
            <tr>
                <td>${item.id}</td>
                <td>${item.town}</td>
                <td>${item.crop}</td>
                <td>${item.status}</td>
            </tr>
        `).join("");
        el("recentCaseRows").innerHTML = recent || `<tr><td colspan="4">暂无数据</td></tr>`;

        el("quickActions").innerHTML = data.quickActions.map(
            (text) => `<button class="btn quick-btn" type="button">${text}</button>`
        ).join("");
    }

    function initCaseFilters() {
        const towns = [...new Set(window.AppData.cases.map((item) => item.town))];
        const statuses = [...new Set(window.AppData.cases.map((item) => item.status))];
        const crops = [...new Set(window.AppData.cases.map((item) => item.crop))];

        const fill = (target, values, placeholder) => {
            target.innerHTML = [`<option value="">${placeholder}</option>`].concat(
                values.map((value) => `<option value="${value}">${value}</option>`)
            ).join("");
        };
        fill(el("caseFilterTown"), towns, "全部乡镇");
        fill(el("caseFilterStatus"), statuses, "全部状态");
        fill(el("caseFilterCrop"), crops, "全部作物");
    }

    function filteredCases() {
        const town = el("caseFilterTown").value;
        const status = el("caseFilterStatus").value;
        const crop = el("caseFilterCrop").value;

        return window.AppData.cases.filter((item) => {
            return (!town || item.town === town)
                && (!status || item.status === status)
                && (!crop || item.crop === crop);
        });
    }

    function renderCaseCenter() {
        const rows = filteredCases();
        const selectedCaseId = state.selectedCase ? state.selectedCase.id : "";
        if (rows.length && !rows.some((item) => item.id === selectedCaseId)) {
            state.selectedCase = rows[0];
        }

        el("caseRows").innerHTML = rows.map((item) => `
            <tr class="${item.id === selectedCaseId ? "active" : ""}" data-case-id="${item.id}">
                <td>${item.id}</td>
                <td>${item.town}/${item.village}</td>
                <td>${item.crop}</td>
                <td>${item.surveyor}</td>
                <td>${item.status}</td>
            </tr>
        `).join("") || `<tr><td colspan="5">暂无符合条件的案件</td></tr>`;

        el("caseRows").querySelectorAll("[data-case-id]").forEach((row) => {
            row.addEventListener("click", () => {
                state.selectedCase = window.AppData.cases.find((item) => item.id === row.dataset.caseId) || null;
                renderCaseCenter();
            });
        });

        if (state.selectedCase) {
            const item = state.selectedCase;
            el("caseDetail").innerHTML = listHtml([
                { title: "报案人", detail: item.reporter },
                { title: "影像来源", detail: item.imageSource },
                { title: "模型结果", detail: `${item.disasterType} (${Math.round(item.confidence * 100)}%)` },
                { title: "结果摘要", detail: item.result }
            ]);
        } else {
            el("caseDetail").innerHTML = "";
        }

        el("disputeList").innerHTML = listHtml(window.AppData.disputes);
    }

    async function submitReview() {
        if (!state.selectedCase) {
            alert("请先选择案件。");
            return;
        }
        const payload = {
            case_id: state.selectedCase.id,
            reviewer: state.user.displayName || state.user.username,
            corrected_label: el("reviewLabelSelect").value,
            corrected_area_mu: el("reviewAreaInput").value,
            comment: el("reviewCommentInput").value
        };
        const response = await fetch(`${window.AppData.apiBase}/api/reviews`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(payload)
        }).then((res) => res.json()).catch(() => ({ error: "提交失败" }));
        if (response.error) {
            alert(response.error);
            return;
        }
        alert("复核已提交。");
        el("reviewAreaInput").value = "";
        el("reviewCommentInput").value = "";
    }

    function renderReportCenter() {
        el("reportLogList").innerHTML = listHtml(
            state.reportLogs.length ? state.reportLogs : [{ title: "暂无记录", detail: "请先执行报告操作。" }]
        );
        el("evidenceList").innerHTML = listHtml(window.AppData.evidenceTemplate);
    }

    function addReportLog(title, detail) {
        state.reportLogs.unshift({ title, detail });
        renderReportCenter();
    }

    function renderRiskCenter() {
        el("riskMetrics").innerHTML = window.AppData.riskMetrics.map((item) => `
            <div class="metric-card"><span>${item.label}</span><strong>${item.value}</strong></div>
        `).join("");
        el("regionTrendList").innerHTML = listHtml(window.AppData.regionTrends);
        el("dispatchList").innerHTML = listHtml(window.AppData.dispatchTasks);
        renderRiskCharts();
    }

    function renderRiskCharts() {
        const areaCanvas = el("riskAreaChart").getContext("2d");
        const typeCanvas = el("riskTypeChart").getContext("2d");

        if (state.charts.area) state.charts.area.destroy();
        if (state.charts.type) state.charts.type.destroy();

        state.charts.area = new Chart(areaCanvas, {
            type: "bar",
            data: {
                labels: ["城关镇", "柳泉镇", "河湾镇", "北关镇"],
                datasets: [{
                    label: "受灾面积(亩)",
                    data: [48.1, 35.6, 27.4, 12.5],
                    backgroundColor: ["#265f4a", "#36745b", "#4f8b6d", "#7ea678"],
                    borderRadius: 8
                }]
            },
            options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false } } }
        });

        state.charts.type = new Chart(typeCanvas, {
            type: "doughnut",
            data: {
                labels: ["病虫害", "物理倒伏", "正常收割", "非农地物"],
                datasets: [{ data: [41, 33, 18, 8], backgroundColor: ["#2d6a4f", "#d07a36", "#8f9b5a", "#5b6770"] }]
            },
            options: { responsive: true, maintainAspectRatio: false }
        });
    }

    function renderDataCenter() {
        el("imageryList").innerHTML = listHtml(window.AppData.imageryAssets);
        el("modelList").innerHTML = listHtml(window.AppData.modelAssets);
    }

    function renderSettingsCenter() {
        el("profileList").innerHTML = listHtml([
            { title: "账号", detail: state.user.username },
            { title: "姓名", detail: state.user.displayName || state.user.username },
            { title: "角色", detail: window.AppData.roleLabel[state.user.role] || state.user.role }
        ]);
        el("settingList").innerHTML = listHtml(window.AppData.settings);
    }

    function initSurveyTabs() {
        document.querySelectorAll("[data-survey-tab]").forEach((button) => {
            button.addEventListener("click", () => {
                const key = button.dataset.surveyTab;
                document.querySelectorAll("[data-survey-tab]").forEach((item) => item.classList.toggle("active", item === button));
                document.querySelectorAll(".subpage").forEach((page) => page.classList.toggle("active", page.dataset.subpage === key));
            });
        });
    }

    function renderSurveyAuxPanels() {
        el("historyList").innerHTML = listHtml([
            { title: "同地块历史", detail: "2025-09-18 记录为轻度病虫害。" },
            { title: "同期长势", detail: "当前 NDVI 比去年同期低 0.18。" },
            { title: "重复报案", detail: "近 180 天内同地块报案 1 次。" }
        ]);

        const features = state.currentAnalysis ? state.currentAnalysis.feature_vector : null;
        el("featureList").innerHTML = features
            ? Object.entries(features).map(([key, value]) => `<div class="list-item"><strong>${key}</strong><p>${value}</p></div>`).join("")
            : `<div class="list-item"><strong>暂无分析结果</strong><p>完成一次分析后显示特征。</p></div>`;

        el("fieldEvidenceList").innerHTML = listHtml(
            state.evidence.length ? state.evidence : [{ title: "暂无证据", detail: "请上传现场照片并添加说明。" }]
        );
        el("fieldChecklist").innerHTML = listHtml([
            { title: "照片上传", detail: "至少上传 3 张现场照片。" },
            { title: "无人机影像", detail: "优先覆盖异常斑块区域。" },
            { title: "证据清单", detail: "截图、影像、备注统一入库。" }
        ]);
    }

    function setAnalyzeResult(content) {
        el("analyzeResult").innerHTML = content;
    }

    function activeResult() {
        if (!state.currentAnalysis) return null;
        return state.currentAnalysis.model_mode === "ml"
            ? state.currentAnalysis.ml_result
            : state.currentAnalysis.rule_result;
    }

    function applyThemeButtons(themeKey) {
        document.querySelectorAll("[data-theme-key]").forEach((button) => {
            button.classList.toggle("active", button.dataset.themeKey === themeKey);
        });
    }

    function initSurveyModule() {
        if (state.mapReady) return;
        if (typeof window.require !== "function") return;

        window.require([
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
        ], function(
            Map, MapView, WebTileLayer, Basemap, GraphicsLayer, Sketch, geometryEngine, Graphic, Point, Extent, webMercatorUtils
        ) {
            const tk = "851ea4614a87e8397c5f56693d2fb73b";
            const vec = new WebTileLayer({
                urlTemplate: `https://t0.tianditu.gov.cn/vec_w/wmts?SERVICE=WMTS&REQUEST=GetTile&VERSION=1.0.0&LAYER=vec&STYLE=default&TILEMATRIXSET=w&FORMAT=tiles&TILEMATRIX={level}&TILEROW={row}&TILECOL={col}&tk=${tk}`
            });
            const cva = new WebTileLayer({
                urlTemplate: `https://t0.tianditu.gov.cn/cva_w/wmts?SERVICE=WMTS&REQUEST=GetTile&VERSION=1.0.0&LAYER=cva&STYLE=default&TILEMATRIXSET=w&FORMAT=tiles&TILEMATRIX={level}&TILEROW={row}&TILECOL={col}&tk=${tk}`
            });

            const resultLayer = new GraphicsLayer();
            const drawLayer = new GraphicsLayer();
            const map = new Map({
                basemap: new Basemap({ baseLayers: [vec, cva] }),
                layers: [resultLayer, drawLayer]
            });
            const view = new MapView({
                container: "viewDiv",
                map,
                center: [113.6253, 34.7466],
                zoom: 13
            });

            let droneFile = null;
            let currentGeometry = null;

            function rgba(hex, alpha) {
                const value = parseInt(hex.replace("#", ""), 16);
                return [(value >> 16) & 255, (value >> 8) & 255, value & 255, alpha];
            }

            function renderOverlay() {
                resultLayer.removeAll();
                const polygon = currentGeometry;
                if (!polygon || !state.currentAnalysis) return;

                const themeLayer = state.currentAnalysis.thematic_layers[state.currentTheme];
                const palette = (themeLayer && themeLayer.palette) || ["#b2432f", "#d7892f", "#1f5c3e"];
                const ratios = state.currentAnalysis.state_ratios;
                const result = activeResult();
                const key = (result && result.label_key) || "healthy";
                const ratioMap = {
                    pest: ratios.damage,
                    lodging: ratios.damage,
                    harvest: ratios.harvest,
                    fallow: ratios.fallow,
                    non_agri: ratios.non_agri,
                    healthy: 0
                };
                const ratio = typeof ratioMap[key] === "number" ? ratioMap[key] : ratios.damage;
                const extent = polygon.extent;
                const xStep = (extent.xmax - extent.xmin) / 16;
                const yStep = (extent.ymax - extent.ymin) / 16;

                for (let x = extent.xmin; x < extent.xmax; x += xStep) {
                    for (let y = extent.ymin; y < extent.ymax; y += yStep) {
                        const point = new Point({ x, y, spatialReference: view.spatialReference });
                        if (!geometryEngine.contains(polygon, point)) continue;
                        const color = Math.random() < ratio ? rgba(palette[0], 0.55) : rgba(palette[2], 0.22);
                        resultLayer.add(new Graphic({
                            geometry: {
                                type: "polygon",
                                rings: [[[x, y], [x + xStep, y], [x + xStep, y + yStep], [x, y + yStep], [x, y]]],
                                spatialReference: view.spatialReference
                            },
                            symbol: { type: "simple-fill", color, outline: { color: [0, 0, 0, 0], width: 0 } }
                        }));
                    }
                }
            }

            el("btnSearch").addEventListener("click", async () => {
                const query = el("searchInput").value.trim();
                if (!query) return;
                const result = await fetch(
                    `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(query)}&countrycodes=cn`
                ).then((res) => res.json()).catch(() => []);
                if (!result.length) {
                    alert("未找到位置。");
                    return;
                }
                view.goTo({ center: [parseFloat(result[0].lon), parseFloat(result[0].lat)], zoom: 16 });
            });

            el("droneUploadInput").addEventListener("change", async (event) => {
                droneFile = event.target.files[0];
                if (!droneFile) return;
                try {
                    const image = await (await GeoTIFF.fromArrayBuffer(await droneFile.arrayBuffer())).getImage();
                    const bbox = image.getBoundingBox();
                    const geoKeys = image.getGeoKeys();
                    const wkid = (geoKeys && geoKeys.ProjectedCSTypeGeoKey)
                        || (geoKeys && geoKeys.GeographicTypeGeoKey)
                        || 4326;
                    await view.goTo(new Extent({
                        xmin: bbox[0],
                        ymin: bbox[1],
                        xmax: bbox[2],
                        ymax: bbox[3],
                        spatialReference: { wkid }
                    }));
                } catch (error) {
                    droneFile = null;
                    alert("GeoTIFF 解析失败。");
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
                    if (event.state !== "complete") return;
                    const firstGraphic = drawLayer.graphics.getItemAt(0);
                    currentGeometry = (firstGraphic && firstGraphic.geometry) || event.graphic.geometry;
                    resultLayer.removeAll();
                    el("btnAnalyze").disabled = false;
                });
            });

            el("btnAnalyze").addEventListener("click", async () => {
                if (!currentGeometry) {
                    alert("请先绘制 AOI。");
                    return;
                }
                const areaMu = Math.abs(geometryEngine.geodesicArea(currentGeometry, "square-meters")) * 0.0015;
                const wgsGeometry = webMercatorUtils.webMercatorToGeographic(currentGeometry);
                const cropMode = el("cropModeSelect").value;
                const modelMode = el("modelModeSelect").value;
                let response;

                if (droneFile) {
                    const form = new FormData();
                    form.append("file", droneFile);
                    form.append("geometry", JSON.stringify(wgsGeometry.toJSON()));
                    form.append("area_mu", areaMu);
                    form.append("crop_mode", cropMode);
                    form.append("model_mode", modelMode);
                    response = await fetch(`${window.AppData.apiBase}/api/analyze`, { method: "POST", body: form });
                } else {
                    response = await fetch(`${window.AppData.apiBase}/api/analyze`, {
                        method: "POST",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify({
                            geometry: JSON.stringify(wgsGeometry.toJSON()),
                            area_mu: areaMu,
                            crop_mode: cropMode,
                            model_mode: modelMode
                        })
                    });
                }

                const result = await response.json();
                if (!response.ok || result.status !== "success") {
                    alert(result.error || "分析失败。");
                    return;
                }

                state.currentAnalysis = result;
                const finalResult = result.final_result;
                setAnalyzeResult(`
                    <div class="list-item"><strong>判定结果</strong><p>${finalResult.label} (${Math.round(finalResult.confidence * 100)}%)</p></div>
                    <div class="list-item"><strong>识别面积</strong><p>${result.recognized_area_mu} 亩</p></div>
                    <div class="list-item"><strong>结果说明</strong><p>${finalResult.explanation}</p></div>
                `);
                renderSurveyAuxPanels();
                renderOverlay();
            });

            document.querySelectorAll("[data-theme-key]").forEach((button) => {
                button.addEventListener("click", () => {
                    state.currentTheme = button.dataset.themeKey;
                    applyThemeButtons(state.currentTheme);
                    if (state.currentAnalysis) renderOverlay();
                });
            });

            document.querySelectorAll("[data-sample-label]").forEach((button) => {
                button.addEventListener("click", async () => {
                    if (!state.currentAnalysis) {
                        alert("请先完成一次分析。");
                        return;
                    }
                    const payload = {
                        label_key: button.dataset.sampleLabel,
                        crop_mode: state.currentAnalysis.crop_mode,
                        feature_vector: state.currentAnalysis.feature_vector,
                        notes: el("sampleNoteInput").value.trim(),
                        geometry: currentGeometry ? currentGeometry.toJSON() : null
                    };
                    const response = await fetch(`${window.AppData.apiBase}/api/samples`, {
                        method: "POST",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify(payload)
                    }).then((res) => res.json()).catch(() => ({ error: "样本保存失败" }));
                    if (response.error) {
                        alert(response.error);
                        return;
                    }
                    loadSamples();
                });
            });

            el("addFieldEvidenceBtn").addEventListener("click", () => {
                const note = el("fieldNoteInput").value.trim() || "现场补充材料";
                state.evidence.unshift({ title: `证据 ${state.evidence.length + 1}`, detail: note });
                el("fieldNoteInput").value = "";
                renderSurveyAuxPanels();
            });

            async function loadSamples() {
                const response = await fetch(`${window.AppData.apiBase}/api/samples`).then((res) => res.json()).catch(() => ({ items: [] }));
                const rows = response.items || [];
                el("sampleList").innerHTML = rows.length ? rows.slice().reverse().slice(0, 8).map((item) => `
                    <div class="list-item"><strong>${item.label}</strong><p>${item.notes || "无备注"}</p></div>
                `).join("") : `<div class="list-item"><strong>暂无样本</strong><p>完成分析后可新增样本。</p></div>`;
            }

            loadSamples();
            state.mapReady = true;
            state.mapContext = { renderOverlay };
        });
    }

    function bindGlobalEvents() {
        el("logoutBtn").addEventListener("click", () => {
            window.Auth.logout();
            window.location.href = "index.html";
        });

        ["caseFilterTown", "caseFilterStatus", "caseFilterCrop"].forEach((id) => {
            el(id).addEventListener("change", renderCaseCenter);
        });

        el("submitReviewBtn").addEventListener("click", submitReview);
        el("generateFarmerReportBtn").addEventListener("click", () => {
            addReportLog("农户报告", `${formatNow()} 已生成。`);
        });
        el("generateArchiveReportBtn").addEventListener("click", () => {
            addReportLog("归档报告", `${formatNow()} 已生成。`);
        });
        el("exportPdfBtn").addEventListener("click", () => {
            addReportLog("PDF 导出", `${formatNow()} 已导出。`);
        });
    }

    function setDefaultMenuByRole() {
        const hashKey = window.location.hash.replace("#", "").trim();
        const allowed = allowedMenus().map((item) => item.key);
        state.currentMenu = allowed.includes(hashKey) ? hashKey : "workbench";
    }

    function init() {
        initHeader();
        initCaseFilters();
        initSurveyTabs();
        bindGlobalEvents();
        setDefaultMenuByRole();
        switchPage();
    }

    init();
})();
