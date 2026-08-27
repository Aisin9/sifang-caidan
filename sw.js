/* ============================================
   sw.js — Service Worker（离线缓存）v4
   作用：
   1. 让网站满足「可安装成应用（PWA）」的条件
   2. 断网时也能打开菜单

   更新策略：缓存优先 + 整版原子更新
   - 安装时一次性把整版文件预存进「本版本的缓存」，全部成功后才激活
   - 之后所有请求优先用「本版本缓存」，保证 HTML/CSS/JS 永远是同一版本，
     不会出现新旧文件混搭（旧策略网络优先，网络不稳时会混）
   - 发新版 = 改 CACHE_NAME：浏览器发现新版本后，
     第一次访问完成安装，第二次访问（刷新）生效
   ============================================ */

var CACHE_NAME = "sifang-caidan-v6";
var ASSETS = [
  "./",
  "./index.html",
  "./style.css",
  "./manifest.json",
  "./icon-192.png",
  "./js/content.js",
  "./js/store.js",
  "./js/checkin.js",
  "./js/image.js",
  "./js/random.js",
  "./js/app.js"
];

// 安装：把整版文件预存进缓存（addAll 任一失败则整个安装失败，保持旧版），
// 装完立即接管页面（skipWaiting）
self.addEventListener("install", function (e) {
  e.waitUntil(
    caches.open(CACHE_NAME)
      .then(function (c) { return c.addAll(ASSETS); })
      .then(function () { return self.skipWaiting(); })
  );
});

// 激活：清掉所有旧版本缓存
self.addEventListener("activate", function (e) {
  e.waitUntil(
    caches.keys().then(function (keys) {
      return Promise.all(
        keys.filter(function (k) { return k !== CACHE_NAME; })
          .map(function (k) { return caches.delete(k); })
      );
    }).then(function () { return self.clients.claim(); })
  );
});

// 请求拦截：缓存优先（保证同版本一致性），缓存没有才走网络
self.addEventListener("fetch", function (e) {
  if (e.request.method !== "GET") return;

  e.respondWith(
    caches.match(e.request, { ignoreSearch: true }).then(function (hit) {
      if (hit) return hit;
      // 缓存没有：联网取，顺便存入当前版本缓存（供下次断网用）
      return fetch(e.request).then(function (res) {
        if (res.ok && new URL(e.request.url).origin === self.location.origin) {
          var clone = res.clone();
          caches.open(CACHE_NAME).then(function (c) { c.put(e.request, clone); });
        }
        return res;
      }).catch(function () {
        // 断网且无缓存：导航请求给首页（SPA 自己渲染），其余返回错误
        if (e.request.mode === "navigate") return caches.match("./index.html");
        return new Response("offline", { status: 503, statusText: "Offline" });
      });
    })
  );
});
