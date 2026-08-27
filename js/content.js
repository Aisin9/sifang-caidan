/* ============================================
   content.js — 内置内容（纯数据，最先引入）
   1. SAMPLE_DISHES：示例菜品（首次启动一次性注入菜单）
   2. SEASONAL_ITEMS：时令推荐库（首页轮播，按月份匹配）
   3. PHOTO_CREDITS：内置照片的许可致谢（「我的」页展示）
   4. makePlaceholderImage()：生成「渐变 + emoji」占位图（无图/图片加载失败兜底）

   照片说明：内置照片来自 Wikimedia Commons（许可 CC0/CC BY/CC BY-SA/公有领域），
   已压缩至 ≤300KB 存于 images/ 目录。colors/emoji 保留作加载中/失败时的兜底视觉。
   ============================================ */

// 注入批次号：示例菜内容改了就把这里 +1，
// 这样所有用户下次打开会注入新一批（老批次不重复）
var SAMPLE_DISHES_VERSION = 1;

// 5 道经典家常菜（emoji/colors 用于图片加载失败时的兜底占位）
var SAMPLE_DISHES = [
  {
    name: "红烧肉", category: "荤菜", tags: ["下饭", "硬菜", "家常"], rating: 5,
    emoji: "🍖", colors: ["#d98e5f", "#a85f3d"], image: "images/sample-hongshaorou.jpg",
    ingredients: ["五花肉 500g", "冰糖 30g", "生抽 2勺", "老抽 1勺", "料酒 2勺", "姜片 3片", "葱段 2根", "八角 2个", "香叶 2片", "盐 少许"],
    steps: [
      "五花肉切 3cm 方块，冷水下锅加料酒焯水，捞出沥干",
      "锅中放少许油和冰糖，小火炒至焦糖色",
      "下五花肉翻炒上色，加姜葱、八角、香叶炒香",
      "加生抽、老抽和没过肉的热水，大火烧开转小火炖 40 分钟",
      "开盖转大火收汁，加盐调味，汤汁浓稠即可出锅"
    ]
  },
  {
    name: "番茄炒蛋", category: "快手菜", tags: ["快手", "下饭", "儿童爱吃"], rating: 4,
    emoji: "🍅", colors: ["#f2a58c", "#e0685a"], image: "images/sample-fanqiechaodan.jpg",
    ingredients: ["番茄 2个", "鸡蛋 3个", "葱花 少许", "白糖 1小勺", "盐 适量", "食用油 适量"],
    steps: [
      "番茄切块，鸡蛋加少许盐打散",
      "热锅倒油，倒入蛋液炒至凝固盛出",
      "锅留底油，下番茄块中火翻炒出汁",
      "加白糖和盐调味",
      "倒回鸡蛋翻炒均匀，撒葱花出锅"
    ]
  },
  {
    name: "清蒸鲈鱼", category: "荤菜", tags: ["清淡", "宴客", "高蛋白"], rating: 5,
    emoji: "🐟", colors: ["#9cc3c9", "#5f8f9c"], image: "images/sample-qingzhengluyu.jpg",
    ingredients: ["鲈鱼 1条（约600g）", "姜丝 适量", "葱丝 适量", "蒸鱼豉油 3勺", "料酒 1勺", "食用油 2勺", "盐 少许"],
    steps: [
      "鲈鱼处理干净，两面划刀，抹少许盐和料酒腌 10 分钟",
      "鱼身铺姜丝，水开后上锅大火蒸 8 分钟",
      "关火再焖 2 分钟，倒掉盘中汤汁，去掉姜丝",
      "铺上新鲜葱丝，淋蒸鱼豉油",
      "烧热食用油浇在葱丝上激出香味"
    ]
  },
  {
    name: "宫保鸡丁", category: "荤菜", tags: ["下饭", "川味", "经典"], rating: 4,
    emoji: "🍗", colors: ["#d9a05f", "#b06b3d"], image: "images/sample-gongbaojiding.jpg",
    ingredients: ["鸡胸肉 300g", "花生米 50g", "干辣椒 8个", "花椒 1小把", "葱段 适量", "姜蒜 适量", "生抽 2勺", "醋 2勺", "糖 1勺", "淀粉 1勺", "料酒 1勺", "盐 少许"],
    steps: [
      "鸡胸肉切丁，加料酒、盐、淀粉抓匀腌 15 分钟",
      "调碗汁：生抽、醋、糖、淀粉、清水拌匀",
      "热锅凉油下鸡丁滑炒至变色盛出",
      "下干辣椒、花椒炒香，加葱姜蒜爆香",
      "倒回鸡丁和花生米，淋入碗汁大火翻炒收汁"
    ]
  },
  {
    name: "酸辣土豆丝", category: "素菜", tags: ["快手", "开胃", "下饭"], rating: 3,
    emoji: "🥔", colors: ["#e8cf9f", "#c9a35e"], image: "images/sample-suanlatudousi.jpg",
    ingredients: ["土豆 2个", "干辣椒 4个", "花椒 少许", "蒜片 适量", "醋 2勺", "盐 适量", "食用油 适量"],
    steps: [
      "土豆切细丝，清水冲洗两遍去淀粉，沥干",
      "热锅倒油，下花椒小火炸香后捞出",
      "下干辣椒和蒜片爆香",
      "倒入土豆丝大火快炒 1 分钟",
      "沿锅边淋醋，加盐翻炒均匀出锅"
    ]
  }
];

