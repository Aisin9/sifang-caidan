/* ============================================
   app.js — 界面层
   负责：视图切换、列表渲染与搜索、表单收集、
        步骤拖拽排序、抽签交互、备份导入导出
   依赖：store.js / image.js / random.js（需先引入）
   ============================================ */

// ---- 界面状态：记录「当前在哪、正在编辑什么」 ----
var state = {
  listCategory: "全部",   // 列表页选中的分类
  searchQuery: "",        // 搜索关键词
  pickCategory: "全部",   // 抽签页选中的分类
  pickMode: "equal",      // equal = 等概率 | weighted = 加权
  currentId: null,        // 详情页正在看的菜品 id
  editingId: null,        // 表单正在编辑的菜品 id（null = 新增）
  // 表单的临时数据（点「保存」前只存在内存里，不写库）
  formImage: "",
  formRating: 0,
  formIngredients: [],
  formSteps: [],
  formTags: [],
  lastPick: null          // 最近一次抽中的菜品
};

// ---- 工具函数 ----

// 把用户输入的内容转义，防止拼进 HTML 时出问题（如菜名里带 < > 符号）
function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, function (c) {
    return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c];
  });
}

// 生成爱心 HTML。interactive = true 时爱心可点击打分
function heartsHTML(rating, interactive) {
  var html = "";
  for (var i = 1; i <= 5; i++) {
    var cls = "heart" + (i <= rating ? " filled" : "");
    if (interactive) {
      html += '<span class="' + cls + '" data-action="set-rating" data-value="' + i + '">♥</span>';
    } else {
      html += '<span class="' + cls + '">♥</span>';
    }
  }
  return html;
}

// ---- 视图切换 ----

function showView(name) {
  state.view = name;
  ["list", "detail", "form", "pick", "backup"].forEach(function (v) {
    document.getElementById("view-" + v).classList.toggle("hidden", v !== name);
  });

  // 导航高亮：详情和表单都算「菜单」页
  var navKey = (name === "detail" || name === "form") ? "list" : name;
  document.querySelectorAll(".nav-btn").forEach(function (btn) {
    btn.classList.toggle("active", btn.dataset.view === navKey);
  });

  // 浮动添加按钮只在列表页显示
  document.getElementById("fab").classList.toggle("hidden", name !== "list");

  // 进入视图时刷新对应内容
  if (name === "list") renderList();
  if (name === "detail") renderDetail();
  if (name === "pick") renderPickView();
  if (name === "backup") renderBackupView();
}

// 渲染一排分类 chips（列表页和抽签页共用）
// selected: 当前选中的分类名；onSelect: 点 chip 后的回调
function renderChips(container, selected, onSelect) {
  var cats = ["全部"].concat(getCategories());
  container.innerHTML = cats.map(function (c) {
    return '<button class="chip' + (c === selected ? " active" : "") + '" data-cat="' + escapeHtml(c) + '">' + escapeHtml(c) + "</button>";
  }).join("");
  // 事件委托：只绑一次容器，动态生成的 chip 也能响应
  container.onclick = function (e) {
    var btn = e.target.closest(".chip");
    if (btn) onSelect(btn.dataset.cat);
  };
}

// ============================================
// 视图 1：菜单列表（含搜索）
// ============================================

// 搜索 + 分类过滤：query 匹配菜名 / 标签 / 食材，不区分大小写
function filterDishes(query, category) {
  query = (query || "").trim().toLowerCase();
  return getDishes().filter(function (d) {
    if (category !== "全部" && d.category !== category) return false;
    if (!query) return true;
    var hay = (d.name + " " + (d.tags || []).join(" ") + " " + (d.ingredients || []).join(" ")).toLowerCase();
    return hay.indexOf(query) !== -1;
  });
}

