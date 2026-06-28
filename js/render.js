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
    els.resultList = document.getElementById("resultList");
    els.feedbackChips = document.getElementById("feedbackChips");
    els.feedbackInput = document.getElementById("feedbackInput");
    els.applyFeedback = document.getElementById("applyFeedback");
    els.userStatus = document.getElementById("userStatus");
    els.loginBtn = document.getElementById("loginBtn");
    els.logoutBtn = document.getElementById("logoutBtn");
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
      { key: "singles", label: "单曲搜索", icon: "🔍" },
      { key: "user", label: "我的收藏", icon: "❤️" },
      { key: "ost", label: "影视原声", icon: "🎬", disabled: true }
    ];
  }

  function renderChannelTabs(task, state) {
    const channels = (task && task.channels) || (task && task._channels) || null;
    const tabData = getChannelTabs();
    const userLoggedIn = state.user && state.user.loggedIn;

    let html = "";
    tabData.forEach((tab) => {
      let count = 0;
      let countText = "";
      if (tab.key === "playlists" && channels && channels.playlists) {
        count = (channels.playlists.tracks || []).length;
        if (count) countText = `<span class="tab-count">${count}</span>`;
      }
      if (tab.key === "singles" && channels && channels.singles) {
        count = (channels.singles.tracks || []).length;
        if (count) countText = `<span class="tab-count">${count}</span>`;
      }
      if (tab.key === "user" && channels && channels.user) {
        count = (channels.user.tracks || []).length;
        if (channels.user.loggedIn && count) countText = `<span class="tab-count">${count}</span>`;
        else if (!channels.user.loggedIn || !userLoggedIn) {
          countText = `<span class="tab-soon">需登录</span>`;
        }
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
    return "singles";
  }

  function renderRecommendations(task, state) {
    const results = task && task.status === "confirmed" ? task.results : [];
    const channels = (task && task.channels) || null;
    const profile = task && task.profile;
    const remoteLoading = task && task._remoteLoading;
    const remoteError = task && task._remoteError;
    const playlistObjs = channels ? (channels.playlists.playlists || []) : (task.playlists || []);

    const channel = state.activeChannel || "all";

    const totalTracks = results.length;
    const playlistTrackCount = channels ? (channels.playlists.tracks || []).length : results.filter(t => t._fromPlaylist).length;
    const userTrackCount = channels ? (channels.user.tracks || []).length : results.filter(t => t._fromLiked || t._fromUserPlaylist).length;
    const singleTrackCount = channels ? (channels.singles.tracks || []).length : results.filter(t => !t._fromPlaylist && !t._fromLiked && !t._fromUserPlaylist && t._source === "remote").length;

    els.playlistPill.textContent = totalTracks ? `Top ${totalTracks}` : "未生成";
    els.metricTracks.textContent = totalTracks ? `${singleTrackCount + playlistTrackCount + userTrackCount}首` : "0";
    els.metricFit.textContent = results[0] ? `${results[0].score}%` : "0%";
    els.metricBpm.textContent = profile ? `${profile.bpmTarget[0]}-${profile.bpmTarget[1]}` : "--";
    const feedbackBox = document.getElementById("feedbackBox");
    if (feedbackBox) feedbackBox.classList.toggle("hidden", !results.length);

    renderChannelTabs(task, state);

    if (!results.length && !playlistObjs.length) {
      els.resultList.innerHTML = `<div class="summary-empty">确认需求后，这里会出现候选曲目、平台来源、适用段落和匹配理由。</div>`;
      return;
    }

    let html = "";

    if (channel === "playlists") {
      if (playlistObjs.length > 0) {
        html += `<div class="section-title">🎵 精选歌单（${playlistObjs.length}个）</div>`;
        html += playlistObjs.map((pl) => renderPlaylistCard(pl)).join("");
        const playlistTracks = filterTracksByChannel(results, "playlists");
        if (playlistTracks.length > 0) {
          html += `<div class="section-title">🎵 来自歌单的曲目</div>`;
          html += playlistTracks.map((track, i) => renderTrackCard(track, i)).join("");
        }
      } else {
        html = `<div class="summary-empty">正在匹配精品歌单...</div>`;
      }
    } else if (channel === "singles") {
      const singleTracks = filterTracksByChannel(results, "singles");
      if (singleTracks.length > 0) {
        html += `<div class="section-title">🔍 单曲搜索结果（${singleTracks.length}首）</div>`;
        html += singleTracks.map((track, i) => renderTrackCard(track, i)).join("");
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
        const userTracks = filterTracksByChannel(results, "user");
        if (userTracks.length > 0) {
          html += `<div class="section-title">❤️ 来自你的收藏（${userTracks.length}首）</div>`;
          html += userTracks.map((track, i) => renderTrackCard(track, i)).join("");
        } else {
          html = `<div class="summary-empty">你的歌单中暂无匹配的曲目，试试不同的需求描述</div>`;
        }
      }
    } else if (channel === "ost") {
      html = `<div class="summary-empty">🎬 影视原声渠道即将上线</div>`;
    } else {
      const matchingUse = (profile && profile.uses && profile.uses[0]) || "general";
      const useConfig = global.AppFinder.FINDER_CONFIG[matchingUse] || global.AppFinder.FINDER_CONFIG.general;
      html += `<div class="section-title">${useConfig.icon} 推荐结果（共${totalTracks}首）</div>`;
      html += results.map((track, index) => renderTrackCard(track, index)).join("");
    }

    if (remoteLoading) {
      html += `<div class="remote-loading">🔍 ${useConfigLoading(profile)} ...</div>`;
    }
    if (remoteError && !results.some((t) => t._source === "remote")) {
      html += `<div class="remote-fallback">未连接到音乐搜索后端，当前显示本地精选曲库。启动后端服务后可获取真实平台音乐。<br><small>cd backend && npm start</small></div>`;
    }

    els.resultList.innerHTML = html;
  }

  function useConfigLoading(profile) {
    const uses = (profile && profile.uses) || ["general"];
    const agents = uses.map(u => {
      const cfg = global.AppFinder.FINDER_CONFIG[u];
      return cfg ? cfg.name : u;
    });
    return `${agents.join("、")}正在搜索 网易云音乐 / Apple Music / 精品歌单`;
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

  function renderTrackCard(track, index) {
    const isRemote = track._source === "remote";
    const fromPlaylist = track._fromPlaylist && track._playlistName;
    const fromLiked = track._fromLiked;
    const fromUserPl = track._fromUserPlaylist && track._playlistName;
    const hasAlbumCover = !!(track._albumCover || track.thumbnail);
    const hasStructure = track.structure && track.structure.length > 2;
    const hasVocal = track.vocal && track.vocal !== "unknown";
    const hasUrl = !!(track._url || track.url);
    const useTags = track._useTags || [];

    const channelIcon = getTrackChannel(track) === "user" ? "❤️"
      : getTrackChannel(track) === "playlists" ? "🎵"
      : "🔍";
    const platformBadge = isRemote
      ? `<span class="platform-badge remote">${channelIcon} ${escapeHtml(track.platforms[0] || "音乐平台")}</span>`
      : `<span class="platform-badge local">本地曲库</span>`;

    let sourceBadge = "";
    if (fromPlaylist) sourceBadge = `<span class="playlist-source-badge">🎵 ${escapeHtml(track._playlistName)}</span>`;
    else if (fromLiked) sourceBadge = `<span class="user-source-badge">❤️ 我喜欢的音乐</span>`;
    else if (fromUserPl) sourceBadge = `<span class="user-source-badge">📁 ${escapeHtml(track._playlistName)}</span>`;

    const coverHtml = hasAlbumCover
      ? `<img class="track-cover" src="${escapeHtml(track._albumCover || track.thumbnail)}" alt="" loading="lazy">`
      : "";

    const useTagsHtml = useTags.length > 0
      ? `<div class="use-tags">${useTags.map(t => `<span class="use-tag">${t.icon} ${escapeHtml(t.label)}</span>`).join("")}</div>`
      : "";

    let metaHtml = `<div class="meta-cell"><b>BPM</b><span>${track.bpm || "--"}</span></div>`;
    metaHtml += `<div class="meta-cell"><b>能量</b><span>${track.energy || "--"}/100</span></div>`;
    if (hasVocal) {
      metaHtml += `<div class="meta-cell"><b>人声</b><span>${vocalName(track.vocal)}</span></div>`;
    } else if (isRemote && track.duration) {
      const mins = Math.floor(track.duration / 60);
      const secs = Math.floor(track.duration % 60);
      metaHtml += `<div class="meta-cell"><b>时长</b><span>${mins}:${String(secs).padStart(2, "0")}</span></div>`;
    }

    let structureHtml = "";
    if (hasStructure && !isRemote) {
      structureHtml = `<p class="reason"><strong>剪辑结构：</strong>${escapeHtml(track.structure)}</p>`;
    }

    let platformLinksHtml = "";
    if (isRemote && track.platforms && track.platforms.length > 0) {
      platformLinksHtml = track.platforms.map((p) => {
        const url = track._url || track.url || "";
        if (url) {
          return `<a class="platform-link" href="${escapeHtml(url)}" target="_blank" rel="noopener">${escapeHtml(p)}</a>`;
        }
        return `<span class="platform">${escapeHtml(p)}</span>`;
      }).join("");
    } else {
      platformLinksHtml = (track.platforms || []).map((p) => `<span class="platform">${escapeHtml(p)}</span>`).join("");
    }

    let listenHtml = "";
    if (isRemote) {
      listenHtml = track._url || track.url
        ? `<a class="track-listen-link" href="${escapeHtml(track._url || track.url)}" target="_blank" rel="noopener">在 ${escapeHtml(track.platforms[0] || "音乐平台")} 上收听 →</a>`
        : `<span class="track-listen-text">${escapeHtml(track.download || "")}</span>`;
    } else {
      listenHtml = escapeHtml(track.download || "");
    }

    return `
      <article class="track-card ${isRemote ? "track-remote" : ""} ${fromPlaylist || fromLiked || fromUserPl ? "from-playlist" : ""}">
        <div class="track-head">
          ${coverHtml}
          <div class="track-head-info">
            <div class="track-head-top">
              <h4>${index + 1}. ${escapeHtml(track.title)}</h4>
              ${platformBadge}
            </div>
            ${sourceBadge}
            ${useTagsHtml}
            <p class="track-artist">${escapeHtml(track.artist)} · ${listenHtml}</p>
          </div>
          <div class="score">${track.score}%</div>
        </div>
        <div class="track-body">
          <div class="bar"><i style="width:${track.score}%"></i></div>
          <div class="track-meta">${metaHtml}</div>
          ${track.hook ? `<p class="reason hook">${escapeHtml(track.hook)}</p>` : ""}
          <p class="reason"><strong>推荐依据：</strong>${escapeHtml((track.reasons || []).join("；"))}。</p>
          ${structureHtml}
          <div class="platforms">${platformLinksHtml}</div>
        </div>
      </article>
    `;
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
    getElements: () => els
  };
})(window);