// 时令推荐库：months 表示适用月份（1~12），每月保证 2~4 条
var SEASONAL_ITEMS = [
  { name: "白菜", months: [11, 12, 1], blurb: "霜打白菜赛羊肉，白菜炖豆腐越炖越香", emoji: "🥬", colors: ["#cfe3a8", "#9cbf72"], image: "images/seasonal-baicai.jpg" },
  { name: "萝卜", months: [12, 1, 2], blurb: "冬吃萝卜夏吃姜，白萝卜炖汤清甜暖胃", emoji: "🥕", colors: ["#eabf8f", "#cf8f55"], image: "images/seasonal-luobo.jpg" },
  { name: "韭菜", months: [2, 3], blurb: "早春韭菜最鲜嫩，韭菜炒蛋快手又香", emoji: "🌱", colors: ["#8fbf6f", "#5f9450"], image: "images/seasonal-jiucai.jpg" },
  { name: "春笋", months: [3, 4], blurb: "雨后春笋脆嫩清甜，油焖或炖汤都鲜美", emoji: "🎋", colors: ["#c3d48f", "#8fae5e"], image: "images/seasonal-chunsun.jpg" },
  { name: "蚕豆", months: [4, 5], blurb: "嫩蚕豆清香粉糯，清炒一盘就是春天", emoji: "🥗", colors: ["#9dbd7a", "#6d8f52"], image: "images/seasonal-candou.jpg" },
  { name: "黄瓜", months: [5, 6, 7], blurb: "盛夏黄瓜水灵爽脆，凉拌拍黄瓜开胃解暑", emoji: "🥒", colors: ["#cfe3b8", "#8fbf7a"], image: "images/seasonal-huanggua.jpg" },
  { name: "番茄", months: [6, 7, 8], blurb: "盛夏番茄沙瓤多汁，番茄炒蛋永远是下饭神器", emoji: "🍅", colors: ["#f2a58c", "#e0685a"], image: "images/seasonal-fanqie.jpg" },
  { name: "苦瓜", months: [7, 8], blurb: "苦夏吃苦瓜，清炒苦瓜回甘去火", emoji: "🫑", colors: ["#9ccf8a", "#66a15a"], image: "images/seasonal-kugua.jpg" },
  { name: "茄子", months: [7, 8, 9], blurb: "立秋后茄子软糯少籽，蒜蓉蒸茄最下饭", emoji: "🍆", colors: ["#b18fce", "#7c5f9e"], image: "images/seasonal-qiezi.jpg" },
  { name: "冬瓜", months: [8, 9], blurb: "冬瓜清淡利水，冬瓜排骨汤夏末秋初正合适", emoji: "🍲", colors: ["#a8d8c9", "#6fae9c"], image: "images/seasonal-donggua.jpg" },
  { name: "南瓜", months: [9, 10], blurb: "秋南瓜香甜粉糯，南瓜粥暖胃又养人", emoji: "🎃", colors: ["#e8a85c", "#c77b3e"], image: "images/seasonal-nangua.jpg" },
  { name: "板栗", months: [9, 10, 11], blurb: "板栗上市季，栗子烧鸡浓香入味", emoji: "🌰", colors: ["#c99a6b", "#9a6b3f"], image: "images/seasonal-banli.jpg" },
  { name: "莲藕", months: [10, 11, 12], blurb: "秋冬莲藕清甜脆嫩，排骨莲藕汤暖心暖胃", emoji: "🌸", colors: ["#e8b8c8", "#c98fa5"], image: "images/seasonal-lianou.jpg" }
];

