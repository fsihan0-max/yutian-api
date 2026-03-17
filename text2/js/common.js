window.AppUI = {
    apiBase: window.AppData.apiBase,
    byId(id) {
        return document.getElementById(id);
    },
    cardList(items, className = "task-item") {
        return items.map((item) => `<div class="${className}"><strong>${item.title || item.label || "信息"}</strong><p>${item.detail || item.text || item.value || ""}</p></div>`).join("");
    },
    initSectionNav(pageTitleId, labelMap) {
        document.querySelectorAll(".section-link").forEach((button) => {
            button.addEventListener("click", () => {
                const key = button.dataset.section;
                document.querySelectorAll(".section-link").forEach((item) => item.classList.toggle("active", item === button));
                document.querySelectorAll("[data-page-section]").forEach((section) => {
                    section.classList.toggle("active", section.dataset.pageSection === key);
                });
                if (pageTitleId && labelMap[key]) {
                    this.byId(pageTitleId).textContent = labelMap[key];
                }
            });
        });
    },
    async updateHealthBadge(badgeId) {
        const badge = this.byId(badgeId);
        try {
            const response = await fetch(`${this.apiBase}/api/health`);
            const result = await response.json();
            badge.textContent = result.status === "ok" ? "后端状态：在线" : "后端状态：异常";
        } catch (error) {
            badge.textContent = "后端状态：未连接";
        }
    }
};
