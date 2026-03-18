const reviewState = { selectedCase: AppData.cases[0], reviews: [] };

function renderReviewCases() {
    const get = (id) => AppUI.byId(id).value;
    const items = AppData.cases.filter((item) => {
        return (!get("filterTown") || item.town === get("filterTown"))
            && (!get("filterCrop") || item.crop === get("filterCrop"))
            && (!get("filterStatus") || item.status === get("filterStatus"))
            && (!get("filterRisk") || item.riskLevel === get("filterRisk"))
            && (!get("filterSource") || item.imageSource === get("filterSource"));
    });
    if (!items.find((item) => item.id === reviewState.selectedCase.id)) {
        reviewState.selectedCase = items[0] || AppData.cases[0];
    }

    AppUI.byId("caseTableBody").innerHTML = items.map((item) => `
        <tr data-case-id="${item.id}" class="${item.id === reviewState.selectedCase.id ? "active" : ""}">
            <td>${item.id}</td>
            <td>${item.town} / ${item.village}</td>
            <td>${item.crop}</td>
            <td>${item.disasterType}</td>
            <td>${Math.round(item.confidence * 100)}%</td>
            <td>${item.imageSource}</td>
            <td>${item.status}</td>
        </tr>
    `).join("") || `<tr><td colspan="7">暂无符合条件的案件。</td></tr>`;

    AppUI.byId("caseTableBody").querySelectorAll("tr[data-case-id]").forEach((row) => {
        row.addEventListener("click", () => {
            reviewState.selectedCase = AppData.cases.find((item) => item.id === row.dataset.caseId) || AppData.cases[0];
            renderReviewCases();
            renderReviewDetail();
            renderReportSection();
        });
    });
    renderReviewDetail();
}

function renderReviewDetail() {
    const item = reviewState.selectedCase;
    AppUI.byId("caseDetailTitle").textContent = item.id;
    AppUI.byId("caseDetailList").innerHTML = [
        ["报案人", item.reporter],
        ["地块位置", item.location],
        ["作物类型", item.crop],
        ["受灾时间", item.disasterTime],
        ["影像来源", item.imageSource],
        ["查勘员", item.surveyor],
        ["风险等级", item.riskLevel],
        ["案件详情", item.result]
    ].map(([label, value]) => `<div class="detail-item"><strong>${label}</strong><p>${value}</p></div>`).join("");

    const activeIndex = AppData.statusFlow.indexOf(item.status);
    AppUI.byId("statusFlow").innerHTML = AppData.statusFlow.map((status, index) => `<div class="status-step ${index <= activeIndex ? "active" : ""}">${status}</div>`).join("");

    AppUI.byId("reviewCompareList").innerHTML = AppUI.cardList([
        { title: "模型结果", detail: `${item.disasterType}，置信度 ${Math.round(item.confidence * 100)}%。` },
        { title: "面积修正", detail: "支持对识别面积进行人工调整并回写。" },
        { title: "类型修正", detail: "支持将病虫害、倒伏、收割、休耕等类型重新修正。" }
    ], "compare-item");
}

function renderReportSection() {
    const item = reviewState.selectedCase;
    AppUI.byId("reportPreview").innerHTML = AppUI.cardList([
        { title: "农户版报告", detail: `面向农户解释当前案件 ${item.id} 的识别结果与后续流程。` },
        { title: "保险归档报告", detail: `归档案件 ${item.id} 的影像、定损结果、人工复核意见。` },
        { title: "PDF 导出", detail: "导出结构化报告与证据目录，便于归档。 " }
    ], "compare-item");
    AppUI.byId("archiveEvidenceList").innerHTML = AppUI.cardList([
        { title: "原始影像", detail: "包含卫星 / 无人机原始影像来源。" },
        { title: "AOI 与图层截图", detail: "包含边界、专题图层与定损结果截图。" },
        { title: "复核记录", detail: "包含面积修正、类型修正和复勘意见。" }
    ], "evidence-item");
}

async function loadReviews() {
    try {
        const result = await fetch(`${AppUI.apiBase}/api/reviews`).then((res) => res.json());
        reviewState.reviews = result.items || [];
    } catch (error) {
        reviewState.reviews = [];
    }
    renderReviewLogs();
}

function renderReviewLogs() {
    AppUI.byId("reviewLogList").innerHTML = reviewState.reviews.length
        ? reviewState.reviews.slice().reverse().slice(0, 6).map((item) => `<div class="log-item"><strong>${item.case_id || "未绑定案件"} · ${item.corrected_label || "待定"}</strong><p>${item.comment || "无附加说明"}</p><p>${item.reviewer || "系统用户"} / ${item.created_at || ""}</p></div>`).join("")
        : `<div class="log-item"><strong>暂无复核记录</strong><p>提交人工复核后会显示在这里。</p></div>`;
}

async function submitReview() {
    const body = {
        case_id: reviewState.selectedCase.id,
        reviewer: AppUI.byId("reviewerInput").value.trim() || "系统用户",
        corrected_label: AppUI.byId("reviewLabelSelect").value,
        corrected_area_mu: AppUI.byId("reviewAreaInput").value,
        comment: AppUI.byId("reviewCommentInput").value.trim(),
        requires_resurvey: AppUI.byId("reviewResurveyCheckbox").checked
    };
    const result = await fetch(`${AppUI.apiBase}/api/reviews`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body)
    }).then((res) => res.json()).catch(() => ({ error: "提交复核失败" }));
    if (result.error) {
        alert(result.error);
        return;
    }
    reviewState.reviews.push(result.item);
    renderReviewLogs();
    alert("人工复核已提交。");
}

function initReviewPage() {
    AppUI.initSectionNav("reviewPageTitle", {
        overview: "案件总览",
        decision: "结果复核",
        report: "报告出证",
        dispute: "争议案件"
    });
    AppUI.updateHealthBadge("reviewHealthBadge");
    [["filterTown", [...new Set(AppData.cases.map((item) => item.town))], "全部乡镇"], ["filterCrop", [...new Set(AppData.cases.map((item) => item.crop))], "全部作物"], ["filterStatus", AppData.statusFlow, "全部状态"], ["filterRisk", ["高风险", "低风险"], "全部风险"], ["filterSource", [...new Set(AppData.cases.map((item) => item.imageSource))], "全部来源"]].forEach(([id, values, placeholder]) => {
        AppUI.byId(id).innerHTML = [`<option value="">${placeholder}</option>`].concat(values.map((value) => `<option value="${value}">${value}</option>`)).join("");
        AppUI.byId(id).addEventListener("change", renderReviewCases);
    });
    AppUI.byId("generateReportBtn").addEventListener("click", renderReportSection);
    AppUI.byId("exportPdfBtn").addEventListener("click", () => alert("当前为演示环境，PDF 导出接口待接入。"));
    AppUI.byId("submitReviewBtn").addEventListener("click", submitReview);
    AppUI.byId("disputeCaseList").innerHTML = AppUI.cardList(AppData.disputeCases);
    renderReviewCases();
    renderReportSection();
    loadReviews();
}

initReviewPage();
