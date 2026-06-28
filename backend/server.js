require("dotenv").config();
const express = require("express");
const cors = require("cors");
const path = require("path");
const searchRouter = require("./routes/search");
const {
  loginWithCookie,
  isLoggedIn,
  getUserProfile,
  logout
} = require("./services/ncm-user");

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());

app.use(express.static(path.join(__dirname, "..")));

app.get("/api/health", (_req, res) => {
  res.json({
    status: "ok",
    service: "乐之笛后端",
    version: "1.0.0",
    time: new Date().toISOString()
  });
});

app.post("/api/login", async (req, res) => {
  const { cookie } = req.body;
  if (!cookie || typeof cookie !== "string") {
    return res.status(400).json({ success: false, error: "请提供cookie" });
  }
  const result = await loginWithCookie(cookie);
  res.json(result);
});

app.post("/api/logout", (_req, res) => {
  logout();
  res.json({ success: true });
});

app.get("/api/user", (_req, res) => {
  res.json({
    loggedIn: isLoggedIn(),
    profile: getUserProfile()
  });
});

// 搜索路由
app.use("/api/search", searchRouter);

// 404
app.use((_req, res) => {
  res.status(404).json({ error: "not found" });
});

// 全局错误处理
app.use((err, _req, res, _next) => {
  console.error("[server] 未捕获错误:", err);
  res.status(500).json({ error: "服务器内部错误" });
});

app.listen(PORT, () => {
  console.log(`\n  乐之笛后端已启动`);
  console.log(`  地址: http://localhost:${PORT}`);
  console.log(`  搜索: POST http://localhost:${PORT}/api/search\n`);

  console.log(`  ✓ 网易云音乐 (NeteaseCloudMusicApi) - 已启用 (无需配置)`);
  console.log(`  ✓ Apple Music (iTunes API) - 已启用 (无需配置)`);
  console.log(`  ✓ QQ音乐 (移动端接口) - 已启用 (无需配置)`);

  const ytKey = process.env.YOUTUBE_API_KEY;
  const spotId = process.env.SPOTIFY_CLIENT_ID;
  const spotSecret = process.env.SPOTIFY_CLIENT_SECRET;
  console.log(`  ${ytKey && !ytKey.startsWith('your_') ? "✓" : "✗"} YouTube ${ytKey && !ytKey.startsWith('your_') ? "已配置" : "未配置 (可选)"}`);
  console.log(`  ${spotId && spotSecret && !spotId.startsWith('your_') ? "✓" : "✗"} Spotify ${spotId && spotSecret && !spotId.startsWith('your_') ? "已配置" : "未配置 (可选)"}`);
  console.log("");
});