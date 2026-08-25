/* ============================================
   random.js — 「今天吃什么」抽签
   两种抽法 + 名字轮播动画
   ============================================ */

// 抽法 1：等概率 — 每道菜机会一样
function pickEqual(list) {
  return list[Math.floor(Math.random() * list.length)];
}

// 抽法 2：按喜爱度加权 — 爱心越多越容易被抽中
// 原理（线段法）：把每道菜按权重铺成一条线段，
// 5 心占 5 格、1 心占 1 格、未评分按 1 心计；
// 在线段上随机掷一个点，落在谁的地盘谁中奖。
function pickWeighted(list) {
  var weights = list.map(function (d) {
    return d.rating > 0 ? d.rating : 1; // 未评分按 1 计，避免永远抽不到
  });
  var total = weights.reduce(function (a, b) { return a + b; }, 0);
  var r = Math.random() * total;
  for (var i = 0; i < list.length; i++) {
    r -= weights[i];
    if (r <= 0) return list[i];
  }
  return list[list.length - 1]; // 浮点误差兜底
}

// 名字轮播动画：
// 中奖者其实在动画前就定好了（finalIndex），动画只是表演。
// 前半段随机乱跳制造悬念，后半段只在中奖者附近徘徊，
// 间隔从 60ms 逐渐拉长到 300ms，模拟转盘减速，最后定格。
// names: 候选菜名数组；onTick(名字, 是否最终帧)；onDone: 定格后回调
function runRoulette(names, finalIndex, onTick, onDone) {
  var total = 24; // 一共跳 24 次
  var i = 0;

  function tick() {
    // 跳完了：显示中奖者，停顿一下再出结果
    if (i >= total) {
      onTick(names[finalIndex], true);
      setTimeout(onDone, 400);
      return;
    }

    var progress = i / total;
    var idx;
    if (progress < 0.6) {
      // 前半段：完全随机乱跳
      idx = Math.floor(Math.random() * names.length);
    } else {
      // 后半段：只在中奖者前后一格徘徊
      var offset = Math.floor(Math.random() * 3) - 1;
      idx = (finalIndex + offset + names.length) % names.length;
    }

    onTick(names[idx], false);
    i++;
    // 间隔逐渐拉长 = 越来越慢
    setTimeout(tick, 60 + 240 * progress);
  }

  tick();
}
