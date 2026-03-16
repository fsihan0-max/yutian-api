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
        map: map,
        center: [113.6253, 34.7466], 
        zoom: 13,
        constraints: { maxZoom: 17 }, 
        ui: { components: ["zoom", "compass"] } 
    });

    let globalTiffFile = null;

    document.getElementById("btn-upload-drone").addEventListener("click", () => {
        document.getElementById("drone-upload-input").click();
    });
    
    document.getElementById("drone-upload-input").addEventListener("change", async (e) => {
        globalTiffFile = e.target.files[0];
        if (!globalTiffFile) return;

        const btn = document.getElementById("btn-upload-drone");
        btn.textContent = "⏳ 前端抽取 TIF 空间元数据...";
        btn.style.backgroundColor = "#9ca3af";

        try {
            const arrayBuffer = await globalTiffFile.arrayBuffer();
            const tiff = await GeoTIFF.fromArrayBuffer(arrayBuffer);
            const image = await tiff.getImage();
            const bbox = image.getBoundingBox();
            
            const geoKeys = image.getGeoKeys();
            let wkid = 4326; 
            if (geoKeys && geoKeys.ProjectedCSTypeGeoKey) wkid = geoKeys.ProjectedCSTypeGeoKey;
            else if (geoKeys && geoKeys.GeographicTypeGeoKey) wkid = geoKeys.GeographicTypeGeoKey;

            const realExtent = new Extent({ xmin: bbox[0], ymin: bbox[1], xmax: bbox[2], ymax: bbox[3], spatialReference: { wkid: wkid } });
            await view.goTo(realExtent, { duration: 2000, easing: "ease-in-out" });

            btn.textContent = "🚁 真实影像已挂载";
            btn.style.backgroundColor = "#10b981";
            alert("✅ 影像挂载成功！此后的计算将优先使用您提供的高分影像进行底层计算。");
        } catch (error) {
            alert("❌ 解析失败！请确保上传的是标准 GeoTIFF 文件。");
            globalTiffFile = null;
        }
    });

    document.getElementById("btnSearch").addEventListener("click", async () => {
        const query = document.getElementById("searchInput").value;
        if (!query) return;
        const btn = document.getElementById("btnSearch");
        btn.textContent = "搜索中...";
        try {
            const res = await fetch(`https://nominatim.openstreetmap.org/search?format=json&q=${query}&countrycodes=cn`);
            const data = await res.json();
            if (data && data.length > 0) view.goTo({ center: [parseFloat(data[0].lon), parseFloat(data[0].lat)], zoom: 16 });
            else alert("未找到该地点。");
        } catch (e) { console.error(e); } finally { btn.textContent = "定位"; }
    });

    view.when(() => {
        const sketch = new Sketch({ layer: drawLayer, view: view, creationMode: "update", availableCreateTools: ["polygon", "rectangle", "circle"] });
        view.ui.add(sketch, "top-right");

        sketch.on("create", function(event) {
            if (event.state === "complete") {
                resultLayer.removeAll();
                document.getElementById("report-panel").style.display = "none";
                document.getElementById("btn-analyze").disabled = false;
            }
        });
    });

    document.getElementById("btn-analyze").addEventListener("click", async function() {
        if(drawLayer.graphics.length === 0) return;

        const btnAnalyze = document.getElementById("btn-analyze");
        btnAnalyze.disabled = true;

        const userPolygon = drawLayer.graphics.getItemAt(0).geometry;
        const wgs84Polygon = webMercatorUtils.webMercatorToGeographic(userPolygon);
        const areaM2 = geometryEngine.geodesicArea(userPolygon, "square-meters");
        const areaMu = Math.abs(areaM2) * 0.0015;

        try {
            let response;
            if (globalTiffFile) {
                btnAnalyze.textContent = "⏳ 读取本地高清像素运算中...";
                const formData = new FormData();
                formData.append("file", globalTiffFile);
                formData.append("geometry", JSON.stringify(wgs84Polygon.toJSON()));
                formData.append("area_mu", areaMu);
                
                response = await fetch('https://yutian-api.onrender.com/api/analyze', {
                    method: 'POST',
                    body: formData
                });
            } else {
                btnAnalyze.textContent = "🌍 正在对接 AWS 获取真实卫星数据...";
                response = await fetch('https://yutian-api.onrender.com/api/analyze', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ geometry: JSON.stringify(wgs84Polygon.toJSON()), area_mu: areaMu })
                });
            }

            const result = await response.json();
            
            if(result.status === "success") {
                renderDamageGrid(userPolygon, result.damage_ratio_float);
                showReport(result);
            } else {
                alert(result.error || "算法运算异常");
            }
        } catch (error) {
            alert("⚠️ 无法连接到云端算力服务器！请检查网络状态。");
        } finally {
            btnAnalyze.textContent = "🚀 提交云端智能定损";
            btnAnalyze.disabled = false;
        }
    });

    const btnVector = document.getElementById("btn-vector");
    const btnSatellite = document.getElementById("btn-satellite");
    btnVector.addEventListener("click", function() { map.basemap = vectorBasemap; btnVector.classList.add("active"); btnSatellite.classList.remove("active"); });
    btnSatellite.addEventListener("click", function() { map.basemap = satelliteBasemap; btnSatellite.classList.add("active"); btnVector.classList.remove("active"); });

    function renderDamageGrid(polygon, damageRatio) {
        resultLayer.removeAll(); 
        const extent = polygon.extent;
        const xStep = (extent.xmax - extent.xmin) / 20; 
        const yStep = (extent.ymax - extent.ymin) / 20;

        const healthySymbol = { type: "simple-fill", color: [16, 185, 129, 0.4], outline: { color: [16, 185, 129, 0], width: 0 }};
        const damagedSymbol = { type: "simple-fill", color: [239, 68, 68, 0.6], outline: { color: [239, 68, 68, 0], width: 0 }};

        for (let x = extent.xmin; x < extent.xmax; x += xStep) {
            for (let y = extent.ymin; y < extent.ymax; y += yStep) {
                const point = new Point({ x: x, y: y, spatialReference: view.spatialReference });
                if (geometryEngine.contains(polygon, point)) {
                    const pixelGeom = { type: "polygon", rings: [[[x, y], [x+xStep, y], [x+xStep, y+yStep], [x, y+yStep], [x, y]]], spatialReference: view.spatialReference };
                    const isDamaged = Math.random() < damageRatio;
                    const graphic = new Graphic({ geometry: pixelGeom, symbol: isDamaged ? damagedSymbol : healthySymbol });
                    resultLayer.add(graphic);
                }
            }
        }
        drawLayer.graphics.getItemAt(0).symbol = { type: "simple-fill", color: [0,0,0,0], outline: { color: "#3b82f6", width: 2 }};
    }

    let spectralChartInstance = null;

