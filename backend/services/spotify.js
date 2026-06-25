const fetch = require("node-fetch");

let accessToken = null;
let tokenExpiresAt = 0;

/**
 * Spotify Web API 搜索
 * 需要 Client ID / Client Secret: https://developer.spotify.com/dashboard
 */
async function getSpotifyToken(clientId, clientSecret) {
  if (accessToken && Date.now() < tokenExpiresAt - 60000) {
    return accessToken;
  }
  try {
    const auth = Buffer.from(`${clientId}:${clientSecret}`).toString("base64");
    const res = await fetch("https://accounts.spotify.com/api/token", {
      method: "POST",
      headers: {
        "Authorization": `Basic ${auth}`,
        "Content-Type": "application/x-www-form-urlencoded"
      },
      body: "grant_type=client_credentials"
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();
    accessToken = data.access_token;
    tokenExpiresAt = Date.now() + (data.expires_in || 3600) * 1000;
    return accessToken;
  } catch (err) {
    console.warn("[spotify] 获取 token 失败:", err.message);
    return null;
  }
}

async function searchSpotify(keyword, limit = 10, clientId = "", clientSecret = "") {
  if (!clientId || !clientSecret) {
    console.warn("[spotify] Client ID / Secret 未配置");
    return [];
  }
  try {
    const token = await getSpotifyToken(clientId, clientSecret);
    if (!token) return [];
    const url = `https://api.spotify.com/v1/search?q=${encodeURIComponent(keyword)}&type=track&limit=${limit}&market=CN`;
    const res = await fetch(url, {
      headers: { "Authorization": `Bearer ${token}` }
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();
    if (!data.tracks || !data.tracks.items) return [];
    return data.tracks.items.map((track) => ({
      source: "spotify",
      id: track.id,
      title: track.name,
      artist: (track.artists || []).map((a) => a.name).join(" / "),
      album: (track.album || {}).name || "",
      duration: (track.duration_ms || 0) / 1000,
      platforms: ["Spotify"],
      url: track.external_urls ? track.external_urls.spotify : `https://open.spotify.com/track/${track.id}`,
      previewUrl: track.preview_url || null,
      albumCover: track.album && track.album.images && track.album.images[0]
        ? track.album.images[0].url
        : ""
    }));
  } catch (err) {
    console.warn("[spotify] 搜索失败:", err.message);
    return [];
  }
}

module.exports = { searchSpotify };