/* ============================================
   store.js — 数据层 v2（IndexedDB 存储）
   ============================================
   为什么换存储：
   - 旧版用 localStorage，浏览器给它固定的约 5MB 配额，图片存不了几道菜
   - IndexedDB 的配额由浏览器按磁盘空间动态分配（Chrome 最高可达
     磁盘空闲空间的约 60%，通常几百 MB ~ 几 GB），不再受 5MB 限制

   工作方式：
   - 启动时 initStore() 一次性把数据读进内存（cache）
   - 之后「读」直接读内存（同步、快）；「写」先改内存、再异步落盘
   - 旧版 localStorage 里的数据会自动迁移到 IndexedDB
   - 如果浏览器不支持 IndexedDB，自动退回 localStorage（约 5MB）

   调用约定：所有写操作（addDish 等）都返回 Promise<boolean>
   —— true 表示已成功写入磁盘，false 表示存储失败（会弹提示）
   ============================================ */

var DB_NAME = "privateMenuDB";      // IndexedDB 数据库名
var DB_VERSION = 1;
var STORE_NAME = "data";            // 对象仓库名
var MAIN_KEY = "main";              // 整份数据就用这一个 key
var LEGACY_KEY = "privateMenuData"; // 旧版 localStorage 的键名（迁移用）

var cache = null;  // 内存中的数据（initStore 完成后才有值）
var useIDB = false; // 当前用的是 IndexedDB 还是 localStorage

// ---- 默认数据结构（第一次使用时初始化）----
function defaultData() {
  return {
    version: 3,
    categories: ["荤菜", "素菜", "汤羹", "主食", "快手菜"],
    dishes: [],
    checkins: {}   // 「好好吃饭」打卡记录：{ "2026-08-27": true }
  };
}

// ============================================
// IndexedDB 基础封装
// 原生 API 是回调风格、写起来啰嗦，这里包成 Promise
// ============================================

function openDB() {
  return new Promise(function (resolve, reject) {
    var req = indexedDB.open(DB_NAME, DB_VERSION);
    // 数据库首次创建时建仓库
    req.onupgradeneeded = function () {
      if (!req.result.objectStoreNames.contains(STORE_NAME)) {
        req.result.createObjectStore(STORE_NAME);
      }
    };
    req.onsuccess = function () { resolve(req.result); };
    req.onerror = function () { reject(req.error); };
  });
}

function idbGet(key) {
  return openDB().then(function (db) {
    return new Promise(function (resolve, reject) {
      var req = db.transaction(STORE_NAME, "readonly").objectStore(STORE_NAME).get(key);
      req.onsuccess = function () { resolve(req.result); };
      req.onerror = function () { reject(req.error); };
    });
  });
}

function idbSet(key, value) {
  return openDB().then(function (db) {
    return new Promise(function (resolve, reject) {
      var req = db.transaction(STORE_NAME, "readwrite").objectStore(STORE_NAME).put(value, key);
      req.onsuccess = function () { resolve(); };
      req.onerror = function () { reject(req.error); };
    });
  });
}

function idbDelete(key) {
  return openDB().then(function (db) {
    return new Promise(function (resolve, reject) {
      var req = db.transaction(STORE_NAME, "readwrite").objectStore(STORE_NAME).delete(key);
      req.onsuccess = function () { resolve(); };
      req.onerror = function () { reject(req.error); };
    });
  });
}

// ============================================
// 初始化：选引擎 → 读数据 → 旧版迁移
// ============================================

