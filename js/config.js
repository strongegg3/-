(function (global) {
  const TASK_STORAGE_KEY = "yuezhidi.tasks.v2";
  const ACTIVE_TASK_KEY = "yuezhidi.activeTask.v2";
  const MODEL_STORAGE_KEY = "yuezhidi.model.v2";

  const defaultModel = {
    baseUrl: "https://api.openai.com/v1",
    model: "gpt-4.1-mini",
    apiKey: ""
  };

  const demoBrief = "城市夜景 vlog，一个人下班后穿过街区，画面有霓虹、地铁和便利店。想要孤独但高级，不要太吵，适合开头慢慢进入，后半段可以有一点节奏。";

  const plannerQuestions = [
    "这个视频大概有哪些画面或段落？如果有开头、中段、结尾，也可以按顺序说。",
    "你希望观众看完是什么感受？比如治愈、孤独、高级、热血、怀旧、轻松。",
    "配乐节奏更偏慢铺垫、稳定律动，还是强卡点？有没有想避开的曲风？",
    "有没有明确不要的东西？比如太吵、抢人声、版权不明、低频太重。"
  ];

  const feedbackPresets = ["太吵了", "更悲伤一点", "节奏更卡点", "不要抢人声", "更有旅行感", "开头更抓人"];

  global.AppConfig = {
    TASK_STORAGE_KEY,
    ACTIVE_TASK_KEY,
    MODEL_STORAGE_KEY,
    defaultModel,
    demoBrief,
    plannerQuestions,
    feedbackPresets
  };
})(window);
