(function initLoginPage() {
    const session = window.Auth.currentSession();
    if (session) {
        window.location.href = "../workbench/index.html";
        return;
    }

    const tabLogin = document.getElementById("tabLogin");
    const tabRegister = document.getElementById("tabRegister");
    const loginForm = document.getElementById("loginForm");
    const registerForm = document.getElementById("registerForm");
    const message = document.getElementById("authMessage");

    function setMessage(text, isError) {
        message.textContent = text;
        message.classList.toggle("error", Boolean(isError));
        message.classList.toggle("success", !isError && Boolean(text));
    }

    function switchTab(type) {
        const isLogin = type === "login";
        tabLogin.classList.toggle("active", isLogin);
        tabRegister.classList.toggle("active", !isLogin);
        loginForm.classList.toggle("hidden", !isLogin);
        registerForm.classList.toggle("hidden", isLogin);
        setMessage("", false);
    }

    tabLogin.addEventListener("click", () => switchTab("login"));
    tabRegister.addEventListener("click", () => switchTab("register"));

    loginForm.addEventListener("submit", (event) => {
        event.preventDefault();
        const username = document.getElementById("loginUsername").value;
        const password = document.getElementById("loginPassword").value;
        const result = window.Auth.login(username, password);
        if (!result.ok) {
            setMessage(result.message, true);
            return;
        }
        window.location.href = "../workbench/index.html";
    });

    registerForm.addEventListener("submit", (event) => {
        event.preventDefault();
        const username = document.getElementById("registerUsername").value;
        const password = document.getElementById("registerPassword").value;
        const confirm = document.getElementById("registerPasswordConfirm").value;
        const role = document.getElementById("registerRole").value;

        if (password !== confirm) {
            setMessage("涓ゆ杈撳叆鐨勫瘑鐮佷笉涓€鑷淬€?, true);
            return;
        }

        const result = window.Auth.register({ username, password, role });
        if (!result.ok) {
            setMessage(result.message, true);
            return;
        }

        setMessage("娉ㄥ唽鎴愬姛锛岃浣跨敤鏂拌处鍙风櫥褰曘€?, false);
        registerForm.reset();
        switchTab("login");
    });
})();