function initStore() {
  return (async function () {
    // 1. 探测 IndexedDB 是否可用（个别浏览器在 file:// 下会禁用）
    useIDB = false;
    if (typeof indexedDB !== "undefined") {
      try {
        await idbGet(MAIN_KEY);
        useIDB = true;
      } catch (e) {
        useIDB = false;
      }
    }

    // 2. 读取数据
    var data = null;
    if (useIDB) {
      data = await idbGet(MAIN_KEY);
    } else {
      data = lsRead(LEGACY_KEY);
    }
    if (!data || !Array.isArray(data.dishes)) data = defaultData();
    cache = data;

    // 3. 旧版迁移：localStorage 里有数据 → 搬进 IndexedDB → 腾出旧的 5MB
    // （个别浏览器禁用存储时 localStorage 访问会抛异常，包一层防止初始化崩溃）
    if (useIDB) {
      try {
        var legacyRaw = localStorage.getItem(LEGACY_KEY);
        if (legacyRaw) {
          var existing = await idbGet(MAIN_KEY);
          if (!existing) {
            var old = null;
            try { old = JSON.parse(legacyRaw); } catch (e) { old = null; }
            if (old && Array.isArray(old.dishes)) {
              cache = old;
              await idbSet(MAIN_KEY, old);
            }
          }
          localStorage.removeItem(LEGACY_KEY);
        }
      } catch (e) {
        console.warn("localStorage 不可用，跳过迁移：", e);
      }
    }

    // 4. 示例菜品：无条件一次性注入（有标记则跳过；用户删除/清空后不复活）
    if (typeof SAMPLE_DISHES !== "undefined" &&
        cache.sampleDishesVersion !== SAMPLE_DISHES_VERSION) {
      SAMPLE_DISHES.forEach(function (s) {
        var d = Object.assign({}, s);
        d.id = uid();
        d.createdAt = Date.now();
        d.updatedAt = d.createdAt;
        // 优先用内置真实照片（相对路径），没有时退回渐变占位图
        d.image = s.image || ((typeof makePlaceholderImage === "function")
          ? makePlaceholderImage(d.emoji, d.colors, d.name) : "");
        fillDishDefaults(d);
        cache.dishes.push(d);
        if (d.category) addCategoryToData(cache, d.category);
      });
      cache.sampleDishesVersion = SAMPLE_DISHES_VERSION;
      // 标记与菜品在同一次写入中落盘，不会出现「只写了一半」的状态
      if (useIDB) await idbSet(MAIN_KEY, cache);
      else {
        try {
          localStorage.setItem(LEGACY_KEY, JSON.stringify(cache));
        } catch (e) {
          console.warn("localStorage 不可用，示例菜仅保存在本次会话内存中：", e);
        }
      }
    }

    // 5. 存量迁移：补 checkins 字段 + 老用户库中的 SVG 占位图换成内置照片
    var changed = false;
    if (!cache.checkins || typeof cache.checkins !== "object" || Array.isArray(cache.checkins)) {
      cache.checkins = {};
      changed = true;
    }
    if (typeof SAMPLE_DISHES !== "undefined") {
      var photoMap = {};
      SAMPLE_DISHES.forEach(function (s) {
        if (typeof s.image === "string" && s.image.indexOf("data:") !== 0) {
          photoMap[s.name] = s.image;
        }
      });
      cache.dishes.forEach(function (d) {
        // 只替换「旧版注入的 SVG 占位图 + 示例菜名」；
        // 用户上传的 JPEG dataURL 和刻意清空的图片不受影响
        if (typeof d.image === "string" &&
            d.image.indexOf("data:image/svg+xml") === 0 &&
            photoMap[d.name]) {
          d.image = photoMap[d.name];
          changed = true;
        }
      });
    }
    if (changed) {
      if (useIDB) await idbSet(MAIN_KEY, cache);
      else {
        try {
          localStorage.setItem(LEGACY_KEY, JSON.stringify(cache));
        } catch (e) {
          console.warn("localStorage 不可用，迁移结果仅保存在本次会话内存中：", e);
        }
      }
    }
  })();
}

// ---- localStorage 引擎的读写（回退方案用）----
function lsRead(key) {
  try {
    var raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : null;
  } catch (e) {
    return null;
  }
}

// ============================================
// 保存：把内存 cache 写入存储引擎
// 成功返回 true；空间不足时弹提示并返回 false
// ============================================

function isQuotaError(e) {
  return !!(e && (e.name === "QuotaExceededError" || /quota/i.test(String(e.message))));
}

function storageFullAlert() {
  alert(
    "浏览器存储空间不足。\n" +
    "建议：删除部分菜品图片，或先到「备份」页导出数据。\n" +
    "本次修改尚未保存，当前表单内容不会丢失。"
  );
}

function saveData() {
  if (useIDB) {
    return idbSet(MAIN_KEY, cache).then(function () {
      return true;
    }).catch(function (e) {
      if (isQuotaError(e)) storageFullAlert();
      else alert("保存失败：" + e);
      return false;
    });
  }
  try {
    localStorage.setItem(LEGACY_KEY, JSON.stringify(cache));
    return Promise.resolve(true);
  } catch (e) {
    storageFullAlert();
    return Promise.resolve(false);
  }
}

