(function (global) {
  const { TASK_STORAGE_KEY, ACTIVE_TASK_KEY, MODEL_STORAGE_KEY, defaultModel, demoBrief } = global.AppConfig;
  const { buildProfile, nameOf } = global.AppProfile;

  function safeParse(value, fallback) {
    try {
      return value ? JSON.parse(value) : fallback;
    } catch (error) {
      return fallback;
    }
  }

  function loadState() {
    const tasks = safeParse(localStorage.getItem(TASK_STORAGE_KEY), []);
    const activeId = localStorage.getItem(ACTIVE_TASK_KEY);
    const model = { ...defaultModel, ...safeParse(localStorage.getItem(MODEL_STORAGE_KEY), {}) };
    const state = {
      tasks,
      activeId: tasks.some((task) => task.id === activeId) ? activeId : tasks[0] ? tasks[0].id : null,
      model,
      busy: false
    };
    return state;
  }

  function saveState(state) {
    localStorage.setItem(TASK_STORAGE_KEY, JSON.stringify(state.tasks));
    if (state.activeId) localStorage.setItem(ACTIVE_TASK_KEY, state.activeId);
  }

  function saveModelSettings(state, config) {
    state.model = {
      baseUrl: config.baseUrl.trim() || defaultModel.baseUrl,
      model: config.model.trim() || defaultModel.model,
      apiKey: config.apiKey.trim()
    };
    localStorage.setItem(MODEL_STORAGE_KEY, JSON.stringify(state.model));
  }

  function inferTaskTitle(task) {
    const text = task.confirmedSummary || task.summary || global.AppPlanner.allUserText(task);
    if (/城市|夜景|地铁|霓虹/.test(text)) return "城市夜景配乐";
    if (/毕业|校园|朋友/.test(text)) return "毕业回忆配乐";
    if (/旅行|海边|火车|公路/.test(text)) return "旅行 vlog 配乐";
    if (/美食|探店|咖啡/.test(text)) return "美食探店配乐";
    if (/健身|训练|运动/.test(text)) return "健身卡点配乐";
    const firstUser = task.messages.find((message) => message.role === "user");
    if (firstUser) return firstUser.content.slice(0, 16) + (firstUser.content.length > 16 ? "..." : "");
    return "新配乐任务";
  }

  function touch(task) {
    task.updatedAt = Date.now();
    if (task.status !== "confirmed") {
      task.title = inferTaskTitle(task);
    }
  }

  function createTask(seedText) {
    const now = Date.now();
    const task = {
      id: `task-${now}-${Math.random().toString(16).slice(2)}`,
      title: "新配乐任务",
      status: "draft",
      createdAt: now,
      updatedAt: now,
      messages: [
        {
          role: "assistant",
          content: "把视频内容、文案或想要的感觉发给我。我会先补齐真实需求，再交给音乐寻找 Agent。",
          time: now
        }
      ],
      plannerTurns: 0,
      plannerSource: "本地模拟待命",
      summary: "",
      confirmedSummary: "",
      profile: null,
      results: [],
      feedback: []
    };
    return { task, seedText: seedText || "" };
  }

  function createDemoTask() {
    return createTask(demoBrief);
  }

  global.AppState = {
    loadState,
    saveState,
    saveModelSettings,
    createTask,
    createDemoTask,
    touch,
    inferTaskTitle
  };
})(window);