// 内置照片的许可致谢（来源：Wikimedia Commons）
var PHOTO_CREDITS = [
  { file: "sample-hongshaorou.jpg", author: "N509FZ", license: "CC BY-SA 4.0" },
  { file: "sample-fanqiechaodan.jpg", author: "NNU-10-24100123", license: "CC BY-SA 3.0" },
  { file: "sample-qingzhengluyu.jpg", author: "Kungchungwonam", license: "CC BY-SA 4.0" },
  { file: "sample-gongbaojiding.jpg", author: "Steven G. Johnson", license: "CC BY-SA 3.0" },
  { file: "sample-suanlatudousi.jpg", author: "pelican (Tokyo)", license: "CC BY-SA 2.0" },
  { file: "seasonal-baicai.jpg", author: "Алексей Кабанов", license: "CC BY-SA 4.0" },
  { file: "seasonal-luobo.jpg", author: "Eric Polk", license: "CC BY-SA 4.0" },
  { file: "seasonal-jiucai.jpg", author: "Kurt Stüber", license: "CC BY-SA 3.0" },
  { file: "seasonal-chunsun.jpg", author: "Joi Ito", license: "CC BY 2.0" },
  { file: "seasonal-candou.jpg", author: "Renia123", license: "CC0" },
  { file: "seasonal-huanggua.jpg", author: "H. Zell", license: "CC BY-SA 3.0" },
  { file: "seasonal-fanqie.jpg", author: "Michal Klajban", license: "CC BY-SA 4.0" },
  { file: "seasonal-kugua.jpg", author: "Fred Hsu", license: "CC BY-SA 3.0" },
  { file: "seasonal-qiezi.jpg", author: "Joydeep", license: "CC BY-SA 3.0" },
  { file: "seasonal-donggua.jpg", author: "Nesnad", license: "CC BY 4.0" },
  { file: "seasonal-nangua.jpg", author: "George Chernilevsky", license: "Public domain" },
  { file: "seasonal-banli.jpg", author: "Benjamin Gimmel (BenHur)", license: "CC BY-SA 3.0" },
  { file: "seasonal-lianou.jpg", author: "David Rydevik", license: "Public domain" }
];

// 生成「渐变 + emoji」占位图（SVG data URL）
// emoji: 大图标；colors: [起色, 止色]；name: 预留（当前不参与渲染，避免中文编码/字体问题）
function makePlaceholderImage(emoji, colors, name) {
  var svg =
    '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 800 600">' +
    "<defs><linearGradient id=\"g\" x1=\"0\" y1=\"0\" x2=\"1\" y2=\"1\">" +
    '<stop offset="0" stop-color="' + colors[0] + '"/>' +
    '<stop offset="1" stop-color="' + colors[1] + '"/>' +
    "</linearGradient></defs>" +
    '<rect width="800" height="600" fill="url(#g)"/>' +
    '<text x="400" y="330" font-size="230" text-anchor="middle" dominant-baseline="middle" ' +
    'font-family="Apple Color Emoji, Segoe UI Emoji, Noto Color Emoji, sans-serif">' +
    emoji + "</text></svg>";
  // encodeURIComponent 一次解决 #（渐变色）、引号、emoji 的编码问题
  return "data:image/svg+xml;charset=utf-8," + encodeURIComponent(svg);
}
