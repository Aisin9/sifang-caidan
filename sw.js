/* ============================================
   sw.js — Service Worker（离线缓存）
   作用：
   1. 让网站满足「可安装成应用（PWA）」的条件
   2. 断网时也能打开菜单（用上次缓存的内容兜底）

   更新策略：网络优先 —— 每次先尝试联网取最新文件，
   取到了就顺便更新缓存；断网时才用缓存兜底。
   所以发新版本时不用改缓存名也能拿到新文件；
   只有想「立刻清掉所有旧缓存」时才改 CACHE_NAME。
   ============================================ */

var CACHE_NAME = "sifang-caidan-v2";
var ASSETS = [
  "./",
  "./index.html",
  "./style.css",
  "./manifest.json",
  "./icon-192.png",
  "./js/store.js",
  "./js/image.js",
  "./js/random.js",
  "./js/app.js"
];

// 安装：把核心文件预存进缓存，装完立即接管页面
self.addEventListener("install", function (e) {
  e.waitUntil(
    caches.open(CACHE_NAME)
      .then(function (c) { return c.addAll(ASSETS); })
      .then(function () { return self.skipWaiting(); })
  );
});

// 激活：清掉旧版本缓存
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

// 请求拦截：网络优先，断网时缓存兜底
self.addEventListener("fetch", function (e) {
  if (e.request.method !== "GET") return;

  e.respondWith(
    fetch(e.request).then(function (res) {
      // 网络成功：把同源资源顺手存进缓存（供下次断网用）
      if (res.ok && new URL(e.request.url).origin === self.location.origin) {
        var clone = res.clone();
        caches.open(CACHE_NAME).then(function (c) { c.put(e.request, clone); });
      }
      return res;
    }).catch(function () {
      // 断网：先找对应缓存，找不到就给主页（SPA 都能渲染）
      return caches.match(e.request, { ignoreSearch: true }).then(function (hit) {
        return hit || caches.match("./index.html");
      });
    })
  );
});
