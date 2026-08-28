/* ============================================
   e2e.js — 端到端浏览器测试（零依赖）
   前置：node tests/serve.js 8765 已启动；
         headless Edge 带 --remote-debugging-port=9240 已打开 http://127.0.0.1:8765/
   运行：node tests/e2e.js
   ============================================ */

(async () => {
  const list = await (await fetch("http://127.0.0.1:9240/json/list")).json();
  const page = list.find(t => t.type === "page" && t.url.includes("8765"));
  if (!page) { console.log("页面未找到（检查 serve.js 与 Edge 是否已启动）"); process.exit(1); }

  const ws = new WebSocket(page.webSocketDebuggerUrl);
  let seq = 0;
  const pending = new Map();
  ws.onmessage = (ev) => {
    const msg = JSON.parse(ev.data);
    if (msg.id && pending.has(msg.id)) { pending.get(msg.id)(msg); pending.delete(msg.id); }
  };
  const send = (method, params) => new Promise((resolve, reject) => {
    const id = ++seq;
    pending.set(id, resolve);
    ws.send(JSON.stringify({ id, method, params }));
    setTimeout(() => { if (pending.has(id)) { pending.delete(id); reject(new Error("timeout: " + method)); } }, 20000);
  });
  await new Promise(r => ws.onopen = r);
  await new Promise(r => setTimeout(r, 5000));

  let pass = 0, fail = 0;
  const assert = (c, n) => { c ? (pass++, console.log("  PASS " + n)) : (fail++, console.log("  FAIL " + n)); };
  const evalJS = async (expr) => {
    const r = await send("Runtime.evaluate", { expression: expr, awaitPromise: true, returnByValue: true });
    if (r.result && r.result.exceptionDetails) { console.log("  脚本异常:", r.result.exceptionDetails.text); return null; }
    return r.result && r.result.result ? r.result.result.value : null;
  };

  console.log("== 结构：5 Tab 与视图 ==");
  assert((await evalJS("document.querySelectorAll('.nav-item').length")) === 10, "两套导航共 10 个 Tab 按钮（5×2）");
  assert((await evalJS("document.getElementById('view-meals') !== null")) === true, "view-meals 存在");
  assert((await evalJS("document.getElementById('view-meal-form') !== null")) === true, "view-meal-form 存在");
  const navOrder = await evalJS("[...document.querySelectorAll('.nav-item')].map(b => b.dataset.view).join(',')");
  assert(navOrder.split(",").slice(0, 5).join(",") === "home,meals,list,pick,me", "侧栏顺序: home,meals,list,pick,me");

  console.log("== 饭记空态 ==");
  await evalJS("showView('meals')");
  assert((await evalJS("!document.getElementById('meals-empty').classList.contains('hidden')")) === true, "空态显示");
  const activeNav = await evalJS("[...document.querySelectorAll('.nav-item.active')].map(b => b.dataset.view).join(',')");
  assert(activeNav === "meals,meals", "饭记 Tab 双高亮: " + activeNav);

  console.log("== 记录饭记全流程 ==");
  await evalJS("openMealForm(null)");
  await new Promise(r => setTimeout(r, 300));
  const today = await evalJS("toDateKey(new Date())");
  assert((await evalJS("document.getElementById('mf-date').value")) === today, "表单日期默认今天");
  assert((await evalJS("document.getElementById('mf-date').max")) === today, "日期 max=今天");
  const expectType = await evalJS("defaultMealType(new Date().getHours())");
  assert((await evalJS("state.mealFormType")) === expectType, "餐次默认按当前小时: " + expectType);
  // 勾选第一道菜 + 填感想 + 提交
  await evalJS("(function () {" +
    "var cb = document.querySelector('#mf-dish-list input[data-dish-id]');" +
    "if (cb) { cb.checked = true; cb.dispatchEvent(new Event('change', {bubbles:true})); }" +
    "document.getElementById('mf-note').value = '测试饭记：好吃';" +
    "document.getElementById('meal-form').dispatchEvent(new Event('submit', {cancelable:true}));" +
    "return true;})()");
  await new Promise(r => setTimeout(r, 1200));
  assert((await evalJS("state.view")) === "meals", "保存后回到时间线");
  assert((await evalJS("getMeals().length")) === 1, "饭记已写入");
  assert((await evalJS("isChecked('" + today + "')")) === true, "保存饭记自动打卡");
  assert((await evalJS("document.querySelectorAll('#meals-timeline .meal-card').length")) === 1, "时间线显示 1 张卡");
  assert((await evalJS("document.querySelector('#meals-timeline .meal-day').textContent")) === "今天", "日期头显示「今天」");
  assert((await evalJS("document.querySelector('.meal-note').textContent")) === "测试饭记：好吃", "感想渲染");

  console.log("== 首页摘要卡 ==");
  await evalJS("showView('home')");
  await new Promise(r => setTimeout(r, 300));
  assert((await evalJS("document.getElementById('today-meals-count').textContent")) === "1 顿", "首页显示 1 顿");
  assert((await evalJS("document.getElementById('checkin-stats').textContent.indexOf('打卡') !== -1")) === true, "打卡统计已渲染");

  console.log("== 饭记 chip 跳菜详情 + 返回 ==");
  await evalJS("showView('meals')");
  const hasChip = await evalJS("document.querySelector('.meal-chip') !== null");
  assert(hasChip === true, "饭记卡含菜名 chip");
  await evalJS("document.querySelector('.meal-chip').click()");
  await new Promise(r => setTimeout(r, 400));
  assert((await evalJS("state.view")) === "detail", "chip 跳到菜详情");
  assert((await evalJS("document.getElementById('detail-content').innerHTML.length > 0")) === true, "详情渲染");
  await evalJS("document.getElementById('btn-back').click()");
  await new Promise(r => setTimeout(r, 300));
  assert((await evalJS("state.view")) === "meals", "返回回到饭记页");

  console.log("== 编辑改日期 → 新日期打卡、旧日期保留 ==");
  const yesterday = await evalJS("dateKeyAddDays('" + today + "', -1)");
  await evalJS("document.querySelector('.meal-card').click()");
  await new Promise(r => setTimeout(r, 300));
  assert((await evalJS("state.view")) === "meal-form", "点卡片进入编辑");
  await evalJS("(function () {" +
    "document.getElementById('mf-date').value = '" + yesterday + "';" +
    "document.getElementById('meal-form').dispatchEvent(new Event('submit', {cancelable:true}));" +
    "return true;})()");
  await new Promise(r => setTimeout(r, 800));
  assert((await evalJS("getMeals()[0].date")) === yesterday, "日期已改到昨天");
  assert((await evalJS("isChecked('" + yesterday + "')")) === true, "新日期已打卡");
  assert((await evalJS("isChecked('" + today + "')")) === true, "旧日期打卡保留");
  assert((await evalJS("document.querySelector('#meals-timeline .meal-day').textContent")) === "昨天", "日期头显示「昨天」");

  console.log("== 未来日期拒绝 ==");
  await evalJS("openMealForm(null)");
  await new Promise(r => setTimeout(r, 200));
  const future = await evalJS("dateKeyAddDays('" + today + "', 3)");
  const alertMsg = await evalJS("(async function () {" +
    "var msg = ''; var orig = window.alert;" +
    "window.alert = function (m) { msg = m; };" +
    "document.getElementById('mf-date').value = '" + future + "';" +
    "document.getElementById('meal-form').dispatchEvent(new Event('submit', {cancelable:true}));" +
    "await new Promise(function (r) { setTimeout(r, 100); });" +
    "window.alert = orig; return msg;})()");
  assert(alertMsg.indexOf("未来") !== -1, "未来日期被拒绝: " + alertMsg);
  await evalJS("showView('meals')");

  console.log("== 删除饭记（打卡保留） ==");
  // headless 下 window.confirm 会阻塞主线程等用户点按钮，先接管为直接确认
  await evalJS("window.confirm = function () { return true; };");
  await evalJS("document.querySelector('.meal-card').click()");
  await new Promise(r => setTimeout(r, 300));
  await evalJS("document.getElementById('mf-btn-delete').click()");
  await new Promise(r => setTimeout(r, 800));
  assert((await evalJS("getMeals().length")) === 0, "饭记已删除");
  assert((await evalJS("isChecked('" + yesterday + "')")) === true, "删除后打卡保留");
  assert((await evalJS("!document.getElementById('meals-empty').classList.contains('hidden')")) === true, "时间线回到空态");

  console.log("== iOS 视觉（375px） ==");
  await send("Emulation.setDeviceMetricsOverride", { width: 375, height: 812, deviceScaleFactor: 2, mobile: true });
  await new Promise(r => setTimeout(r, 400));
  const titleSize = await evalJS("getComputedStyle(document.querySelector('.page-title')).fontSize");
  assert(titleSize === "30px" || titleSize === "34px", "大标题 30/34px: " + titleSize);
  const blur = await evalJS("getComputedStyle(document.querySelector('.bottom-nav')).backdropFilter || getComputedStyle(document.querySelector('.bottom-nav')).webkitBackdropFilter");
  assert(blur.indexOf("blur(20px)") !== -1, "底栏毛玻璃: " + blur);
  const cardRadius = await evalJS("getComputedStyle(document.querySelector('.card')).borderRadius");
  assert(cardRadius === "16px", "卡片圆角 16px");
  const tabNums = await evalJS("getComputedStyle(document.getElementById('checkin-stats')).fontVariantNumeric");
  assert(tabNums.indexOf("tabular-nums") !== -1, "统计数字 tabular-nums");
  const widths = await evalJS("[...document.querySelectorAll('.bottom-nav .nav-item')].map(b => b.offsetWidth).join(',')");
  const wArr = widths.split(",").map(Number);
  assert(wArr.length === 5 && Math.max(...wArr) - Math.min(...wArr) <= 1, "5 Tab 均分: " + widths);

  console.log("== 清理现场 ==");
  await evalJS("clearAllData()");

  console.log("\n结果: " + pass + " 通过, " + fail + " 失败");
  process.exit(fail ? 1 : 0);
})().catch(e => { console.error("脚本错误:", e.message); process.exit(1); });
