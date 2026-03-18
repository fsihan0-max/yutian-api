(function initAuthModule() {
    const USERS_KEY = "agri_users";
    const SESSION_KEY = "agri_session";

    const DEFAULT_USERS = [
        { username: "surveyor01", password: "123456", role: "surveyor", displayName: "鏌ュ嫎鍛?1" },
        { username: "reviewer01", password: "123456", role: "reviewer", displayName: "澶嶆牳鍛?1" },
        { username: "admin01", password: "123456", role: "admin", displayName: "绠＄悊鍛?1" }
    ];

    function readJson(key, fallback) {
        try {
            const raw = localStorage.getItem(key);
            if (!raw) return fallback;
            const parsed = JSON.parse(raw);
            return parsed === null || typeof parsed === "undefined" ? fallback : parsed;
        } catch (error) {
            return fallback;
        }
    }

    function writeJson(key, value) {
        localStorage.setItem(key, JSON.stringify(value));
    }

    function ensureUsers() {
        const users = readJson(USERS_KEY, []);
        if (users.length) return users;
        writeJson(USERS_KEY, DEFAULT_USERS);
        return DEFAULT_USERS.slice();
    }

    function listUsers() {
        return ensureUsers();
    }

    function register(payload) {
        const username = String(payload.username || "").trim();
        const password = String(payload.password || "").trim();
        const role = String(payload.role || "").trim();

        if (!username || !password || !role) {
            return { ok: false, message: "璇峰～鍐欏畬鏁存敞鍐屼俊鎭€? };
        }
        if (username.length < 4) {
            return { ok: false, message: "璐﹀彿鑷冲皯 4 浣嶃€? };
        }
        if (password.length < 6) {
            return { ok: false, message: "瀵嗙爜鑷冲皯 6 浣嶃€? };
        }
        if (!["surveyor", "reviewer", "admin"].includes(role)) {
            return { ok: false, message: "瑙掕壊鏃犳晥銆? };
        }

        const users = ensureUsers();
        if (users.some((item) => item.username === username)) {
            return { ok: false, message: "璐﹀彿宸插瓨鍦ㄣ€? };
        }

        const user = {
            username,
            password,
            role,
            displayName: payload.displayName ? String(payload.displayName).trim() : username
        };
        users.push(user);
        writeJson(USERS_KEY, users);
        return { ok: true, user };
    }

    function login(username, password) {
        const account = String(username || "").trim();
        const secret = String(password || "").trim();
        const user = ensureUsers().find(
            (item) => item.username === account && item.password === secret
        );
        if (!user) {
            return { ok: false, message: "璐﹀彿鎴栧瘑鐮侀敊璇€? };
        }
        const session = {
            username: user.username,
            displayName: user.displayName || user.username,
            role: user.role,
            loginAt: new Date().toISOString()
        };
        writeJson(SESSION_KEY, session);
        return { ok: true, session };
    }

    function currentSession() {
        return readJson(SESSION_KEY, null);
    }

    function logout() {
        localStorage.removeItem(SESSION_KEY);
    }

    window.Auth = {
        listUsers,
        register,
        login,
        currentSession,
        logout
    };
})();

