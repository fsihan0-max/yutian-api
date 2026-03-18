window.AppConfig = {
  apiBase: `${window.location.protocol}//${window.location.hostname || "127.0.0.1"}:5000`,
  roleLabel: {
    surveyor: "\u67e5\u52d8\u5458",
    reviewer: "\u590d\u6838\u5458",
    admin: "\u7ba1\u7406\u5458"
  },
  menus: [
    { key: "workbench", label: "\u5de5\u4f5c\u53f0", roles: ["surveyor", "reviewer", "admin"] },
    { key: "survey", label: "\u67e5\u52d8\u5b9a\u635f", roles: ["surveyor"] },
    { key: "cases", label: "\u6848\u4ef6\u4e2d\u5fc3", roles: ["surveyor", "reviewer"] },
    { key: "reports", label: "\u62a5\u544a\u4e2d\u5fc3", roles: ["reviewer"] },
    { key: "risk", label: "\u98ce\u9669\u76d1\u7ba1", roles: ["admin"] },
    { key: "data", label: "\u6570\u636e\u4e2d\u5fc3", roles: ["surveyor", "admin"] },
    { key: "settings", label: "\u7cfb\u7edf\u8bbe\u7f6e", roles: ["admin"] }
  ],
  caseStatus: {
    pendingSurvey: "\u5f85\u67e5\u52d8",
    analyzing: "\u5206\u6790\u4e2d",
    pendingReview: "\u5f85\u590d\u6838",
    closed: "\u5df2\u7ed3\u6848"
  },
  settings: [
    { title: "\u89d2\u8272\u6743\u9650", detail: "\u67e5\u52d8\u5458\u3001\u590d\u6838\u5458\u3001\u7ba1\u7406\u5458\u3002" },
    { title: "\u7cfb\u7edf\u53c2\u6570", detail: "\u9762\u79ef\u9608\u503c\u3001\u7f6e\u4fe1\u5ea6\u9608\u503c\u3001\u590d\u6838\u89c4\u5219\u3002" },
    { title: "\u56fe\u5c42\u8bbe\u7f6e", detail: "\u5e95\u56fe\u4e0e\u4e13\u9898\u56fe\u5c42\u5f00\u5173\u3002" }
  ],
  evidenceTemplate: [
    { title: "\u539f\u59cb\u5f71\u50cf", detail: "\u4fdd\u7559\u536b\u661f/\u65e0\u4eba\u673a\u539f\u59cb\u5f71\u50cf\u53ca\u65f6\u95f4\u6233\u3002" },
    { title: "AOI \u622a\u56fe", detail: "\u4fdd\u5b58 AOI \u4e0e\u7ed3\u679c\u53e0\u52a0\u622a\u56fe\u7528\u4e8e\u5f52\u6863\u3002" },
    { title: "\u5916\u4e1a\u7167\u7247", detail: "\u4e0a\u4f20\u73b0\u573a\u7167\u7247\u4e0e\u8865\u5145\u8bf4\u660e\u3002" }
  ]
};

window.AppData = window.AppConfig;
