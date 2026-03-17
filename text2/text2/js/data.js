window.AppData = {
    apiBase: `${window.location.protocol}//${window.location.hostname || "127.0.0.1"}:5000`,
    roleLabel: {
        surveyor: "查勘员",
        reviewer: "复核员",
        admin: "管理员"
    },
    menus: [
        { key: "workbench", label: "工作台", roles: ["surveyor", "reviewer", "admin"] },
        { key: "survey", label: "查勘定损", roles: ["surveyor"] },
        { key: "cases", label: "案件中心", roles: ["surveyor", "reviewer"] },
        { key: "reports", label: "报告中心", roles: ["reviewer"] },
        { key: "risk", label: "风险监管", roles: ["admin"] },
        { key: "data", label: "数据资源", roles: ["surveyor", "admin"] },
        { key: "settings", label: "系统设置", roles: ["admin"] }
    ],
    workbenchByRole: {
        surveyor: {
            metrics: [
                { label: "我的待办", value: "7" },
                { label: "今日新增案件", value: "4" },
                { label: "待外业取证", value: "3" },
                { label: "异常预警", value: "2" }
            ],
            todos: [
                { title: "YT-20260316-001", detail: "09:30 前完成 AOI 绘制并提交分析。" },
                { title: "YT-20260316-004", detail: "补传无人机影像并更新证据清单。" },
                { title: "YT-20260316-005", detail: "核对同地块历史案件并标记重复报案风险。" }
            ],
            warnings: [
                { title: "重复报案提醒", detail: "城关镇东关村同坐标 30 天内出现 2 次报案。" },
                { title: "影像时效提醒", detail: "柳泉镇案件影像采集时间晚于报案时间 48 小时。" }
            ],
            quickActions: ["新建案件", "开始分析", "上传影像", "查看结果"]
        },
        reviewer: {
            metrics: [
                { label: "我的待办", value: "11" },
                { label: "今日新增案件", value: "6" },
                { label: "待复核数量", value: "5" },
                { label: "争议案件", value: "2" }
            ],
            todos: [
                { title: "YT-20260316-001", detail: "完成面积修正并提交复核意见。" },
                { title: "YT-20260316-002", detail: "核对病虫害类型并确认复勘。" },
                { title: "YT-20260316-006", detail: "生成归档报告并导出 PDF。" }
            ],
            warnings: [
                { title: "争议案件提醒", detail: "YT-20260311-003 申请二次复核。" },
                { title: "证据缺失提醒", detail: "1 个案件缺少外业照片，暂不允许结案。" }
            ],
            quickActions: ["提交复核", "查看争议", "生成报告", "导出 PDF"]
        },
        admin: {
            metrics: [
                { label: "我的待办", value: "9" },
                { label: "今日新增案件", value: "18" },
                { label: "待复核数量", value: "7" },
                { label: "异常预警", value: "5" }
            ],
            todos: [
                { title: "资源调度", detail: "将 2 名查勘员从河湾镇调整到柳泉镇。" },
                { title: "模型巡检", detail: "核对本周新增样本 24 条并刷新模型版本。" },
                { title: "权限审核", detail: "审核 3 个复核员账号权限变更申请。" }
            ],
            warnings: [
                { title: "高风险区域", detail: "城关镇 24 小时内报案增幅 42%。" },
                { title: "非农地物预警", detail: "发现 3 个案件 AOI 疑似包含道路与建筑。" }
            ],
            quickActions: ["资源调度", "风险总览", "模型管理", "角色权限"]
        }
    },
    cases: [
        {
            id: "YT-20260316-001",
            town: "城关镇",
            village: "东关村",
            crop: "小麦",
            status: "待复核",
            reporter: "王建国",
            surveyor: "张敏",
            imageSource: "无人机 GeoTIFF",
            disasterType: "物理倒伏",
            confidence: 0.84,
            result: "受灾面积 18.6 亩"
        },
        {
            id: "YT-20260316-002",
            town: "柳泉镇",
            village: "北坡村",
            crop: "玉米",
            status: "分析中",
            reporter: "赵红梅",
            surveyor: "李凯",
            imageSource: "Sentinel-2",
            disasterType: "病虫害",
            confidence: 0.76,
            result: "异常斑块明显，待复核"
        },
        {
            id: "YT-20260316-003",
            town: "河湾镇",
            village: "西陈村",
            crop: "小麦",
            status: "待查勘",
            reporter: "陈玉兰",
            surveyor: "王浩",
            imageSource: "待上传",
            disasterType: "待判定",
            confidence: 0.50,
            result: "等待外业取证"
        },
        {
            id: "YT-20260316-004",
            town: "城关镇",
            village: "南岗村",
            crop: "小麦",
            status: "已结案",
            reporter: "孙志强",
            surveyor: "刘晴",
            imageSource: "无人机 GeoTIFF",
            disasterType: "病虫害",
            confidence: 0.69,
            result: "受灾面积 9.3 亩"
        }
    ],
    disputes: [
        { title: "YT-20260311-003", detail: "农户对面积结果有异议，申请二次复核。" },
        { title: "YT-20260312-009", detail: "疑似重复报案，需专家意见。" }
    ],
    riskMetrics: [
        { label: "今日报案数", value: "27" },
        { label: "待复核案件", value: "7" },
        { label: "高风险乡镇", value: "3" },
        { label: "无人机任务", value: "6" }
    ],
    regionTrends: [
        { title: "灾害分布", detail: "城关镇以倒伏为主，柳泉镇以病虫害为主。" },
        { title: "作物分布", detail: "小麦案件占比 63%，玉米案件占比 31%。" },
        { title: "时间趋势", detail: "近 72 小时报案主要集中在 09:00-11:00。" }
    ],
    dispatchTasks: [
        { title: "查勘员分配", detail: "张敏、李凯负责柳泉镇高风险区。" },
        { title: "无人机任务", detail: "北坡村与东关村优先执行补拍任务。" }
    ],
    imageryAssets: [
        { title: "Sentinel-2 月度影像", detail: "最近更新时间：2026-03-15" },
        { title: "无人机正射图", detail: "本周上传：16 份" },
        { title: "专题图层", detail: "NDVI/NDRE/EVI2/NDMI/BSI 已发布" }
    ],
    modelAssets: [
        { title: "样本库", detail: "有效样本 1,246 条，今日新增 24 条。" },
        { title: "规则参数", detail: "当前版本 v1.3，更新时间 2026-03-12。" },
        { title: "模型版本", detail: "当前版本 ml-2026-03，待评估。" }
    ],
    settings: [
        { title: "角色权限", detail: "查勘员/复核员/管理员共 3 类角色。" },
        { title: "系统参数", detail: "面积阈值、置信度阈值、复核规则可配置。" },
        { title: "图层设置", detail: "底图、专题图层、矢量边界可配置。" }
    ],
    evidenceTemplate: [
        { title: "原始影像", detail: "保留卫星或无人机原始文件与时间戳。" },
        { title: "范围截图", detail: "导出 AOI 与分析结果图层截图。" },
        { title: "外业照片", detail: "上传现场照片并补充说明。" }
    ]
};
