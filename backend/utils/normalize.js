/**
 * 统一格式化多平台搜索结果
 * 输出格式与前端 catalog.js 的 track 对象对齐
 */
function normalizeTrack(raw, profile = null) {
  const vocal = estimateVocal(raw.title, raw.artist);
  const source = raw.source || raw.platform || "unknown";
  const platforms = raw.platforms || (raw.platform ? [raw.platform] : []);
  const platformLabels = {
    netease: "网易云音乐",
    itunes: "Apple Music",
    qqmusic: "QQ音乐",
    spotify: "Spotify",
    youtube: "YouTube"
  };
  const platformLabel = platforms.length ? platforms : [platformLabels[source] || source];
  const coverUrl = raw.albumCover || raw.coverUrl || raw.thumbnail || raw.artworkUrl || null;
  const track = {
    id: `${source}-${raw.id}`,
    title: raw.title || "未知曲目",
    artist: raw.artist || "未知艺人",
    platform: source,
    platforms: platformLabel,
    bpm: estimateBpm(raw),
    energy: estimateEnergy(raw),
    moods: inferMoods(raw),
    genres: inferGenres(raw),
    scenes: [],
    heat: estimateHeat(raw),
    vocal: vocal,
    structure: "",
    download: platformLabel.length
      ? `可在 ${platformLabel.join("、")} 上收听`
      : "来源未知",
    hook: buildHook(raw, platformLabel),
    _raw: raw,
    _url: raw.url || null,
    _previewUrl: raw.previewUrl || null,
    _albumCover: coverUrl,
    duration: raw.duration || 0
  };

  return track;
}

/**
 * 根据标题、时长、来源估算 BPM
 */
function estimateBpm(raw) {
  const title = (raw.title || "").toLowerCase();
  if (/remix|dj|club|dance|party|fast|快|house|trap|劲爆|运动/.test(title)) return 128;
  if (/lofi|chill|calm|sleep|静|ambient|氛围|钢琴|piano/.test(title)) return 80;
  if (/hip.?hop|rap|说唱|trap/.test(title)) return 95;
  if (/rock|摇滚|金属|metal/.test(title)) return 130;
  if (/jazz|爵士|bossa|bossa.?nova/.test(title)) return 110;
  if (/pop|流行|acoustic|民谣|folk|indie/.test(title)) return 105;
  if (/classical|古典|orchestra|交响/.test(title)) return 72;
  if (/electronic|电音|synth|电子/.test(title)) return 120;
  const duration = raw.duration || 0;
  if (duration > 0 && duration < 180) return 120;
  if (duration > 240) return 90;
  return 100;
}

/**
 * 估算热度
 */
function estimateHeat(raw) {
  const baseScores = {
    netease: 82,
    itunes: 80,
    qqmusic: 78,
    spotify: 82,
    youtube: 75
  };
  return baseScores[raw.source] || 70;
}

/**
 * 估算能量值
 */
function estimateEnergy(raw) {
  const title = (raw.title || "").toLowerCase();
  if (/remix|dj|club|dance|party|fast|快|house|trap|劲爆|运动|high/.test(title)) return 80;
  if (/rock|摇滚|金属|metal|heavy/.test(title)) return 75;
  if (/lofi|chill|calm|sleep|静|ambient|氛围|钢琴|piano|relax/.test(title)) return 30;
  if (/sad|悲伤|sorrow|slow|慢|ballad/.test(title)) return 35;
  if (/acoustic|民谣|folk|indie|吉他|guitar/.test(title)) return 45;
  if (/jazz|爵士|bossa/.test(title)) return 50;
  if (/pop|流行|electronic|电音/.test(title)) return 60;
  return 50;
}

/**
 * 推断情绪标签
 */
function inferMoods(raw) {
  const title = (raw.title || "").toLowerCase();
  const moods = [];
  if (/remix|dj|drop|club|dance|party|劲爆|燃|高能/.test(title)) moods.push("energetic");
  if (/sad|悲伤|sorrow|lone|lonely|alone|孤|难过|泪|emo|离别/.test(title)) moods.push("sad", "lonely");
  if (/love|爱|heart|sweet|甜|warm|温暖|治愈|heal|阳光|sun/.test(title)) moods.push("warm");
  if (/piano|钢琴|acoustic|guitar|吉他|quiet|静|calm|relax|sleep|chill|ambient/.test(title)) moods.push("calm");
  if (/happy|开心|fun|smile|joy|轻快|明亮|bright/.test(title)) moods.push("happy");
  if (/city|城市|night|夜|neon|霓虹|urban|街/.test(title)) moods.push("premium");
  if (/nostalg|回忆|nostalgia|old|怀旧|vintage|retro/.test(title)) moods.push("nostalgic");
  if (/travel|旅行|journey|wander|road|路|海|mountain|山/.test(title)) moods.push("free");
  if (!moods.length) moods.push("clean");
  return moods;
}

/**
 * 推断曲风
 */
function inferGenres(raw) {
  const title = (raw.title || "").toLowerCase();
  const genres = [];
  if (/lofi|lo.?fi/.test(title)) genres.push("lofi");
  if (/ambient|氛围|atmosphere/.test(title)) genres.push("ambient");
  if (/piano|钢琴/.test(title)) genres.push("piano");
  if (/acoustic|民谣|folk|indie/.test(title)) genres.push("acoustic", "indie");
  if (/jazz|爵士|bossa/.test(title)) genres.push("jazz");
  if (/electronic|电音|synth|电子/.test(title)) genres.push("electronic");
  if (/pop|流行/.test(title)) genres.push("pop");
  if (/rock|摇滚/.test(title)) genres.push("rock");
  if (/hip.?hop|rap|说唱/.test(title)) genres.push("hip-hop");
  if (/classical|古典|orchestra|交响/.test(title)) genres.push("classical");
  if (/house|trap|dubstep|dnb|drum.*bass/.test(title)) genres.push("electronic");
  return genres;
}

/**
 * 估算人声类型
 */
function estimateVocal(title, artist) {
  const t = (title || "").toLowerCase();
  const a = (artist || "").toLowerCase();
  if (/piano|钢琴|acoustic|guitar|吉他|ambient|氛围|lofi|lo.?fi|orchestra|交响|classical|古典/.test(t)) {
    if (/remix|vocals|feat|ft\.|演唱|歌|vocal/.test(t)) return "light-vocal";
    return "instrumental";
  }
  if (/beat|instrumental|纯音乐|bgm|ost|soundtrack|原声/.test(t)) return "instrumental";
  if (/remix|dj|chop|切片|mix/.test(t)) return "vocal-chop";
  if (/feat|ft\.|演唱|歌|album|ep|专辑|single/.test(t)) return "light-vocal";
  return "light-vocal";
}

/**
 * 构建推荐语
 */
function buildHook(raw, platformLabel) {
  if (raw.description) return raw.description.slice(0, 100);
  const parts = [];
  if (raw.album) parts.push(`专辑《${raw.album}》`);
  if (platformLabel && platformLabel.length) {
    parts.push(`${platformLabel.join("、")} 热播`);
  }
  if (raw.duration > 0) {
    const mins = Math.floor(raw.duration / 60);
    const secs = Math.floor(raw.duration % 60);
    parts.push(`时长 ${mins}:${String(secs).padStart(2, "0")}`);
  }
  if (parts.length > 0) {
    return `${raw.artist} · ${parts.join(" · ")}`;
  }
  return `${raw.artist} · ${raw.title}`;
}

module.exports = { normalizeTrack };