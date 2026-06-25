(function (global) {
  const { plannerQuestions, defaultModel } = global.AppConfig;
  const { nameOf, buildProfile, inferPlatform, inferDuration } = global.AppProfile;

  function normalizeEndpoint(baseUrl) {
    const trimmed = baseUrl.replace(/\/+$/, "");
    return trimmed.endsWith("/chat/completions") ? trimmed : `${trimmed}/chat/completions`;
  }

  function parsePlannerResponse(content) {
    const raw = content.trim().replace(/^```json\s*/i, "").replace(/^```\s*/i, "").replace(/```$/i, "").trim();
    try {
      const parsed = JSON.parse(raw);
      return {
        stage: parsed.stage === "summary_ready" ? "summary_ready" : "questioning",
        assistant_message: String(parsed.assistant_message || raw),
        summary: String(parsed.summary || "")
      };
    } catch (error) {
      return {
        stage: "questioning",
        assistant_message: content,
        summary: ""
      };
    }
  }

  async function callPlannerModel(task, forceSummary, config) {
    const effective = {
      baseUrl: (config && config.baseUrl) || defaultModel.baseUrl,
      model: (config && config.model) || defaultModel.model,
      apiKey: (config && config.apiKey) || defaultModel.apiKey
    };
    if (!effective.apiKey) throw new Error("missing api key");
    const endpoint = normalizeEndpoint(effective.baseUrl);
    const system = [
      "你是乐之笛的规划 AI，服务对象是 vlogger 和剪辑师。",
      "你的任务是通过逐轮追问，把用户模糊的配乐想法整理成完整需求。",
      "你现在只负责需求澄清，不推荐具体歌曲。",
      "每轮最多问一个关键问题。信息足够时输出 summary_ready。",
      "必须只输出 JSON，不要 Markdown。",
      "JSON 字段：stage 为 questioning 或 summary_ready；assistant_message 为给用户看的话；summary 为最终总结，未完成时为空字符串。"
    ].join("\n");
    const modelMessages = [
      { role: "system", content: system },
      ...task.messages.map((message) => ({
        role: message.role === "assistant" ? "assistant" : "user",
        content: message.content
      }))
    ];
    if (forceSummary) {
      modelMessages.push({
        role: "user",
        content: "请基于已有对话直接输出 summary_ready，并生成完整可执行的配乐需求总结。"
      });
    }
    const res = await fetch(endpoint, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${effective.apiKey}`
      },
      body: JSON.stringify({
        model: effective.model,
        messages: modelMessages,
        temperature: 0.4
      })
    });
    if (!res.ok) throw new Error(`model request failed: ${res.status}`);
    const data = await res.json();
    const content = data.choices && data.choices[0] && data.choices[0].message
      ? data.choices[0].message.content
      : "";
    if (!content) throw new Error("empty model response");
    return parsePlannerResponse(content);
  }

  function allUserText(task) {
    return task.messages.filter((message) => message.role === "user").map((message) => message.content).join("\n");
  }

  function extractBrief(text) {
    const compact = text.replace(/\s+/g, " ").trim();
    if (!compact) return "用户暂未提供明确画面，按生活方式 vlog 处理";
    return compact.length > 96 ? `${compact.slice(0, 96)}...` : compact;
  }

  function buildSummaryFromTask(task) {
    const text = allUserText(task);
    const profile = buildProfile(text);
    const scenes = profile.scenes.map(nameOf).join("、");
    const moods = profile.moods.map(nameOf).join("、");
    const platform = inferPlatform(text);
    const duration = inferDuration(text);
    return [
      `视频内容：${extractBrief(text)}`,
      `目标情绪：${moods}。整体应服务画面叙事，不喧宾夺主。`,
      `画面场景：${scenes}。`,
      `节奏需求：建议 ${profile.bpmTarget[0]}-${profile.bpmTarget[1]} BPM，能量控制在 ${profile.energyTarget[0]}-${profile.energyTarget[1]}/100。${profile.wantsBeat ? "需要有清晰鼓点和可卡点段落。" : "需要自然铺垫和稳定推进。"}`,
      `曲风方向：${profile.genreHints.join("、")}。`,
      `限制条件：${profile.avoid.join("、")}。`,
      `发布与使用：面向${platform}，视频时长倾向${duration}，优先选择可商用或来源清晰的音乐。`
    ].join("\n");
  }

  function localPlanner(task, forceSummary) {
    const userCount = task.messages.filter((message) => message.role === "user").length;
    if (forceSummary || userCount >= plannerQuestions.length + 1) {
      return {
        stage: "summary_ready",
        assistant_message: "我已经把你的配乐需求整理好了。你可以在右侧直接修改，确认后我会交给音乐寻找 Agent。",
        summary: buildSummaryFromTask(task)
      };
    }
    return {
      stage: "questioning",
      assistant_message: plannerQuestions[Math.min(userCount - 1, plannerQuestions.length - 1)],
      summary: ""
    };
  }

  async function runPlanner(task, forceSummary, modelConfig) {
    let response;
    let source = "本地模拟";
    try {
      response = await callPlannerModel(task, forceSummary, modelConfig);
      source = "大模型在线";
    } catch (error) {
      response = localPlanner(task, forceSummary);
      source = "本地模拟";
    }

    task.plannerTurns = (task.plannerTurns || 0) + 1;
    task.plannerSource = source;
    if (response.assistant_message) {
      task.messages.push({ role: "assistant", content: response.assistant_message, time: Date.now() });
    }
    if (response.stage === "summary_ready") {
      task.status = "summary_ready";
      task.summary = response.summary || buildSummaryFromTask(task);
    } else {
      task.status = "questioning";
    }
    return response;
  }

  global.AppPlanner = {
    runPlanner,
    buildSummaryFromTask,
    allUserText,
    localPlanner
  };
})(window);
