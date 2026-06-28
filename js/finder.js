(function (global) {
  const { catalog } = global.AppData;

  const API_BASE = "";

  const FINDER_CONFIG = {
    intro: {
      name: "开场Agent",
      icon: "🎬",
      scorePrefs: { lowEnergy: true, lowBpm: true, instrumentalBonus: 8, introKeywordBonus: 15 },
      searchHints: ["intro", "氛围", "环境音", "开场", "ambient", "钢琴开头"]
    },
    bgm: {
      name: "BGM Agent",
      icon: "🎵",
      scorePrefs: { lowEnergy: true, midBpm: true, instrumentalBonus: 10, vocalPenalty: -6 },
      searchHints: ["bgm", "背景音乐", "纯音乐", "轻音乐", "lofi", "不抢人声"]
    },
    transition: {
      name: "转场Agent",
      icon: "⚡",
      scorePrefs: { beatBonus: 12, midHighBpm: true, buildUpBonus: 8 },
      searchHints: ["间奏", "节奏", "beat", "卡点", "鼓点", "instrumental"]
    },
    climax: {
      name: "高潮Agent",
      icon: "🔥",
      scorePrefs: { highEnergy: true, highBpm: true, energyBonus: 10, chorusBonus: 8 },
      searchHints: ["副歌", "高能", "燃", "epic", "高潮", "爆发"]
    },
    ending: {
      name: "结尾Agent",
      icon: "🌙",
      scorePrefs: { lowEnergy: true, fadeBonus: 8, pianoBonus: 6 },
      searchHints: ["outro", "结尾", "钢琴", "渐弱", "收尾", "余韵"]
    },
    general: {
      name: "通用Agent",
      icon: "🎶",
      scorePrefs: {},
      searchHints: ["vlog", "配乐", "背景音乐"]
    }
  };

  function clamp(value, min, max) {
    return Math.max(min, Math.min(max, value));
  }

  function rangeScore(value, range) {
    const [min, max] = range;
    if (value >= min && value <= max) return 1;
    const distance = value < min ? min - value : value - max;
    return clamp(1 - distance / 45, 0, 1);
  }

  function scoreLocalTracks(profile) {
    return catalog.map((track) => {
      let score = 10;
      const reasons = [];
      const fitUses = tagTrackUses(track, profile);
      const sceneHits = profile.scenes.filter((scene) => track.scenes.includes(scene));
      const moodHits = profile.moods.filter((mood) => track.moods.includes(mood));
      score += sceneHits.length * 10;
      score += moodHits.length * 9;
      if (sceneHits.length) reasons.push(`场景命中：${sceneHits.map((k) => global.AppProfile.nameOf(k)).join("、")}`);
      if (moodHits.length) reasons.push(`情绪命中：${moodHits.map((k) => global.AppProfile.nameOf(k)).join("、")}`);

      const uses = profile.uses || ["general"];
      uses.forEach((use) => {
        if (fitUses.includes(use)) {
          score += 12;
          reasons.push(`${FINDER_CONFIG[use].icon} 适合做${global.AppProfile.useLabel(use)}`);
        }
      });

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
        _source: "local",
        _fitUses: fitUses,
        _useTags: buildUseTags(fitUses)
      };
    });
  }

  function tagTrackUses(track, profile) {
    const uses = [];
    const bpm = track.bpm || 100;
    const energy = track.energy || 50;
    const title = (track.title || "").toLowerCase();
    const structure = (track.structure || "").toLowerCase();
    const artist = (track.artist || "").toLowerCase();
    const genres = (track.genres || []).map(g => g.toLowerCase());
    const moods = (track.moods || []).map(m => m.toLowerCase());
    const vocal = (track.vocal || "").toLowerCase();

    if ((energy <= 40 && bpm <= 95) || /intro|开头|0:00.*氛围|0:00.*铺底|0:00.*钢琴|ambient/.test(title + " " + structure)) {
      uses.push("intro");
    }
    if ((energy <= 55 && bpm <= 115 && (vocal === "instrumental" || vocal === "light-vocal")) ||
        genres.includes("lofi") || /bgm|背景音乐|不抢|铺底/.test(title + structure)) {
      uses.push("bgm");
    }
    if ((bpm >= 115 && energy >= 55) || /beat|鼓点|节奏|卡点|间奏|切分|drop/.test(title + " " + structure) ||
        (vocal === "vocal-chop" && bpm >= 120)) {
      uses.push("transition");
    }
    if ((energy >= 60 && bpm >= 105) || /副歌|高潮|爆发|drop|燃|epic/.test(title + " " + structure) ||
        moods.includes("energetic") || genres.includes("trap") || genres.includes("sport")) {
      uses.push("climax");
    }
    if ((energy <= 45 && /outro|结尾|渐弱|收尾|余韵|落幕/.test(title + " " + structure)) ||
        (energy <= 35 && bpm <= 85 && (genres.includes("piano") || genres.includes("cinematic")))) {
      uses.push("ending");
    }
    if (uses.length === 0) uses.push("general");
    return uses;
  }

  function buildUseTags(fitUses) {
    return fitUses.map(u => ({
      key: u,
      label: global.AppProfile.useLabel(u),
      icon: (FINDER_CONFIG[u] || {}).icon || "🎶"
    }));
  }

  function scoreRemoteTracks(tracks, profile, keyword) {
    if (!tracks || !tracks.length) return [];
    const keywordParts = (keyword || "").toLowerCase().split(/\s+/).filter(Boolean);
    const uses = profile.uses || ["general"];

    return tracks.map((track) => {
      let score = 40;
      const reasons = [];
      const fitUses = tagRemoteTrackUses(track, profile);

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

      uses.forEach((use) => {
        if (fitUses.includes(use)) {
          score += 10;
          reasons.push(`${FINDER_CONFIG[use].icon} 适合做${global.AppProfile.useLabel(use)}`);
        }
      });

      const bpm = track.bpm || 100;
      const energy = track.energy || 50;
      const bpmScore = rangeScore(bpm, profile.bpmTarget || [80, 130]);
      const energyScore = rangeScore(energy, profile.energyTarget || [30, 70]);
      score += bpmScore * 13;
      score += energyScore * 15;
      if (bpmScore > 0.72) reasons.push(`BPM ${bpm} 落在建议节奏区间`);
      if (energyScore > 0.72) reasons.push(`能量 ${energy}/100 适合当前画面强度`);

      if (profile.wantsSoft && (track.vocal === "instrumental" || /纯音乐|instrumental/.test((track.title || "") + (track.artist || "")))) {
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

      if (track._fromPlaylist && track._playlistName) {
        score += 10;
        reasons.push(`来自精品歌单《${track._playlistName}》`);
      }
      if (track._fromLiked) {
        score += 12;
        reasons.push(`❤️ 来自你喜欢的音乐`);
      }
      if (track._fromUserPlaylist && track._playlistName) {
        score += 8;
        reasons.push(`来自你的歌单《${track._playlistName}》`);
      }

      if (track._previewUrl || track.previewUrl) {
        score += 12;
        reasons.push("支持在线试听");
      }

      const titleLower = (track.title || "").toLowerCase();
      const artistLower = (track.artist || "").toLowerCase();
      const albumLower = (track.album || "").toLowerCase();
      const searchableText = titleLower + " " + artistLower + " " + albumLower;
      let keywordHits = 0;
      keywordParts.forEach((kw) => {
        if (kw && kw.length >= 1 && searchableText.includes(kw)) keywordHits++;
      });
      if (keywordHits > 0) {
        score += keywordHits * 6;
        reasons.push("标题与搜索词相关");
      }

      uses.forEach((use) => {
        const hints = (FINDER_CONFIG[use] || {}).searchHints || [];
        hints.forEach((h) => {
          if (searchableText.includes(h.toLowerCase())) {
            score += 3;
          }
        });
      });

      if (titleLower.length <= 12 && !/^track\s*\d+|^\d+\.\s|untitled|demo|伴奏$/.test(titleLower)) {
        score += 3;
      }

      return {
        ...track,
        score: clamp(Math.round(score), 0, 99),
        reasons,
        _source: "remote",
        _fitUses: fitUses,
        _useTags: buildUseTags(fitUses)
      };
    });
  }

  function tagRemoteTrackUses(track, profile) {
    const uses = [];
    const title = (track.title || "").toLowerCase();
    const artist = (track.artist || "").toLowerCase();
    const album = (track.album || "").toLowerCase();
    const text = `${title} ${artist} ${album}`;
    const bpm = track.bpm || 0;
    const energy = track.energy || 50;
    const heat = track.heat || 50;
    const vocal = (track.vocal || "").toLowerCase();

    if (/intro|ambient|环境音|氛围|开场|开头|序曲|序\b/.test(text) ||
        (bpm > 0 && bpm <= 90 && energy <= 40) ||
        (title.startsWith("01") || /^01\s/.test(title)) && energy <= 45) {
      uses.push("intro");
    }
    if (/bgm|background|纯音乐|轻音乐|lofi|instrumental|不抢|旁白|配乐/.test(text) ||
        (vocal === "instrumental" && energy <= 55) ||
        (bpm > 0 && bpm <= 115 && energy <= 55)) {
      uses.push("bgm");
    }
    if (/beat|drum|间奏|节奏|卡点|转场|transition|build[\s-]?up|drop/.test(text) ||
        (bpm >= 118 && bpm <= 145 && energy >= 50) ||
        vocal === "vocal-chop") {
      uses.push("transition");
    }
    if (/副歌|高潮|chorus|epic|燃|高能|爆发|climax|主题曲|theme/.test(text) ||
        (energy >= 65 && bpm >= 108) ||
        heat >= 85) {
      uses.push("climax");
    }
    if (/outro|结尾|尾曲|尾声|渐弱|收尾|余韵|落幕|fade/.test(text) ||
        (bpm > 0 && bpm <= 85 && energy <= 40)) {
      uses.push("ending");
    }

    if (uses.length === 0) {
      if (energy <= 50 && bpm <= 110) uses.push("bgm");
      else if (energy >= 60 && bpm >= 110) uses.push("climax");
      else uses.push("general");
    }
    return uses;
  }

  async function fetchFindAPI(profile) {
    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 30000);

      const res = await fetch(`${API_BASE}/api/search/find`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ profile }),
        signal: controller.signal
      });
      clearTimeout(timeout);

      if (!res.ok) {
        console.warn("[finder] /find 接口错误:", res.status);
        return null;
      }
      return await res.json();
    } catch (err) {
      console.warn("[finder] /find 接口失败:", err.message);
      return null;
    }
  }

  async function searchCandidates(profile, confirmedSummary) {
    const localResults = scoreLocalTracks(profile);
    const findData = await fetchFindAPI(profile);

    if (!findData) {
      const sorted = localResults.sort((a, b) => b.score - a.score);
      return { tracks: sorted.slice(0, 8), playlists: [], channels: { playlists: [], user: { loggedIn: false }, singles: [] } };
    }

    const playlistTracks = (findData.channels.playlists.tracks || []);
    const userTracks = (findData.channels.user.tracks || []);
    const singleTracks = (findData.channels.singles.tracks || []);
    const playlistObjs = findData.channels.playlists.playlists || [];

    const keyword = findData.keyword || "";
    const scoredPlaylists = scoreRemoteTracks(playlistTracks, profile, keyword);
    const scoredUser = scoreRemoteTracks(userTracks, profile, keyword);
    const scoredSingles = scoreRemoteTracks(singleTracks, profile, keyword);

    const remoteResults = [...scoredSingles, ...scoredPlaylists, ...scoredUser];

    const all = [...localResults, ...remoteResults];
    const seen = new Set();
    const deduplicated = all.filter((t) => {
      const key = `${t.title}||${t.artist}`.toLowerCase().trim();
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });

    deduplicated.sort((a, b) => b.score - a.score);

    const uses = profile.uses || ["general"];
    const primaryUse = uses[0] || "general";

    const matchingUseTracks = deduplicated.filter((t) =>
      (t._fitUses || []).includes(primaryUse) || uses.some(u => (t._fitUses || []).includes(u))
    );
    const otherTracks = deduplicated.filter((t) =>
      !matchingUseTracks.includes(t)
    );

    let finalTracks;
    if (matchingUseTracks.length > 0) {
      const topMatches = matchingUseTracks.slice(0, 6);
      const fillers = otherTracks.slice(0, Math.max(0, 8 - topMatches.length));
      finalTracks = [...topMatches, ...fillers].slice(0, 8);
    } else {
      finalTracks = deduplicated.slice(0, 8);
    }

    return {
      tracks: finalTracks,
      playlists: playlistObjs,
      channels: findData.channels,
      keyword: findData.keyword,
      uses: findData.uses
    };
  }

  function extractSearchKeyword(summary) {
    const { buildProfile } = global.AppProfile;
    const profile = buildProfile(summary);
    const sceneKw = (profile.scenes || []).slice(0, 1).map(k => global.AppProfile.nameOf(k)).join(" ");
    const moodKw = (profile.moods || []).slice(0, 1).map(k => global.AppProfile.nameOf(k)).join(" ");
    const parts = [sceneKw, moodKw].filter(Boolean);
    return parts.join(" ") || "轻音乐";
  }

  function searchLocalOnly(profile) {
    return { tracks: scoreLocalTracks(profile).sort((a, b) => b.score - a.score).slice(0, 5), playlists: [], channels: null };
  }

  function getFinderConfig() {
    return FINDER_CONFIG;
  }

  global.AppFinder = {
    searchCandidates,
    searchLocalOnly,
    rangeScore,
    clamp,
    tagTrackUses,
    tagRemoteTrackUses,
    buildUseTags,
    getFinderConfig,
    FINDER_CONFIG
  };
})(window);
