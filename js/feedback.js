(function (global) {
  function parseFeedback(text) {
    const tags = [];
    const notes = [];
    if (/吵|炸|低频|太强|太满/.test(text)) {
      tags.push("soft");
      notes.push("降低能量、低频和高密度 Drop 权重");
    }
    if (/悲伤|难过|想哭|失落|emo/.test(text)) {
      tags.push("sad", "lonely");
      notes.push("提高悲伤、孤独和回忆感权重");
    }
    if (/卡点|节奏|鼓点|快切|更强/.test(text)) {
      tags.push("beat");
      notes.push("提高 BPM 和节拍稳定性权重");
    }
    if (/不抢|旁白|口播|安静|轻一点/.test(text)) {
      tags.push("soft");
      notes.push("优先纯器乐和低能量曲目");
    }
    if (/旅行|海边|公路|车窗|露营/.test(text)) {
      tags.push("travel");
      notes.push("提高旅行场景权重");
    }
    if (/开头|前三秒|抓人|吸引/.test(text)) {
      tags.push("beat", "energetic");
      notes.push("提高开头抓取和节奏进入速度");
    }
    if (!notes.length) {
      tags.push("premium");
      notes.push("按更精致、更稳妥的方向收敛");
    }
    return { tags: Array.from(new Set(tags)), summary: notes.join("，") };
  }

  async function applyFeedbackToTask(task, feedbackText) {
    const changes = parseFeedback(feedbackText);
    task.feedback = task.feedback || [];
    task.feedback.push({ text: feedbackText, summary: changes.summary, time: Date.now() });
    const additional = changes.tags.map((key) => global.AppProfile.nameOf(key)).join(" ");
    const previous = task.confirmedSummary || task.summary || "";
    task.confirmedSummary = `${previous}\n\n反馈修正：${changes.summary}。用户原话：${feedbackText}`;
    task.summary = task.confirmedSummary;
    const profile = global.AppProfile.buildProfile(`${task.confirmedSummary} ${additional}`);
    task.profile = profile;
    const searchResult = await global.AppFinder.searchCandidates(profile, task.confirmedSummary);
    task.results = searchResult.tracks;
    task.playlists = searchResult.playlists;
    task.channels = searchResult.channels || null;
    return task;
  }

  global.AppFeedback = {
    parseFeedback,
    applyFeedbackToTask
  };
})(window);