function dishCardHTML(d) {
  var img = d.image
    ? '<img src="' + d.image + '" alt="' + escapeHtml(d.name) + '" loading="lazy">'
    : '<div class="card-placeholder">🍽️</div>';
  var tags = (d.tags || []).slice(0, 3).map(function (t) {
    return '<span class="tag">' + escapeHtml(t) + "</span>";
  }).join("");
  return (
    '<div class="dish-card" data-action="open-detail" data-id="' + d.id + '">' +
      '<div class="card-img">' + img + "</div>" +
      '<div class="card-body">' +
        '<h3 class="card-name">' + escapeHtml(d.name) + "</h3>" +
        '<span class="badge">' + escapeHtml(d.category || "未分类") + "</span>" +
        '<div class="hearts small">' + heartsHTML(d.rating || 0, false) + "</div>" +
        (tags ? '<div class="card-tags">' + tags + "</div>" : "") +
      "</div>" +
    "</div>"
  );
}

function renderList() {
  renderChips(document.getElementById("category-chips"), state.listCategory, function (c) {
    state.listCategory = c;
    renderList();
  });

  var all = getDishes().length;
  var list = filterDishes(state.searchQuery, state.listCategory);
  document.getElementById("dish-grid").innerHTML = list.map(dishCardHTML).join("");

  // 空状态分两种：真的没菜 vs 搜索/筛选没结果
  var empty = document.getElementById("list-empty");
  if (list.length === 0) {
    empty.classList.remove("hidden");
    if (all === 0) {
      empty.innerHTML = '<div class="empty-icon">🍳</div><p>还没有菜品<br>点右下角「＋」添加第一道菜吧</p>';
    } else {
      empty.innerHTML = '<div class="empty-icon">🔍</div><p>没有找到匹配的菜品<br>换个关键词或分类试试</p>';
    }
  } else {
    empty.classList.add("hidden");
  }
}

// ============================================
// 视图 2：菜品详情
// ============================================

function renderDetail() {
  var d = getDish(state.currentId);
  if (!d) { showView("list"); return; } // 菜品已被删，回列表

  var img = d.image
    ? '<div class="detail-img"><img src="' + d.image + '" alt="' + escapeHtml(d.name) + '"></div>'
    : "";
  var ings = (d.ingredients || []).map(function (i) { return "<li>" + escapeHtml(i) + "</li>"; }).join("");
  var steps = (d.steps || []).map(function (s) { return "<li>" + escapeHtml(s) + "</li>"; }).join("");
  var tags = (d.tags || []).map(function (t) { return '<span class="tag">' + escapeHtml(t) + "</span>"; }).join("");

  document.getElementById("detail-content").innerHTML =
    img +
    '<h2 class="detail-name">' + escapeHtml(d.name) + "</h2>" +
    '<div class="detail-meta">' +
      '<span class="badge">' + escapeHtml(d.category || "未分类") + "</span>" +
      '<div class="hearts">' + heartsHTML(d.rating || 0, false) + "</div>" +
    "</div>" +
    (tags ? '<div class="detail-tags">' + tags + "</div>" : "") +
    (ings ? "<h3>食材清单</h3><ul class=\"ingredient-detail\">" + ings + "</ul>" : "") +
    (steps ? "<h3>做法步骤</h3><ol class=\"steps-detail\">" + steps + "</ol>" : "");
}

// ============================================
// 视图 3：添加 / 编辑表单
// ============================================

// 打开表单：id 为空 = 新增；有 id = 编辑（预填数据）
function openForm(id) {
  state.editingId = id || null;
  var d = id ? getDish(id) : null;

  // 重置表单临时数据
  state.formImage = d ? (d.image || "") : "";
  state.formRating = d ? (d.rating || 0) : 0;
  state.formIngredients = d ? (d.ingredients || []).slice() : [];
  state.formSteps = d ? (d.steps || []).slice() : [];
  state.formTags = d ? (d.tags || []).slice() : [];

  document.getElementById("form-title").textContent = d ? "编辑菜品" : "添加菜品";
  document.getElementById("f-name").value = d ? d.name : "";
  document.getElementById("f-name").classList.remove("error");
  document.getElementById("f-category").value = d ? (d.category || "") : "";

  renderCategoryDatalist();
  renderImageBox();
  renderIngredientList();
  renderStepList();
  renderTagList();
  renderRatingPicker();

  showView("form");
}

function renderCategoryDatalist() {
  document.getElementById("category-options").innerHTML = getCategories().map(function (c) {
    return '<option value="' + escapeHtml(c) + '"></option>';
  }).join("");
}

// ---- 图片 ----

