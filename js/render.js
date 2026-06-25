(function (global) {
  const { feedbackPresets } = global.AppConfig;
  const { catalog } = global.AppData;
  const { nameOf } = global.AppProfile;

  const els = {};

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
    els.resultList = document.getElementById("resultList");
    els.feedbackChips = document.getElementById("feedbackChips");
    els.feedbackInput = document.getElementById("feedbackInput");
    els.applyFeedback = document.getElementById("applyFeedback");
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

  function vocalName(value) {
    const names = {
      instrumental: "纯器乐",
      "light-vocal": "轻人声",
      "vocal-chop": "人声切片"
    };
    return names[value] || value;
  }

  function renderModelStatus(model) {
    const configured = Boolean((els.apiKey.value || (model && model.apiKey) || "").trim());
    els.modelNote.textContent = configured ? "已保存模型配置；接口失败会自动回退。" : "未配置或调用失败时自动使用本地规划模拟。";
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
    els.taskSubtitle.textContent = task.status === "confirmed"
      ? "需求已确认，歌单可继续按反馈重排。"
      : task.status === "summary_ready"
        ? "规划 AI 已生成总结，可以修改后确认。"
        : "先把模糊想法交给规划 AI，它会逐轮补全需求。";
    els.statusPill.textContent = statusText(task.status);
    els.statusPill.className = `pill ${task.status === "summary_ready" ? "warn" : task.status === "confirmed" ? "live" : ""}`;
    els.plannerSource.textContent = task.plannerSource || "本地模拟待命";
  }

  function renderAgentStatus(task) {
    const steps = [
      ["规划 AI", task && ["questioning", "summary_ready", "confirmed"].includes(task.status)],
      ["需求确认", task && ["summary_ready", "confirmed"].includes(task.status)],
      ["音乐寻找", task && task.status === "confirmed"],
      ["音乐分析", task && task.status === "confirmed"]
    ];
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

  function renderRecommendations(task) {
    const results = task && task.status === "confirmed" ? task.results : [];
    const profile = task && task.profile;
    const remoteLoading = task && task._remoteLoading;
    const remoteError = task && task._remoteError;
    const hasRemote = results.some((t) => t._source === "remote");

    els.playlistPill.textContent = results.length ? `Top ${results.length}` : "未生成";
    els.metricTracks.textContent = results.length ? (hasRemote ? "多平台" : catalog.length) : "0";
    els.metricFit.textContent = results[0] ? `${results[0].score}%` : "0%";
    els.metricBpm.textContent = profile ? `${profile.bpmTarget[0]}-${profile.bpmTarget[1]}` : "--";
    const feedbackBox = document.getElementById("feedbackBox");
    if (feedbackBox) feedbackBox.classList.toggle("hidden", !results.length);
    if (!results.length) {
      els.resultList.innerHTML = `<div class="summary-empty">确认需求后，这里会出现候选曲目、平台来源和匹配理由。</div>`;
      return;
    }

    let html = results.map((track, index) => renderTrackCard(track, index)).join("");

    // 远程搜索加载中提示
    if (remoteLoading) {
      html += `<div class="remote-loading">正在搜索 网易云音乐 / Apple Music / QQ音乐 ...</div>`;
    }
    // 远程搜索失败提示
    if (remoteError && !hasRemote) {
      html += `<div class="remote-fallback">未连接到音乐搜索后端，当前显示本地精选曲库。启动后端服务后可获取真实平台音乐。<br><small>cd backend && npm start</small></div>`;
    }

    els.resultList.innerHTML = html;
  }

  function renderTrackCard(track, index) {
    const isRemote = track._source === "remote";
    const hasAlbumCover = !!(track._albumCover || track.thumbnail);
    const hasStructure = track.structure && track.structure.length > 2;
    const hasVocal = track.vocal && track.vocal !== "unknown";
    const hasUrl = !!(track._url || track.url);

    // 平台徽章
    const platformBadge = isRemote
      ? `<span class="platform-badge remote">${escapeHtml(track.platforms[0] || "音乐平台")}</span>`
      : `<span class="platform-badge local">本地曲库</span>`;

    // 专辑封面
    const coverHtml = hasAlbumCover
      ? `<img class="track-cover" src="${escapeHtml(track._albumCover || track.thumbnail)}" alt="" loading="lazy">`
      : "";

    // 元数据行
    let metaHtml = `<div class="meta-cell"><b>BPM</b><span>${track.bpm || "--"}</span></div>`;
    metaHtml += `<div class="meta-cell"><b>能量</b><span>${track.energy || "--"}/100</span></div>`;
    if (hasVocal) {
      metaHtml += `<div class="meta-cell"><b>人声</b><span>${vocalName(track.vocal)}</span></div>`;
    } else if (isRemote && track.duration) {
      const mins = Math.floor(track.duration / 60);
      const secs = Math.floor(track.duration % 60);
      metaHtml += `<div class="meta-cell"><b>时长</b><span>${mins}:${String(secs).padStart(2, "0")}</span></div>`;
    }

    // 结构/剪辑提示
    let structureHtml = "";
    if (hasStructure && !isRemote) {
      structureHtml = `<p class="reason"><strong>剪辑结构：</strong>${escapeHtml(track.structure)}</p>`;
    }

    // 平台链接
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

    // 下载/来源信息
    let downloadHtml = "";
    if (isRemote) {
      downloadHtml = track._url
        ? `<a class="track-listen-link" href="${escapeHtml(track._url)}" target="_blank" rel="noopener">在 ${escapeHtml(track.platforms[0] || "音乐平台")} 上收听 →</a>`
        : `<span class="track-listen-text">${escapeHtml(track.download)}</span>`;
    } else {
      downloadHtml = escapeHtml(track.download);
    }

    return `
      <article class="track-card ${isRemote ? "track-remote" : ""}">
        <div class="track-head">
          ${coverHtml}
          <div class="track-head-info">
            <div class="track-head-top">
              <h4>${index + 1}. ${escapeHtml(track.title)}</h4>
              ${platformBadge}
            </div>
            <p>${escapeHtml(track.artist)} · ${downloadHtml}</p>
          </div>
          <div class="score">${track.score}%</div>
        </div>
        <div class="track-body">
          <div class="bar"><i style="width:${track.score}%"></i></div>
          <div class="track-meta">${metaHtml}</div>
          <p class="reason">${escapeHtml(track.hook)}</p>
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
      button.disabled = isBusy || button.disabled;
    });
    if (!isBusy) {
      const task = state.tasks.find((t) => t.id === state.activeId);
      els.sendMessage.disabled = false;
      els.forceSummary.disabled = false;
      els.confirmSummary.disabled = !(task && (task.summary || task.confirmedSummary));
      els.rewriteSummary.disabled = !(task && task.status !== "confirmed");
      els.applyFeedback.disabled = !(task && task.status === "confirmed");
    }
    els.chatInput.disabled = isBusy;
    els.composerHint.textContent = isBusy ? "规划 AI 正在处理..." : "Ctrl / Cmd + Enter 可快速发送。";
  }

  function renderAll(state) {
    const task = state.tasks.find((t) => t.id === state.activeId);
    renderModelStatus(state.model);
    renderTaskList(state);
    renderHeader(task);
    renderAgentStatus(task);
    renderMessages(task, state.busy);
    renderSummary(task, state.busy);
    renderRecommendations(task);
    renderBusy(state.busy, state);
  }

  global.AppRender = {
    initElementReferences,
    renderAll,
    renderModelStatus,
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
