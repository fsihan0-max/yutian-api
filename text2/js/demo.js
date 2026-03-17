const demoState = { current: AppData.demoScenarios[0] };

function renderDemoCards() {
    AppUI.byId("demoCaseGrid").innerHTML = AppData.demoScenarios.map((item) => `
        <button class="portal-card demo-card ${item.key === demoState.current.key ? "accent" : ""}" data-demo-key="${item.key}">
            <span class="card-index">${item.crop_mode === "corn" ? "玉米模式" : "小麦模式"}</span>
            <h3>${item.title}</h3>
            <p>支持自动加载数据并直接展示分析结果。</p>
        </button>
    `).join("");
    AppUI.byId("demoCaseGrid").querySelectorAll("[data-demo-key]").forEach((button) => {
        button.addEventListener("click", () => {
            demoState.current = AppData.demoScenarios.find((item) => item.key === button.dataset.demoKey) || AppData.demoScenarios[0];
            AppUI.byId("demoScenarioSelect").value = demoState.current.key;
            renderDemoCards();
        });
    });
}

async function runDemo() {
    const scenario = demoState.current;
    AppUI.byId("demoTimeline").innerHTML = AppUI.cardList([
        { title: "步骤 1", detail: "自动加载示例案例参数。" },
        { title: "步骤 2", detail: "调用分析接口并等待返回结果。" },
        { title: "步骤 3", detail: "展示最终判定、专题指标与说明。" }
    ]);

    const payload = {
        geometry: JSON.stringify(scenario.geometry),
        area_mu: scenario.area_mu,
        crop_mode: scenario.crop_mode,
        model_mode: scenario.model_mode
    };

    const result = await fetch(`${AppUI.apiBase}/api/analyze`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
    }).then((res) => res.json()).catch(() => ({ error: "演示请求失败" }));

    if (result.error) {
        AppUI.byId("demoResultPanel").innerHTML = AppUI.cardList([{ title: "演示失败", detail: result.error }]);
        return;
    }

    AppUI.byId("demoResultPanel").innerHTML = AppUI.cardList([
        { title: "最终判定", detail: `${result.final_result.label}，置信度 ${Math.round(result.final_result.confidence * 100)}%。` },
        { title: "作物模式", detail: result.crop_mode_label },
        { title: "专题图层", detail: Object.keys(result.thematic_layers).join(" / ").toUpperCase() },
        { title: "结果说明", detail: result.final_result.explanation }
    ], "compare-item");
}

function initDemoPage() {
    AppUI.initSectionNav("demoPageTitle", {
        cases: "示例案例",
        autoplay: "一键演示"
    });
    AppUI.updateHealthBadge("demoHealthBadge");
    AppUI.byId("demoScenarioSelect").innerHTML = AppData.demoScenarios.map((item) => `<option value="${item.key}">${item.title}</option>`).join("");
    AppUI.byId("demoScenarioSelect").addEventListener("change", (event) => {
        demoState.current = AppData.demoScenarios.find((item) => item.key === event.target.value) || AppData.demoScenarios[0];
        renderDemoCards();
    });
    AppUI.byId("runDemoBtn").addEventListener("click", runDemo);
    renderDemoCards();
}

initDemoPage();
