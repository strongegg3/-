/**
 * YouTube Data API v3 搜索
 * 需要 API Key: https://console.cloud.google.com/apis/credentials
 */
let googleModule = null;

function getGoogle() {
  if (!googleModule) {
    try {
      googleModule = require("googleapis").google;
    } catch {
      googleModule = null;
    }
  }
  return googleModule;
}

async function searchYouTube(keyword, limit = 10, apiKey = "") {
  const google = getGoogle();
  if (!google || !apiKey) {
    console.warn("[youtube] googleapis 未安装或 API Key 未配置");
    return [];
  }
  try {
    const youtube = google.youtube({ version: "v3", auth: apiKey });
    const res = await youtube.search.list({
      part: ["snippet"],
      q: keyword,
      type: ["video"],
      maxResults: Math.min(limit, 50),
      videoCategoryId: "10", // Music category
      relevanceLanguage: "zh"
    });
    const items = res.data.items || [];
    // 获取视频时长信息
    const videoIds = items.map((i) => i.id.videoId).join(",");
    let durationMap = {};
    if (videoIds) {
      const detailRes = await youtube.videos.list({
        part: ["contentDetails"],
        id: videoIds
      });
      (detailRes.data.items || []).forEach((v) => {
        durationMap[v.id] = parseDuration(v.contentDetails.duration);
      });
    }
    return items.map((item) => {
      const vid = item.id.videoId;
      const snippet = item.snippet;
      return {
        source: "youtube",
        id: vid,
        title: snippet.title,
        artist: snippet.channelTitle,
        album: "",
        duration: durationMap[vid] || 0,
        platforms: ["YouTube"],
        url: `https://www.youtube.com/watch?v=${vid}`,
        thumbnail: snippet.thumbnails && snippet.thumbnails.default
          ? snippet.thumbnails.default.url
          : "",
        description: snippet.description
      };
    });
  } catch (err) {
    console.warn("[youtube] 搜索失败:", err.message);
    return [];
  }
}

/**
 * 解析 ISO 8601 duration 为秒数
 */
function parseDuration(duration) {
  const match = duration.match(/PT(\d+H)?(\d+M)?(\d+S)?/);
  if (!match) return 0;
  const hours = parseInt(match[1] || "0", 10);
  const minutes = parseInt(match[2] || "0", 10);
  const seconds = parseInt(match[3] || "0", 10);
  return hours * 3600 + minutes * 60 + seconds;
}

module.exports = { searchYouTube };