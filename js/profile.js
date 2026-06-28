(function (global) {
  const { keywordMap, labelMap } = global.AppData;

  const USE_LABELS = {
    intro: "开场曲",
    bgm: "背景BGM",
    transition: "转场音乐",
    climax: "高潮配乐",
    ending: "结尾音乐",
    general: "通用配乐"
  };

  function nameOf(key) {
    return labelMap[key] || key;
  }

  function useLabel(use) {
    return USE_LABELS[use] || use;
  }

  function inferUses(text) {
    const source = text.toLowerCase();
    const uses = [];
    if (/开场|开头|开头曲|intro|开篇|前奏.*开|慢慢进入|带入氛围/.test(source)) uses.push("intro");
    if (/bgm|背景|旁白|口播|不抢|铺底|环境音|持续|工作|学习/.test(source)) uses.push("bgm");
    if (/转场|卡点|快切|间奏|过渡|切换|beat|drum/.test(source)) uses.push("transition");
    if (/高潮|副歌|燃|高能|爆发|抓人|冲击|热血|epic|drop/.test(source)) uses.push("climax");
    if (/结尾|收尾|outro|结束|渐弱|余韵|落幕|淡出/.test(source)) uses.push("ending");
    if (!uses.length) uses.push("general");
    return [...new Set(uses)];
  }

  function inferBpmTarget(flags, uses) {
    if (uses.includes("transition") || flags.wantsBeat || flags.wantsEnergy) return [118, 145];
    if (uses.includes("intro") && (flags.wantsSoft || flags.wantsSad)) return [60, 90];
    if (uses.includes("bgm")) return [80, 110];
    if (flags.wantsSad || flags.wantsSoft) return [72, 104];
    if (uses.includes("climax")) return [110, 140];
    return [88, 124];
  }

  function inferEnergyTarget(flags, uses) {
    if (uses.includes("climax") || flags.wantsEnergy || flags.wantsBeat) return [60, 90];
    if (uses.includes("intro") && (flags.wantsSoft || flags.wantsSad)) return [15, 40];
    if (uses.includes("bgm") || flags.wantsSoft) return [20, 50];
    if (flags.wantsSoft || flags.wantsSad) return [25, 55];
    return [38, 70];
  }

  function inferGenreHints(profile) {
    const hints = [];
    const { uses } = profile;
    if (uses.includes("intro")) hints.push("ambient / 环境音 / 纯音乐开头");
    if (uses.includes("bgm")) hints.push("lofi / instrumental / 轻人声");
    if (uses.includes("transition")) hints.push("有鼓点 / beat / 节奏感");
    if (uses.includes("climax")) hints.push("epic / cinematic / 副歌有记忆点");
    if (profile.scenes.includes("city")) hints.push("lofi / ambient / minimal electronic");
    if (profile.scenes.includes("travel")) hints.push("indie pop / acoustic / folk");
    if (profile.scenes.includes("food")) hints.push("jazz-hop / bossa / light funk");
    if (profile.scenes.includes("fitness")) hints.push("house / trap / sport electronic");
    if (profile.wantsSad) hints.push("piano / cinematic");
    if (profile.wantsSoft) hints.push("instrumental / low vocal");
    if (!hints.length) hints.push("lofi / light electronic");
    return [...new Set(hints)];
  }

  function inferPlatform(text) {
    if (/抖音|tiktok|短视频/.test(text)) return "抖音或短视频平台";
    if (/小红书/.test(text)) return "小红书";
    if (/youtube/i.test(text)) return "YouTube";
    if (/b站|哔哩|bilibili/i.test(text)) return "B 站";
    return "主流视频平台";
  }

  function inferDuration(text) {
    if (/30秒|三十秒|短视频|前三秒/.test(text)) return "30 秒内短视频";
    if (/三分钟|3分钟|长视频|纪录/.test(text)) return "3 分钟以上叙事视频";
    return "1-3 分钟 vlog";
  }

  function buildProfile(text) {
    const source = text.toLowerCase();
    const scores = {};
    Object.keys(keywordMap).forEach((key) => {
      scores[key] = 0;
      keywordMap[key].forEach((word) => {
        if (source.includes(word.toLowerCase())) scores[key] += 2;
      });
    });
    const scenes = ["city", "travel", "food", "graduation", "fitness"]
      .filter((key) => scores[key] > 0)
      .sort((a, b) => scores[b] - scores[a]);
    const moods = ["lonely", "warm", "sad", "premium", "energetic", "soft"]
      .filter((key) => scores[key] > 0)
      .sort((a, b) => scores[b] - scores[a]);
    const wantsBeat = scores.beat > 0 || scores.fitness > 0;
    const wantsSoft = scores.soft > 0 || /不要太吵|不抢|旁白|口播|纯音乐/.test(text);
    const wantsSad = scores.sad > 0;
    const wantsEnergy = scores.energetic > 0 || scores.fitness > 0;
    const flags = { wantsBeat, wantsEnergy, wantsSad, wantsSoft };
    const uses = inferUses(text);
    return {
      scenes: scenes.length ? scenes : ["daily"],
      moods: moods.length ? moods : ["clean"],
      uses,
      wantsBeat,
      wantsSoft,
      wantsSad,
      wantsEnergy,
      bpmTarget: inferBpmTarget(flags, uses),
      energyTarget: inferEnergyTarget(flags, uses),
      avoid: wantsSoft ? ["高能量 Drop", "密集人声", "过强低频"] : ["版权不明来源", "与画面情绪冲突"],
      genreHints: inferGenreHints({ ...flags, scenes, moods, uses })
    };
  }

  global.AppProfile = {
    nameOf,
    useLabel,
    buildProfile,
    inferUses,
    inferPlatform,
    inferDuration,
    USE_LABELS
  };
})(window);