function renderImageBox() {
  var box = document.getElementById("image-preview-box");
  if (state.formImage) {
    document.getElementById("image-preview").src = state.formImage;
    box.classList.remove("hidden");
  } else {
    document.getElementById("image-preview").removeAttribute("src");
    box.classList.add("hidden");
  }
}

// ---- 食材 ----

function renderIngredientList() {
  document.getElementById("ingredient-list").innerHTML = state.formIngredients.map(function (item, i) {
    return (
      "<li>" +
        '<span class="item-text">' + escapeHtml(item) + "</span>" +
        '<button type="button" class="btn-remove" data-action="remove-ingredient" data-index="' + i + '">×</button>' +
      "</li>"
    );
  }).join("");
}

// ---- 步骤（支持拖拽排序 + 上下移按钮）----

function renderStepList() {
  document.getElementById("step-list").innerHTML = state.formSteps.map(function (s, i) {
    var isFirst = i === 0;
    var isLast = i === state.formSteps.length - 1;
    return (
      '<li class="step-item" draggable="true" data-index="' + i + '">' +
        '<span class="drag-handle" title="按住拖动排序">⠿</span>' +
        '<span class="step-num">' + (i + 1) + ".</span>" +
        '<span class="item-text">' + escapeHtml(s) + "</span>" +
        '<span class="step-actions">' +
          '<button type="button" class="btn-arrow" data-action="move-step" data-dir="-1" data-index="' + i + '"' + (isFirst ? " disabled" : "") + ' title="上移">↑</button>' +
          '<button type="button" class="btn-arrow" data-action="move-step" data-dir="1" data-index="' + i + '"' + (isLast ? " disabled" : "") + ' title="下移">↓</button>' +
          '<button type="button" class="btn-remove" data-action="remove-step" data-index="' + i + '">×</button>' +
        "</span>" +
      "</li>"
    );
  }).join("");
}

// 上移 / 下移一步（手机上没有鼠标拖拽，用这两个按钮兜底）
function moveStep(index, dir) {
  var j = index + dir;
  if (j < 0 || j >= state.formSteps.length) return;
  var tmp = state.formSteps[index];
  state.formSteps[index] = state.formSteps[j];
  state.formSteps[j] = tmp;
  renderStepList();
}

// 拖拽排序（HTML5 拖拽，桌面端用）
// 思路：dragstart 记住「谁被拖」，dragover 高亮落点，drop 时交换数组顺序再重渲染
function bindStepDrag() {
  var ol = document.getElementById("step-list");
  var dragIndex = null;

  ol.addEventListener("dragstart", function (e) {
    var li = e.target.closest(".step-item");
    if (!li) return;
    dragIndex = Number(li.dataset.index);
    li.classList.add("dragging");
    e.dataTransfer.effectAllowed = "move";
  });

  // 必须 preventDefault 才能允许 drop（浏览器默认禁止把东西拖进去）
  ol.addEventListener("dragover", function (e) {
    e.preventDefault();
    var li = e.target.closest(".step-item");
    ol.querySelectorAll(".drag-over").forEach(function (el) { el.classList.remove("drag-over"); });
    if (li) li.classList.add("drag-over");
  });

  ol.addEventListener("drop", function (e) {
    e.preventDefault();
    var li = e.target.closest(".step-item");
    ol.querySelectorAll(".drag-over").forEach(function (el) { el.classList.remove("drag-over"); });
    if (!li || dragIndex === null) return;
    var targetIndex = Number(li.dataset.index);
    if (targetIndex !== dragIndex) {
      // splice 移动：先把源删掉，再插到目标位置
      var moved = state.formSteps.splice(dragIndex, 1)[0];
      state.formSteps.splice(targetIndex, 0, moved);
      renderStepList();
    }
  });

  ol.addEventListener("dragend", function () {
    dragIndex = null;
    ol.querySelectorAll(".dragging").forEach(function (el) { el.classList.remove("dragging"); });
  });
}

// ---- 标签 ----

function renderTagList() {
  document.getElementById("tag-list").innerHTML = state.formTags.map(function (t, i) {
    return (
      '<span class="tag chip-tag">' + escapeHtml(t) +
      '<button type="button" class="tag-x" data-action="remove-tag" data-index="' + i + '">×</button></span>'
    );
  }).join("");
}

