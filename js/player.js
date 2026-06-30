(function (global) {
  let currentTrack = null;
  let isPlaying = false;
  let playerIframe = null;
  let listeners = [];
  let playQueue = [];
  let queueIndex = -1;
  let playMode = "sequence";

  const PLAY_MODES = {
    sequence: { icon: "🔁", label: "顺序播放" },
    shuffle: { icon: "🔀", label: "随机播放" },
    repeat: { icon: "🔂", label: "单曲循环" }
  };

  function formatDuration(seconds) {
    if (!seconds || seconds <= 0) return "--:--";
    const m = Math.floor(seconds / 60);
    const s = Math.floor(seconds % 60);
    return `${m}:${s.toString().padStart(2, "0")}`;
  }

  function initPlayer() {
    if (playerIframe) return;
    playerIframe = document.createElement("iframe");
    playerIframe.id = "ncm-player";
    playerIframe.style.display = "none";
    playerIframe.setAttribute("frameborder", "no");
    playerIframe.setAttribute("border", "0");
    playerIframe.setAttribute("marginwidth", "0");
    playerIframe.setAttribute("marginheight", "0");
    playerIframe.setAttribute("width", "0");
    playerIframe.setAttribute("height", "0");
    document.body.appendChild(playerIframe);
  }

  function canPlayTrack(track) {
    if (!track) return false;
    const isNetease = (track.platforms && track.platforms.includes("网易云音乐")) ||
                      track.source === "netease" || track.source === "netease-user" ||
                      (track._source === "remote" && track.id);
    return isNetease && track.id;
  }

  function playTrack(track, queue) {
    initPlayer();
    if (!canPlayTrack(track)) return false;

    if (queue && Array.isArray(queue)) {
      setQueue(queue, track);
    }

    const songId = track.id;
    currentTrack = track;
    isPlaying = true;
    playerIframe.src = `https://music.163.com/outchain/player?type=2&id=${songId}&auto=1&height=66`;
    notifyListeners();
    addToHistory(track);
    return true;
  }

  function stop() {
    if (playerIframe) {
      playerIframe.src = "about:blank";
    }
    isPlaying = false;
    notifyListeners();
  }

  function togglePlay(track, queue) {
    if (currentTrack && String(currentTrack.id) === String(track.id) && isPlaying) {
      stop();
      return false;
    } else {
      return playTrack(track, queue);
    }
  }

  function setQueue(tracks, startTrack) {
    const playableTracks = tracks.filter(t => canPlayTrack(t));
    playQueue = playableTracks;
    if (startTrack) {
      queueIndex = playableTracks.findIndex(t => String(t.id) === String(startTrack.id));
    } else {
      queueIndex = 0;
    }
  }

  function playNext() {
    if (playQueue.length === 0) return false;
    let nextIdx;
    if (playMode === "shuffle") {
      nextIdx = Math.floor(Math.random() * playQueue.length);
    } else if (playMode === "repeat") {
      nextIdx = queueIndex;
    } else {
      nextIdx = queueIndex + 1;
      if (nextIdx >= playQueue.length) nextIdx = 0;
    }
    queueIndex = nextIdx;
    const nextTrack = playQueue[nextIdx];
    if (nextTrack) {
      currentTrack = nextTrack;
      isPlaying = true;
      playerIframe.src = `https://music.163.com/outchain/player?type=2&id=${nextTrack.id}&auto=1&height=66`;
      notifyListeners();
      addToHistory(nextTrack);
      return true;
    }
    return false;
  }

  function playPrev() {
    if (playQueue.length === 0) return false;
    let prevIdx;
    if (playMode === "shuffle") {
      prevIdx = Math.floor(Math.random() * playQueue.length);
    } else if (playMode === "repeat") {
      prevIdx = queueIndex;
    } else {
      prevIdx = queueIndex - 1;
      if (prevIdx < 0) prevIdx = playQueue.length - 1;
    }
    queueIndex = prevIdx;
    const prevTrack = playQueue[prevIdx];
    if (prevTrack) {
      currentTrack = prevTrack;
      isPlaying = true;
      playerIframe.src = `https://music.163.com/outchain/player?type=2&id=${prevTrack.id}&auto=1&height=66`;
      notifyListeners();
      addToHistory(prevTrack);
      return true;
    }
    return false;
  }

  function togglePlayMode() {
    const modes = ["sequence", "shuffle", "repeat"];
    const currentIdx = modes.indexOf(playMode);
    playMode = modes[(currentIdx + 1) % modes.length];
    notifyListeners();
    return playMode;
  }

  function getPlayMode() {
    return playMode;
  }

  function getPlayModeInfo() {
    return PLAY_MODES[playMode];
  }

  function getCurrentTrack() {
    return currentTrack;
  }

  function getIsPlaying() {
    return isPlaying;
  }

  function getQueueInfo() {
    return {
      queue: playQueue,
      index: queueIndex,
      hasNext: playQueue.length > 0,
      hasPrev: playQueue.length > 0,
      total: playQueue.length,
      current: queueIndex >= 0 ? queueIndex + 1 : 0
    };
  }

  function subscribe(listener) {
    listeners.push(listener);
    return () => {
      listeners = listeners.filter(l => l !== listener);
    };
  }

  function notifyListeners() {
    listeners.forEach(l => l(currentTrack, isPlaying, getQueueInfo()));
  }

  const FAVORITES_KEY = "yuezhidi_favorites";
  const HISTORY_KEY = "yuezhidi_history";
  const SELECTION_KEY = "yuezhidi_selection";

  function safeParse(value, fallback) {
    try {
      return value ? JSON.parse(value) : fallback;
    } catch (e) {
      return fallback;
    }
  }

  function getFavorites() {
    return safeParse(localStorage.getItem(FAVORITES_KEY), []);
  }

  function isFavorite(trackId) {
    const favs = getFavorites();
    return favs.some(f => String(f.id) === String(trackId));
  }

  function toggleFavorite(track) {
    let favs = getFavorites();
    const idx = favs.findIndex(f => String(f.id) === String(track.id));
    if (idx >= 0) {
      favs.splice(idx, 1);
    } else {
      favs.unshift({
        id: String(track.id),
        title: track.title,
        artist: track.artist,
        album: track.album || "",
        duration: track.duration || track._duration || 0,
        cover: track._albumCover || track.albumCover || track.thumbnail || track.cover || "",
        url: track._url || track.url || "",
        source: track.source || track._source || "",
        platforms: track.platforms || ["网易云音乐"],
        score: track.score || 0,
        reasons: track.reasons || [],
        useTags: track._useTags || [],
        addedAt: Date.now()
      });
      if (favs.length > 200) favs = favs.slice(0, 200);
    }
    localStorage.setItem(FAVORITES_KEY, JSON.stringify(favs));
    notifyListeners();
    return idx < 0;
  }

  function clearFavorites() {
    localStorage.removeItem(FAVORITES_KEY);
    notifyListeners();
  }

  function getHistory() {
    return safeParse(localStorage.getItem(HISTORY_KEY), []);
  }

  function addToHistory(track) {
    let hist = getHistory();
    const idx = hist.findIndex(h => String(h.id) === String(track.id));
    if (idx >= 0) hist.splice(idx, 1);
    hist.unshift({
      id: String(track.id),
      title: track.title,
      artist: track.artist,
      album: track.album || "",
      duration: track.duration || track._duration || 0,
      cover: track._albumCover || track.albumCover || track.thumbnail || track.cover || "",
      url: track._url || track.url || "",
      source: track.source || track._source || "",
      platforms: track.platforms || ["网易云音乐"],
      playedAt: Date.now()
    });
    if (hist.length > 100) hist = hist.slice(0, 100);
    localStorage.setItem(HISTORY_KEY, JSON.stringify(hist));
  }

  function clearHistory() {
    localStorage.removeItem(HISTORY_KEY);
    notifyListeners();
  }

  function getSelection() {
    return safeParse(localStorage.getItem(SELECTION_KEY), []);
  }

  function isInSelection(trackId) {
    const sel = getSelection();
    return sel.some(s => String(s.id) === String(trackId));
  }

  function toggleSelection(track) {
    let sel = getSelection();
    const idx = sel.findIndex(s => String(s.id) === String(track.id));
    if (idx >= 0) {
      sel.splice(idx, 1);
    } else {
      sel.push({
        id: String(track.id),
        title: track.title,
        artist: track.artist,
        album: track.album || "",
        duration: track.duration || track._duration || 0,
        cover: track._albumCover || track.albumCover || track.thumbnail || track.cover || "",
        url: track._url || track.url || "",
        source: track.source || track._source || "",
        platforms: track.platforms || ["网易云音乐"],
        score: track.score || 0,
        reasons: track.reasons || [],
        useTags: track._useTags || [],
        selectedAt: Date.now()
      });
    }
    localStorage.setItem(SELECTION_KEY, JSON.stringify(sel));
    notifyListeners();
    return idx < 0;
  }

  function removeFromSelection(trackId) {
    let sel = getSelection();
    sel = sel.filter(s => String(s.id) !== String(trackId));
    localStorage.setItem(SELECTION_KEY, JSON.stringify(sel));
    notifyListeners();
  }

  function clearSelection() {
    localStorage.removeItem(SELECTION_KEY);
    notifyListeners();
  }

  function moveSelectionItem(trackId, direction) {
    const sel = getSelection();
    const idx = sel.findIndex(s => String(s.id) === String(trackId));
    if (idx < 0) return false;
    const swapIdx = idx + direction;
    if (swapIdx < 0 || swapIdx >= sel.length) return false;
    [sel[idx], sel[swapIdx]] = [sel[swapIdx], sel[idx]];
    localStorage.setItem(SELECTION_KEY, JSON.stringify(sel));
    notifyListeners();
    return true;
  }

  function copyTrackInfo(track) {
    const useLabels = (track._useTags || []).map(t => t.label).join("、");
    const lines = [
      `${track.title} - ${track.artist}`,
    ];
    if (track.album) lines.push(`专辑: ${track.album}`);
    if (track.duration) lines.push(`时长: ${formatDuration(track.duration)}`);
    if (track.score) lines.push(`匹配度: ${track.score}%`);
    if (useLabels) lines.push(`适用段落: ${useLabels}`);
    const url = track._url || track.url;
    if (url) lines.push(`链接: ${url}`);
    const text = lines.join("\n");

    if (navigator.clipboard && navigator.clipboard.writeText) {
      return navigator.clipboard.writeText(text).then(() => true).catch(() => fallbackCopy(text));
    }
    return Promise.resolve(fallbackCopy(text));
  }

  function fallbackCopy(text) {
    const ta = document.createElement("textarea");
    ta.value = text;
    ta.style.position = "fixed";
    ta.style.left = "-9999px";
    document.body.appendChild(ta);
    ta.select();
    try {
      document.execCommand("copy");
      return true;
    } catch (e) {
      return false;
    } finally {
      document.body.removeChild(ta);
    }
  }

  function sortTracks(tracks, sortBy) {
    const sorted = [...tracks];
    switch (sortBy) {
      case "score-desc":
        sorted.sort((a, b) => (b.score || 0) - (a.score || 0));
        break;
      case "score-asc":
        sorted.sort((a, b) => (a.score || 0) - (b.score || 0));
        break;
      case "title-asc":
        sorted.sort((a, b) => (a.title || "").localeCompare(b.title || "", "zh-CN"));
        break;
      case "duration-asc":
        sorted.sort((a, b) => (a.duration || 0) - (b.duration || 0));
        break;
      case "duration-desc":
        sorted.sort((a, b) => (b.duration || 0) - (a.duration || 0));
        break;
    }
    return sorted;
  }

  function filterTracks(tracks, keyword) {
    if (!keyword || !keyword.trim()) return tracks;
    const kw = keyword.trim().toLowerCase();
    return tracks.filter(t => {
      return (t.title || "").toLowerCase().includes(kw) ||
             (t.artist || "").toLowerCase().includes(kw) ||
             (t.album || "").toLowerCase().includes(kw);
    });
  }

  function exportPlaylist(task) {
    const lines = [];
    lines.push(`# 乐之笛配乐方案 - ${task.title || "未命名"}`);
    lines.push(`生成时间: ${new Date().toLocaleString("zh-CN")}`);
    if (task.confirmedSummary) {
      lines.push(`\n## 需求摘要\n${task.confirmedSummary}`);
    }
    const uses = (task.profile && task.profile.uses) || [];
    if (uses.length) {
      lines.push(`\n## 配乐用途\n${uses.map(u => {
        const labels = { intro: "开场", bgm: "BGM", transition: "转场", climax: "高潮", ending: "结尾", general: "通用" };
        return labels[u] || u;
      }).join("、")}`);
    }
    const allTracks = task.allTracks || task.results || [];
    lines.push(`\n## 推荐曲目（共${allTracks.length}首）\n`);
    allTracks.forEach((t, i) => {
      const useTagLabels = (t._useTags || []).map(tag => tag.label).join("、");
      lines.push(`${i + 1}. **${t.title}** - ${t.artist}`);
      lines.push(`   - 匹配度: ${t.score}%`);
      if (t.duration) lines.push(`   - 时长: ${formatDuration(t.duration)}`);
      if (useTagLabels) lines.push(`   - 适用段落: ${useTagLabels}`);
      if (t.bpm) lines.push(`   - BPM: ${t.bpm}`);
      if (t.platforms && t.platforms.length) lines.push(`   - 平台: ${t.platforms.join("、")}`);
      const url = t._url || t.url;
      if (url) lines.push(`   - 链接: ${url}`);
      if (t.reasons && t.reasons.length) lines.push(`   - 推荐理由: ${t.reasons.join("；")}`);
      lines.push("");
    });
    const content = lines.join("\n");
    const blob = new Blob([content], { type: "text/markdown;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `配乐方案_${(task.title || "乐之笛").replace(/[\\/:*?"<>|]/g, "_")}_${new Date().toISOString().slice(0, 10)}.md`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }

  function exportSelection(task) {
    const sel = getSelection();
    if (sel.length === 0) return false;
    const lines = [];
    lines.push(`# 乐之笛精选配乐集 - ${task ? (task.title || "未命名") : "我的精选"}`);
    lines.push(`导出时间: ${new Date().toLocaleString("zh-CN")}`);
    if (task && task.confirmedSummary) {
      lines.push(`\n## 需求摘要\n${task.confirmedSummary}`);
    }
    lines.push(`\n## 精选曲目（共${sel.length}首，已排序）\n`);
    sel.forEach((t, i) => {
      const useLabels = (t.useTags || []).map(tag => tag.label).join("、");
      lines.push(`${i + 1}. **${t.title}** - ${t.artist}`);
      if (t.duration) lines.push(`   - 时长: ${formatDuration(t.duration)}`);
      if (useLabels) lines.push(`   - 适用段落: ${useLabels}`);
      if (t.score) lines.push(`   - 匹配度: ${t.score}%`);
      const url = t.url;
      if (url) lines.push(`   - 链接: ${url}`);
      if (t.reasons && t.reasons.length) lines.push(`   - 推荐理由: ${t.reasons.join("；")}`);
      lines.push("");
    });
    const totalDuration = sel.reduce((s, t) => s + (t.duration || 0), 0);
    lines.push(`---\n总时长: ${formatDuration(totalDuration)}`);
    const content = lines.join("\n");
    const blob = new Blob([content], { type: "text/markdown;charset=utf-8" });
    const dlUrl = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = dlUrl;
    a.download = `精选配乐_${(task && task.title) || "乐之笛"}_${new Date().toISOString().slice(0, 10)}.md`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(dlUrl);
    return true;
  }

  global.AppPlayer = {
    playTrack,
    stop,
    togglePlay,
    playNext,
    playPrev,
    setQueue,
    getQueueInfo,
    canPlayTrack,
    getCurrentTrack,
    getIsPlaying,
    togglePlayMode,
    getPlayMode,
    getPlayModeInfo,
    subscribe,
    formatDuration,
    sortTracks,
    filterTracks,
    getFavorites,
    isFavorite,
    toggleFavorite,
    clearFavorites,
    getHistory,
    addToHistory,
    clearHistory,
    copyTrackInfo,
    exportPlaylist,
    getSelection,
    isInSelection,
    toggleSelection,
    removeFromSelection,
    clearSelection,
    moveSelectionItem,
    exportSelection
  };
})(window);
