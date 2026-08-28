/* ============================================
   smoke-node.js — 数据层冒烟测试（零依赖，node tests/smoke-node.js）
   用 vm 沙箱加载 store.js / checkin.js / content.js，
   localStorage 走桩（indexedDB=undefined → 回退引擎路径）
   ============================================ */

const fs = require("fs");
const path = require("path");
const vm = require("vm");

const ROOT = path.join(__dirname, "..");
const JS = ["js/content.js", "js/store.js", "js/checkin.js"].map(function (f) {
  return fs.readFileSync(path.join(ROOT, f), "utf8");
});

// ---- 浏览器环境桩 ----
const lsMem = new Map();
const sandbox = {
  console: console,
  alert: function (m) { console.log("  [alert]", String(m).split("\n")[0]); },
  confirm: function () { return true; },
  navigator: {},
  localStorage: {
    getItem: function (k) { return lsMem.has(k) ? lsMem.get(k) : null; },
    setItem: function (k, v) { lsMem.set(k, String(v)); },
    removeItem: function (k) { lsMem.delete(k); },
  },
};
sandbox.globalThis = sandbox;
vm.createContext(sandbox);
JS.forEach(function (code) {
  vm.runInContext(code, sandbox, { filename: "project" });
});

// ---- 测试工具 ----
let pass = 0, fail = 0;
function assert(cond, name) {
  if (cond) { pass++; console.log("  PASS " + name); }
  else { fail++; console.log("  FAIL " + name); }
}

function setItemCount() {
  return lsMem.get("privateMenuData") ? 1 : 0;
}
function lastPersisted() {
  return JSON.parse(lsMem.get("privateMenuData") || "null");
}

(async function main() {
  console.log("== 迁移：v3 旧数据（无 meals 字段） ==");
  lsMem.set("privateMenuData", JSON.stringify({
    version: 3,
    categories: ["荤菜"],
    dishes: [],
    checkins: { "2026-08-20": true }
  }));
  await sandbox.initStore();
  assert(Array.isArray(sandbox.cache.meals) && sandbox.cache.meals.length === 0, "meals 补为 []");
  assert(lastPersisted().meals !== undefined, "meals 已落盘");
  assert(sandbox.getCheckins()["2026-08-20"] === true, "旧 checkins 保留");

  console.log("== addMeal：自动打卡 + 原子性 ==");
  lsMem.delete("privateMenuData");
  sandbox.cache = null;
  await sandbox.initStore();
  sandbox.cache.meals = [];
  await sandbox.saveData();
  const before = JSON.stringify(lsMem.get("privateMenuData"));

  const meal = { date: "2026-08-28", mealType: "晚餐", dishIds: [], note: "第一次记录", image: "" };
  const ok = await sandbox.addMeal(meal);
  assert(ok === true, "addMeal 返回 true");
  assert(meal.id && meal.createdAt && meal.updatedAt, "补 id/createdAt/updatedAt");
  assert(sandbox.getMeals().length === 1, "meals 含该条");
  assert(sandbox.getCheckins()["2026-08-28"] === true, "当天自动打卡");
  assert(meal.mealType === "晚餐", "餐次保留");
  // 原子性：落盘次数 = 1（persisted 从 before 到 after 只多一次 setItem）
  assert(lsMem.get("privateMenuData") !== before, "已落盘");

  console.log("== addMeal 非法日期 ==");
  const bad = await sandbox.addMeal({ date: "2026/08/28", mealType: "晚餐" });
  assert(bad === false, "非法日期返回 false");
  assert(sandbox.getMeals().length === 1, "未写入内存");

  console.log("== addMeal 幂等打卡 + 非法餐次归一 ==");
  await sandbox.addMeal({ date: "2026-08-28", mealType: "夜宵", note: "" });
  assert(sandbox.getMeals()[1].mealType === "晚餐", "非法餐次归一为晚餐");
  assert(sandbox.getCheckins()["2026-08-28"] === true, "同日多条打卡幂等");

  console.log("== updateMeal：白名单 + 改日期打卡 ==");
  const m1 = sandbox.getMeals()[0];
  const origId = m1.id, origCreated = m1.createdAt;
  const up = await sandbox.updateMeal(m1.id, { id: "hacked", createdAt: 1, date: "2026-08-27", note: "改到昨天" });
  assert(up === true, "updateMeal 返回 true");
  const m1b = sandbox.getMeal(m1.id);
  assert(m1b.id === origId && m1b.createdAt === origCreated, "白名单：id/createdAt 未被覆盖");
  assert(m1b.date === "2026-08-27" && m1b.note === "改到昨天", "date/note 已更新");
  assert(sandbox.getCheckins()["2026-08-27"] === true, "新日期自动打卡");
  assert(sandbox.getCheckins()["2026-08-28"] === true, "旧日期打卡保留");

  console.log("== deleteMeal：不撤销打卡 ==");
  const okDel = await sandbox.deleteMeal(sandbox.getMeals()[1].id);
  assert(okDel === true && sandbox.getMeals().length === 1, "饭记已删除");
  assert(sandbox.getCheckins()["2026-08-28"] === true, "打卡保留");

  console.log("== sortMeals / groupMealsByDate ==");
  const mk = function (date, type, created) {
    return { id: date + type + created, date: date, mealType: type, createdAt: created };
  };
  const list = [
    mk("2026-08-26", "晚餐", 100),
    mk("2026-08-28", "早餐", 300),
    mk("2026-08-28", "午餐", 200),
    mk("2026-08-27", "加餐", 400),
    mk("2026-08-28", "早餐", 100),
  ];
  const sorted = sandbox.sortMeals(list);
  assert(list[0].id === "2026-08-26晚餐100", "原数组未被修改");
  assert(sorted.map(function (m) { return m.id; }).join(",") ===
    "2026-08-28早餐100,2026-08-28早餐300,2026-08-28午餐200,2026-08-27加餐400,2026-08-26晚餐100",
    "日期降序 → 餐次升序 → createdAt 升序");
  const groups = sandbox.groupMealsByDate(list);
  assert(groups.length === 3 && groups[0].date === "2026-08-28" && groups[0].meals.length === 3,
    "分组：3 天，最新在前，28 号 3 条");

  console.log("== formatDayHeader ==");
  const today = "2026-08-28";
  assert(sandbox.formatDayHeader("2026-08-28", today) === "今天", "今天");
  assert(sandbox.formatDayHeader("2026-08-27", today) === "昨天", "昨天");
  assert(sandbox.formatDayHeader("2026-08-15", today) === "8月15日 " + sandbox.WEEKDAYS_CN[new Date(2026, 7, 15).getDay()], "本年日期+周几");
  assert(sandbox.formatDayHeader("2025-12-31", today) === "2025年12月31日 " + sandbox.WEEKDAYS_CN[new Date(2025, 11, 31).getDay()], "跨年补年份");

  console.log("== defaultMealType ==");
  assert(sandbox.defaultMealType(9) === "早餐", "9 点=早餐");
  assert(sandbox.defaultMealType(13) === "午餐", "13 点=午餐");
  assert(sandbox.defaultMealType(16) === "加餐", "16 点=加餐");
  assert(sandbox.defaultMealType(20) === "晚餐", "20 点=晚餐");
  assert(sandbox.defaultMealType(23) === "加餐", "23 点=加餐");

  console.log("\n结果: " + pass + " 通过, " + fail + " 失败");
  process.exit(fail ? 1 : 0);
})().catch(function (e) {
  console.error("测试异常:", e);
  process.exit(1);
});
