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
    reportLogs: [],
    reportType: "farmer"
  };

  const WORKBENCH_TITLES = {
    surveyor: { todo: "我的待办", recent: "最近处理案件" },
    reviewer: { todo: "我的待办", recent: "最近处理案件" },
    admin: { todo: "各分中心待办积压", recent: "各分中心近期案件" }
  };

  const QUICK_ROUTE_BY_ROLE = {
    surveyor: ["survey", "survey", "survey", "cases"],
    reviewer: ["cases", "cases", "reports", "reports"],
    admin: ["risk", "risk", "data", "settings"]
  };

  const el = (id) => document.getElementById(id);
  const escapeHtml = (v) => String(v ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/\"/g, "&quot;").replace(/'/g, "&#39;");
  const listHtml = (items) => items.map((i) => `<div class="list-item"><strong>${escapeHtml(i.title)}</strong><p>${escapeHtml(i.detail)}</p></div>`).join("");

  function formatNow() {
    const d = new Date();
    const p = (n) => String(n).padStart(2, "0");
    return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}`;
  }

  async function updateHealthBadge() {
    const badge = el("healthBadge");
    try {
      const res = await fetch(`${window.AppData.apiBase}/api/health`);
      const data = await res.json();
      badge.textContent = data.status === "ok" ? "服务在线" : "服务异常";
    } catch {
      badge.textContent = "服务未连接";
    }
  }

  function allowedMenus() {
    return window.AppData.menus.filter((m) => m.roles.includes(state.user.role));
  }

  function renderMenu() {
    const menus = allowedMenus();
    el("menuList").innerHTML = menus.map((m) => `<button class="menu-item ${m.key === state.currentMenu ? "active" : ""}" data-menu-key="${m.key}" type="button">${m.label}</button>`).join("");
    el("menuList").querySelectorAll("[data-menu-key]").forEach((b) => {
      b.addEventListener("click", () => {
        state.currentMenu = b.dataset.menuKey;
        switchPage();
      });
    });
  }

  function gotoMenu(menuKey) {
    const allowed = allowedMenus().map((m) => m.key);
    state.currentMenu = allowed.includes(menuKey) ? menuKey : "workbench";
    switchPage();
  }

  function initHeader() {
    const roleName = window.AppData.roleLabel[state.user.role] || state.user.role;
    el("currentUserName").textContent = state.user.displayName || state.user.username;
    el("currentRoleName").textContent = roleName;
    el("roleLabel").textContent = roleName;
    el("dateBadge").textContent = formatNow();
    updateHealthBadge();
  }

  function initCaseFilters() {
    const towns = [...new Set(window.AppData.cases.map((x) => x.town))];
    const statuses = [...new Set(window.AppData.cases.map((x) => x.status))];
    const crops = [...new Set(window.AppData.cases.map((x) => x.crop))];
    const fill = (id, vals, placeholder) => {
      const target = el(id);
      const current = target.value;
      target.innerHTML = [`<option value="">${placeholder}</option>`].concat(vals.map((v) => `<option value="${v}">${v}</option>`)).join("");
      if (current && vals.includes(current)) target.value = current;
    };
    fill("caseFilterTown", towns, "全部乡镇");
    fill("caseFilterStatus", statuses, "全部状态");
    fill("caseFilterCrop", crops, "全部作物");
  }

  function filteredCases() {
    const t = el("caseFilterTown").value;
    const s = el("caseFilterStatus").value;
    const c = el("caseFilterCrop").value;
    return window.AppData.cases.filter((x) => (!t || x.town === t) && (!s || x.status === s) && (!c || x.crop === c));
  }

  function renderWorkbench() {
    const data = window.AppData.workbenchByRole[state.user.role];
    const title = WORKBENCH_TITLES[state.user.role] || WORKBENCH_TITLES.surveyor;
    el("workbenchTodoTitle").textContent = title.todo;
    el("workbenchRecentTitle").textContent = title.recent;

    el("workbenchMetrics").innerHTML = data.metrics.map((x) => `<div class="metric-card"><span>${x.label}</span><strong>${x.value}</strong></div>`).join("");
    el("todoList").innerHTML = listHtml(data.todos);
    el("warningList").innerHTML = listHtml(data.warnings);
    el("recentCaseRows").innerHTML = window.AppData.cases.slice(0, 5).map((x) => `<tr><td>${x.id}</td><td>${x.town}</td><td>${x.crop}</td><td>${x.status}</td></tr>`).join("") || `<tr><td colspan="4">暂无数据</td></tr>`;

    const routes = QUICK_ROUTE_BY_ROLE[state.user.role] || [];
    el("quickActions").innerHTML = data.quickActions.map((text, i) => `<button class="btn quick-btn" type="button" data-route="${routes[i] || "workbench"}">${text}</button>`).join("");
    el("quickActions").querySelectorAll("[data-route]").forEach((b) => b.addEventListener("click", () => gotoMenu(b.dataset.route)));
  }

  function renderCaseCenter() {
    initCaseFilters();
    const rows = filteredCases();
    if (rows.length && (!state.selectedCase || !rows.some((x) => x.id === state.selectedCase.id))) state.selectedCase = rows[0];
    if (!rows.length) state.selectedCase = null;

    el("caseRows").innerHTML = rows.map((x) => `<tr class="${state.selectedCase && state.selectedCase.id === x.id ? "active" : ""}" data-case-id="${x.id}"><td>${x.id}</td><td>${x.town}/${x.village}</td><td>${x.crop}</td><td>${x.surveyor}</td><td>${x.status}</td></tr>`).join("") || `<tr><td colspan="5">暂无符合条件的案件</td></tr>`;
    el("caseRows").querySelectorAll("[data-case-id]").forEach((r) => r.addEventListener("click", () => {
      state.selectedCase = window.AppData.cases.find((x) => x.id === r.dataset.caseId) || null;
      renderCaseCenter();
    }));

    if (state.selectedCase) {
      const x = state.selectedCase;
      el("caseDetail").innerHTML = listHtml([
        { title: "报案人", detail: x.reporter },
        { title: "影像来源", detail: x.imageSource },
        { title: "模型结果", detail: `${x.disasterType} (${Math.round(x.confidence * 100)}%)` },
        { title: "结果摘要", detail: x.result }
      ]);
    } else {
      el("caseDetail").innerHTML = "";
    }

    const canReview = state.user.role !== "surveyor";
    el("reviewActionPanel").classList.toggle("hidden", !canReview);
    el("reviewReadonlyHint").classList.toggle("hidden", canReview);
    el("disputeList").innerHTML = listHtml(window.AppData.disputes);
  }

  async function submitReview() {
    if (state.user.role === "surveyor") {
      alert("查勘员无复核权限。");
      return;
    }
    if (!state.selectedCase) {
      alert("请先选择案件。");
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

    const result = await fetch(`${window.AppData.apiBase}/api/reviews`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload)
    }).then((r) => r.json()).catch(() => ({ error: "提交失败" }));

    if (result.error) {
      alert(result.error);
      return;
    }

    state.selectedCase.status = "已结案";
    if (correctedLabel) state.selectedCase.disasterType = correctedLabel;
    state.selectedCase.result = correctedArea ? `人工复核面积 ${correctedArea} 亩，类型：${correctedLabel || state.selectedCase.disasterType}` : `人工复核完成，类型：${correctedLabel || state.selectedCase.disasterType}`;

    el("reviewAreaInput").value = "";
    el("reviewCommentInput").value = "";

    renderCaseCenter();
    renderWorkbench();
    addReportLog("复核结案", `${formatNow()} ${state.selectedCase.id} 已更新为“已结案”。`);
    alert("复核已提交并结案。列表状态已更新。");
  }

  function renderReportCenter() {
    el("reportLogList").innerHTML = listHtml(state.reportLogs.length ? state.reportLogs : [{ title: "暂无记录", detail: "请先执行报告操作。" }]);
    el("evidenceList").innerHTML = listHtml(window.AppData.evidenceTemplate);
  }

  function addReportLog(title, detail) {
    state.reportLogs.unshift({ title, detail });
    renderReportCenter();
  }

  function buildReportPreview(type) {
    const reportName = type === "archive" ? "归档报告" : "农户告知报告";
    const item = state.selectedCase;
    if (!item) {
      return { title: reportName, html: `<div class="report-line"><strong>暂无选中案件</strong><p>请先选择案件。</p></div>` };
    }
    const finalResult = state.currentAnalysis?.final_result;
    const evidenceText = state.evidence.length ? `${state.evidence.length} 条外业证据，含 ${state.evidence.filter((x) => x.thumbnail).length} 张照片。` : "暂无外业照片";
    const rows = [
      ["报告类型", reportName],
      ["生成时间", formatNow()],
      ["案件编号", item.id],
      ["地块位置", `${item.town}${item.village}`],
      ["案件状态", item.status],
      ["灾损类型", item.disasterType],
      ["案件摘要", item.result],
      ["模型判定", finalResult ? `${finalResult.label} (${Math.round(finalResult.confidence * 100)}%)` : "暂无分析结果"],
      ["证据说明", evidenceText]
    ];
    const html = rows.map(([k, v]) => `<div class="report-line"><strong>${escapeHtml(k)}</strong><p>${escapeHtml(v)}</p></div>`).join("");
    return { title: reportName, html };
  }

  function openReportModal(type) {
    state.reportType = type;
    const preview = buildReportPreview(type);
    el("reportModalTitle").textContent = preview.title;
    el("reportPreviewContent").innerHTML = preview.html;
    el("reportModal").classList.remove("hidden");
  }

  function closeReportModal() {
    el("reportModal").classList.add("hidden");
  }

  function printReport() {
    if (el("reportModal").classList.contains("hidden")) openReportModal(state.reportType || "archive");
    document.body.classList.add("print-report-mode");
    window.print();
    setTimeout(() => document.body.classList.remove("print-report-mode"), 300);
  }

  function renderRiskCenter() {
    el("riskMetrics").innerHTML = window.AppData.riskMetrics.map((x) => `<div class="metric-card"><span>${x.label}</span><strong>${x.value}</strong></div>`).join("");
    el("regionTrendList").innerHTML = listHtml(window.AppData.regionTrends);
    el("dispatchList").innerHTML = listHtml(window.AppData.dispatchTasks);
    const area = el("riskAreaChart").getContext("2d");
    const type = el("riskTypeChart").getContext("2d");
    if (state.charts.area) state.charts.area.destroy();
    if (state.charts.type) state.charts.type.destroy();
    state.charts.area = new Chart(area, { type: "bar", data: { labels: ["城关镇", "柳泉镇", "河湾镇", "北关镇"], datasets: [{ label: "受灾面积(亩)", data: [48.1, 35.6, 27.4, 12.5], backgroundColor: ["#265f4a", "#36745b", "#4f8b6d", "#7ea678"], borderRadius: 8 }] }, options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false } } } });
    state.charts.type = new Chart(type, { type: "doughnut", data: { labels: ["病虫害", "物理倒伏", "正常收割", "非农地物"], datasets: [{ data: [41, 33, 18, 8], backgroundColor: ["#2d6a4f", "#d07a36", "#8f9b5a", "#5b6770"] }] }, options: { responsive: true, maintainAspectRatio: false } });
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
    document.querySelectorAll("[data-survey-tab]").forEach((btn) => {
      btn.addEventListener("click", () => {
        const key = btn.dataset.surveyTab;
        document.querySelectorAll("[data-survey-tab]").forEach((x) => x.classList.toggle("active", x === btn));
        document.querySelectorAll(".subpage").forEach((x) => x.classList.toggle("active", x.dataset.subpage === key));
      });
    });
  }

  function hasAoi() {
    return Boolean(state.mapContext && typeof state.mapContext.hasAoi === "function" && state.mapContext.hasAoi());
  }

  function renderEvidenceList() {
    if (!state.evidence.length) return `<div class="list-item"><strong>暂无证据</strong><p>请上传现场照片并添加说明。</p></div>`;
    return state.evidence.map((x) => `
      <div class="evidence-item">
        ${x.thumbnail ? `<img class="evidence-thumb" src="${x.thumbnail}" alt="现场照片">` : `<div class="evidence-thumb"></div>`}
        <div class="evidence-meta"><strong>${escapeHtml(x.title)}</strong><p>${escapeHtml(x.detail)}</p></div>
      </div>
    `).join("");
  }

  function renderSurveyAuxPanels() {
    if (!hasAoi()) {
      el("historyList").innerHTML = listHtml([{ title: "请先圈选地块", detail: "完成 AOI 圈选后再查看历史对比。" }]);
      el("featureList").innerHTML = `<div class="list-item"><strong>请先圈选地块</strong><p>完成 AOI 圈选后再查看同地块特征。</p></div>`;
    } else {
      el("historyList").innerHTML = listHtml([
        { title: "同地块历史", detail: "2025-09-18 记录为轻度病虫害。" },
        { title: "同期长势", detail: "当前 NDVI 比去年同期低 0.18。" },
        { title: "重复报案", detail: "近 180 天内同地块报案 1 次。" }
      ]);
      const f = state.currentAnalysis ? state.currentAnalysis.feature_vector : null;
      el("featureList").innerHTML = f ? Object.entries(f).map(([k, v]) => `<div class="list-item"><strong>${k}</strong><p>${v}</p></div>`).join("") : `<div class="list-item"><strong>暂无分析结果</strong><p>完成一次分析后显示同地块特征。</p></div>`;
    }
    el("fieldEvidenceList").innerHTML = renderEvidenceList();
    el("fieldChecklist").innerHTML = listHtml([
      { title: "照片上传", detail: "至少上传 3 张现场照片。" },
      { title: "无人机影像", detail: "优先覆盖异常斑块区域。" },
      { title: "证据清单", detail: "截图、影像、备注统一入库。" }
    ]);
  }

  function setAnalyzeResult(html) {
    el("analyzeResult").innerHTML = html;
  }

  function activeResult() {
    if (!state.currentAnalysis) return null;
    return state.currentAnalysis.model_mode === "ml" ? state.currentAnalysis.ml_result : state.currentAnalysis.rule_result;
  }

  function applyThemeButtons(themeKey) {
    document.querySelectorAll("[data-theme-key]").forEach((b) => b.classList.toggle("active", b.dataset.themeKey === themeKey));
  }

  function readFileAsDataUrl(file) {
    return new Promise((resolve, reject) => {
      const r = new FileReader();
      r.onload = () => resolve(r.result);
      r.onerror = () => reject(new Error("照片读取失败"));
      r.readAsDataURL(file);
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
    ], function (Map, MapView, WebTileLayer, Basemap, GraphicsLayer, Sketch, geometryEngine, Graphic, Point, Extent, webMercatorUtils) {
      const tk = "851ea4614a87e8397c5f56693d2fb73b";
      const layer = (name) => new WebTileLayer({ urlTemplate: `https://t0.tianditu.gov.cn/${name}_w/wmts?SERVICE=WMTS&REQUEST=GetTile&VERSION=1.0.0&LAYER=${name}&STYLE=default&TILEMATRIXSET=w&FORMAT=tiles&TILEMATRIX={level}&TILEROW={row}&TILECOL={col}&tk=${tk}` });
      const basemaps = {
        vector: new Basemap({ baseLayers: [layer("vec"), layer("cva")] }),
        image: new Basemap({ baseLayers: [layer("img"), layer("cia")] })
      };
      const resultLayer = new GraphicsLayer();
      const drawLayer = new GraphicsLayer();
      const map = new Map({ basemap: basemaps.vector, layers: [resultLayer, drawLayer] });
      const view = new MapView({ container: "viewDiv", map, center: [113.6253, 34.7466], zoom: 13 });

      let droneFile = null;
      let currentGeometry = null;

      const setBasemap = (mode) => {
        map.basemap = mode === "image" ? basemaps.image : basemaps.vector;
        el("baseMapVecBtn").classList.toggle("active", mode !== "image");
        el("baseMapImgBtn").classList.toggle("active", mode === "image");
      };

      const syncAoi = (fallback = null) => {
        const g = drawLayer.graphics.getItemAt(0);
        currentGeometry = (g && g.geometry) || fallback;
        el("btnAnalyze").disabled = !currentGeometry;
        resultLayer.removeAll();
        renderSurveyAuxPanels();
      };

      function renderOverlay() {
        resultLayer.removeAll();
        if (!currentGeometry || !state.currentAnalysis) return;
        const palette = state.currentAnalysis.thematic_layers[state.currentTheme]?.palette || ["#b2432f", "#d7892f", "#1f5c3e"];
        const ratios = state.currentAnalysis.state_ratios;
        const key = (activeResult() && activeResult().label_key) || "healthy";
        const ratioMap = { pest: ratios.damage, lodging: ratios.damage, harvest: ratios.harvest, fallow: ratios.fallow, non_agri: ratios.non_agri, healthy: 0 };
        const ratio = typeof ratioMap[key] === "number" ? ratioMap[key] : ratios.damage;
        const e = currentGeometry.extent;
        const xs = (e.xmax - e.xmin) / 16;
        const ys = (e.ymax - e.ymin) / 16;
        const rgba = (hex, a) => {
          const v = parseInt(hex.replace("#", ""), 16);
          return [(v >> 16) & 255, (v >> 8) & 255, v & 255, a];
        };
        for (let x = e.xmin; x < e.xmax; x += xs) {
          for (let y = e.ymin; y < e.ymax; y += ys) {
            const p = new Point({ x, y, spatialReference: view.spatialReference });
            if (!geometryEngine.contains(currentGeometry, p)) continue;
            const color = Math.random() < ratio ? rgba(palette[0], 0.55) : rgba(palette[2], 0.22);
            resultLayer.add(new Graphic({ geometry: { type: "polygon", rings: [[[x, y], [x + xs, y], [x + xs, y + ys], [x, y + ys], [x, y]]], spatialReference: view.spatialReference }, symbol: { type: "simple-fill", color, outline: { color: [0, 0, 0, 0], width: 0 } } }));
          }
        }
      }

      el("baseMapVecBtn").addEventListener("click", () => setBasemap("vector"));
      el("baseMapImgBtn").addEventListener("click", () => setBasemap("image"));

      el("btnSearch").addEventListener("click", async () => {
        const q = el("searchInput").value.trim();
        if (!q) return;
        const r = await fetch(`https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(q)}&countrycodes=cn`).then((x) => x.json()).catch(() => []);
        if (!r.length) return alert("未找到位置。");
        view.goTo({ center: [parseFloat(r[0].lon), parseFloat(r[0].lat)], zoom: 16 });
      });

      el("droneUploadInput").addEventListener("change", async (ev) => {
        droneFile = ev.target.files[0];
        if (!droneFile) return;
        try {
          const img = await (await GeoTIFF.fromArrayBuffer(await droneFile.arrayBuffer())).getImage();
          const b = img.getBoundingBox();
          const g = img.getGeoKeys();
          const wkid = (g && g.ProjectedCSTypeGeoKey) || (g && g.GeographicTypeGeoKey) || 4326;
          await view.goTo(new Extent({ xmin: b[0], ymin: b[1], xmax: b[2], ymax: b[3], spatialReference: { wkid } }));
        } catch {
          droneFile = null;
          alert("GeoTIFF 解析失败。");
        }
      });

      view.when(() => {
        const sketch = new Sketch({ layer: drawLayer, view, creationMode: "update", availableCreateTools: ["polygon", "rectangle", "circle"] });
        view.ui.add(sketch, "top-right");
        sketch.on("create", (ev) => { if (ev.state === "complete") syncAoi(ev.graphic.geometry); });
        sketch.on("update", (ev) => { if (ev.state === "complete") syncAoi(); });
        sketch.on("delete", () => syncAoi(null));
      });

      el("btnAnalyze").addEventListener("click", async () => {
        if (!currentGeometry) return alert("请先绘制 AOI。");
        const areaMu = Math.abs(geometryEngine.geodesicArea(currentGeometry, "square-meters")) * 0.0015;
        const wgs = webMercatorUtils.webMercatorToGeographic(currentGeometry);
        const cropMode = el("cropModeSelect").value;
        const modelMode = el("modelModeSelect").value;
        let response;
        if (droneFile) {
          const fd = new FormData();
          fd.append("file", droneFile);
          fd.append("geometry", JSON.stringify(wgs.toJSON()));
          fd.append("area_mu", areaMu);
          fd.append("crop_mode", cropMode);
          fd.append("model_mode", modelMode);
          response = await fetch(`${window.AppData.apiBase}/api/analyze`, { method: "POST", body: fd });
        } else {
          response = await fetch(`${window.AppData.apiBase}/api/analyze`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ geometry: JSON.stringify(wgs.toJSON()), area_mu: areaMu, crop_mode: cropMode, model_mode: modelMode }) });
        }
        const result = await response.json();
        if (!response.ok || result.status !== "success") return alert(result.error || "分析失败。");
        state.currentAnalysis = result;
        const fr = result.final_result;
        setAnalyzeResult(`<div class="list-item"><strong>判定结果</strong><p>${fr.label} (${Math.round(fr.confidence * 100)}%)</p></div><div class="list-item"><strong>识别面积</strong><p>${result.recognized_area_mu} 亩</p></div><div class="list-item"><strong>结果说明</strong><p>${fr.explanation}</p></div>`);
        renderSurveyAuxPanels();
        renderOverlay();
      });

      document.querySelectorAll("[data-theme-key]").forEach((b) => b.addEventListener("click", () => {
        state.currentTheme = b.dataset.themeKey;
        applyThemeButtons(state.currentTheme);
        if (state.currentAnalysis) renderOverlay();
      }));

      document.querySelectorAll("[data-sample-label]").forEach((b) => b.addEventListener("click", async () => {
        if (!state.currentAnalysis) return alert("请先完成一次分析。");
        const payload = { label_key: b.dataset.sampleLabel, crop_mode: state.currentAnalysis.crop_mode, feature_vector: state.currentAnalysis.feature_vector, notes: el("sampleNoteInput").value.trim(), geometry: currentGeometry ? currentGeometry.toJSON() : null };
        const result = await fetch(`${window.AppData.apiBase}/api/samples`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) }).then((r) => r.json()).catch(() => ({ error: "样本保存失败" }));
        if (result.error) return alert(result.error);
        loadSamples();
      }));

      el("addFieldEvidenceBtn").addEventListener("click", async () => {
        const files = Array.from(el("fieldPhotoInput").files || []);
        const note = el("fieldNoteInput").value.trim();
        if (!files.length && !note) return alert("请先选择照片或填写说明。");
        try {
          const items = await Promise.all(files.map(async (f) => ({ title: `现场照片 - ${f.name}`, detail: note || "现场照片上传", thumbnail: await readFileAsDataUrl(f) })));
          state.evidence = (items.length ? items : [{ title: `外业说明 ${formatNow()}`, detail: note || "现场补充材料", thumbnail: "" }]).concat(state.evidence);
          el("fieldPhotoInput").value = "";
          el("fieldNoteInput").value = "";
          renderSurveyAuxPanels();
        } catch (e) {
          alert(e.message || "照片读取失败。");
        }
      });

      async function loadSamples() {
        const data = await fetch(`${window.AppData.apiBase}/api/samples`).then((r) => r.json()).catch(() => ({ items: [] }));
        const rows = data.items || [];
        el("sampleList").innerHTML = rows.length ? rows.slice().reverse().slice(0, 8).map((x) => `<div class="list-item"><strong>${x.label}</strong><p>${x.notes || "无备注"}</p></div>`).join("") : `<div class="list-item"><strong>暂无样本</strong><p>完成分析后可新增样本。</p></div>`;
      }

      loadSamples();
      setBasemap("vector");
      state.mapReady = true;
      state.mapContext = { hasAoi: () => Boolean(currentGeometry), renderOverlay };
      renderSurveyAuxPanels();
    });
  }

  function switchPage() {
    const menus = allowedMenus();
    if (!menus.some((x) => x.key === state.currentMenu)) state.currentMenu = "workbench";
    if (window.location.hash !== `#${state.currentMenu}`) window.location.hash = state.currentMenu;
    const menu = menus.find((x) => x.key === state.currentMenu);
    el("pageTitle").textContent = (menu && menu.label) || "工作台";
    document.querySelectorAll(".page").forEach((p) => p.classList.toggle("active", p.dataset.page === state.currentMenu));
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

  function bindGlobalEvents() {
    el("logoutBtn").addEventListener("click", () => {
      window.Auth.logout();
      window.location.href = "index.html";
    });

    ["caseFilterTown", "caseFilterStatus", "caseFilterCrop"].forEach((id) => el(id).addEventListener("change", renderCaseCenter));
    el("submitReviewBtn").addEventListener("click", submitReview);

    el("generateFarmerReportBtn").addEventListener("click", () => {
      openReportModal("farmer");
      addReportLog("农户报告", `${formatNow()} 已生成预览。`);
    });
    el("generateArchiveReportBtn").addEventListener("click", () => {
      openReportModal("archive");
      addReportLog("归档报告", `${formatNow()} 已生成预览。`);
    });
    el("exportPdfBtn").addEventListener("click", () => {
      printReport();
      addReportLog("PDF 导出", `${formatNow()} 已触发浏览器打印。`);
    });

    el("closeReportModalBtn").addEventListener("click", closeReportModal);
    el("closeReportModalMask").addEventListener("click", closeReportModal);
    window.addEventListener("afterprint", () => document.body.classList.remove("print-report-mode"));
  }

  function setDefaultMenuByRole() {
    const key = window.location.hash.replace("#", "").trim();
    const allowed = allowedMenus().map((x) => x.key);
    state.currentMenu = allowed.includes(key) ? key : "workbench";
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
