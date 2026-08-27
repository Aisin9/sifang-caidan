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
