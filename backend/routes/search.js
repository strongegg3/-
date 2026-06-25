const express = require("express");
const { searchNCM } = require("../services/ncm");
const { searchITunes } = require("../services/itunes");
const { searchQQMusic } = require("../services/qqmusic");
const { searchYouTube } = require("../services/youtube");
const { searchSpotify } = require("../services/spotify");
const { normalizeTrack } = require("../utils/normalize");

const router = express.Router();

function isRealKey(val) {
  if (!val) return false;
  const lower = val.toLowerCase().trim();
  if (lower.startsWith("your_")) return false;
  if (lower.includes("xxx")) return false;
  if (lower.length < 5) return false;
  return true;
}

function withTimeout(promise, ms, label) {
  return Promise.race([
    promise,
    new Promise((resolve) => setTimeout(() => {
      console.warn(`[search] ${label} 超时`);
      resolve([]);
    }, ms))
  ]).catch((err) => {
    console.warn(`[search] ${label} 失败:`, err.message);
    return [];
  });
}

router.post("/", async (req, res) => {
  const { keyword, limit = 8, profile } = req.body;

  if (!keyword || !keyword.trim()) {
    return res.status(400).json({ error: "keyword 不能为空" });
  }

  const trimmedKeyword = keyword.trim();
  const searchLimit = Math.min(Number(limit) || 8, 8);

  const ytKey = process.env.YOUTUBE_API_KEY || "";
  const spotId = process.env.SPOTIFY_CLIENT_ID || "";
  const spotSecret = process.env.SPOTIFY_CLIENT_SECRET || "";

  const searchTasks = [
    withTimeout(searchNCM(trimmedKeyword, searchLimit), 12000, "ncm(网易云)"),
    withTimeout(searchITunes(trimmedKeyword, searchLimit), 8000, "itunes(Apple)"),
    withTimeout(searchQQMusic(trimmedKeyword, searchLimit), 8000, "qqmusic")
  ];
  const taskLabels = ["netease", "itunes", "qqmusic"];

  if (isRealKey(ytKey)) {
    searchTasks.push(withTimeout(searchYouTube(trimmedKeyword, limit, ytKey), 6000, "youtube"));
    taskLabels.push("youtube");
  }
  if (isRealKey(spotId) && isRealKey(spotSecret)) {
    searchTasks.push(withTimeout(searchSpotify(trimmedKeyword, limit, spotId, spotSecret), 6000, "spotify"));
    taskLabels.push("spotify");
  }

  const results = await Promise.all(searchTasks);

  const sourceCounts = {};
  const allRawTracks = [];
  results.forEach((tracks, i) => {
    const label = taskLabels[i];
    sourceCounts[label] = tracks.length;
    allRawTracks.push(...tracks);
  });

  const allTracks = allRawTracks.map((r) => normalizeTrack(r, profile));

  const deduplicated = deduplicate(allTracks);

  deduplicated.sort((a, b) => (b.heat || 0) - (a.heat || 0));

  const top = deduplicated.slice(0, limit);

  res.json({
    keyword: trimmedKeyword,
    total: top.length,
    sources: sourceCounts,
    tracks: top
  });
});

function deduplicate(tracks) {
  const seen = new Set();
  return tracks.filter((t) => {
    const key = `${t.title}||${t.artist}`.toLowerCase().trim();
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

module.exports = router;