// ---- 喜爱度 ----

function renderRatingPicker() {
  document.getElementById("rating-picker").innerHTML = heartsHTML(state.formRating, true);
  document.getElementById("rating-hint").textContent =
    state.formRating === 0 ? "还没评分（不评分也能保存）" : state.formRating + " 颗心";
}

// ---- 保存表单 ----

async function saveForm(e) {
  e.preventDefault();

  var name = document.getElementById("f-name").value.trim();
  if (!name) {
    document.getElementById("f-name").classList.add("error");
    alert("请填写菜名");
    return;
  }

  var dish = {
    name: name,
    category: document.getElementById("f-category").value.trim() || "未分类",
    tags: state.formTags,
    ingredients: state.formIngredients,
    steps: state.formSteps,
    rating: state.formRating,
    image: state.formImage
  };

  var ok;
  if (state.editingId) {
    ok = await updateDish(state.editingId, dish);
  } else {
    ok = await addDish(dish);
  }
  // 保存失败（如空间不足）时留在表单页，内容不丢
  if (!ok) return;

  if (state.editingId) {
    state.currentId = state.editingId;
    showView("detail");
  } else {
    showView("list");
  }
}

// ============================================
// 视图 4：今天吃什么
// ============================================

function renderPickView() {
  renderChips(document.getElementById("pick-category-chips"), state.pickCategory, function (c) {
    state.pickCategory = c;
    renderPickView();
  });
  updatePickButton();
}

// 没菜可抽时禁用按钮并说明原因
function updatePickButton() {
  var btn = document.getElementById("btn-pick");
  var hint = document.getElementById("pick-empty-hint");
  var pool = filterDishes("", state.pickCategory);
  if (pool.length === 0) {
    btn.disabled = true;
    hint.classList.remove("hidden");
    hint.textContent = state.pickCategory === "全部"
      ? "还没有菜品，先去「菜单」页添加一道菜吧"
      : "「" + state.pickCategory + "」分类下还没有菜品";
  } else {
    btn.disabled = false;
    hint.classList.add("hidden");
  }
}

function handlePick() {
  var pool = filterDishes("", state.pickCategory);
  if (pool.length === 0) return;

  // 先按当前模式定好中奖者，动画只是表演
  var dish = state.pickMode === "weighted" ? pickWeighted(pool) : pickEqual(pool);
  state.lastPick = dish;
  var finalIndex = pool.indexOf(dish);

  var box = document.getElementById("roulette-box");
  var result = document.getElementById("pick-result");
  var btn = document.getElementById("btn-pick");
  result.classList.add("hidden");
  box.classList.remove("hidden");
  btn.disabled = true; // 动画期间防止连点

  runRoulette(
    pool.map(function (d) { return d.name; }),
    finalIndex,
    function (name, isFinal) {
      box.textContent = name;
      box.classList.toggle("final", isFinal);
    },
    function () {
      renderPickResult();
      btn.disabled = false;
    }
  );
}

function renderPickResult() {
  var d = state.lastPick;
  var img = d.image
    ? '<div class="result-img"><img src="' + d.image + '" alt="' + escapeHtml(d.name) + '"></div>'
    : "";
  var div = document.getElementById("pick-result");
  div.innerHTML =
    '<div class="result-card">' +
      img +
      "<h3>" + escapeHtml(d.name) + "</h3>" +
      '<div class="detail-meta" style="justify-content:center">' +
        '<span class="badge">' + escapeHtml(d.category || "未分类") + "</span>" +
        '<div class="hearts">' + heartsHTML(d.rating || 0, false) + "</div>" +
      "</div>" +
      '<div class="result-actions">' +
        '<button class="btn" data-action="pick-detail">查看详情</button>' +
        '<button class="btn btn-primary" data-action="pick-again">再抽一次</button>' +
      "</div>" +
    "</div>";
  div.classList.remove("hidden");
  div.classList.add("pop-in");
}

// ============================================
// 视图 5：备份
// ============================================

