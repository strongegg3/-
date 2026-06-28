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
      let score = 10;
      const reasons = [];
      const sceneHits = profile.scenes.filter((scene) => track.scenes.includes(scene));
      const moodHits = profile.moods.filter((mood) => track.moods.includes(mood));
      score += sceneHits.length * 10;
      score += moodHits.length * 9;
      if (sceneHits.length) reasons.push(`场景命中：${sceneHits.map((k) => global.AppProfile.nameOf(k)).join("、")}`);
      if (moodHits.length) reasons.push(`情绪命中：${moodHits.map((k) => global.AppProfile.nameOf(k)).join("、")}`);

      const bpmScore = rangeScore(track.bpm, profile.bpmTarget);
      const energyScore = rangeScore(track.energy, profile.energyTarget);
      score += bpmScore * 10;
      score += energyScore * 12;
      if (bpmScore > 0.72) reasons.push(`BPM ${track.bpm} 落在建议节奏区间`);
      if (energyScore > 0.72) reasons.push(`能量 ${track.energy}/100 适合当前画面强度`);

      if (profile.wantsSoft && track.vocal === "instrumental") {
        score += 6;
        reasons.push("纯器乐，不容易抢旁白");
      }
      if (profile.wantsSoft && track.energy > 72) score -= 18;
      if (profile.wantsBeat && track.bpm >= 118) score += 7;
      if (profile.wantsSad && track.moods.includes("sad")) score += 8;
      if (profile.wantsEnergy && track.energy >= 70) score += 7;
      score += Math.min(track.heat, 95) * 0.08;

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
  function scoreRemoteTracks(tracks, profile, keyword) {
    if (!tracks || !tracks.length) return [];
    const keywordParts = (keyword || "").toLowerCase().split(/\s+/).filter(Boolean);
    return tracks.map((track) => {
      let score = 40;
      const reasons = [];
      const sceneHits = (profile.scenes || []).filter((scene) =>
        (track.scenes || []).includes(scene)
      );
      const moodHits = (profile.moods || []).filter((mood) =>
        (track.moods || []).includes(mood)
      );
      score += sceneHits.length * 12;
      score += moodHits.length * 11;
      if (sceneHits.length) reasons.push(`场景命中：${sceneHits.map((k) => global.AppProfile.nameOf(k)).join("、")}`);
      if (moodHits.length) reasons.push(`情绪命中：${moodHits.map((k) => global.AppProfile.nameOf(k)).join("、")}`);

      const bpmScore = rangeScore(track.bpm || 100, profile.bpmTarget || [80, 130]);
      const energyScore = rangeScore(track.energy || 50, profile.energyTarget || [30, 70]);
      score += bpmScore * 13;
      score += energyScore * 15;
      if (bpmScore > 0.72) reasons.push(`BPM ${track.bpm} 落在建议节奏区间`);
      if (energyScore > 0.72) reasons.push(`能量 ${track.energy}/100 适合当前画面强度`);

      if (profile.wantsSoft && track.vocal === "instrumental") {
        score += 8;
        reasons.push("纯器乐，不容易抢旁白");
      }
      score += Math.min(track.heat || 70, 95) * 0.12;

      const platformBonus = {
        netease: 24,
        itunes: 26,
        qqmusic: 24,
        spotify: 26,
        youtube: 22
      };
      const source = track.platform || (track._raw && track._raw.source) || "unknown";
      score += platformBonus[source] || 20;
      reasons.push(`${(track.platforms && track.platforms[0]) || "音乐平台"} 真实搜索结果`);

      if (track._previewUrl || track.previewUrl) {
        score += 12;
        reasons.push("支持在线试听");
      }

      const titleLower = (track.title || "").toLowerCase();
      const artistLower = (track.artist || "").toLowerCase();
      const albumLower = ((track._raw && track._raw.album) || track.album || "").toLowerCase();
      const searchableText = titleLower + " " + artistLower + " " + albumLower;
      let keywordHits = 0;
      keywordParts.forEach((kw) => {
        if (kw && kw.length >= 1 && searchableText.includes(kw)) {
          keywordHits++;
        }
      });
      if (keywordHits > 0) {
        score += keywordHits * 8;
        reasons.push(`标题与搜索词相关`);
      }

      if (titleLower.length <= 12 && !/^track\s*\d+|^\d+\.\s|untitled|demo|伴奏$/.test(titleLower)) {
        score += 3;
      }

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
        body: JSON.stringify({ keyword, limit: 15 }),
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
    const localResults = scoreLocalTracks(profile);

    let remoteResults = [];
    let searchKeyword = "";
    if (confirmedSummary) {
      try {
        searchKeyword = extractSearchKeyword(confirmedSummary);
        const rawRemote = await fetchRemoteTracks(searchKeyword);
        if (rawRemote.length > 0) {
          remoteResults = scoreRemoteTracks(rawRemote, profile, searchKeyword);
        }
      } catch (err) {
        console.warn("[finder] 远程搜索异常:", err.message);
      }
    }

    const all = [...localResults, ...remoteResults];
    const seen = new Set();
    const deduplicated = all.filter((t) => {
      const key = `${t.title}||${t.artist}`.toLowerCase().trim();
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });

    deduplicated.sort((a, b) => b.score - a.score);

    if (remoteResults.length > 0) {
      const remoteTracks = deduplicated.filter((t) => t._source === "remote");
      const localTracks = deduplicated.filter((t) => t._source === "local");

      const platformOrder = ["itunes", "netease", "qqmusic", "spotify", "youtube"];
      const platformBuckets = {};
      remoteTracks.forEach((t) => {
        const p = t.platform || "unknown";
        if (!platformBuckets[p]) platformBuckets[p] = [];
        platformBuckets[p].push(t);
      });

      const topPicks = [];
      const usedKeys = new Set();
      const pickNext = (track) => {
        const k = `${track.title}||${track.artist}`.toLowerCase().trim();
        if (!usedKeys.has(k)) {
          usedKeys.add(k);
          topPicks.push(track);
        }
      };

      for (const platform of platformOrder) {
        const bucket = platformBuckets[platform];
        if (bucket && bucket.length > 0 && topPicks.length < 3) {
          pickNext(bucket[0]);
        }
      }

      const remainingRemote = remoteTracks.filter((t) => {
        const k = `${t.title}||${t.artist}`.toLowerCase().trim();
        return !usedKeys.has(k);
      });

      const remaining = [...remainingRemote, ...localTracks].sort((a, b) => b.score - a.score);
      return [...topPicks, ...remaining].slice(0, 5);
    }

    return deduplicated.slice(0, 5);
  }

  /**
   * 从需求描述中提取搜索关键词
   */
  function extractSearchKeyword(summary) {
    const genreKeywords = [];
    const sceneKeywords = [];
    const moodCnKeywords = [];
    const contentKeywords = [];

    const videoContentMatch = summary.match(/视频内容[：:]\s*([^\n]+)/);
    if (videoContentMatch) {
      const contentLine = videoContentMatch[1];
      const sceneMatches = contentLine.match(/城市夜景|城市|夜景|街头|街区|便利店|地铁|旅行|海边|校园|咖啡|雨天|日落|黄昏|日出|街头|公路/);
      if (sceneMatches) {
        contentKeywords.push(sceneMatches[0]);
      }
      const moodContentMatches = contentLine.match(/孤独|治愈|温暖|悲伤|安静|放松|欢快|平静|chill|sad|lonely|calm/);
      if (moodContentMatches) {
        contentKeywords.push(moodContentMatches[0]);
      }
    }

    const sceneLineMatch = summary.match(/画面场景[：:]\s*([^\n]+)/);
    if (sceneLineMatch && !contentKeywords.length) {
      const sceneLine = sceneLineMatch[1];
      const sm = sceneLine.match(/城市|旅行|美食|校园|健身|运动/);
      if (sm) contentKeywords.push(sm[0]);
    }

    const genreMap = {
      "lofi": "lofi", "ambient": "ambient", "piano": "piano",
      "jazz": "jazz", "hip-hop": "hip hop", "hip hop": "hip hop",
      "electronic": "electronic", "pop": "pop", "rock": "rock",
      "classical": "classical", "acoustic": "acoustic", "indie": "indie",
      "folk": "folk", "bossa": "bossa", "house": "house", "trap": "trap",
      "民谣": "民谣", "摇滚": "摇滚", "电子": "电子", "古典": "古典",
      "钢琴": "钢琴", "爵士": "爵士", "古风": "古风", "纯音乐": "纯音乐",
      "instrumental": "instrumental", "minimal": "minimal",
      "轻音乐": "轻音乐"
    };

    const sceneMap = {
      "城市夜景": "城市夜景", "城市": "城市", "夜景": "夜景", "旅行": "旅行", "海边": "海边",
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

    Object.entries(genreMap).forEach(([key, val]) => {
      if (val && lower.includes(key) && !genreKeywords.includes(val)) {
        genreKeywords.push(val);
      }
    });

    const parts = [];
    if (contentKeywords.length) {
      parts.push(contentKeywords[0]);
    }
    if (sceneKeywords.length && !parts.includes(sceneKeywords[0])) {
      parts.push(sceneKeywords[0]);
    }
    if (moodCnKeywords.length && parts.length < 3) {
      parts.push(moodCnKeywords[0]);
    }
    if (genreKeywords.length && parts.length < 3) {
      const g = genreKeywords[0];
      if (!parts.includes(g)) parts.push(g);
    }

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

    return "轻音乐";
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