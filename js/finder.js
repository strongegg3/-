(function (global) {
  const { catalog } = global.AppData;

  const API_BASE = "";

  function clamp(value, min, max) {
    return Math.max(min, Math.min(max, value));
  }

  function rangeScore(value, range) {
    const [min, max] = range;
    if (value >= min && value <= max) return 1;
    const distance = value < min ? min - value : value - max;
    return clamp(1 - distance / 45, 0, 1);
  }

  /**
   * 对本地曲库评分排序
   */
  function scoreLocalTracks(profile) {
    return catalog.map((track) => {
      let score = 18;
      const reasons = [];
      const sceneHits = profile.scenes.filter((scene) => track.scenes.includes(scene));
      const moodHits = profile.moods.filter((mood) => track.moods.includes(mood));
      score += sceneHits.length * 13;
      score += moodHits.length * 12;
      if (sceneHits.length) reasons.push(`场景命中：${sceneHits.map((k) => global.AppProfile.nameOf(k)).join("、")}`);
      if (moodHits.length) reasons.push(`情绪命中：${moodHits.map((k) => global.AppProfile.nameOf(k)).join("、")}`);

      const bpmScore = rangeScore(track.bpm, profile.bpmTarget);
      const energyScore = rangeScore(track.energy, profile.energyTarget);
      score += bpmScore * 14;
      score += energyScore * 16;
      if (bpmScore > 0.72) reasons.push(`BPM ${track.bpm} 落在建议节奏区间`);
      if (energyScore > 0.72) reasons.push(`能量 ${track.energy}/100 适合当前画面强度`);

      if (profile.wantsSoft && track.vocal === "instrumental") {
        score += 8;
        reasons.push("纯器乐，不容易抢旁白");
      }
      if (profile.wantsSoft && track.energy > 72) score -= 18;
      if (profile.wantsBeat && track.bpm >= 118) score += 9;
      if (profile.wantsSad && track.moods.includes("sad")) score += 10;
      if (profile.wantsEnergy && track.energy >= 70) score += 9;
      score += Math.min(track.heat, 95) * 0.12;

      return {
        ...track,
        score: clamp(Math.round(score), 0, 99),
        reasons: reasons.length ? reasons : ["与当前项目存在基础情绪和节奏匹配"],
        _source: "local"
      };
    });
  }

  /**
   * 对远程搜索结果评分
   * 来自真实音乐平台的曲目获得"真实度"加成，确保排到本地 mock 曲目前面
   */
  function scoreRemoteTracks(tracks, profile) {
    if (!tracks || !tracks.length) return [];
    return tracks.map((track) => {
      // 真实音乐平台基础分 + 真实度加成
      let score = 28;
      const reasons = [];
      const sceneHits = (profile.scenes || []).filter((scene) =>
        (track.scenes || []).includes(scene)
      );
      const moodHits = (profile.moods || []).filter((mood) =>
        (track.moods || []).includes(mood)
      );
      score += sceneHits.length * 11;
      score += moodHits.length * 10;
      if (sceneHits.length) reasons.push(`场景命中：${sceneHits.map((k) => global.AppProfile.nameOf(k)).join("、")}`);
      if (moodHits.length) reasons.push(`情绪命中：${moodHits.map((k) => global.AppProfile.nameOf(k)).join("、")}`);

      const bpmScore = rangeScore(track.bpm || 100, profile.bpmTarget || [80, 130]);
      const energyScore = rangeScore(track.energy || 50, profile.energyTarget || [30, 70]);
      score += bpmScore * 12;
      score += energyScore * 14;
      if (bpmScore > 0.72) reasons.push(`BPM ${track.bpm} 落在建议节奏区间`);
      if (energyScore > 0.72) reasons.push(`能量 ${track.energy}/100 适合当前画面强度`);

      if (profile.wantsSoft && track.vocal === "instrumental") {
        score += 7;
        reasons.push("纯器乐，不容易抢旁白");
      }
      score += Math.min(track.heat || 50, 95) * 0.1;

      // 真实音乐平台加成
      const platformBonus = {
        netease: 15,
        itunes: 14,
        qqmusic: 14,
        spotify: 16,
        youtube: 13
      };
      const source = track.platform || (track._raw && track._raw.source) || "unknown";
      score += platformBonus[source] || 12;
      reasons.push(`${track.platforms[0] || "音乐平台"} 真实搜索结果`);

      return {
        ...track,
        score: clamp(Math.round(score), 0, 99),
        reasons: reasons,
        _source: "remote"
      };
    });
  }

  /**
   * 调用后端多平台搜索 API
   * @param {string} keyword - 搜索关键词
   * @returns {Promise<Array>} 统一格式的曲目列表
   */
  async function fetchRemoteTracks(keyword) {
    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 15000);

      const res = await fetch(`${API_BASE}/api/search`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ keyword, limit: 8 }),
        signal: controller.signal
      });
      clearTimeout(timeout);

      if (!res.ok) {
        console.warn("[finder] 后端返回错误:", res.status);
        return [];
      }
      const data = await res.json();
      return data.tracks || [];
    } catch (err) {
      if (err.name === "AbortError") {
        console.warn("[finder] 后端搜索超时，使用本地曲库");
      } else {
        console.warn("[finder] 后端搜索失败，使用本地曲库:", err.message);
      }
      return [];
    }
  }

  /**
   * 搜索候选曲目（本地 + 远程合并）
   * @param {object} profile - 用户需求画像
   * @param {string} confirmedSummary - 确认后的需求描述，用于远程搜索关键词
   * @returns {Promise<Array>} 排序后的 Top 5
   */
  async function searchCandidates(profile, confirmedSummary) {
    // 本地评分
    const localResults = scoreLocalTracks(profile);

    // 远程搜索（异步，不阻塞本地结果）
    let remoteResults = [];
    if (confirmedSummary) {
      try {
        const keyword = extractSearchKeyword(confirmedSummary);
        const rawRemote = await fetchRemoteTracks(keyword);
        if (rawRemote.length > 0) {
          remoteResults = scoreRemoteTracks(rawRemote, profile);
        }
      } catch (err) {
        console.warn("[finder] 远程搜索异常:", err.message);
      }
    }

    // 合并：本地 + 远程，去重后按分数排序
    const all = [...localResults, ...remoteResults];
    const seen = new Set();
    const deduplicated = all.filter((t) => {
      const key = `${t.title}||${t.artist}`.toLowerCase().trim();
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });

    return deduplicated.sort((a, b) => b.score - a.score).slice(0, 5);
  }

  /**
   * 从需求描述中提取搜索关键词
   */
  function extractSearchKeyword(summary) {
    const genreKeywords = [];
    const sceneKeywords = [];
    const moodCnKeywords = [];

    const genreMap = {
      "lofi": "lofi", "ambient": "ambient", "piano": "piano",
      "jazz": "jazz", "hip-hop": "hip hop", "hip hop": "hip hop",
      "electronic": "electronic", "pop": "pop", "rock": "rock",
      "classical": "classical", "acoustic": "acoustic", "indie": "indie",
      "folk": "folk", "bossa": "bossa", "house": "house", "trap": "trap",
      "民谣": "民谣", "摇滚": "摇滚", "电子": "电子", "古典": "古典",
      "钢琴": "钢琴", "爵士": "爵士", "古风": "古风", "纯音乐": "纯音乐",
      "instrumental": "instrumental", "minimal": "minimal"
    };

    const sceneMap = {
      "城市": "城市", "夜景": "夜景", "旅行": "旅行", "海边": "海边",
      "街头": "街头", "校园": "校园", "咖啡": "咖啡", "雨天": "雨天",
      "city": "city", "night": "night", "travel": "travel", "coffee": "coffee",
      "daily": "", "日常": ""
    };

    const moodMap = {
      "孤独": "孤独", "悲伤": "伤感", "温暖": "治愈", "治愈": "治愈",
      "安静": "轻音乐", "放松": "chill", "欢快": "轻快", "卡点": "节奏",
      "高级": "", "平静": "calm", "chill": "chill", "sad": "sad",
      "happy": "happy", "calm": "calm", "energetic": "energetic",
      "lonely": "lonely", "燃": "高能"
    };

    const lower = summary.toLowerCase();

    Object.entries(genreMap).forEach(([key, val]) => {
      if (val && lower.includes(key) && !genreKeywords.includes(val)) {
        genreKeywords.push(val);
      }
    });

    Object.entries(sceneMap).forEach(([key, val]) => {
      if (val && summary.includes(key) && !sceneKeywords.includes(val)) {
        sceneKeywords.push(val);
      }
    });

    Object.entries(moodMap).forEach(([key, val]) => {
      if (val && summary.includes(key) && !moodCnKeywords.includes(val)) {
        moodCnKeywords.push(val);
      }
    });

    const parts = [];
    if (genreKeywords.length) parts.push(genreKeywords[0]);
    if (sceneKeywords.length) parts.push(sceneKeywords[0]);
    if (moodCnKeywords.length && parts.length < 2) parts.push(moodCnKeywords[0]);

    if (parts.length >= 1) {
      return parts.slice(0, 3).join(" ");
    }

    const lines = summary.split("\n");
    const firstLine = lines[0].replace("视频内容：", "").trim();
    const cleanedFirst = firstLine
      .replace(/vlog|Vlog|VLOG/g, "")
      .replace(/，|。|！|？|,|\.|!|\?|、|一个人|想要|感觉|但|不|太|的/g, " ")
      .replace(/\s+/g, " ").trim();
    if (cleanedFirst && cleanedFirst.length >= 2 && cleanedFirst.length <= 12) {
      return cleanedFirst;
    }

    return "lofi";
  }

  /**
   * 同步搜索本地曲库（不调远程 API）
   */
  function searchLocalOnly(profile) {
    return scoreLocalTracks(profile).sort((a, b) => b.score - a.score).slice(0, 5);
  }

  global.AppFinder = {
    searchCandidates,
    searchLocalOnly,
    fetchRemoteTracks,
    rangeScore,
    clamp
  };
})(window);