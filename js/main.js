(function (global) {
  const state = global.AppState.loadState();
  global.AppRender.initElementReferences();
  const els = global.AppRender.getElements();

  let loginModalEl, cookieInputEl, cancelLoginBtn, confirmLoginBtn;

  function activeTask() {
    return state.tasks.find((task) => task.id === state.activeId) || null;
  }

  function ensureHasTask() {
    if (!state.tasks.length) {
      const { task } = global.AppState.createTask("");
      state.tasks.unshift(task);
      state.activeId = task.id;
      global.AppState.saveState(state);
    }
    if (!state.activeId || !state.tasks.some((t) => t.id === state.activeId)) {
      state.activeId = state.tasks[0].id;
      global.AppState.saveState(state);
    }
  }

  function render() {
    global.AppRender.renderAll(state);
  }

  function setBusy(isBusy) {
    state.busy = isBusy;
    render();
  }

  function addUserMessageAndRun(userText, forceSummary) {
    const task = activeTask();
    if (!task) return;
    if (userText) {
      task.messages.push({ role: "user", content: userText, time: Date.now() });
    }
    if (!forceSummary && !task.messages.some((m) => m.role === "user")) {
      return;
    }
    task.status = "questioning";
    global.AppState.touch(task);
    global.AppState.saveState(state);
    setBusy(true);

    const modelConfig = {
      baseUrl: els.baseUrl.value.trim(),
      model: els.modelName.value.trim(),
      apiKey: els.apiKey.value.trim()
    };
    global.AppPlanner.runPlanner(task, forceSummary, modelConfig).then(() => {
      global.AppState.saveState(state);
      setBusy(false);
      window.setTimeout(() => els.chatInput && els.chatInput.focus(), 50);
    }).catch(() => {
      setBusy(false);
    });
  }

  async function verifyUserLogin() {
    if (!state.user.cookie) return false;
    try {
      const res = await fetch("/api/user", { method: "GET" });
      if (res.ok) {
        const data = await res.json();
        if (data.loggedIn && data.profile) {
          global.AppState.saveUser(state, { loggedIn: true, profile: data.profile, cookie: state.user.cookie });
          return true;
        }
      }
    } catch (e) {
      console.warn("[main] 后端未启动，无法验证登录状态");
    }
    return false;
  }

  async function handleLogin() {
    const cookieVal = cookieInputEl.value.trim();
    if (!cookieVal) {
      alert("请粘贴你的 MUSIC_U cookie 值");
      return;
    }
    try {
      const res = await fetch("/api/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ cookie: cookieVal })
      });
      const data = await res.json();
      if (data.success && data.profile) {
        global.AppState.saveUser(state, { loggedIn: true, profile: data.profile, cookie: cookieVal });
        hideLoginModal();
        render();
      } else {
        alert("登录失败：" + (data.error || "Cookie 无效，请确认是否正确"));
      }
    } catch (err) {
      alert("无法连接到后端服务，请先启动后端 (cd backend && npm start)");
    }
  }

  async function handleLogout() {
    try {
      await fetch("/api/logout", { method: "POST" });
    } catch (e) {
    }
    global.AppState.saveUser(state, { loggedIn: false, profile: null, cookie: "" });
    render();
  }

  function showLoginModal() {
    if (!loginModalEl) return;
    loginModalEl.classList.remove("hidden");
    cookieInputEl.value = "";
    cookieInputEl.focus();
  }

  function hideLoginModal() {
    if (!loginModalEl) return;
    loginModalEl.classList.add("hidden");
  }

  function bindLoginEvents() {
    loginModalEl = document.getElementById("loginModal");
    cookieInputEl = document.getElementById("cookieInput");
    cancelLoginBtn = document.getElementById("cancelLogin");
    confirmLoginBtn = document.getElementById("confirmLogin");

    if (els.loginBtn) {
      els.loginBtn.addEventListener("click", showLoginModal);
    }
    if (els.logoutBtn) {
      els.logoutBtn.addEventListener("click", handleLogout);
    }
    if (cancelLoginBtn) {
      cancelLoginBtn.addEventListener("click", hideLoginModal);
    }
    if (confirmLoginBtn) {
      confirmLoginBtn.addEventListener("click", handleLogin);
    }
    if (loginModalEl) {
      loginModalEl.addEventListener("click", (e) => {
        if (e.target === loginModalEl) hideLoginModal();
      });
    }
  }

  function bindEvents() {
    els.newTask.addEventListener("click", () => {
      const { task } = global.AppState.createTask("");
      state.tasks.unshift(task);
      state.activeId = task.id;
      state.activeChannel = "all";
      global.AppState.saveState(state);
      render();
      window.setTimeout(() => els.chatInput.focus(), 50);
    });

    els.loadDemo.addEventListener("click", () => {
      const { task, seedText } = global.AppState.createDemoTask();
      state.tasks.unshift(task);
      state.activeId = task.id;
      state.activeChannel = "all";
      global.AppState.saveState(state);
      render();
      els.chatInput.value = seedText;
      window.setTimeout(() => addUserMessageAndRun(seedText, false), 80);
    });

    els.saveModel.addEventListener("click", () => {
      global.AppState.saveModelSettings(state, {
        baseUrl: els.baseUrl.value,
        model: els.modelName.value,
        apiKey: els.apiKey.value
      });
      render();
    });

    els.sendMessage.addEventListener("click", () => {
      const text = els.chatInput.value.trim();
      if (!text) return;
      els.chatInput.value = "";
      addUserMessageAndRun(text, false);
    });

    els.forceSummary.addEventListener("click", () => {
      const pending = els.chatInput.value.trim();
      els.chatInput.value = "";
      addUserMessageAndRun(pending, true);
    });

    els.confirmSummary.addEventListener("click", async () => {
      const task = activeTask();
      if (!task) return;
      const summary = els.summaryEditor.value.trim();
      if (!summary) return;
      task.summary = summary;
      task.confirmedSummary = summary;
      task.profile = global.AppProfile.buildProfile(summary);
      task.status = "confirmed";
      task.title = global.AppState.inferTaskTitle(task);
      task.channels = null;
      state.activeChannel = "all";
      global.AppState.touch(task);
      global.AppState.saveState(state);

      const localResult = global.AppFinder.searchLocalOnly(task.profile);
      task.results = localResult.tracks;
      task.playlists = [];
      task.channels = { playlists: { playlists: [], tracks: [] }, singles: { tracks: [] }, user: { tracks: [], loggedIn: state.user.loggedIn } };
      task._remoteLoading = true;
      task._remoteError = false;
      render();

      try {
        const searchResult = await global.AppFinder.searchCandidates(task.profile, summary);
        task.results = searchResult.tracks;
        task.playlists = searchResult.playlists;
        task.channels = searchResult.channels || null;
        task._remoteError = !task.results.some((t) => t._source === "remote");
      } catch (err) {
        console.error("搜索出错:", err);
        task._remoteError = true;
      }
      task._remoteLoading = false;
      global.AppState.touch(task);
      global.AppState.saveState(state);
      render();
    });

    els.rewriteSummary.addEventListener("click", () => {
      const task = activeTask();
      if (!task || state.busy) return;
      task.status = "questioning";
      task.messages.push({
        role: "assistant",
        content: "可以继续补充你想调整的部分：画面、配乐用途（开场/BGM/转场/高潮/结尾）、情绪、节奏、曲风或不要的元素都可以。",
        time: Date.now()
      });
      global.AppState.touch(task);
      global.AppState.saveState(state);
      render();
      window.setTimeout(() => els.chatInput.focus(), 50);
    });

    els.applyFeedback.addEventListener("click", async () => {
      const text = els.feedbackInput.value.trim();
      if (!text) return;
      const task = activeTask();
      if (!task || task.status !== "confirmed") return;
      els.feedbackInput.value = "";
      task._remoteLoading = true;
      task._remoteError = false;
      render();
      await global.AppFeedback.applyFeedbackToTask(task, text);
      task._remoteError = !task.results.some((t) => t._source === "remote");
      task._remoteLoading = false;
      global.AppState.touch(task);
      global.AppState.saveState(state);
      render();
    });

    els.chatInput.addEventListener("keydown", (event) => {
      if (event.key === "Enter" && (event.ctrlKey || event.metaKey)) {
        els.sendMessage.click();
      }
    });

    els.summaryEditor.addEventListener("input", () => {
      const task = activeTask();
      if (!task) return;
      task.summary = els.summaryEditor.value;
      global.AppState.touch(task);
      global.AppState.saveState(state);
    });

    global.AppRender.renderFeedbackChips((text) => {
      els.feedbackInput.value = text;
      els.applyFeedback.click();
    });
  }

  async function init() {
    ensureHasTask();
    bindLoginEvents();
    bindEvents();
    if (state.model) {
      els.baseUrl.value = state.model.baseUrl || "";
      els.modelName.value = state.model.model || "";
      els.apiKey.value = state.model.apiKey || "";
    }
    render();
    window.setTimeout(() => els.chatInput.focus(), 80);

    if (state.user.cookie) {
      await verifyUserLogin();
      render();
    }
  }

  document.addEventListener("DOMContentLoaded", init);
})(window);
