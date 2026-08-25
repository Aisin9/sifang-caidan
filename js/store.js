/* ============================================
   store.js — 数据层
   负责：localStorage 的读写 + 菜品的增删改查
   所有函数都是全局的，供 app.js 调用
   ============================================ */

var STORAGE_KEY = "privateMenuData";

// 默认数据结构（第一次使用时初始化）
function defaultData() {
  return {
    version: 1,
    categories: ["荤菜", "素菜", "汤羹", "主食", "快手菜"],
    dishes: []
  };
}

// 从 localStorage 读取全部数据；数据损坏时回退到空数据
function loadData() {
  try {
    var raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return defaultData();
    var data = JSON.parse(raw);
    if (!data || !Array.isArray(data.dishes)) return defaultData();
    if (!Array.isArray(data.categories) || data.categories.length === 0) {
      data.categories = defaultData().categories;
    }
    return data;
  } catch (e) {
    alert("本地数据读取失败，已重置为空数据。");
    return defaultData();
  }
}

// 保存全部数据。
// 成功返回 true；存储空间不足时弹出友好提示并返回 false（表单内容不会丢）
function saveData(data) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
    return true;
  } catch (e) {
    alert(
      "本地存储空间不足（浏览器上限约 5MB，图片占大头）。\n" +
      "建议：删除部分菜品图片，或先到「备份」页导出数据。\n" +
      "本次修改尚未保存，当前表单内容不会丢失。"
    );
    return false;
  }
}

// 生成唯一 ID：时间戳转 36 进制 + 随机串，冲突概率可忽略
function uid() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
}

// ---- 菜品增删改查 ----

function getDishes() {
  return loadData().dishes;
}

function getDish(id) {
  return loadData().dishes.find(function (d) { return d.id === id; }) || null;
}

// 新增菜品：自动补 id 和时间戳，返回是否保存成功
function addDish(dish) {
  var data = loadData();
  dish.id = uid();
  dish.createdAt = Date.now();
  dish.updatedAt = dish.createdAt;
  fillDishDefaults(dish);
  data.dishes.push(dish);
  if (dish.category) addCategoryToData(data, dish.category);
  return saveData(data);
}

// 更新菜品：合并字段，刷新 updatedAt，返回是否保存成功
function updateDish(id, patch) {
  var data = loadData();
  var dish = data.dishes.find(function (d) { return d.id === id; });
  if (!dish) return false;
  Object.assign(dish, patch);
  dish.updatedAt = Date.now();
  if (dish.category) addCategoryToData(data, dish.category);
  return saveData(data);
}

function deleteDish(id) {
  var data = loadData();
  data.dishes = data.dishes.filter(function (d) { return d.id !== id; });
  return saveData(data);
}

// 防止漏存字段：给缺失的字段补默认值
function fillDishDefaults(dish) {
  dish.tags = dish.tags || [];
  dish.ingredients = dish.ingredients || [];
  dish.steps = dish.steps || [];
  dish.rating = dish.rating || 0;
  dish.image = dish.image || "";
}

// ---- 分类 ----

function getCategories() {
  return loadData().categories;
}

// 把新分类加进 data（自动去重）
function addCategoryToData(data, name) {
  name = String(name).trim();
  if (name && data.categories.indexOf(name) === -1) {
    data.categories.push(name);
  }
}

// 当前数据占用多少 KB（备份页显示用量）
function getUsageKB() {
  var raw = localStorage.getItem(STORAGE_KEY) || "";
  return Math.round(raw.length / 1024);
}

// 清空全部数据
function clearAllData() {
  localStorage.removeItem(STORAGE_KEY);
}
