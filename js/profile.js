(function (global) {
  const { keywordMap, labelMap } = global.AppData;

  function nameOf(key) {
    return labelMap[key] || key;
  }

  function inferBpmTarget(flags) {
    if (flags.wantsBeat || flags.wantsEnergy) return [118, 145];
    if (flags.wantsSad || flags.wantsSoft) return [72, 104];
    return [88, 124];
  }

  function inferEnergyTarget(flags) {
    if (flags.wantsEnergy || flags.wantsBeat) return [60, 90];
    if (flags.wantsSoft || flags.wantsSad) return [25, 55];
    return [38, 70];
  }

  function inferGenreHints(profile) {
    const hints = [];
    if (profile.scenes.includes("city")) hints.push("lofi / ambient / minimal electronic");
    if (profile.scenes.includes("travel")) hints.push("indie pop / acoustic / folk");
    if (profile.scenes.includes("food")) hints.push("jazz-hop / bossa / light funk");
    if (profile.scenes.includes("fitness")) hints.push("house / trap / sport electronic");
    if (profile.wantsSad) hints.push("piano / cinematic");
    if (profile.wantsSoft) hints.push("instrumental / low vocal");
    if (!hints.length) hints.push("lofi / light electronic");
    return hints;
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
    const wantsSoft = scores.soft > 0 || /不要太吵|不抢|旁白|口播/.test(text);
    const wantsSad = scores.sad > 0;
    const wantsEnergy = scores.energetic > 0 || scores.fitness > 0;
    const flags = { wantsBeat, wantsEnergy, wantsSad, wantsSoft };
    return {
      scenes: scenes.length ? scenes : ["daily"],
      moods: moods.length ? moods : ["clean"],
      wantsBeat,
      wantsSoft,
      wantsSad,
      wantsEnergy,
      bpmTarget: inferBpmTarget(flags),
      energyTarget: inferEnergyTarget(flags),
      avoid: wantsSoft ? ["高能量 Drop", "密集人声", "过强低频"] : ["版权不明来源", "与画面情绪冲突"],
      genreHints: inferGenreHints({ ...flags, scenes, moods })
    };
  }

  global.AppProfile = {
    nameOf,
    buildProfile,
    inferPlatform,
    inferDuration
  };
})(window);
