let mapController = null;

export function renderOverlay(analysisResult, themeKey) {
  if (mapController) {
    mapController.renderOverlay(analysisResult, themeKey);
  }
}

export function initMap({
  containerId = "viewDiv",
  onAoiChange = () => {},
  vecButtonId = "baseMapVecBtn",
  imgButtonId = "baseMapImgBtn"
} = {}) {
  if (mapController) {
    return Promise.resolve(mapController);
  }

  if (typeof window.require !== "function") {
    return Promise.reject(new Error("ArcGIS API 未加载"));
  }

  return new Promise((resolve) => {
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
      Map,
      MapView,
      WebTileLayer,
      Basemap,
      GraphicsLayer,
      Sketch,
      geometryEngine,
      Graphic,
      Point,
      Extent,
      webMercatorUtils
    ) {
      const tk = "851ea4614a87e8397c5f56693d2fb73b";
      const wmts = (name) => new WebTileLayer({
        urlTemplate: `https://t0.tianditu.gov.cn/${name}_w/wmts?SERVICE=WMTS&REQUEST=GetTile&VERSION=1.0.0&LAYER=${name}&STYLE=default&TILEMATRIXSET=w&FORMAT=tiles&TILEMATRIX={level}&TILEROW={row}&TILECOL={col}&tk=${tk}`
      });

      const basemaps = {
        vector: new Basemap({ baseLayers: [wmts("vec"), wmts("cva")] }),
        image: new Basemap({ baseLayers: [wmts("img"), wmts("cia")] })
      };

      const resultLayer = new GraphicsLayer();
      const drawLayer = new GraphicsLayer();
      const map = new Map({
        basemap: basemaps.vector,
        layers: [resultLayer, drawLayer]
      });

      const view = new MapView({
        container: containerId,
        map,
        center: [113.6253, 34.7466],
        zoom: 13
      });

      let currentGeometry = null;

      function setBasemap(mode) {
        map.basemap = mode === "image" ? basemaps.image : basemaps.vector;
        const vecBtn = document.getElementById(vecButtonId);
        const imgBtn = document.getElementById(imgButtonId);
        if (vecBtn) vecBtn.classList.toggle("active", mode !== "image");
        if (imgBtn) imgBtn.classList.toggle("active", mode === "image");
      }

      function syncAoiGeometry(fallback = null) {
        const first = drawLayer.graphics.getItemAt(0);
        currentGeometry = (first && first.geometry) || fallback;
        resultLayer.removeAll();
        onAoiChange(Boolean(currentGeometry));
      }

      function rgba(hex, alpha) {
        const value = parseInt(hex.replace("#", ""), 16);
        return [(value >> 16) & 255, (value >> 8) & 255, value & 255, alpha];
      }

      function drawOverlay(analysisResult, themeKey) {
        resultLayer.removeAll();
        if (!currentGeometry || !analysisResult) return;

        const themeLayer = analysisResult.thematic_layers[themeKey];
        const palette = (themeLayer && themeLayer.palette) || ["#b2432f", "#d7892f", "#1f5c3e"];
        const extent = currentGeometry.extent;

        const labelColors = {
          healthy: rgba(palette[2], 0.22),
          pest: rgba("#d07a36", 0.55),
          lodging: rgba("#b3432f", 0.55),
          harvest: rgba("#8f9b5a", 0.46),
          fallow: rgba("#9a7f56", 0.46),
          non_agri: rgba("#5b6770", 0.58),
          invalid: rgba("#c8d0d4", 0.15)
        };

        const blockGrid = analysisResult.block_grid || { rows: 16, cols: 16 };
        const rows = Math.max(1, Number(blockGrid.rows || 16));
        const cols = Math.max(1, Number(blockGrid.cols || 16));
        const xStep = (extent.xmax - extent.xmin) / cols;
        const yStep = (extent.ymax - extent.ymin) / rows;

        const blockMap = new Map((analysisResult.block_cells || []).map((cell) => [
          `${cell.row}-${cell.col}`,
          cell
        ]));

        for (let row = 0; row < rows; row += 1) {
          for (let col = 0; col < cols; col += 1) {
            const x = extent.xmin + (col * xStep);
            const y = extent.ymin + (row * yStep);
            const center = new Point({
              x: x + (xStep * 0.5),
              y: y + (yStep * 0.5),
              spatialReference: view.spatialReference
            });
            if (!geometryEngine.contains(currentGeometry, center)) continue;

            const cell = blockMap.get(`${row}-${col}`) || { label_key: "invalid" };
            const labelKey = cell.label_key || "invalid";
            const color = labelColors[labelKey] || labelColors.invalid;
            resultLayer.add(new Graphic({
              geometry: {
                type: "polygon",
                rings: [[[x, y], [x + xStep, y], [x + xStep, y + yStep], [x, y + yStep], [x, y]]],
                spatialReference: view.spatialReference
              },
              symbol: {
                type: "simple-fill",
                color,
                outline: { color: [0, 0, 0, 0], width: 0 }
              },
              attributes: {
                labelKey,
                confidence: Number(cell.confidence || 0)
              }
            }));
          }
        }
      }

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
          syncAoiGeometry(event.graphic.geometry);
        });

        sketch.on("update", (event) => {
          if (event.state !== "complete") return;
          syncAoiGeometry();
        });

        sketch.on("delete", () => {
          syncAoiGeometry(null);
        });
      });

      const vecBtn = document.getElementById(vecButtonId);
      const imgBtn = document.getElementById(imgButtonId);
      if (vecBtn) vecBtn.addEventListener("click", () => setBasemap("vector"));
      if (imgBtn) imgBtn.addEventListener("click", () => setBasemap("image"));

      setBasemap("vector");

      mapController = {
        hasAoi: () => Boolean(currentGeometry),
        getAreaMu: () => {
          if (!currentGeometry) return 0;
          return Math.abs(geometryEngine.geodesicArea(currentGeometry, "square-meters")) * 0.0015;
        },
        getGeometryWgsJson: () => {
          if (!currentGeometry) return null;
          const wgs = webMercatorUtils.webMercatorToGeographic(currentGeometry);
          return wgs.toJSON();
        },
        goToLonLat: (lon, lat, zoom = 16) => view.goTo({ center: [lon, lat], zoom }),
        zoomToGeoTiff: async (file) => {
          const image = await (await GeoTIFF.fromArrayBuffer(await file.arrayBuffer())).getImage();
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
        },
        renderOverlay: drawOverlay
      };

      resolve(mapController);
    });
  });
}

