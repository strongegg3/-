const NeteaseCloudMusicApi = require("NeteaseCloudMusicApi");

const REQ_TIMEOUT = 6000;

const OST_CATEGORIES = [
  { cat: "影视原声", keywords: ["影视", "电影", "ost", "原声", "配乐"] },
  { cat: "ACG", keywords: ["acg", "动漫", "动画", "游戏", "galgame", "二次元"] },
  { cat: "欧美影视", keywords: ["美剧", "好莱坞", "电影原声", "score"] }
];

const USE_TO_OST = {
  intro: ["影视原声", "ACG"],
  bgm: ["影视原声", "ACG"],
  transition: ["ACG"],
  climax: ["影视原声", "欧美影视"],
  ending: ["影视原声", "ACG"],
  general: ["影视原声", "ACG"]
};

function withTimeout(promise, ms, label) {
  return Promise.race([
    promise,
    new Promise((_, reject) =>
      setTimeout(() => reject(new Error(`${label} 超时(${ms}ms)`)), ms)
    )
  ]);
}

async function fetchOstPlaylists(cat, limit = 2) {
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
      `OST分类[${cat}]`
    );

    if (!result || !result.body || result.body.code !== 200) {
      return [];
    }

    const playlists = result.body.playlists || [];
    return playlists.map((pl) => ({
      id: String(pl.id),
      name: pl.name || "未知歌单",
      cover: (pl.coverImgUrl || "").replace(/^http:\/\//, "https://"),
      trackCount: pl.trackCount || 0,
      playCount: pl.playCount || 0,
      creator: pl.creator ? pl.creator.nickname : "未知",
      cat: cat,
      url: `https://music.163.com/#/playlist?id=${pl.id}`
    }));
  } catch (err) {
    console.warn(`[ncm-ost] 获取"${cat}"歌单失败:`, err.message);
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
      REQ_TIMEOUT + 2000,
      `OST歌单[${playlistName}]`
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
        source: "netease-ost",
        id: String(song.id),
        title: song.name || "未知曲目",
        artist: artistNames || "未知艺人",
        album: album.name || "未知专辑",
        duration: song.dt ? Math.round(song.dt / 1000) : 0,
        albumCover: (album.picUrl || "").replace(/^http:\/\//, "https://"),
        url: song.id ? `https://music.163.com/#/song?id=${song.id}` : "",
        platforms: ["网易云音乐"],
        pop: song.pop || 0,
        _fromOst: true,
        channel: "ost"
      };
    });
  } catch (err) {
    console.warn(`[ncm-ost] 获取歌单"${playlistName}"曲目失败:`, err.message);
    return [];
  }
}

async function fetchOstTracks(profile, tracksPerPlaylist = 4) {
  const uses = profile.uses || ["general"];
  const catsToSearch = new Set();
  uses.forEach((u) => {
    const cats = USE_TO_OST[u];
    if (cats) cats.forEach((c) => catsToSearch.add(c));
  });

  if (profile.genres) {
    profile.genres.forEach((g) => {
      const lower = g.toLowerCase();
      if (lower.includes("ost") || lower.includes("原声") || lower.includes("影视") || lower.includes("acg") || lower.includes("动漫")) {
        catsToSearch.add("影视原声");
        catsToSearch.add("ACG");
      }
    });
  }

  if (catsToSearch.size === 0) {
    catsToSearch.add("影视原声");
  }

  const cats = Array.from(catsToSearch).slice(0, 2);

  const playlistTasks = cats.map((cat) => fetchOstPlaylists(cat, 2));
  const playlistResults = await Promise.allSettled(playlistTasks);

  const allPlaylists = [];
  const seenIds = new Set();
  playlistResults.forEach((r) => {
    if (r.status === "fulfilled" && Array.isArray(r.value)) {
      r.value.forEach((pl) => {
        if (!seenIds.has(pl.id)) {
          seenIds.add(pl.id);
          allPlaylists.push(pl);
        }
      });
    }
  });

  const topPlaylists = allPlaylists.slice(0, 3);

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
        _playlistName: pl.name,
        _playlistId: pl.id
      });
    });
  });

  return {
    playlists: topPlaylists,
    tracks: allTracks
  };
}

module.exports = {
  fetchOstTracks
};
