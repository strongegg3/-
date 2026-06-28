const NeteaseCloudMusicApi = require("NeteaseCloudMusicApi");

async function searchNCM(keyword, limit = 10) {
  if (!keyword || !keyword.trim()) return [];
  const trimmedKeyword = keyword.trim();

  try {
    const result = await NeteaseCloudMusicApi.cloudsearch({
      keywords: trimmedKeyword,
      type: 1,
      limit: limit,
      offset: 0,
      timeout: 8000
    });

    if (!result || !result.body || result.body.code !== 200) {
      console.warn("[ncm] API 返回异常:", result?.body?.code);
      return [];
    }

    const data = result.body.result || {};
    const list = Array.isArray(data.songs) ? data.songs : [];
    if (!list.length) return [];

    return list.map((song) => {
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
        _raw: song
      };
    });
  } catch (err) {
    console.error("[ncm] 搜索失败:", err.message);
    return [];
  }
}

module.exports = { searchNCM };
