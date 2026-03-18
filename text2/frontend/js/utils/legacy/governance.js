const governanceState = { charts: {} };

function renderGovernanceLists() {
    AppUI.byId("heatList").innerHTML = AppUI.cardList(AppData.heatData);
    AppUI.byId("alertList").innerHTML = AppUI.cardList([
        { title: "重复报案", detail: "当前检测到 2 个地块存在近周期重复报案风险。" },
        { title: "非农地物", detail: "1 个案件边界疑似含道路与建筑混入。" },
        { title: "收割识别", detail: "3 个案件表现为正常收割，不建议进入灾损流程。" }
    ]);
    AppUI.byId("regionalInsightList").innerHTML = AppUI.cardList([
        { title: "灾害分布", detail: "当前病虫害主要分布在柳泉镇，倒伏集中于城关镇。" },
        { title: "作物分布", detail: "当前高风险案件以小麦、玉米为主。" },
        { title: "时间趋势", detail: "近 72 小时报案高峰主要出现在上午 9 点到 11 点。" }
    ]);
    AppUI.byId("timeTrendList").innerHTML = AppUI.cardList([
        { title: "近三日趋势", detail: "报案数连续上升，查勘资源需前置。" },
        { title: "区域变化", detail: "城关镇和柳泉镇风险热度持续高位。" }
    ]);
    AppUI.byId("riskCheckList").innerHTML = AppUI.cardList([
        { title: "重复报案", detail: "利用历史案件坐标与时间窗口识别重复报案。" },
        { title: "非农地物", detail: "结合 BSI 与纹理特征识别道路、建筑等非农地物。" },
        { title: "收割识别", detail: "基于低 NDVI / 低 NDMI 判定正常收割状态。" }
    ]);
    AppUI.byId("nonDisasterList").innerHTML = AppUI.cardList([
        { title: "正常收割", detail: "当前系统识别出 3 个正常收割样例。" },
        { title: "休耕", detail: "当前系统识别出 2 个休耕样例。" },
        { title: "非农地物", detail: "当前系统识别出 1 个边界异常样例。" }
    ], "detail-item");
    AppUI.byId("dispatchTaskList").innerHTML = AppUI.cardList(AppData.dispatchTasks);
    AppUI.byId("droneTaskList").innerHTML = AppUI.cardList(AppData.droneTasks);
    AppUI.byId("dashboardMetricCards").innerHTML = AppData.dashboardMetrics.map((item) => `<div class="summary-card"><span>${item.label}</span><strong>${item.value}</strong></div>`).join("");
}

function initGovernanceCharts() {
    governanceState.charts.town = new Chart(AppUI.byId("townRankingChart").getContext("2d"), {
        type: "bar",
        data: {
            labels: AppData.townRanking.map((item) => item.town),
            datasets: [{ label: "受灾面积(亩)", data: AppData.townRanking.map((item) => item.area), backgroundColor: ["#1f5c3e", "#336f52", "#5a9278", "#96ab6a", "#d7892f"], borderRadius: 10 }]
        },
        options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false } } }
    });
    governanceState.charts.cause = new Chart(AppUI.byId("causeChart").getContext("2d"), {
        type: "doughnut",
        data: { labels: ["病虫害", "物理倒伏"], datasets: [{ data: [58, 42], backgroundColor: ["#1f5c3e", "#d7892f"] }] },
        options: { responsive: true, maintainAspectRatio: false }
    });
}

function initGovernancePage() {
    AppUI.initSectionNav("governancePageTitle", {
        risk: "风险监管大屏",
        regional: "区域态势分析",
        risklab: "风控研判",
        resource: "资源调度"
    });
    AppUI.updateHealthBadge("governanceHealthBadge");
    renderGovernanceLists();
    initGovernanceCharts();
}

initGovernancePage();
