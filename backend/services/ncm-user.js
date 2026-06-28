const NeteaseCloudMusicApi = require("NeteaseCloudMusicApi");

let userCookie = null;
let userProfile = null;
const REQ_TIMEOUT = 8000;

function withTimeout(promise, ms, label) {
  return Promise.race([
    promise,
    new Promise((_, reject) =>
      setTimeout(() => reject(new Error(`${label} 超时(${ms}ms)`)), ms)
    )
  ]);
}

function setUserCookie(cookie) {
  if (cookie && typeof cookie === "string" && cookie.trim().length > 10) {
    userCookie = cookie.trim();
    return true;
  }
  userCookie = null;
  userProfile = null;
  return false;
}

function getUserCookie() {
  return userCookie;
}

function isLoggedIn() {
  return Boolean(userCookie);
}

function getUserProfile() {
  return userProfile;
}

async function loginWithCookie(cookie) {
  setUserCookie(cookie);
  if (!userCookie) return { success: false, message: "cookie无效" };
  try {
    const result = await withTimeout(
      NeteaseCloudMusicApi.login_status({ cookie: userCookie, timeout: REQ_TIMEOUT }),
      REQ_TIMEOUT,
      "login_status"
    );
    if (result && result.body && result.body.profile) {
      userProfile = {
        userId: result.body.profile.userId,
        nickname: result.body.profile.nickname,
        avatarUrl: (result.body.profile.avatarUrl || "").replace(/^http:\/\//, "https://"),
        signature: result.body.profile.signature || ""
      };
      return { success: true, profile: userProfile };
    }
    userCookie = null;
    return { success: false, message: "cookie已失效，请重新登录" };
  } catch (err) {
    userCookie = null;
    return { success: false, message: err.message };
  }
}

async function fetchUserPlaylists(limit = 30) {
  if (!userCookie || !userProfile) return [];
  try {
    const result = await withTimeout(
      NeteaseCloudMusicApi.user_playlist({
        uid: userProfile.userId,
        limit: limit,
        offset: 0,
        cookie: userCookie,
        timeout: REQ_TIMEOUT
      }),
      REQ_TIMEOUT,
      "user_playlist"
    );
    if (!result || !result.body || result.body.code !== 200) return [];
    const playlists = result.body.playlist || [];
    return playlists.map((pl) => ({
      id: String(pl.id),
      name: pl.name || "未知歌单",
      cover: (pl.coverImgUrl || "").replace(/^http:\/\//, "https://"),
      trackCount: pl.trackCount || 0,
      playCount: pl.playCount || 0,
      subscribedCount: pl.subscribedCount || 0,
      creator: pl.creator ? pl.creator.nickname : userProfile.nickname,
      isCreated: pl.creator && pl.creator.userId === userProfile.userId,
      isSubscribed: Boolean(pl.subscribed),
      url: `https://music.163.com/#/playlist?id=${pl.id}`
    }));
  } catch (err) {
    console.warn("[ncm-user] 获取用户歌单失败:", err.message);
    return [];
  }
}

async function fetchPlaylistTracks(playlistId, playlistName, limit = 10) {
  if (!userCookie) return [];
  try {
    const result = await withTimeout(
      NeteaseCloudMusicApi.playlist_track_all({
        id: playlistId,
        limit: limit,
        offset: 0,
        cookie: userCookie,
        timeout: REQ_TIMEOUT
      }),
      REQ_TIMEOUT + 2000,
      `用户歌单曲目[${playlistName}]`
    );
    if (!result || !result.body || result.body.code !== 200) return [];
    const songs = result.body.songs || [];
    return songs.map((song) => {
      const artists = Array.isArray(song.ar) ? song.ar : [];
      const artistNames = artists.map((a) => a.name).filter(Boolean).join(" / ");
      const album = song.al || {};
      return {
        source: "netease-user",
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
    console.warn(`[ncm-user] 获取歌单"${playlistName}"曲目失败:`, err.message);
    return [];
  }
}

async function fetchUserLikedTracks(limit = 20) {
  if (!userCookie || !userProfile) return [];
  try {
    const result = await withTimeout(
      NeteaseCloudMusicApi.likelist({
        uid: userProfile.userId,
        cookie: userCookie,
        timeout: REQ_TIMEOUT
      }),
      REQ_TIMEOUT,
      "likelist"
    );
    if (!result || !result.body || result.body.code !== 200) return [];
    const ids = (result.body.ids || []).slice(0, limit);
    if (!ids.length) return [];
    const detailResult = await withTimeout(
      NeteaseCloudMusicApi.song_detail({
        ids: ids.join(","),
        cookie: userCookie,
        timeout: REQ_TIMEOUT
      }),
      REQ_TIMEOUT,
      "song_detail(喜欢)"
    );
    if (!detailResult || !detailResult.body || detailResult.body.code !== 200) return [];
    const songs = detailResult.body.songs || [];
    return songs.map((song) => {
      const artists = Array.isArray(song.ar) ? song.ar : [];
      const artistNames = artists.map((a) => a.name).filter(Boolean).join(" / ");
      const album = song.al || {};
      return {
        source: "netease-user",
        id: String(song.id),
        title: song.name || "未知曲目",
        artist: artistNames || "未知艺人",
        album: album.name || "未知专辑",
        duration: song.dt ? Math.round(song.dt / 1000) : 0,
        albumCover: (album.picUrl || "").replace(/^http:\/\//, "https://"),
        url: song.id ? `https://music.163.com/#/song?id=${song.id}` : "",
        platforms: ["网易云音乐"],
        pop: song.pop || 0,
        _fromLiked: true
      };
    });
  } catch (err) {
    console.warn("[ncm-user] 获取喜欢的音乐失败:", err.message);
    return [];
  }
}

async function searchUserTracksForUse(profile, tracksPerPlaylist = 8) {
  if (!userCookie || !userProfile) {
    return { playlists: [], tracks: [], loggedIn: false };
  }

  const allPlaylists = await fetchUserPlaylists(20);
  if (!allPlaylists.length) {
    return { playlists: [], tracks: await fetchUserLikedTracks(tracksPerPlaylist), loggedIn: true };
  }

  const uses = profile.uses || ["general"];
  const scenes = profile.scenes || [];
  const moods = profile.moods || [];

  const keywords = [...uses, ...scenes, ...moods].join(" ");

  const matchedPlaylists = allPlaylists.filter((pl) => {
    const name = pl.name.toLowerCase();
    if (uses.includes("intro") && /intro|开场|氛围|环境|ambient|开头/.test(name)) return true;
    if (uses.includes("bgm") && /bgm|背景|纯音乐|轻音乐|lofi|工作|学习|chill/.test(name)) return true;
    if (uses.includes("transition") && /节奏|卡点|beat|转场|间奏|鼓点/.test(name)) return true;
    if (uses.includes("climax") && /高潮|燃|高能|epic|热血|副歌/.test(name)) return true;
    if (/配乐|bgm|vlog|视频|剪辑|音乐|歌单/.test(name)) return true;
    return false;
  });

  const playlistsToSearch = matchedPlaylists.length > 0 ? matchedPlaylists.slice(0, 3) : allPlaylists.slice(0, 2);

  const likedTracks = await fetchUserLikedTracks(tracksPerPlaylist);

  const trackTasks = playlistsToSearch.map((pl) =>
    fetchPlaylistTracks(pl.id, pl.name, tracksPerPlaylist)
  );
  const trackResults = await Promise.allSettled(trackTasks);

  const allTracks = [...likedTracks];
  playlistsToSearch.forEach((pl, i) => {
    const r = trackResults[i];
    const tracks = (r && r.status === "fulfilled" && Array.isArray(r.value)) ? r.value : [];
    tracks.forEach((t) => {
      allTracks.push({
        ...t,
        _fromUserPlaylist: true,
        _playlistName: pl.name,
        _playlistId: pl.id
      });
    });
  });

  return {
    playlists: playlistsToSearch,
    tracks: allTracks,
    loggedIn: true,
    profile: userProfile
  };
}

function logout() {
  userCookie = null;
  userProfile = null;
}

module.exports = {
  setUserCookie,
  getUserCookie,
  getUserProfile,
  isLoggedIn,
  loginWithCookie,
  fetchUserPlaylists,
  fetchPlaylistTracks,
  fetchUserLikedTracks,
  searchUserTracksForUse,
  logout
};
