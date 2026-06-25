const path = require("path");
const { execFile } = require("child_process");
const { promisify } = require("util");

const execFileAsync = promisify(execFile);

let queue = Promise.resolve();

function withQueue(fn) {
  const result = queue.then(() => fn());
  queue = result.catch(() => {});
  return result;
}

async function searchNCM(keyword, limit = 10) {
  if (!keyword || !keyword.trim()) return [];
  const trimmedKeyword = keyword.trim();

  return withQueue(() => doSearch(trimmedKeyword, limit));
}

async function doSearch(keyword, limit) {
  const cliEntry = path.join(__dirname, "..", "node_modules", "@music163", "ncm-cli", "dist", "index.js");

  const args = [cliEntry, "search", "song", "--keyword", keyword, "--limit", String(limit), "--offset", "0", "--output", "json"];

  try {
    const { stdout, stderr } = await execFileAsync(process.execPath, args, {
      cwd: path.join(__dirname, ".."),
      timeout: 12000,
      maxBuffer: 1024 * 1024,
      env: { ...process.env, FORCE_COLOR: "0", NODE_ENV: "production", NPM_CONFIG_UPDATE_NOTIFIER: "false" },
      windowsHide: true,
      shell: false
    });

    const text = (stdout || "").trim();
    if (!text) return [];

    const startIdx = text.indexOf("{");
    const endIdx = text.lastIndexOf("}");
    if (startIdx === -1 || endIdx === -1 || endIdx <= startIdx) return [];

    const jsonStr = text.substring(startIdx, endIdx + 1);
    const parsed = JSON.parse(jsonStr);

    const data = parsed.data || parsed.result || parsed;
    const list = Array.isArray(data.records) ? data.records : (Array.isArray(data.songs) ? data.songs : (Array.isArray(data) ? data : []));
    if (!Array.isArray(list)) return [];

    return list.map((song) => ({
      source: "netease",
      id: String(song.originalId || song.id || Math.random().toString(36).slice(2)),
      title: song.name || song.songName || song.title || "未知曲目",
      artist: Array.isArray(song.artists)
        ? song.artists.map((a) => a.name || "").filter(Boolean).join(" / ")
        : Array.isArray(song.ar)
        ? song.ar.map((a) => a.name || "").filter(Boolean).join(" / ")
        : song.artist || song.singer || "未知艺人",
      album: song.album?.name || song.al?.name || song.albumName || "未知专辑",
      duration: song.duration ? Math.round(song.duration / 1000) : (song.dt ? Math.round(song.dt / 1000) : 0),
      albumCover: (song.coverImgUrl || song.album?.picUrl || song.al?.picUrl || song.cover || "").replace(/^http:\/\//, "https://"),
      url: (song.originalId || song.id) ? `https://music.163.com/#/song?id=${song.originalId || song.id}` : "",
      platforms: ["网易云音乐"],
      _raw: song
    }));
  } catch (err) {
    if (err.killed) {
      console.error("[ncm] search timed out:", keyword);
    } else {
      console.error("[ncm] search failed:", err.message);
    }
    return [];
  }
}

module.exports = { searchNCM };
