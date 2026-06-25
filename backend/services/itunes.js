const fetch = require("node-fetch");

async function searchITunes(keyword, limit = 10) {
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 6000);
    const url = `https://itunes.apple.com/search?term=${encodeURIComponent(keyword)}&media=music&limit=${limit}`;
    const res = await fetch(url, {
      signal: controller.signal,
      headers: { "User-Agent": "Mozilla/5.0" }
    });
    clearTimeout(timeout);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();
    if (!data.results || !Array.isArray(data.results)) return [];
    return data.results.map((t) => {
      let cover = t.artworkUrl100 || t.artworkUrl60 || null;
      if (cover) {
        cover = cover.replace(/\/\d+x\d+bb\.(jpg|png)/, "/300x300bb.$1");
      }
      return {
        source: "itunes",
        id: String(t.trackId),
        title: t.trackName || "",
        artist: t.artistName || "未知艺人",
        album: t.collectionName || "",
        duration: Math.round((t.trackTimeMillis || 0) / 1000),
        platforms: ["Apple Music"],
        url: t.trackViewUrl || null,
        previewUrl: t.previewUrl || null,
        albumCover: cover,
        genre: t.primaryGenreName || null
      };
    });
  } catch (err) {
    console.warn("[itunes] 搜索失败:", err.message);
    return [];
  }
}

module.exports = { searchITunes };
