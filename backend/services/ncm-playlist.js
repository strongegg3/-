const NeteaseCloudMusicApi = require("NeteaseCloudMusicApi");

const TAG_TO_CAT = {
  "city": "夜晚", "城市": "夜晚", "夜景": "夜晚", "城市夜景": "夜晚", "night": "夜晚",
  "学习": "学习", "work": "工作", "工作": "工作",
  "travel": "旅行", "旅行": "旅行", "散步": "散步", "驾车": "驾车", "通勤": "地铁", "地铁": "地铁",
  "cafe": "下午茶", "food": "下午茶", "咖啡": "下午茶", "下午茶": "下午茶", "午休": "午休",
  "fitness": "运动", "运动": "运动", "健身": "运动", "sports": "运动",
  "治愈": "治愈", "warm": "治愈", "温暖": "治愈",
  "relax": "放松", "放松": "放松", "chill": "放松",
  "lonely": "孤独", "孤独": "孤独",
  "伤感": "伤感", "悲伤": "伤感", "sad": "伤感",
  "安静": "安静", "平静": "安静", "calm": "安静",
  "soft": "轻音乐", "浪漫": "浪漫",
  "快乐": "快乐", "欢快": "快乐", "happy": "快乐", "playful": "快乐",
  "怀旧": "怀旧", "nostalgic": "怀旧", "清新": "清新", "感动": "感动",
  "兴奋": "兴奋", "燃": "兴奋", "energetic": "兴奋", "beat": "运动",
  "思念": "思念",
  "轻音乐": "轻音乐", "lofi": "轻音乐", "ambient": "轻音乐",
  "钢琴": "钢琴", "piano": "钢琴",
  "古典": "古典", "classical": "古典",
  "爵士": "爵士", "jazz": "爵士",
  "电子": "电子", "electronic": "电子",
  "古风": "古风", "民谣": "民谣", "folk": "民谣", "acoustic": "民谣",
  "摇滚": "摇滚", "rock": "摇滚",
  "器乐": "器乐", "instrumental": "器乐",
  "ACG": "ACG", "影视原声": "影视原声",
  "说唱": "说唱", "hip-hop": "说唱", "rap": "说唱",
  "清晨": "清晨", "夜晚": "夜晚", "酒吧": "酒吧", "校园": "校园",
  "graduation": "校园", "pop": "流行", "流行": "流行", "indie": "轻音乐"
};

const USE_TO_CATS = {
  intro: ["轻音乐", "安静", "夜晚", "钢琴", "环境音", "氛围"],
  bgm: ["轻音乐", "学习", "工作", "放松", "治愈", "安静"],
  transition: ["运动", "电子", "兴奋", "摇滚"],
  climax: ["兴奋", "摇滚", "电子", "燃", "史诗"],
  ending: ["安静", "钢琴", "伤感", "治愈", "轻音乐"],
  general: ["轻音乐", "治愈", "放松"]
};

const USE_KEYWORDS = {
  intro: "intro 氛围 环境音 开场 ambient",
  bgm: "bgm 背景音乐 纯音乐 轻音乐 lofi",
  transition: "间奏 纯音乐 节奏 beat instrumental",
  climax: "副歌 高能 燃 epic 高潮",
  ending: "outro 结尾 钢琴 渐弱 收尾",
  general: "vlog 配乐 背景音乐"
};

const CAT_PRIORITY = [
  "治愈", "轻音乐", "学习", "安静", "夜晚", "旅行", "放松",
  "钢琴", "孤独", "伤感", "工作", "散步", "运动", "驾车",
  "电子", "古风", "民谣", "爵士", "摇滚", "古典", "兴奋"
];

const REQ_TIMEOUT = 6000;

function mapProfileToCats(profile) {
  const cats = new Set();
  const scenes = profile.scenes || [];
  const moods = profile.moods || [];
  const genres = profile.genres || [];
  const uses = profile.uses || ["general"];
  const allTags = [...scenes, ...moods, ...genres];

  uses.forEach((use) => {
    const useCats = USE_TO_CATS[use];
    if (useCats) useCats.forEach((c) => cats.add(c));
  });

  allTags.forEach((tag) => {
    const cat = TAG_TO_CAT[tag];
    if (cat) cats.add(cat);
  });

  if (profile.wantsSoft) cats.add("轻音乐");
  if (profile.wantsSad) cats.add("伤感");
  if (profile.wantsEnergy || profile.wantsBeat) cats.add("兴奋");

  if (cats.size === 0) {
    cats.add("轻音乐");
    cats.add("治愈");
  }

  const ordered = [...cats].sort((a, b) => {
    const ai = CAT_PRIORITY.indexOf(a);
    const bi = CAT_PRIORITY.indexOf(b);
    return (ai === -1 ? 99 : ai) - (bi === -1 ? 99 : bi);
  });

  return ordered.slice(0, 4);
}

function getSearchKeywords(profile) {
  const uses = profile.uses || ["general"];
  const useKw = uses.map((u) => USE_KEYWORDS[u] || USE_KEYWORDS.general).join(" ");
  const sceneKw = (profile.scenes || []).map((s) => TAG_TO_CAT[s] || s).join(" ");
  return `${useKw} ${sceneKw}`.trim();
}

