const express = require("express");
const { searchNCM } = require("../services/ncm");
const { searchITunes } = require("../services/itunes");
const { searchQQMusic } = require("../services/qqmusic");
const { searchYouTube } = require("../services/youtube");
const { searchSpotify } = require("../services/spotify");
const { normalizeTrack } = require("../utils/normalize");
const { fetchPremiumPlaylists, getSearchKeywords } = require("../services/ncm-playlist");
const { fetchOstTracks } = require("../services/ncm-ost");
const {
  loginWithCookie,
  isLoggedIn,
  searchUserTracksForUse,
  logout,
  fetchUserPlaylists
} = require("../services/ncm-user");

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

function withTimeoutObj(promise, ms, label) {
  return Promise.race([
    promise,
    new Promise((resolve) => setTimeout(() => {
      console.warn(`[search] ${label} 超时`);
      resolve({ playlists: [], tracks: [] });
    }, ms))
  ]).catch((err) => {
    console.warn(`[search] ${label} 失败:`, err.message);
    return { playlists: [], tracks: [] };
  });
}

function deduplicate(tracks) {
  const seen = new Set();
  return tracks.filter((t) => {
    const key = `${t.title}||${t.artist}`.toLowerCase().trim();
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

router.post("/", async (req, res) => {
  const { keyword, limit = 8, profile } = req.body;

  if (!keyword || !keyword.trim()) {
    return res.status(400).json({ error: "keyword 不能为空" });
  }

  const trimmedKeyword = keyword.trim();
  const searchLimit = Math.min(Math.max(Number(limit) || 8, 8), 15);

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

  const platformGroups = {};
  deduplicated.forEach((t) => {
    const p = t.platform || "unknown";
    if (!platformGroups[p]) platformGroups[p] = [];
    platformGroups[p].push(t);
  });

  Object.keys(platformGroups).forEach((p) => {
    platformGroups[p].sort((a, b) => (b.heat || 0) - (a.heat || 0));
  });

  const platformPriority = ["itunes", "netease", "qqmusic", "spotify", "youtube"];
  const interleaved = [];
  const seen = new Set();
  let added = true;
  let round = 0;
  while (added && interleaved.length < Math.max(searchLimit, 15)) {
    added = false;
    for (const p of platformPriority) {
      const bucket = platformGroups[p];
      if (bucket && round < bucket.length) {
        const track = bucket[round];
        const key = `${track.title}||${track.artist}`.toLowerCase().trim();
        if (!seen.has(key)) {
          seen.add(key);
          interleaved.push(track);
          added = true;
          if (interleaved.length >= Math.max(searchLimit, 15)) break;
        }
      }
    }
    round++;
  }

  res.json({
    keyword: trimmedKeyword,
    total: interleaved.length,
    sources: sourceCounts,
    tracks: interleaved
  });
});

router.post("/playlists", async (req, res) => {
  const { scenes = [], moods = [], genres = [], uses = [], wantsSoft, wantsSad, wantsEnergy, wantsBeat } = req.body;

  const profile = {
    scenes: Array.isArray(scenes) ? scenes : [],
    moods: Array.isArray(moods) ? moods : [],
    genres: Array.isArray(genres) ? genres : [],
    uses: Array.isArray(uses) ? uses : ["general"],
    wantsSoft: Boolean(wantsSoft),
    wantsSad: Boolean(wantsSad),
    wantsEnergy: Boolean(wantsEnergy),
    wantsBeat: Boolean(wantsBeat)
  };

  try {
    const { playlists: rawPlaylists, tracks: rawTracks } = await withTimeoutObj(
      fetchPremiumPlaylists(profile, 5),
      25000,
      "ncm-playlist(精品歌单)"
    );

    const tracks = rawTracks.map((r) => {
      const normalized = normalizeTrack(r, profile);
      normalized._fromPlaylist = true;
      normalized._playlistName = r._playlistName;
      normalized._playlistId = r._playlistId;
      normalized._playlistCat = r._playlistCat;
      normalized.channel = "playlists";
      return normalized;
    });

    const formattedPlaylists = (rawPlaylists || []).map((pl) => ({
      id: pl.id,
      name: pl.name,
      cover: pl.cover,
      trackCount: pl.trackCount,
      playCount: pl.playCount,
      subscribedCount: pl.subscribedCount,
      creator: pl.creator,
      cat: pl.cat,
      tags: pl.tags,
      description: pl.description,
      url: pl.url
    }));

    res.json({
      playlists: formattedPlaylists,
      tracks: tracks,
      total: tracks.length,
      keywords: getSearchKeywords(profile)
    });
  } catch (err) {
    console.error("[search] 歌单搜索失败:", err.message);
    res.json({ playlists: [], tracks: [], total: 0 });
  }
});

router.post("/user", async (req, res) => {
  const { scenes = [], moods = [], genres = [], uses = [], wantsSoft, wantsSad, wantsEnergy, wantsBeat } = req.body;

  const profile = {
    scenes: Array.isArray(scenes) ? scenes : [],
    moods: Array.isArray(moods) ? moods : [],
    genres: Array.isArray(genres) ? genres : [],
    uses: Array.isArray(uses) ? uses : ["general"],
    wantsSoft: Boolean(wantsSoft),
    wantsSad: Boolean(wantsSad),
    wantsEnergy: Boolean(wantsEnergy),
    wantsBeat: Boolean(wantsBeat)
  };

  if (!isLoggedIn()) {
    return res.json({
      loggedIn: false,
      playlists: [],
      tracks: [],
      total: 0,
      profile: null
    });
  }

  try {
    const result = await withTimeoutObj(
      searchUserTracksForUse(profile, 8),
      20000,
      "ncm-user(个人歌单)"
    );

    const tracks = (result.tracks || []).map((r) => {
      const normalized = normalizeTrack(r, profile);
      normalized._fromUserPlaylist = r._fromUserPlaylist;
      normalized._fromLiked = r._fromLiked;
      normalized._playlistName = r._playlistName;
      normalized.channel = "user";
      return normalized;
    });

    const formattedPlaylists = (result.playlists || []).map((pl) => ({
      id: pl.id,
      name: pl.name,
      cover: pl.cover,
      trackCount: pl.trackCount,
      creator: pl.creator,
      isCreated: pl.isCreated,
      url: pl.url
    }));

    res.json({
      loggedIn: true,
      profile: result.profile,
      playlists: formattedPlaylists,
      tracks: deduplicate(tracks),
      total: tracks.length
    });
  } catch (err) {
    console.error("[search] 用户歌单搜索失败:", err.message);
    res.json({ loggedIn: true, playlists: [], tracks: [], total: 0, error: err.message });
  }
});

router.post("/find", async (req, res) => {
  const { profile, keyword } = req.body;
  const useProfile = profile || {};
  useProfile.uses = Array.isArray(useProfile.uses) ? useProfile.uses : ["general"];
  useProfile.scenes = Array.isArray(useProfile.scenes) ? useProfile.scenes : [];
  useProfile.moods = Array.isArray(useProfile.moods) ? useProfile.moods : [];

  const tracksPerPlaylist = 6;

  const [playlistResult, userResult, ostResult] = await Promise.all([
    withTimeoutObj(fetchPremiumPlaylists(useProfile, tracksPerPlaylist), 25000, "精品歌单"),
    isLoggedIn()
      ? withTimeoutObj(searchUserTracksForUse(useProfile, tracksPerPlaylist), 20000, "个人歌单")
      : Promise.resolve({ playlists: [], tracks: [], loggedIn: false }),
    withTimeoutObj(fetchOstTracks(useProfile, tracksPerPlaylist), 20000, "影视原声")
  ]);

  const singleKeyword = keyword || getSearchKeywords(useProfile);
  const searchLimit = 8;

  const singleTasks = [
    withTimeout(searchNCM(singleKeyword, searchLimit), 10000, "ncm单曲"),
    withTimeout(searchITunes(singleKeyword, searchLimit), 8000, "itunes单曲")
  ];
  const singleLabels = ["netease", "itunes"];
  const spotId = process.env.SPOTIFY_CLIENT_ID || "";
  const spotSecret = process.env.SPOTIFY_CLIENT_SECRET || "";
  if (isRealKey(spotId) && isRealKey(spotSecret)) {
    singleTasks.push(withTimeout(searchSpotify(singleKeyword, searchLimit, spotId, spotSecret), 6000, "spotify单曲"));
    singleLabels.push("spotify");
  }

  const singleResults = await Promise.all(singleTasks);
  const allSingles = [];
  singleResults.forEach((tracks, i) => {
    tracks.forEach((t) => {
      allSingles.push(normalizeTrack({ ...t, _platform: singleLabels[i] }, useProfile));
    });
  });

  const playlistTracks = (playlistResult.tracks || []).map((r) => {
    const normalized = normalizeTrack(r, useProfile);
    normalized._fromPlaylist = true;
    normalized._playlistName = r._playlistName;
    normalized._playlistCat = r._playlistCat;
    normalized.channel = "playlists";
    return normalized;
  });

  const userTracks = (userResult.tracks || []).map((r) => {
    const normalized = normalizeTrack(r, useProfile);
    normalized._fromUserPlaylist = r._fromUserPlaylist;
    normalized._fromLiked = r._fromLiked;
    normalized._playlistName = r._playlistName;
    normalized.channel = "user";
    return normalized;
  });

  const ostTracks = (ostResult.tracks || []).map((r) => {
    const normalized = normalizeTrack(r, useProfile);
    normalized._fromOst = true;
    normalized._playlistName = r._playlistName;
    normalized.channel = "ost";
    return normalized;
  });

  res.json({
    keyword: singleKeyword,
    uses: useProfile.uses,
    channels: {
      playlists: {
        playlists: (playlistResult.playlists || []).map((pl) => ({
          id: pl.id, name: pl.name, cover: pl.cover, trackCount: pl.trackCount,
          playCount: pl.playCount, creator: pl.creator, cat: pl.cat,
          description: pl.description, url: pl.url
        })),
        tracks: deduplicate(playlistTracks)
      },
      user: {
        loggedIn: Boolean(userResult.loggedIn),
        profile: userResult.profile || null,
        playlists: (userResult.playlists || []).map((pl) => ({
          id: pl.id, name: pl.name, cover: pl.cover, trackCount: pl.trackCount,
          creator: pl.creator, isCreated: pl.isCreated, url: pl.url
        })),
        tracks: deduplicate(userTracks)
      },
      ost: {
        playlists: (ostResult.playlists || []).map((pl) => ({
          id: pl.id, name: pl.name, cover: pl.cover, trackCount: pl.trackCount,
          creator: pl.creator, cat: pl.cat, url: pl.url
        })),
        tracks: deduplicate(ostTracks)
      },
      singles: {
        tracks: deduplicate(allSingles)
      }
    }
  });
});

router.post("/login", async (req, res) => {
  const { cookie } = req.body;
  if (!cookie || typeof cookie !== "string") {
    return res.status(400).json({ success: false, message: "请提供cookie" });
  }
  const result = await loginWithCookie(cookie);
  res.json(result);
});

router.post("/logout", (_req, res) => {
  logout();
  res.json({ success: true });
});

router.get("/login/status", (_req, res) => {
  res.json({ loggedIn: isLoggedIn() });
});

router.get("/user/playlists", async (_req, res) => {
  if (!isLoggedIn()) {
    return res.json({ loggedIn: false, playlists: [] });
  }
  const playlists = await fetchUserPlaylists(30);
  res.json({ loggedIn: true, playlists });
});

module.exports = router;
