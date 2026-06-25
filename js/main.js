(function (global) {
  const state = global.AppState.loadState();
  global.AppRender.initElementReferences();
  const els = global.AppRender.getElements();

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

  function bindEvents() {
    els.newTask.addEventListener("click", () => {
      const { task } = global.AppState.createTask("");
      state.tasks.unshift(task);
      state.activeId = task.id;
      global.AppState.saveState(state);
      render();
      window.setTimeout(() => els.chatInput.focus(), 50);
    });

    els.loadDemo.addEventListener("click", () => {
      const { task, seedText } = global.AppState.createDemoTask();
      state.tasks.unshift(task);
      state.activeId = task.id;
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
      global.AppState.touch(task);
      global.AppState.saveState(state);
      // 先渲染本地结果
      task.results = global.AppFinder.searchLocalOnly(task.profile);
      task._remoteLoading = true;
      task._remoteError = false;
      render();
      // 异步获取远程结果
      try {
        task.results = await global.AppFinder.searchCandidates(task.profile, summary);
        task._remoteError = !task.results.some((t) => t._source === "remote");
      } catch (err) {
        task._remoteError = true;
      }
      task._remoteLoading = false;
      global.AppState.saveState(state);
      render();
    });

    els.rewriteSummary.addEventListener("click", () => {
      const task = activeTask();
      if (!task || state.busy) return;
      task.status = "questioning";
      task.messages.push({
        role: "assistant",
        content: "可以继续补充你想调整的部分：画面、情绪、节奏、曲风或不要的元素都可以。",
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
      render();
    });

    global.AppRender.renderFeedbackChips((text) => {
      els.feedbackInput.value = text;
      els.applyFeedback.click();
    });
  }

  function init() {
    ensureHasTask();
    bindEvents();
    if (state.model) {
      els.baseUrl.value = state.model.baseUrl || "";
      els.modelName.value = state.model.model || "";
      els.apiKey.value = state.model.apiKey || "";
    }
    render();
    window.setTimeout(() => els.chatInput.focus(), 80);
  }

  document.addEventListener("DOMContentLoaded", init);
})(window);