function withTimeout(promise, ms, label) {
  return Promise.race([
    promise,
    new Promise((_, reject) =>
      setTimeout(() => reject(new Error(`${label} 超时(${ms}ms)`)), ms)
    )
  ]);
}

async function fetchPlaylistsByCat(cat, limit = 2) {
  try {
    const result = await withTimeout(
      NeteaseCloudMusicApi.top_playlist({
        cat: cat,
        order: "hot",
        limit: limit,
        offset: 0,
        timeout: REQ_TIMEOUT
      }),
      REQ_TIMEOUT + 1000,
      `歌单分类[${cat}]`
    );

    if (!result || !result.body || result.body.code !== 200) {
      console.warn(`[ncm-playlist] 获取"${cat}"分类歌单失败:`, result?.body?.code);
      return [];
    }

    const playlists = result.body.playlists || [];
    return playlists.map((pl) => ({
      id: String(pl.id),
      name: pl.name || "未知歌单",
      cover: (pl.coverImgUrl || "").replace(/^http:\/\//, "https://"),
      trackCount: pl.trackCount || 0,
      playCount: pl.playCount || 0,
      subscribedCount: pl.subscribedCount || 0,
      creator: pl.creator ? pl.creator.nickname : "未知",
      cat: cat,
      tags: pl.tags || [],
      description: (pl.description || "").slice(0, 80),
      url: `https://music.163.com/#/playlist?id=${pl.id}`
    }));
  } catch (err) {
    console.warn(`[ncm-playlist] 获取"${cat}"歌单异常:`, err.message);
    return [];
  }
}

async function fetchPlaylistTracks(playlistId, playlistName, limit = 5) {
  try {
    const result = await withTimeout(
      NeteaseCloudMusicApi.playlist_track_all({
        id: playlistId,
        limit: limit,
        offset: 0,
        timeout: REQ_TIMEOUT
      }),
      REQ_TIMEOUT + 1000,
      `歌单曲目[${playlistName}]`
    );

    if (!result || !result.body || result.body.code !== 200) {
      return [];
    }

    const songs = result.body.songs || [];
    return songs.map((song) => {
      const artists = Array.isArray(song.ar) ? song.ar : [];
      const artistNames = artists.map((a) => a.name).filter(Boolean).join(" / ");
      const album = song.al || {};

      return {
        source: "netease",
        id: String(song.id),
        title: song.name || "未知曲目",
        artist: artistNames || "未知艺人",
        album: album.name || "未知专辑",
        duration: song.dt ? Math.round(song.dt / 1000) : 0,
        albumCover: (album.picUrl || "").replace(/^http:\/\//, "https://"),
        url: song.id ? `https://music.163.com/#/song?id=${song.id}` : "",
        platforms: ["网易云音乐"],
        pop: song.pop || 0
      };
    });
  } catch (err) {
    console.warn(`[ncm-playlist] 获取歌单"${playlistName}"曲目异常:`, err.message);
    return [];
  }
}

async function fetchPremiumPlaylists(profile, tracksPerPlaylist = 5) {
  const cats = mapProfileToCats(profile);

  console.log(`[ncm-playlist] 匹配分类: ${cats.join(", ")} (用途: ${(profile.uses || []).join("/")})`);

  const playlistTasks = cats.map((cat) => fetchPlaylistsByCat(cat, 2));
  const playlistResults = await Promise.allSettled(playlistTasks);

  const allPlaylists = [];
  const seenPlaylistIds = new Set();
  playlistResults.forEach((r) => {
    if (r.status === "fulfilled" && Array.isArray(r.value)) {
      r.value.forEach((pl) => {
        if (!seenPlaylistIds.has(pl.id)) {
          seenPlaylistIds.add(pl.id);
          allPlaylists.push(pl);
        }
      });
    }
  });

  if (allPlaylists.length === 0) {
    return { playlists: [], tracks: [] };
  }

  const topPlaylists = allPlaylists.slice(0, 5);

  const trackTasks = topPlaylists.map((pl) =>
    fetchPlaylistTracks(pl.id, pl.name, tracksPerPlaylist)
  );
  const trackResults = await Promise.allSettled(trackTasks);

  const allTracks = [];
  topPlaylists.forEach((pl, i) => {
    const r = trackResults[i];
    const tracks = (r && r.status === "fulfilled" && Array.isArray(r.value)) ? r.value : [];
    tracks.forEach((t) => {
      allTracks.push({
        ...t,
        _fromPlaylist: true,
        _playlistName: pl.name,
        _playlistId: pl.id,
        _playlistCat: pl.cat
      });
    });
  });

  return {
    playlists: topPlaylists,
    tracks: allTracks,
    keywords: getSearchKeywords(profile)
  };
}

module.exports = {
  fetchPremiumPlaylists,
  mapProfileToCats,
  getSearchKeywords,
  TAG_TO_CAT,
  USE_TO_CATS,
  USE_KEYWORDS
};