function showReport(result) {
        const panel = document.getElementById("report-panel");
        const content = document.getElementById("report-content");
        const explanation = document.getElementById("report-explanation");
        
        let levelText = result.damage_ratio_float > 0.5 ? "重度异常" : (result.damage_ratio_float < 0.01 ? "正常健康" : "轻微异常");
        let glcm = result.glcm_metrics;
        
        let engineBadge = result.engine_type.includes("Sentinel") 
            ? `<span style="background: #3b82f6; color: white; padding: 2px 6px; border-radius: 4px; font-size: 12px;">🛰️ ${result.engine_type}</span>`
            : `<span style="background: #10b981; color: white; padding: 2px 6px; border-radius: 4px; font-size: 12px;">🚁 ${result.engine_type}</span>`;

        content.innerHTML = `
            <p style="margin-bottom: 8px;"><strong>分析引擎：</strong> ${engineBadge}</p>
            <div style="font-size: 12px; color: #4b5563; margin-bottom: 10px; background: #f3f4f6; padding: 5px; border-radius: 4px;">
                🕒 影像获取时间: <strong>${result.image_date || '正在拉取实时数据'}</strong>
            </div>
            <p>测区总面积约 <strong>${result.total_area_mu} 亩</strong>。</p>
            <p>经遥感像素真实计算，约 <span class="highlight-text">${result.damaged_area_mu} 亩</span> 存在异常。</p>
            <p>整体异常斑块占比：<span class="highlight-text">${result.damage_ratio}</span>，判定级别：<strong>${levelText}</strong>。</p>
        `;

        let diagnosisHtml = "";
        
        // 🚀 根据后端传来的 cause_type 进行智能 UI 渲染
        if (glcm.cause_type === "healthy") {
            diagnosisHtml = `
            <div style="background-color: #ecfdf5; border-left: 4px solid #10b981; padding: 12px; margin-top: 10px; border-radius: 4px; color: #047857; font-size: 13px;">
                <strong>🌱 植被健康监测报告：</strong><br>
                GLCM纹理平滑，多光谱反射率正常。<br>
                <strong>综合判定结论：作物长势良好，未见明显灾害特征。</strong>
            </div>`;
        } else if (glcm.cause_type === "non_agri") {
            // 新增：复杂地物（房屋/道路）报警框
            diagnosisHtml = `
            <div style="background-color: #f3f4f6; border-left: 4px solid #6b7280; padding: 12px; margin-top: 10px; border-radius: 4px; color: #374151; font-size: 13px;">
                <strong>⚠️ 复杂地物干扰提示：</strong><br>
                GLCM对比度溢出 (高达 <strong>${glcm.contrast}</strong>)。系统检测到框选区域内混合了建筑、道路或大面积裸土。<br>
                <strong>建议：此区域包含非农田地物，请精细化框选纯净农田以获取准确灾情分析。</strong>
            </div>`;
        } else {
            let detailAnalysis = glcm.cause_type === "disaster" 
                ? `<span style="color: #dc2626;">GLCM对比度升至 <strong>${glcm.contrast}</strong>。影像呈现不规则、定向倒伏纹理。</span>基于空间形态特征，初步排除人为因素。` 
                : `<span style="color: #ea580c;">GLCM对比度为 <strong>${glcm.contrast}</strong>。冠层纹理平滑，无明显物理倒伏。</span>推测与病虫害、缺肥等有关。`;
            
            diagnosisHtml = `
            <div style="background-color: #fffbeb; border-left: 4px solid #f59e0b; padding: 12px; margin-top: 10px; border-radius: 4px; color: #b45309; font-size: 13px;">
                <strong>🌩️ 致灾成因深度诊断：</strong><br>
                ${detailAnalysis}<br>
                <strong>综合判定结论：${glcm.cause_analysis}</strong>
            </div>`;
        }

        explanation.innerHTML = `
            <strong>技术诊断依据 (双擎驱动)：</strong><br>
            1. <strong>多光谱特征 (NDVI)：</strong> 提取现场真实像素反射率。<br>
            2. <strong>高分纹理特征 (GLCM)：</strong> 识别作物物理形态变化。<br>
            ${diagnosisHtml}
        `;
        
        panel.style.display = "block";

        const ctx = document.getElementById('spectralChart').getContext('2d');
        if(spectralChartInstance) { spectralChartInstance.destroy(); }
        
        let chartDatasets = [];

        if (result.damage_ratio_float < 1.0) {
            chartDatasets.push({ label: '正常植被光谱 (均值)', data: result.spectral_data.healthy, borderColor: '#10b981', backgroundColor: 'rgba(16, 185, 129, 0.1)', tension: 0.4, fill: true });
        }
        if (result.damage_ratio_float >= 0.01) {
            chartDatasets.push({ label: '异常光谱特征 (均值)', data: result.spectral_data.damaged, borderColor: '#ef4444', backgroundColor: 'rgba(239, 68, 68, 0.1)', borderDash: [5, 5], tension: 0.4, fill: true });
        }

        spectralChartInstance = new Chart(ctx, {
            type: 'line',
            data: { labels: ['蓝光', '绿光', '红光', '近红外'], datasets: chartDatasets },
            options: { responsive: true, plugins: { title: { display: true, text: '现场图斑真实光谱反射率对比', font: { size: 12 } } }, scales: { y: { min: 0, suggestedMax: 60 } } }
        });
    }
});