async function renderBackupView() {
  var n = getDishes().length;
  var s = await getStorageStats();
  var quotaText = s.supported ? formatSize(s.quotaKB) : "未知";
  document.getElementById("backup-stats").innerHTML =
    "已存 <b>" + n + "</b> 道菜品 · 存储已用约 <b>" + formatSize(s.usageKB) +
    "</b> / 浏览器配额约 <b>" + quotaText +
    "</b>（配额由浏览器按磁盘空间动态分配，通常几百 MB ~ 几 GB）";
  updatePersistHint();
}

// 显示持久化存储状态；已获准则提示用户无需担心数据被清理
async function updatePersistHint() {
  var hint = document.getElementById("persist-hint");
  if (!(navigator.storage && navigator.storage.persisted)) return;
  var persisted = false;
  try { persisted = await navigator.storage.persisted(); } catch (e) { /* 忽略 */ }
  if (persisted) {
    hint.textContent = "✅ 已获准持久化存储：浏览器不会在磁盘紧张时清理你的数据";
  }
}

function exportData() {
  var blob = new Blob([JSON.stringify(getData(), null, 2)], { type: "application/json" });
  var url = URL.createObjectURL(blob);
  var a = document.createElement("a");
  var now = new Date();
  var pad = function (n) { return String(n).padStart(2, "0"); };
  a.href = url;
  a.download = "私房菜单备份-" + now.getFullYear() + "-" + pad(now.getMonth() + 1) + "-" + pad(now.getDate()) + ".json";
  document.body.appendChild(a);
  a.click();          // 触发下载
  a.remove();
  URL.revokeObjectURL(url); // 释放临时链接
}

function handleImportFile(file) {
  var reader = new FileReader();
  reader.onload = async function () {
    // 校验 1：必须是合法 JSON
    var data;
    try {
      data = JSON.parse(reader.result);
    } catch (e) {
      alert("导入失败：不是有效的 JSON 文件");
      return;
    }
    // 校验 2：必须是私房菜单的备份结构
    if (!data || !Array.isArray(data.dishes)) {
      alert("导入失败：这不是「私房菜单」的备份文件");
      return;
    }
    // 校验 3：每道菜必须有菜名
    var bad = data.dishes.filter(function (d) {
      return !d || typeof d.name !== "string" || !d.name.trim();
    }).length;
    if (bad > 0) {
      alert("导入失败：备份中有 " + bad + " 道菜品缺少菜名");
      return;
    }

    // 确定 = 合并（按 id 跳过重复）；取消 = 覆盖当前全部数据
    var merge = confirm("点「确定」= 合并进现有菜单（重复的菜会跳过）\n点「取消」= 用备份覆盖当前全部数据");
    var ok = true;
    if (merge) {
      var cur = getData();
      var ids = new Set(cur.dishes.map(function (d) { return d.id; }));
      var skipped = 0;
      data.dishes.forEach(function (d) {
        if (ids.has(d.id)) {
          skipped++;
        } else {
          cur.dishes.push(d);
        }
      });
      (data.categories || []).forEach(function (c) {
        addCategoryToData(cur, c);
      });
      ok = await saveData();
      if (ok) {
        alert("导入完成：新增 " + (data.dishes.length - skipped) + " 道菜品" + (skipped ? "，跳过 " + skipped + " 道重复" : ""));
      }
    } else {
      if (confirm("确定用备份覆盖当前全部数据吗？当前数据将丢失（此操作不可恢复）")) {
        setData({
          version: data.version || 1,
          categories: (data.categories && data.categories.length) ? data.categories : defaultData().categories,
          dishes: data.dishes
        });
        ok = await saveData();
        if (ok) alert("导入完成：已恢复为备份内容");
      }
    }
    showView("list");
  };
  reader.readAsText(file, "utf-8");
}

// ============================================
// 初始化：绑定所有事件
// ============================================

function init() {
  // 先初始化数据层（读 IndexedDB + 旧版迁移），完成后再绑定界面事件
  initStore().then(bindAllEvents).catch(function (e) {
    console.error(e);
    alert("数据初始化失败，请刷新页面重试");
  });
}

