/* ============================================
   checkin.js — 「好好吃饭」打卡的纯日期逻辑
   （无 DOM 依赖，便于测试；UI 在 app.js）
   日期格式统一为本地时间的 "YYYY-MM-DD" 字符串。
   注意：禁用 toISOString —— 它按 UTC 换算，
   UTC+8 时区早上 8 点前会把日期错位到前一天。
   ============================================ */

function pad2(n) {
  return n < 10 ? "0" + n : "" + n;
}

// Date → "YYYY-MM-DD"（本地时间）
function toDateKey(d) {
  return d.getFullYear() + "-" + pad2(d.getMonth() + 1) + "-" + pad2(d.getDate());
}

// "YYYY-MM-DD" → { y, m, d }
function parseDateKey(ds) {
  var p = ds.split("-");
  return { y: +p[0], m: +p[1], d: +p[2] };
}

// 日期加 n 天（正午锚点构造，规避夏令时导致的一天错位）
function dateKeyAddDays(ds, n) {
  var p = parseDateKey(ds);
  return toDateKey(new Date(p.y, p.m - 1, p.d + n, 12, 0, 0));
}

// 某年某月的天数（闰年/2 月由 Date 构造器保证正确）
function daysInMonth(y, m) {
  return new Date(y, m, 0).getDate();
}

// 生成日历格子数组（周一开头）：
// [{ ds, day, inMonth, isFuture }]，开头用空白格补齐第一周
function buildMonthGrid(y, m, todayDs) {
  var firstWeekday = (new Date(y, m - 1, 1).getDay() + 6) % 7; // 周一=0
  var cells = [];
  for (var i = 0; i < firstWeekday; i++) {
    cells.push({ ds: "", day: 0, inMonth: false, isFuture: false });
  }
  for (var d = 1; d <= daysInMonth(y, m); d++) {
    // 定长零填充后字符串比较即日期比较
    var ds = y + "-" + pad2(m) + "-" + pad2(d);
    cells.push({ ds: ds, day: d, inMonth: true, isFuture: ds > todayDs });
  }
  return cells;
}

// 某年某月已打卡天数（翻月后统计跟随显示月）
function countInMonth(checkins, y, m) {
  var prefix = y + "-" + pad2(m) + "-";
  return Object.keys(checkins).filter(function (k) {
    return k.indexOf(prefix) === 0;
  }).length;
}

// 连续打卡天数：从今天往前数；今天未打卡则从昨天起算
function computeStreak(checkins, todayDs) {
  var cur = checkins[todayDs] ? todayDs : dateKeyAddDays(todayDs, -1);
  var n = 0;
  while (checkins[cur]) {
    n++;
    cur = dateKeyAddDays(cur, -1);
  }
  return n;
}

// ============================================
// 饭记时间线的纯逻辑（无 DOM，便于测试）
// ============================================

var MEAL_TYPE_ORDER = ["早餐", "午餐", "晚餐", "加餐"];
var WEEKDAYS_CN = ["周日", "周一", "周二", "周三", "周四", "周五", "周六"];

// 餐次排序权重（非法餐次排最后）
function mealTypeRank(t) {
  var i = MEAL_TYPE_ORDER.indexOf(t);
  return i === -1 ? 99 : i;
}

// 按当前小时给默认餐次
function defaultMealType(h) {
  if (h < 10) return "早餐";
  if (h < 14) return "午餐";
  if (h < 17) return "加餐";
  if (h < 21) return "晚餐";
  return "加餐";
}

// 排序（返回新数组，不改变原顺序）：
// 日期降序（最新一天在前）→ 同天内餐次升序（早→晚，时间正序阅读）→ createdAt 升序
function sortMeals(meals) {
  return (meals || []).slice().sort(function (a, b) {
    if (a.date !== b.date) return a.date < b.date ? 1 : -1;
    var ra = mealTypeRank(a.mealType);
    var rb = mealTypeRank(b.mealType);
    if (ra !== rb) return ra - rb;
    return (a.createdAt || 0) - (b.createdAt || 0);
  });
}

// 按日期分组：[{ date, meals:[...] }]，日期降序
function groupMealsByDate(meals) {
  var groups = [];
  sortMeals(meals).forEach(function (m) {
    var last = groups[groups.length - 1];
    if (!last || last.date !== m.date) {
      groups.push({ date: m.date, meals: [m] });
    } else {
      last.meals.push(m);
    }
  });
  return groups;
}

// 日期头文案：今天 / 昨天 / M月D日 周X（跨年补 YYYY年）
function formatDayHeader(ds, todayDs) {
  if (ds === todayDs) return "今天";
  if (ds === dateKeyAddDays(todayDs, -1)) return "昨天";
  var p = parseDateKey(ds);
  var wd = WEEKDAYS_CN[new Date(p.y, p.m - 1, p.d).getDay()];
  var yearPart = (p.y === new Date().getFullYear()) ? "" : p.y + "年";
  return yearPart + p.m + "月" + p.d + "日 " + wd;
}
