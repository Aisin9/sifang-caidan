/* ============================================
   serve.js — 本地静态服务器（零依赖，测试用）
   用法：node tests/serve.js [端口]，默认 8765
   根目录为项目目录，供 headless 浏览器做端到端测试
   ============================================ */

var http = require("http");
var fs = require("fs");
var path = require("path");

var ROOT = path.join(__dirname, "..");
var PORT = Number(process.argv[2]) || 8765;

var MIME = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "application/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".webmanifest": "application/manifest+json"
};

http.createServer(function (req, res) {
  var urlPath = decodeURIComponent(req.url.split("?")[0]);
  if (urlPath === "/") urlPath = "/index.html";
  var filePath = path.join(ROOT, urlPath);
  // 防目录穿越
  if (filePath.indexOf(ROOT) !== 0) {
    res.writeHead(403); res.end("forbidden"); return;
  }
  fs.readFile(filePath, function (err, data) {
    if (err) {
      res.writeHead(404); res.end("not found"); return;
    }
    res.writeHead(200, { "Content-Type": MIME[path.extname(filePath).toLowerCase()] || "application/octet-stream" });
    res.end(data);
  });
}).listen(PORT, function () {
  console.log("静态服务器已启动: http://127.0.0.1:" + PORT + "/");
});
