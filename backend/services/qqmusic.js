const fetch = require("node-fetch");

async function searchQQMusic(keyword, limit = 10) {
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 6000);
    const url = `https://i.y.qq.com/s.music/fcgi-bin/search_for_qq_cp?format=json&p=1&n=${limit}&w=${encodeURIComponent(keyword)}`;
    const res = await fetch(url, {
      signal: controller.signal,
      headers: {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
        "Referer": "https://y.qq.com/"
      }
    });
    clearTimeout(timeout);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();
    if (data.code === 0 && data.data && data.data.song && data.data.song.list) {
      return data.data.song.list.map((song) => {
        const albumMid = song.albummid || "";
        const coverUrl = albumMid
          ? `https://y.gtimg.cn/music/photo_new/T002R300x300M000${albumMid}.jpg`
          : null;
        return {
          source: "qqmusic",
          id: String(song.songmid || song.songid),
          title: song.songname || "",
          artist: (song.singer || []).map((s) => s.name).join(" / "),
          album: song.albumname || "",
          duration: song.interval || 0,
          platforms: ["QQ音乐"],
          url: `https://y.qq.com/n/ryqq/songDetail/${song.songmid || song.songid}`,
          albumCover: coverUrl
        };
      });
    }
    return [];
  } catch (err) {
    console.warn("[qqmusic] 搜索失败:", err.message);
    return [];
  }
}

module.exports = { searchQQMusic };
