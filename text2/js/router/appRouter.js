const el = (id) => document.getElementById(id);

function allowedMenusByRole(role) {
  return window.AppConfig.menus.filter((menu) => menu.roles.includes(role));
}

export function createAppRouter(state, onRouteChange) {
  function allowedMenus() {
    return allowedMenusByRole(state.user.role);
  }

  function normalizeMenuKey(menuKey) {
    const allowed = allowedMenus().map((item) => item.key);
    return allowed.includes(menuKey) ? menuKey : "workbench";
  }

  function renderMenu() {
    const menus = allowedMenus();
    el("menuList").innerHTML = menus.map((menu) => `
      <button class="menu-item ${menu.key === state.currentMenu ? "active" : ""}" data-menu-key="${menu.key}" type="button">
        ${menu.label}
      </button>
    `).join("");

    el("menuList").querySelectorAll("[data-menu-key]").forEach((button) => {
      button.addEventListener("click", () => go(button.dataset.menuKey));
    });
  }

  function updatePageLayout() {
    const menus = allowedMenus();
    const menuRecord = menus.find((item) => item.key === state.currentMenu);
    el("pageTitle").textContent = (menuRecord && menuRecord.label) || "\u5de5\u4f5c\u53f0";

    document.querySelectorAll(".page").forEach((page) => {
      page.classList.toggle("active", page.dataset.page === state.currentMenu);
    });
  }

  function go(menuKey) {
    state.currentMenu = normalizeMenuKey(menuKey);
    if (window.location.hash !== `#${state.currentMenu}`) {
      window.location.hash = state.currentMenu;
    }
    renderMenu();
    updatePageLayout();
    onRouteChange(state.currentMenu);
  }

  function setFromHash() {
    const hashKey = window.location.hash.replace("#", "").trim();
    go(hashKey || "workbench");
  }

  return {
    go,
    renderMenu,
    setFromHash,
    allowedMenus
  };
}
