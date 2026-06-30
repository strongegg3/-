(function (global) {
  const { feedbackPresets } = global.AppConfig;
  const { catalog } = global.AppData;
  const { nameOf, useLabel } = global.AppProfile;

  const els = {};
  let activeChannel = "all";

  function initElementReferences() {
    els.newTask = document.getElementById("newTask");
    els.loadDemo = document.getElementById("loadDemo");
    els.taskList = document.getElementById("taskList");
    els.baseUrl = document.getElementById("baseUrl");
    els.modelName = document.getElementById("modelName");
    els.apiKey = document.getElementById("apiKey");
    els.saveModel = document.getElementById("saveModel");
    els.modelNote = document.getElementById("modelNote");
    els.taskTitle = document.getElementById("taskTitle");
    els.taskSubtitle = document.getElementById("taskSubtitle");
    els.statusPill = document.getElementById("statusPill");
    els.plannerSource = document.getElementById("plannerSource");
    els.agentStatus = document.getElementById("agentStatus");
    els.messages = document.getElementById("messages");
    els.chatInput = document.getElementById("chatInput");
    els.composerHint = document.getElementById("composerHint");
    els.sendMessage = document.getElementById("sendMessage");
    els.forceSummary = document.getElementById("forceSummary");
    els.summaryEmpty = document.getElementById("summaryEmpty");
    els.summaryEditor = document.getElementById("summaryEditor");
    els.confirmSummary = document.getElementById("confirmSummary");
    els.rewriteSummary = document.getElementById("rewriteSummary");
    els.playlistPill = document.getElementById("playlistPill");
    els.metricTracks = document.getElementById("metricTracks");
    els.metricFit = document.getElementById("metricFit");
    els.metricBpm = document.getElementById("metricBpm");
    els.resultTabs = document.getElementById("resultTabs");
    els.resultToolbar = document.getElementById("resultToolbar");
    els.filterInput = document.getElementById("filterInput");
    els.sortSelect = document.getElementById("sortSelect");
    els.resultList = document.getElementById("resultList");
    els.feedbackChips = document.getElementById("feedbackChips");
    els.feedbackInput = document.getElementById("feedbackInput");
    els.applyFeedback = document.getElementById("applyFeedback");
    els.userStatus = document.getElementById("userStatus");
    els.loginBtn = document.getElementById("loginBtn");
    els.logoutBtn = document.getElementById("logoutBtn");
    els.exportBtn = document.getElementById("exportBtn");
    els.playerBar = document.getElementById("playerBar");
    els.playerBarSpacer = document.getElementById("playerBarSpacer");
    els.playerCover = document.getElementById("playerCover");
    els.playerTitle = document.getElementById("playerTitle");
    els.playerArtist = document.getElementById("playerArtist");
    els.playerDuration = document.getElementById("playerDuration");
    els.playerMode = document.getElementById("playerMode");
    els.playerPrev = document.getElementById("playerPrev");
    els.playerNext = document.getElementById("playerNext");
    els.playerStop = document.getElementById("playerStop");
  }

  function escapeHtml(value) {
    return String(value)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#039;");
  }

  function statusText(status) {
    const names = {
      draft: "草稿",
      questioning: "澄清中",
      summary_ready: "待确认",
      confirmed: "已生成"
    };
    return names[status] || "草稿";
  }

  function formatTime(value) {
    if (!value) return "--:--";
    return new Date(value).toLocaleString("zh-CN", {
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit"
    });
  }

  function formatCount(num) {
    if (!num) return "0";
    if (num >= 100000000) return (num / 100000000).toFixed(1) + "亿";
    if (num >= 10000) return (num / 10000).toFixed(1) + "万";
    return String(num);
  }

  function vocalName(value) {
    const names = {
      instrumental: "纯器乐",
      "light-vocal": "轻人声",
      "vocal-chop": "人声切片"
    };
    return names[value] || value || "未知";
  }

  function renderModelStatus(model) {
    const configured = Boolean((els.apiKey.value || (model && model.apiKey) || "").trim());
    els.modelNote.textContent = configured ? "已保存模型配置；接口失败会自动回退。" : "未配置或调用失败时自动使用本地规划模拟。";
  }

  function renderUserStatus(state) {
    if (!els.userStatus) return;
    const user = state.user || {};
    if (user.loggedIn && user.profile) {
      els.userStatus.innerHTML = `<span class="user-logged-in">❤️ ${escapeHtml(user.profile.nickname)}</span>`;
      if (els.loginBtn) els.loginBtn.style.display = "none";
      if (els.logoutBtn) els.logoutBtn.style.display = "";
    } else {
      els.userStatus.innerHTML = `<span class="user-guest">未登录网易云</span>`;
      if (els.loginBtn) els.loginBtn.style.display = "";
      if (els.logoutBtn) els.logoutBtn.style.display = "none";
    }
  }

  function renderExportButton(task) {
    if (els.exportBtn) {
      const hasResults = task && task.results && task.results.length > 0;
      els.exportBtn.classList.toggle("hidden", !hasResults);
    }
  }

  function renderTaskList(state) {
    els.taskList.innerHTML = "";
    state.tasks.forEach((task) => {
      const button = document.createElement("button");
      button.type = "button";
      button.className = `task-item${task.id === state.activeId ? " active" : ""}`;
      button.innerHTML = `
        <span class="task-title">${escapeHtml(task.title || "新配乐任务")}</span>
        <span class="task-meta">
          <span><i class="status-dot ${task.status === "confirmed" ? "confirmed" : task.status === "summary_ready" ? "summary" : ""}"></i>${statusText(task.status)}</span>
          <span>${formatTime(task.updatedAt)}</span>
        </span>
      `;
      button.addEventListener("click", () => {
        state.activeId = task.id;
        state.activeChannel = "all";
        global.AppState.saveState(state);
        renderAll(state);
      });
      els.taskList.appendChild(button);
    });
  }

  function renderHeader(task) {
    if (!task) return;
    els.taskTitle.textContent = task.title || "新配乐任务";
    const uses = (task.profile && task.profile.uses) || [];
    const useLabelStr = uses.map(u => useLabel(u)).join("、");
    els.taskSubtitle.textContent = task.status === "confirmed"
      ? `需求已确认${useLabelStr ? "（" + useLabelStr + "）" : ""}，可继续按反馈重排。`
      : task.status === "summary_ready"
        ? "规划 AI 已生成总结，可以修改后确认。"
        : "先把模糊想法交给规划 AI，它会逐轮补全需求。";
    els.statusPill.textContent = statusText(task.status);
    els.statusPill.className = `pill ${task.status === "summary_ready" ? "warn" : task.status === "confirmed" ? "live" : ""}`;
    els.plannerSource.textContent = task.plannerSource || "本地模拟待命";
    renderExportButton(task);
  }

  function renderAgentStatus(task) {
    const uses = (task && task.profile && task.profile.uses) || [];
    const activeAgents = task && task.status === "confirmed"
      ? global.AppAnalyst.getActiveAgents(task.profile)
      : [];
    const steps = [
      ["规划 AI", task && ["questioning", "summary_ready", "confirmed"].includes(task.status)],
      ["需求确认", task && ["summary_ready", "confirmed"].includes(task.status)]
    ];
    activeAgents.forEach(agent => {
      steps.push([`${agent.icon} ${agent.name}`, task && task.status === "confirmed"]);
    });
    steps.push(["音乐分析", task && task.status === "confirmed"]);
    els.agentStatus.innerHTML = steps.map(([name, active]) => `<span class="agent-chip ${active ? "active" : ""}">${active ? "●" : "○"} ${name}</span>`).join("");
  }

  function renderMessages(task, busy) {
    if (!task) return;
    els.messages.innerHTML = task.messages.map((message) => `
      <div class="message ${message.role === "user" ? "user" : "assistant"}">
        <div class="avatar">${message.role === "user" ? "你" : "AI"}</div>
        <div class="bubble">${escapeHtml(message.content)}</div>
      </div>
    `).join("");
    if (busy) {
      els.messages.insertAdjacentHTML("beforeend", `
        <div class="message assistant">
          <div class="avatar">AI</div>
          <div class="bubble">规划 AI 正在整理问题...</div>
        </div>
      `);
    }
    els.messages.scrollTop = els.messages.scrollHeight;
  }

  function renderSummary(task, busy) {
    const hasSummary = task && (task.summary || task.confirmedSummary);
    els.summaryEmpty.classList.toggle("hidden", Boolean(hasSummary));
    els.summaryEditor.classList.toggle("hidden", !hasSummary);
    if (hasSummary && document.activeElement !== els.summaryEditor) {
      els.summaryEditor.value = task.confirmedSummary || task.summary;
    }
    els.confirmSummary.disabled = busy || !hasSummary;
    els.rewriteSummary.disabled = busy || !task || task.status === "confirmed";
  }

  function getChannelTabs() {
    return [
      { key: "all", label: "全部推荐", icon: "✨" },
      { key: "playlists", label: "精选歌单", icon: "🎵" },
      { key: "ost", label: "影视/ACG", icon: "🎬" },
      { key: "singles", label: "单曲搜索", icon: "🔍" },
      { key: "user", label: "我的音乐", icon: "❤️" },
      { key: "selection", label: "我的精选", icon: "📋" },
      { key: "favorites", label: "本地收藏", icon: "⭐" },
      { key: "history", label: "试听历史", icon: "🕐" }
    ];
  }

  function renderChannelTabs(task, state) {
    const channels = (task && task.channels) || (task && task._channels) || null;
    const tabData = getChannelTabs();
    const userLoggedIn = state.user && state.user.loggedIn;
    const favCount = global.AppPlayer.getFavorites().length;
    const histCount = global.AppPlayer.getHistory().length;
    const selCount = global.AppPlayer.getSelection().length;

    let html = "";
    tabData.forEach((tab) => {
      let count = 0;
      let countText = "";
      if (tab.key === "playlists" && channels && channels.playlists) {
        count = (channels.playlists.tracks || []).length;
        if (count) countText = `<span class="tab-count">${count}</span>`;
      } else if (tab.key === "singles" && channels && channels.singles) {
        count = (channels.singles.tracks || []).length;
        if (count) countText = `<span class="tab-count">${count}</span>`;
      } else if (tab.key === "user" && channels && channels.user) {
        count = (channels.user.tracks || []).length;
        if (channels.user.loggedIn && count) countText = `<span class="tab-count">${count}</span>`;
        else if (!channels.user.loggedIn || !userLoggedIn) {
          countText = `<span class="tab-soon">需登录</span>`;
        }
      } else if (tab.key === "favorites") {
        if (favCount) countText = `<span class="tab-count">${favCount}</span>`;
      } else if (tab.key === "history") {
        if (histCount) countText = `<span class="tab-count">${histCount}</span>`;
      } else if (tab.key === "selection") {
        if (selCount) countText = `<span class="tab-count selection-count">${selCount}</span>`;
      } else if (tab.key === "ost" && channels && channels.ost) {
        count = (channels.ost.tracks || []).length;
        if (count) countText = `<span class="tab-count">${count}</span>`;
      }
      const isActive = state.activeChannel === tab.key;
      const disabled = tab.disabled ? "disabled" : "";
      html += `<button class="tab-btn ${isActive ? "active" : ""}" data-channel="${tab.key}" ${disabled}>${tab.icon} ${tab.label}${countText}</button>`;
    });
    els.resultTabs.innerHTML = html;
  }

  function bindChannelEvents(state) {
    if (els.resultTabs._bound) return;
    els.resultTabs._bound = true;
    els.resultTabs.addEventListener("click", (e) => {
      const btn = e.target.closest(".tab-btn");
      if (!btn || btn.disabled) return;
      const channel = btn.getAttribute("data-channel");
      if (channel === state.activeChannel) return;
      state.activeChannel = channel;
      renderAll(state);
    });
  }

  function getTrackChannel(track) {
    if (track._fromUserPlaylist || track._fromLiked || track.channel === "user") return "user";
    if (track._fromPlaylist || track.channel === "playlists") return "playlists";
    if (track._fromOst || track.channel === "ost") return "ost";
    return "singles";
  }

  function renderRecommendations(task, state) {
    const results = task && task.status === "confirmed" ? task.results : [];
    const allTracks = (task && task.allTracks) || results;
    const channels = (task && task.channels) || null;
    const profile = task && task.profile;
    const remoteLoading = task && task._remoteLoading;
    const remoteError = task && task._remoteError;
    const playlistObjs = channels ? (channels.playlists.playlists || []) : (task.playlists || []);

    const channel = state.activeChannel || "all";
    const sortBy = state.sortBy || "score-desc";
    const filterKeyword = state.filterKeyword || "";

    const showToolbar = results.length > 0 || channel === "favorites" || channel === "history" || channel === "selection";
    if (els.resultToolbar) {
      els.resultToolbar.style.display = showToolbar ? "flex" : "none";
    }

    const totalTracks = results.length;
    const playlistTrackCount = allTracks.filter(t => getTrackChannel(t) === "playlists").length;
    const userTrackCount = allTracks.filter(t => getTrackChannel(t) === "user").length;
    const singleTrackCount = allTracks.filter(t => getTrackChannel(t) === "singles").length;
    const ostTrackCount = allTracks.filter(t => getTrackChannel(t) === "ost").length;
    const selCount = global.AppPlayer.getSelection().length;

    els.playlistPill.textContent = totalTracks ? `Top ${totalTracks}` : "未生成";
    els.metricTracks.textContent = totalTracks ? `${singleTrackCount + playlistTrackCount + userTrackCount + ostTrackCount}首` : "0";
    els.metricFit.textContent = results[0] ? `${results[0].score}%` : "0%";
    els.metricBpm.textContent = profile ? `${profile.bpmTarget[0]}-${profile.bpmTarget[1]}` : "--";
    const feedbackBox = document.getElementById("feedbackBox");
    if (feedbackBox) feedbackBox.classList.toggle("hidden", !results.length);

    renderChannelTabs(task, state);

    const currentTrack = global.AppPlayer ? global.AppPlayer.getCurrentTrack() : null;
    const isPlaying = global.AppPlayer ? global.AppPlayer.getIsPlaying() : false;

    function processTracks(tracks) {
      let processed = global.AppPlayer.filterTracks(tracks, filterKeyword);
      processed = global.AppPlayer.sortTracks(processed, sortBy);
      return processed;
    }

    if (!results.length && !playlistObjs.length && channel !== "favorites" && channel !== "history" && channel !== "selection") {
      els.resultList.innerHTML = `<div class="summary-empty">确认需求后，这里会出现候选曲目、平台来源、适用段落和匹配理由。点击歌曲卡片的 ▶ 按钮可以直接试听。</div>`;
      return;
    }

    let html = "";
    let currentQueueTracks = [];

    if (channel === "playlists") {
      if (playlistObjs.length > 0) {
        html += `<div class="section-title">🎵 精选歌单（${playlistObjs.length}个）</div>`;
        html += `<div class="playlist-scroll">${playlistObjs.map((pl) => renderPlaylistCard(pl)).join("")}</div>`;
        const playlistTracks = processTracks(filterTracksByChannel(allTracks, "playlists"));
        currentQueueTracks = playlistTracks;
        if (playlistTracks.length > 0) {
          html += `<div class="section-title">🎵 来自歌单的曲目（${playlistTracks.length}首）</div>`;
          html += playlistTracks.map((track, i) => renderTrackCard(track, i, currentTrack, isPlaying)).join("");
        }
      } else {
        html = `<div class="summary-empty">正在匹配精品歌单...</div>`;
      }
    } else if (channel === "singles") {
      const singleTracks = processTracks(filterTracksByChannel(allTracks, "singles"));
      currentQueueTracks = singleTracks;
      if (singleTracks.length > 0) {
        html += `<div class="section-title">🔍 单曲搜索结果（${singleTracks.length}首）</div>`;
        html += singleTracks.map((track, i) => renderTrackCard(track, i, currentTrack, isPlaying)).join("");
      } else {
        html = `<div class="summary-empty">暂无单曲搜索结果</div>`;
      }
    } else if (channel === "user") {
      if (!state.user.loggedIn) {
        html = `<div class="summary-empty login-hint">
          <p>❤️ 登录网易云音乐后，可以从你的喜欢和歌单中找配乐</p>
          <p class="hint-text">点击左下角「登录网易云」，粘贴你的网易云MUSIC_U cookie即可</p>
        </div>`;
      } else {
        const userTracks = processTracks(filterTracksByChannel(allTracks, "user"));
        currentQueueTracks = userTracks;
        const userPlaylists = channels && channels.user ? (channels.user.playlists || []) : [];
        if (userPlaylists.length > 0) {
          html += `<div class="section-title">📁 匹配到的你的歌单</div>`;
          html += `<div class="mini-playlists">`;
          html += userPlaylists.slice(0, 4).map(pl => `
            <div class="mini-playlist">
              ${pl.cover ? `<img src="${escapeHtml(pl.cover)}" alt="">` : `<div class="mini-pl-placeholder">♫</div>`}
              <span>${escapeHtml(pl.name)}</span>
            </div>
          `).join("");
          html += `</div>`;
        }
        if (userTracks.length > 0) {
          html += `<div class="section-title">❤️ 来自你的收藏（${userTracks.length}首）</div>`;
          html += userTracks.map((track, i) => renderTrackCard(track, i, currentTrack, isPlaying)).join("");
        } else {
          html = `<div class="summary-empty">你的歌单中暂无匹配的曲目，试试不同的需求描述</div>`;
        }
      }
    } else if (channel === "selection") {
      let sel = global.AppPlayer.getSelection();
      sel = processTracks(sel);
      currentQueueTracks = sel;
      if (sel.length > 0) {
        const totalDur = sel.reduce((s, t) => s + (t.duration || 0), 0);
        html += `<div class="section-header-row">
          <div class="section-title">📋 我的精选配乐集（${sel.length}首）</div>
          <div style="display:flex;gap:6px;">
            <button class="clear-btn export-sel-btn" data-action="export-selection" title="导出精选集">📥 导出</button>
            <button class="clear-btn play-sel-btn" data-action="play-selection" title="按顺序播放">▶️ 播放全部</button>
            <button class="clear-btn" data-clear="selection" title="清空精选集">🗑️ 清空</button>
          </div>
        </div>`;
        html += `<p class="section-subtitle">在推荐结果中点击 ➕ 按钮将歌曲加入精选集，可以调整顺序并导出方案。总时长: ${global.AppPlayer.formatDuration(totalDur)}</p>`;
        html += sel.map((track, i) => renderSelectionTrackCard(track, i, currentTrack, isPlaying)).join("");
      } else {
        html = `<div class="summary-empty">精选集是空的，在推荐结果里点击 ➕ 按钮挑选歌曲吧</div>`;
      }
    } else if (channel === "favorites") {
      let favs = global.AppPlayer.getFavorites();
      favs = processTracks(favs);
      currentQueueTracks = favs;
      if (favs.length > 0) {
        html += `<div class="section-header-row">
          <div class="section-title">⭐ 我的本地收藏（${favs.length}首）</div>
          <button class="clear-btn" data-clear="favorites" title="清空收藏">🗑️ 清空</button>
        </div>`;
        html += `<p class="section-subtitle">点击 ⭐ 按钮收藏喜欢的歌曲，数据保存在浏览器本地</p>`;
        html += favs.map((track, i) => renderTrackCard(track, i, currentTrack, isPlaying, true)).join("");
      } else {
        html = `<div class="summary-empty">还没有收藏任何歌曲，在推荐结果里点击 ⭐ 按钮收藏吧</div>`;
      }
    } else if (channel === "history") {
      let hist = global.AppPlayer.getHistory();
      hist = processTracks(hist);
      currentQueueTracks = hist;
      if (hist.length > 0) {
        html += `<div class="section-header-row">
          <div class="section-title">🕐 试听历史（${hist.length}首）</div>
          <button class="clear-btn" data-clear="history" title="清空历史">🗑️ 清空</button>
        </div>`;
        html += `<p class="section-subtitle">最近试听的歌曲，点击可以重新播放</p>`;
        html += hist.map((track, i) => renderTrackCard(track, i, currentTrack, isPlaying, true)).join("");
      } else {
        html = `<div class="summary-empty">还没有试听记录，点击歌曲卡片上的 ▶ 按钮开始试听吧</div>`;
      }
    } else if (channel === "ost") {
      const ostTracks = processTracks(filterTracksByChannel(allTracks, "ost"));
      currentQueueTracks = ostTracks;
      const ostPlaylists = channels && channels.ost ? (channels.ost.playlists || []) : [];
      if (ostTracks.length > 0 || ostPlaylists.length > 0) {
        if (ostPlaylists.length > 0) {
          html += `<div class="section-title">🎬 OST相关歌单</div>`;
          html += `<div class="playlist-scroll">${ostPlaylists.map((pl) => renderPlaylistCard(pl)).join("")}</div>`;
        }
        if (ostTracks.length > 0) {
          html += `<div class="section-title">🎬 影视/ACG原声（${ostTracks.length}首）</div>`;
          html += ostTracks.map((track, i) => renderTrackCard(track, i, currentTrack, isPlaying)).join("");
        }
      } else {
        html = `<div class="summary-empty">🎬 暂无影视/ACG原声结果</div>`;
      }
    } else {
      const matchingUse = (profile && profile.uses && profile.uses[0]) || "general";
      const useConfig = global.AppFinder.FINDER_CONFIG[matchingUse] || global.AppFinder.FINDER_CONFIG.general;
      const ostPlaylists = channels && channels.ost ? (channels.ost.playlists || []) : [];
      const displayResults = processTracks(results);
      currentQueueTracks = displayResults;

      if (playlistObjs.length > 0) {
        html += `<div class="section-title">📋 精选歌单推荐</div>`;
        html += `<div class="playlist-scroll">${playlistObjs.slice(0, 3).map((pl) => renderPlaylistCard(pl)).join("")}</div>`;
      }
      if (ostPlaylists.length > 0) {
        html += `<div class="section-title">🎬 影视/ACG原声歌单</div>`;
        html += `<div class="playlist-scroll">${ostPlaylists.slice(0, 2).map((pl) => renderPlaylistCard(pl)).join("")}</div>`;
      }
      const countText = filterKeyword ? `${displayResults.length}首（已过滤）` : `共${totalTracks}首`;
      html += `<div class="section-title">${useConfig.icon} 推荐曲目（${countText}）</div>`;
      html += displayResults.map((track, index) => renderTrackCard(track, index, currentTrack, isPlaying)).join("");
    }

    state._currentQueue = currentQueueTracks;

    if (remoteLoading) {
      html += `<div class="remote-loading">🔍 ${useConfigLoading(profile)} ...</div>`;
    }
    if (remoteError && !results.some((t) => t._source === "remote")) {
      html += `<div class="remote-fallback">未连接到音乐搜索后端，当前显示本地精选曲库。启动后端服务后可获取真实平台音乐。<br><small>cd backend && npm start</small></div>`;
    }

    els.resultList.innerHTML = html;
    bindTrackEvents(state);
  }

  function useConfigLoading(profile) {
    const uses = (profile && profile.uses) || ["general"];
    const agents = uses.map(u => {
      const cfg = global.AppFinder.FINDER_CONFIG[u];
      return cfg ? cfg.name : u;
    });
    return `${agents.join("、")}正在搜索 网易云音乐 / Apple Music / 精品歌单`;
  }

  function renderSelectionTrackCard(track, index, currentTrack, isPlaying) {
    const coverUrl = track.cover || track._albumCover || track.albumCover || track.thumbnail || "";
    const duration = track.duration || track._duration || 0;
    const durationStr = global.AppPlayer.formatDuration(duration);
    const isCurrentPlaying = currentTrack && String(currentTrack.id) === String(track.id) && isPlaying;
    const isNetease = (track.platforms && track.platforms.includes("网易云音乐")) || track.source === "netease" || track.source === "netease-user";
    const canPlay = isNetease && track.id;
    const useLabels = (track.useTags || track._useTags || []).map(t => t.label).join("、");

    const coverHtml = coverUrl
      ? `<img class="track-cover" src="${escapeHtml(coverUrl)}" alt="" loading="lazy">`
      : `<div class="track-cover-placeholder">♫</div>`;

    return `
      <article class="track-card selection-card ${isCurrentPlaying ? 'now-playing' : ''}">
        <div class="sel-order">${index + 1}</div>
        <div class="sel-cover">${coverHtml}</div>
        <div class="sel-info">
          <div class="sel-title">
            ${isCurrentPlaying ? '<span class="now-playing-indicator">🔊</span>' : ''}
            ${escapeHtml(track.title)}
          </div>
          <div class="sel-artist">${escapeHtml(track.artist)}${track.album ? ' · ' + escapeHtml(track.album) : ''}</div>
          <div class="sel-meta">
            ${durationStr}
            ${useLabels ? `<span class="sel-tag">${escapeHtml(useLabels)}</span>` : ''}
            ${track.score ? `<span class="sel-score">匹配 ${track.score}%</span>` : ''}
          </div>
        </div>
        <div class="sel-actions">
          ${canPlay ? `<button class="sel-action-btn" data-action="play" data-track-id="${escapeHtml(track.id)}" title="播放">${isCurrentPlaying ? '🔊' : '▶'}</button>` : ''}
          <button class="sel-action-btn" data-action="move-up" data-track-id="${escapeHtml(track.id)}" title="上移" ${index === 0 ? 'disabled' : ''}>⬆</button>
          <button class="sel-action-btn" data-action="move-down" data-track-id="${escapeHtml(track.id)}" title="下移" ${index >= global.AppPlayer.getSelection().length - 1 ? 'disabled' : ''}>⬇</button>
          <button class="sel-action-btn remove" data-action="remove-sel" data-track-id="${escapeHtml(track.id)}" title="移除">✕</button>
        </div>
      </article>
    `;
  }

  function filterTracksByChannel(tracks, channel) {
    return tracks.filter(t => getTrackChannel(t) === channel);
  }

  function renderPlaylistCard(pl) {
    const playCountStr = formatCount(pl.playCount);
    const catLabel = pl.cat || "";

    return `
      <article class="playlist-card">
        <div class="pl-cover-wrap">
          ${pl.cover ? `<img class="pl-cover" src="${escapeHtml(pl.cover)}" alt="" loading="lazy">` : `<div class="pl-cover-placeholder">♫</div>`}
          <span class="pl-cat-badge">${escapeHtml(catLabel)}</span>
        </div>
        <div class="pl-info">
          <h4 class="pl-name">${escapeHtml(pl.name)}</h4>
          <p class="pl-meta">
            <span>${escapeHtml(pl.creator)}</span>
            <span class="pl-dot">·</span>
            <span>${pl.trackCount} 首</span>
            <span class="pl-dot">·</span>
            <span>播放 ${playCountStr}</span>
          </p>
          ${pl.description ? `<p class="pl-desc">${escapeHtml(pl.description)}${pl.description.length >= 80 ? "..." : ""}</p>` : ""}
          <a class="pl-link" href="${escapeHtml(pl.url)}" target="_blank" rel="noopener">在网易云音乐打开 →</a>
        </div>
      </article>
    `;
  }

  function renderTrackCard(track, index, currentTrack, isPlaying, isFromLocal) {
    const isRemote = track._source === "remote" || track.source === "netease" || track.source === "netease-user" || isFromLocal;
    const fromPlaylist = track._fromPlaylist && track._playlistName;
    const fromLiked = track._fromLiked;
    const fromUserPl = track._fromUserPlaylist && track._playlistName;
    const hasAlbumCover = !!(track._albumCover || track.albumCover || track.thumbnail || track.cover);
    const hasStructure = track.structure && track.structure.length > 2;
    const hasVocal = track.vocal && track.vocal !== "unknown";
    const hasUrl = !!(track._url || track.url);
    const useTags = track._useTags || [];
    const coverUrl = track._albumCover || track.albumCover || track.thumbnail || track.cover || "";
    const isNetease = (track.platforms && track.platforms.includes("网易云音乐")) || 
                      track.source === "netease" || track.source === "netease-user";
    const canPlay = isNetease && track.id;
    const isCurrentPlaying = currentTrack && String(currentTrack.id) === String(track.id) && isPlaying;
    const isFav = global.AppPlayer.isFavorite(track.id);
    const isSelected = global.AppPlayer.isInSelection(track.id);
    const duration = track.duration || track._duration || 0;
    const durationStr = global.AppPlayer.formatDuration(duration);

    const channelIcon = getTrackChannel(track) === "user" ? "❤️"
      : getTrackChannel(track) === "playlists" ? "🎵"
      : getTrackChannel(track) === "ost" ? "🎬"
      : "🔍";
    const platformBadge = isRemote
      ? `<span class="platform-badge remote">${channelIcon} ${escapeHtml(track.platforms ? track.platforms[0] : (track.platform || "网易云音乐"))}</span>`
      : `<span class="platform-badge local">本地曲库</span>`;

    let sourceBadge = "";
    if (fromPlaylist) sourceBadge = `<span class="playlist-source-badge">🎵 ${escapeHtml(track._playlistName)}</span>`;
    else if (fromLiked) sourceBadge = `<span class="user-source-badge">❤️ 我喜欢的音乐</span>`;
    else if (fromUserPl) sourceBadge = `<span class="user-source-badge">📁 ${escapeHtml(track._playlistName)}</span>`;

    const coverHtml = hasAlbumCover
      ? `<img class="track-cover" src="${escapeHtml(coverUrl)}" alt="" loading="lazy">`
      : "";

    const useTagsHtml = useTags.length > 0
      ? `<div class="use-tags">${useTags.map(t => `<span class="use-tag">${t.icon} ${escapeHtml(t.label)}</span>`).join("")}</div>`
      : "";

    let metaHtml = "";
    if (isRemote) {
      metaHtml += `<div class="meta-cell"><b>时长</b><span>${durationStr}</span></div>`;
      if (track.album) metaHtml += `<div class="meta-cell"><b>专辑</b><span title="${escapeHtml(track.album)}">${escapeHtml(track.album.length > 8 ? track.album.slice(0, 8) + "…" : track.album)}</span></div>`;
    } else {
      metaHtml += `<div class="meta-cell"><b>BPM</b><span>${track.bpm || "--"}</span></div>`;
      metaHtml += `<div class="meta-cell"><b>能量</b><span>${track.energy || "--"}/100</span></div>`;
      if (hasVocal) {
        metaHtml += `<div class="meta-cell"><b>人声</b><span>${vocalName(track.vocal)}</span></div>`;
      } else if (duration > 0) {
        metaHtml += `<div class="meta-cell"><b>时长</b><span>${durationStr}</span></div>`;
      }
    }

    let structureHtml = "";
    if (hasStructure && !isRemote) {
      structureHtml = `<p class="reason"><strong>剪辑结构：</strong>${escapeHtml(track.structure)}</p>`;
    }

    let platformLinksHtml = "";
    const platforms = track.platforms || (track.platform ? [track.platform] : []);
    if (isRemote && platforms.length > 0) {
      platformLinksHtml = platforms.map((p) => {
        const url = track._url || track.url || "";
        if (url) {
          return `<a class="platform-link" href="${escapeHtml(url)}" target="_blank" rel="noopener">${escapeHtml(p)}</a>`;
        }
        return `<span class="platform">${escapeHtml(p)}</span>`;
      }).join("");
    } else {
      platformLinksHtml = platforms.map((p) => `<span class="platform">${escapeHtml(p)}</span>`).join("");
    }

    const actionButtons = `
      <div class="track-actions">
        ${canPlay ? `<button class="track-action-btn play-btn ${isCurrentPlaying ? 'playing' : ''}" data-action="play" data-track-id="${escapeHtml(track.id)}" title="${isCurrentPlaying ? '停止播放' : '试听'}">${isCurrentPlaying ? '🔊' : '▶'}</button>` : ''}
        <button class="track-action-btn fav-btn ${isFav ? 'favorited' : ''}" data-action="favorite" data-track-id="${escapeHtml(track.id)}" title="${isFav ? '取消收藏' : '收藏'}">${isFav ? '⭐' : '☆'}</button>
        <button class="track-action-btn select-btn ${isSelected ? 'selected' : ''}" data-action="select" data-track-id="${escapeHtml(track.id)}" title="${isSelected ? '从精选集移除' : '加入精选集'}">${isSelected ? '✅' : '➕'}</button>
        <button class="track-action-btn copy-btn" data-action="copy" data-track-id="${escapeHtml(track.id)}" title="复制歌曲信息">📋</button>
      </div>
    `;

    let listenHtml = "";
    if (isRemote) {
      listenHtml = track._url || track.url
        ? `<a class="track-listen-link" href="${escapeHtml(track._url || track.url)}" target="_blank" rel="noopener">打开 →</a>`
        : "";
    } else {
      listenHtml = escapeHtml(track.download || "");
    }

    const reasons = track.reasons || [];
    const reasonHtml = reasons.length > 0
      ? `<p class="reason hook">💡 ${escapeHtml(reasons[0])}</p>${reasons.length > 1 ? `<p class="reason">${reasons.slice(1).map(r => escapeHtml(r)).join("；")}。</p>` : ''}`
      : (track.hook ? `<p class="reason hook">💡 ${escapeHtml(track.hook)}</p>` : "");

    const scoreDisplay = track.score != null ? `${track.score}%` : "--";

    return `
      <article class="track-card ${isRemote ? "track-remote" : ""} ${fromPlaylist || fromLiked || fromUserPl ? "from-playlist" : ""} ${isCurrentPlaying ? 'now-playing' : ''}">
        <div class="track-head">
          ${coverHtml ? `<div class="track-cover-wrap">${coverHtml}${canPlay ? `<button class="cover-play-btn" data-action="play" data-track-id="${escapeHtml(track.id)}">${isCurrentPlaying ? '🔊' : '▶'}</button>` : ''}</div>` : ''}
          <div class="track-head-info">
            <div class="track-head-top">
              <h4>${index + 1}. ${escapeHtml(track.title)}</h4>
              ${platformBadge}
            </div>
            ${sourceBadge}
            ${useTagsHtml}
            <p class="track-artist">${escapeHtml(track.artist)}${track.album && isRemote ? ` · <span class="track-album">${escapeHtml(track.album)}</span>` : ''} ${listenHtml ? `· ${listenHtml}` : ''}</p>
          </div>
          <div class="track-score-area">
            <div class="score">${scoreDisplay}</div>
            ${actionButtons}
          </div>
        </div>
        <div class="track-body">
          ${track.score != null ? `<div class="bar"><i style="width:${track.score}%"></i></div>` : ''}
          <div class="track-meta">${metaHtml}</div>
          ${reasonHtml}
          ${structureHtml}
          <div class="platforms">${platformLinksHtml}</div>
        </div>
      </article>
    `;
  }

  function bindTrackEvents(state) {
    if (els.resultList._bound) {
      els.resultList._bound = false;
      const newEl = els.resultList.cloneNode(true);
      els.resultList.parentNode.replaceChild(newEl, els.resultList);
      els.resultList = newEl;
    }
    els.resultList._bound = true;

    els.resultList.addEventListener("click", (e) => {
      const clearBtn = e.target.closest("[data-clear]");
      if (clearBtn) {
        const clearType = clearBtn.getAttribute("data-clear");
        if (clearType === "favorites") {
          if (confirm("确定要清空所有收藏吗？此操作不可恢复。")) {
            global.AppPlayer.clearFavorites();
            showToast("已清空收藏");
            renderAll(state);
          }
        } else if (clearType === "history") {
          if (confirm("确定要清空试听历史吗？此操作不可恢复。")) {
            global.AppPlayer.clearHistory();
            showToast("已清空试听历史");
            renderAll(state);
          }
        } else if (clearType === "selection") {
          if (confirm("确定要清空精选集吗？此操作不可恢复。")) {
            global.AppPlayer.clearSelection();
            showToast("已清空精选集");
            renderAll(state);
          }
        }
        return;
      }

      const btn = e.target.closest("[data-action]");
      if (!btn) return;
      const action = btn.getAttribute("data-action");
      const trackId = btn.getAttribute("data-track-id");

      if (action === "export-selection") {
        const task = state.tasks.find(t => t.id === state.activeId);
        const ok = global.AppPlayer.exportSelection(task);
        showToast(ok ? "精选集已导出" : "精选集为空");
        return;
      }
      if (action === "play-selection") {
        const sel = global.AppPlayer.getSelection();
        if (sel.length > 0) {
          global.AppPlayer.setQueue(sel, sel[0]);
          global.AppPlayer.playTrack(sel[0], sel);
          updatePlayerBar();
          renderAll(state);
        }
        return;
      }

      if (!trackId) return;

      const task = state.tasks.find(t => t.id === state.activeId);
      let track = null;

      if (state.activeChannel === "favorites") {
        track = global.AppPlayer.getFavorites().find(t => String(t.id) === String(trackId));
      } else if (state.activeChannel === "history") {
        track = global.AppPlayer.getHistory().find(t => String(t.id) === String(trackId));
      } else if (state.activeChannel === "selection") {
        track = global.AppPlayer.getSelection().find(t => String(t.id) === String(trackId));
      } else if (task) {
        const allTracks = task.allTracks || task.results || [];
        track = allTracks.find(t => String(t.id) === String(trackId));
        if (!track) {
          track = global.AppPlayer.getSelection().find(t => String(t.id) === String(trackId))
            || global.AppPlayer.getFavorites().find(t => String(t.id) === String(trackId));
        }
        if (!track && task.channels) {
          const allChannelTracks = [
            ...(task.channels.playlists?.tracks || []),
            ...(task.channels.singles?.tracks || []),
            ...(task.channels.user?.tracks || []),
            ...(task.channels.ost?.tracks || [])
          ];
          track = allChannelTracks.find(t => String(t.id) === String(trackId));
        }
      }

      if (!track) return;

      if (action === "play") {
        let queue;
        if (state.activeChannel === "selection") {
          queue = global.AppPlayer.getSelection();
        } else {
          queue = state._currentQueue || (task ? (task.allTracks || task.results || []) : []);
        }
        global.AppPlayer.togglePlay(track, queue);
        updatePlayerBar();
        renderAll(state);
      } else if (action === "favorite") {
        global.AppPlayer.toggleFavorite(track);
        renderAll(state);
      } else if (action === "select") {
        const added = global.AppPlayer.toggleSelection(track);
        showToast(added ? "已加入精选集" : "已从精选集移除");
        renderAll(state);
      } else if (action === "remove-sel") {
        global.AppPlayer.removeFromSelection(trackId);
        showToast("已从精选集移除");
        renderAll(state);
      } else if (action === "move-up") {
        global.AppPlayer.moveSelectionItem(trackId, -1);
        renderAll(state);
      } else if (action === "move-down") {
        global.AppPlayer.moveSelectionItem(trackId, 1);
        renderAll(state);
      } else if (action === "copy") {
        global.AppPlayer.copyTrackInfo(track).then((ok) => {
          showToast(ok ? "已复制歌曲信息" : "复制失败");
        });
      } else if (action === "remove-fav") {
        global.AppPlayer.toggleFavorite(track);
        renderAll(state);
      }
    });
  }

  function showToast(message) {
    let toast = document.getElementById("app-toast");
    if (!toast) {
      toast = document.createElement("div");
      toast.id = "app-toast";
      toast.className = "app-toast";
      document.body.appendChild(toast);
    }
    toast.textContent = message;
    toast.classList.add("show");
    setTimeout(() => toast.classList.remove("show"), 2000);
  }

  function updatePlayerBar() {
    if (!global.AppPlayer) return;
    const track = global.AppPlayer.getCurrentTrack();
    const playing = global.AppPlayer.getIsPlaying();
    const modeInfo = global.AppPlayer.getPlayModeInfo();

    if (els.playerMode && modeInfo) {
      els.playerMode.textContent = modeInfo.icon;
      els.playerMode.title = modeInfo.label;
    }

    if (track && playing) {
      els.playerBar.classList.add("active");
      if (els.playerBarSpacer) els.playerBarSpacer.classList.add("active");
      els.playerTitle.textContent = track.title;
      els.playerArtist.textContent = track.artist;
      const duration = track.duration || track._duration || 0;
      els.playerDuration.textContent = duration > 0 ? global.AppPlayer.formatDuration(duration) : "";
      const coverUrl = track._albumCover || track.albumCover || track.cover || track.thumbnail || "";
      if (coverUrl) {
        els.playerCover.innerHTML = `<img class="player-cover" src="${escapeHtml(coverUrl)}" alt="">`;
      } else {
        els.playerCover.innerHTML = "♫";
      }
    } else {
      els.playerBar.classList.remove("active");
      if (els.playerBarSpacer) els.playerBarSpacer.classList.remove("active");
      els.playerDuration.textContent = "";
    }
  }

  function renderFeedbackChips(onChipClick) {
    els.feedbackChips.innerHTML = "";
    feedbackPresets.forEach((text) => {
      const button = document.createElement("button");
      button.type = "button";
      button.className = "chip";
      button.textContent = text;
      button.addEventListener("click", () => onChipClick(text));
      els.feedbackChips.appendChild(button);
    });
  }

  function renderBusy(isBusy, state) {
    [els.sendMessage, els.forceSummary, els.confirmSummary, els.rewriteSummary, els.applyFeedback].forEach((button) => {
      if (button) button.disabled = isBusy || button.disabled;
    });
    if (!isBusy) {
      const task = state.tasks.find((t) => t.id === state.activeId);
      if (els.sendMessage) els.sendMessage.disabled = false;
      if (els.forceSummary) els.forceSummary.disabled = false;
      if (els.confirmSummary) els.confirmSummary.disabled = !(task && (task.summary || task.confirmedSummary));
      if (els.rewriteSummary) els.rewriteSummary.disabled = !(task && task.status !== "confirmed");
      if (els.applyFeedback) els.applyFeedback.disabled = !(task && task.status === "confirmed");
    }
    if (els.chatInput) els.chatInput.disabled = isBusy;
    if (els.composerHint) els.composerHint.textContent = isBusy ? "规划 AI 正在处理..." : "Ctrl / Cmd + Enter 可快速发送。";
  }

  function renderAll(state) {
    const task = state.tasks.find((t) => t.id === state.activeId);
    bindChannelEvents(state);
    renderModelStatus(state.model);
    renderUserStatus(state);
    renderTaskList(state);
    renderHeader(task);
    renderAgentStatus(task);
    renderMessages(task, state.busy);
    renderSummary(task, state.busy);
    renderRecommendations(task, state);
    renderBusy(state.busy, state);
    updatePlayerBar();
  }

  global.AppRender = {
    initElementReferences,
    renderAll,
    renderModelStatus,
    renderUserStatus,
    renderTaskList,
    renderHeader,
    renderAgentStatus,
    renderMessages,
    renderSummary,
    renderRecommendations,
    renderFeedbackChips,
    renderBusy,
    updatePlayerBar,
    getElements: () => els
  };
})(window);