function bindAllEvents() {
  // ---- 顶部导航 ----
  document.querySelectorAll(".nav-btn").forEach(function (btn) {
    btn.addEventListener("click", function () { showView(btn.dataset.view); });
  });

  // ---- 列表页 ----
  document.getElementById("fab").addEventListener("click", function () { openForm(null); });

  var searchInput = document.getElementById("search-input");
  searchInput.addEventListener("input", function () {
    state.searchQuery = searchInput.value;
    renderList();
  });

  // 卡片点击：事件委托（卡片是动态生成的，绑定在网格容器上）
  document.getElementById("dish-grid").addEventListener("click", function (e) {
    var card = e.target.closest("[data-action='open-detail']");
    if (card) {
      state.currentId = card.dataset.id;
      showView("detail");
    }
  });

  // ---- 详情页 ----
  document.getElementById("btn-back").addEventListener("click", function () { showView("list"); });
  document.getElementById("btn-edit").addEventListener("click", function () { openForm(state.currentId); });
  document.getElementById("btn-delete").addEventListener("click", async function () {
    var d = getDish(state.currentId);
    if (!d) return;
    if (confirm("确定删除「" + d.name + "」吗？删除后无法恢复")) {
      await deleteDish(d.id);
      showView("list");
    }
  });

  // ---- 表单 ----
  document.getElementById("dish-form").addEventListener("submit", saveForm);
  document.getElementById("btn-cancel").addEventListener("click", function () {
    showView(state.editingId ? "detail" : "list");
  });
  // 输入菜名后自动清除红色错误标记
  document.getElementById("f-name").addEventListener("input", function () {
    this.classList.remove("error");
  });

  // 图片选择与移除
  var imageInput = document.getElementById("f-image");
  document.getElementById("btn-pick-image").addEventListener("click", function () {
    imageInput.click();
  });
  imageInput.addEventListener("change", function () {
    var file = imageInput.files[0];
    if (!file) return;
    if (file.type.indexOf("image/") !== 0) { alert("请选择图片文件"); return; }
    compressImage(file).then(function (dataUrl) {
      state.formImage = dataUrl;
      renderImageBox();
    }).catch(function () {
      alert("图片处理失败，请换一张试试");
    });
    imageInput.value = ""; // 清空，保证选同一张图也能再次触发 change
  });
  document.getElementById("btn-remove-image").addEventListener("click", function () {
    state.formImage = "";
    renderImageBox();
  });

  // 食材：添加 / 删除（回车也能快速添加）
  var addIngredient = function () {
    var input = document.getElementById("f-ingredient");
    var v = input.value.trim();
    if (!v) return;
    state.formIngredients.push(v);
    input.value = "";
    renderIngredientList();
  };
  document.getElementById("btn-add-ingredient").addEventListener("click", addIngredient);
  document.getElementById("f-ingredient").addEventListener("keydown", function (e) {
    if (e.key === "Enter") { e.preventDefault(); addIngredient(); }
  });
  document.getElementById("ingredient-list").addEventListener("click", function (e) {
    var btn = e.target.closest("[data-action='remove-ingredient']");
    if (btn) {
      state.formIngredients.splice(Number(btn.dataset.index), 1);
      renderIngredientList();
    }
  });

  // 步骤：添加 / 删除 / 上移下移 / 拖拽
  var addStep = function () {
    var input = document.getElementById("f-step");
    var v = input.value.trim();
    if (!v) return;
    state.formSteps.push(v);
    input.value = "";
    renderStepList();
  };
  document.getElementById("btn-add-step").addEventListener("click", addStep);
  document.getElementById("f-step").addEventListener("keydown", function (e) {
    if (e.key === "Enter") { e.preventDefault(); addStep(); }
  });
  document.getElementById("step-list").addEventListener("click", function (e) {
    var moveBtn = e.target.closest("[data-action='move-step']");
    if (moveBtn) { moveStep(Number(moveBtn.dataset.index), Number(moveBtn.dataset.dir)); return; }
    var delBtn = e.target.closest("[data-action='remove-step']");
    if (delBtn) {
      state.formSteps.splice(Number(delBtn.dataset.index), 1);
      renderStepList();
    }
  });
  bindStepDrag();

  // 标签：添加 / 删除
  var addTag = function () {
    var input = document.getElementById("f-tag");
    var v = input.value.trim();
    if (!v) return;
    if (state.formTags.indexOf(v) !== -1) { alert("这个标签已经有了"); return; }
    if (state.formTags.length >= 8) { alert("标签最多 8 个"); return; }
    state.formTags.push(v);
    input.value = "";
    renderTagList();
  };
  document.getElementById("btn-add-tag").addEventListener("click", addTag);
  document.getElementById("f-tag").addEventListener("keydown", function (e) {
    if (e.key === "Enter") { e.preventDefault(); addTag(); }
  });
  document.getElementById("tag-list").addEventListener("click", function (e) {
    var btn = e.target.closest("[data-action='remove-tag']");
    if (btn) {
      state.formTags.splice(Number(btn.dataset.index), 1);
      renderTagList();
    }
  });

  // 喜爱度：点第 n 颗心 = n 分；再点当前分数的那颗 = 取消评分
  document.getElementById("rating-picker").addEventListener("click", function (e) {
    var heart = e.target.closest("[data-action='set-rating']");
    if (!heart) return;
    var v = Number(heart.dataset.value);
    state.formRating = (v === state.formRating) ? 0 : v;
    renderRatingPicker();
  });

  // ---- 抽签页 ----
  document.querySelectorAll(".seg-btn").forEach(function (btn) {
    btn.addEventListener("click", function () {
      state.pickMode = btn.dataset.mode;
      document.querySelectorAll(".seg-btn").forEach(function (b) {
        b.classList.toggle("active", b === btn);
      });
    });
  });
  document.getElementById("btn-pick").addEventListener("click", handlePick);
  document.getElementById("pick-result").addEventListener("click", function (e) {
    var detailBtn = e.target.closest("[data-action='pick-detail']");
    if (detailBtn) {
      state.currentId = state.lastPick.id;
      showView("detail");
      return;
    }
    if (e.target.closest("[data-action='pick-again']")) handlePick();
  });

  // ---- 备份页 ----
  document.getElementById("btn-export").addEventListener("click", exportData);
  var importFileInput = document.getElementById("import-file");
  document.getElementById("btn-import").addEventListener("click", function () {
    importFileInput.click();
  });
  importFileInput.addEventListener("change", function () {
    var file = importFileInput.files[0];
    if (file) handleImportFile(file);
    importFileInput.value = "";
  });
  document.getElementById("btn-clear-all").addEventListener("click", async function () {
    if (!confirm("确定清空全部数据吗？")) return;
    if (!confirm("再次确认：所有菜品将永久删除（建议先导出备份）！")) return;
    await clearAllData();
    showView("list");
  });

  // 申请持久化存储：浏览器只授予「安装到桌面/主屏幕」的应用（PWA）
  document.getElementById("btn-persist").addEventListener("click", async function () {
    var hint = document.getElementById("persist-hint");
    if (!(navigator.storage && navigator.storage.persist)) {
      hint.textContent = "当前浏览器不支持持久化存储";
      return;
    }
    var granted = false;
    try { granted = await navigator.storage.persist(); } catch (e) { /* 忽略 */ }
    hint.textContent = granted
      ? "✅ 已获准：浏览器不会在磁盘紧张时自动清理你的数据"
      : "未获准（浏览器只授予已安装的应用）。把网站「安装」到桌面/主屏幕后会自动获准；即使未获准，数据一般也不会被清理";
  });

  // 注册离线缓存（Service Worker）：让网站可安装成应用 + 断网可用。
  // 仅 https 环境生效（本地 file:// 打开会自动跳过，不影响使用）
  if ("serviceWorker" in navigator) {
    navigator.serviceWorker.register("sw.js").catch(function (e) {
      console.warn("离线缓存注册失败（不影响使用）：", e);
    });
  }

  // 已安装为桌面/主屏幕应用时，Chrome 会自动授予持久化存储；
  // 这里对其他浏览器（如 Safari）补一次请求
  if (window.matchMedia && window.matchMedia("(display-mode: standalone)").matches &&
      navigator.storage && navigator.storage.persist) {
    navigator.storage.persist().catch(function () { /* 忽略 */ });
  }

  // ---- 启动：显示列表页 ----
  showView("list");
}

// 等 HTML 加载完再执行（脚本在 body 末尾也可以不写这行，
// 但写上更保险，也能保证 DOM 一定存在）
document.addEventListener("DOMContentLoaded", init);