// 唯一 ID：时间戳转 36 进制 + 随机串，冲突概率可忽略
function uid() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
}

// ============================================
// 菜品增删改查（读 = 同步读内存；写 = 改内存后异步落盘）
// ============================================

function getData() {
  return cache || defaultData();
}

function getDishes() {
  return getData().dishes;
}

function getDish(id) {
  return getData().dishes.find(function (d) { return d.id === id; }) || null;
}

function getCategories() {
  return getData().categories;
}

// 整体替换数据（导入备份的「覆盖」模式用）
function setData(data) {
  cache = data;
}

// 新增菜品：自动补 id 和时间戳
function addDish(dish) {
  dish.id = uid();
  dish.createdAt = Date.now();
  dish.updatedAt = dish.createdAt;
  fillDishDefaults(dish);
  getData().dishes.push(dish);
  if (dish.category) addCategoryToData(cache, dish.category);
  return saveData();
}

// 更新菜品：合并字段，刷新 updatedAt
function updateDish(id, patch) {
  var dish = getDish(id);
  if (!dish) return Promise.resolve(false);
  Object.assign(dish, patch);
  dish.updatedAt = Date.now();
  if (dish.category) addCategoryToData(cache, dish.category);
  return saveData();
}

function deleteDish(id) {
  var data = getData();
  data.dishes = data.dishes.filter(function (d) { return d.id !== id; });
  return saveData();
}

// 防止漏存字段：给缺失的字段补默认值
function fillDishDefaults(dish) {
  dish.tags = dish.tags || [];
  dish.ingredients = dish.ingredients || [];
  dish.steps = dish.steps || [];
  dish.rating = dish.rating || 0;
  dish.image = dish.image || "";
}

// 把新分类加进 data（自动去重）
function addCategoryToData(data, name) {
  name = String(name).trim();
  if (name && data.categories.indexOf(name) === -1) {
    data.categories.push(name);
  }
}

// 清空全部数据
// 注意：不是简单删存储，而是写入「空数据 + 示例注入标记」，
// 这样重载后不会因为标记丢失而把示例菜重新注入
function clearAllData() {
  cache = defaultData();
  if (typeof SAMPLE_DISHES_VERSION !== "undefined") {
    cache.sampleDishesVersion = SAMPLE_DISHES_VERSION;
  }
  if (useIDB) return idbSet(MAIN_KEY, cache);
  localStorage.setItem(LEGACY_KEY, JSON.stringify(cache));
  return Promise.resolve(true);
}

// ============================================
// 「好好吃饭」打卡
// ============================================

function getCheckins() {
  return getData().checkins || {};
}

function isChecked(ds) {
  return !!(getData().checkins || {})[ds];
}

// 切换某天的打卡状态（ds 格式 "YYYY-MM-DD"），返回 Promise<boolean>
function toggleCheckin(ds) {
  var data = getData();
  if (!data.checkins || typeof data.checkins !== "object") data.checkins = {};
  if (data.checkins[ds]) {
    delete data.checkins[ds];
  } else {
    data.checkins[ds] = true;
  }
  return saveData();
}

// ============================================
// 存储统计（备份页显示）
// ============================================

// 用浏览器标准的 Storage API 拿真实配额和用量
// 返回 { usageKB, quotaKB, supported }；不支持的浏览器 supported = false
async function getStorageStats() {
  if (navigator.storage && navigator.storage.estimate) {
    try {
      var est = await navigator.storage.estimate();
      return {
        usageKB: Math.round(est.usage / 1024),
        quotaKB: Math.round(est.quota / 1024),
        supported: true
      };
    } catch (e) { /* 拿不到就走兜底 */ }
  }
  // 兜底：按引擎粗略估算
  if (useIDB) {
    return { usageKB: Math.round(JSON.stringify(cache).length / 1024), quotaKB: 0, supported: false };
  }
  var raw = localStorage.getItem(LEGACY_KEY) || "";
  return { usageKB: Math.round(raw.length / 1024), quotaKB: 5120, supported: true };
}

// KB 数字转成好读的单位
function formatSize(kb) {
  if (kb >= 1024 * 1024) return (kb / 1024 / 1024).toFixed(2) + " GB";
  if (kb >= 1024) return (kb / 1024).toFixed(1) + " MB";
  return kb + " KB";
}
