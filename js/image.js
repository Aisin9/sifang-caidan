/* ============================================
   image.js — 图片压缩
   思路四步：读文件 → 加载图片 → canvas 缩小重绘 → 导出 base64
   这样 2MB 的手机照片可以压到约 100~250KB，localStorage 才装得下
   ============================================ */

// file: 用户选择的图片文件
// maxSide: 最长边像素（默认 800）
// quality: JPEG 质量 0~1（默认 0.8）
// 返回 Promise，成功时得到 "data:image/jpeg;base64,..." 字符串
function compressImage(file, maxSide, quality) {
  maxSide = maxSide || 800;
  quality = quality || 0.8;

  return new Promise(function (resolve, reject) {
    var reader = new FileReader();

    // 第 1 步：把文件读成 DataURL
    reader.onload = function () {
      var img = new Image();

      // 第 2 步：加载图片
      img.onload = function () {
        // 第 3 步：按最长边缩放（只缩小、不放大的原则）
        var scale = Math.min(1, maxSide / Math.max(img.width, img.height));
        var w = Math.round(img.width * scale);
        var h = Math.round(img.height * scale);

        var canvas = document.createElement("canvas");
        canvas.width = w;
        canvas.height = h;
        var ctx = canvas.getContext("2d");

        // 先铺白底：JPEG 不支持透明，PNG 透明处会变黑，铺白避免
        ctx.fillStyle = "#fff";
        ctx.fillRect(0, 0, w, h);
        ctx.drawImage(img, 0, 0, w, h);

        // 第 4 步：导出压缩后的 JPEG DataURL
        // 附带好处：重编码会剥离 EXIF 信息（含拍照 GPS 位置），更隐私
        resolve(canvas.toDataURL("image/jpeg", quality));
      };
      img.onerror = function () {
        reject(new Error("图片加载失败"));
      };
      img.src = reader.result;

      // 注：现代浏览器把图片画进 canvas 时已自动应用 EXIF 旋转，
      // 所以手机竖拍的照片方向是正确的，无需额外处理。
      // 局限：GIF 动图只会保留第一帧，变成静态图。
    };
    reader.onerror = function () {
      reject(new Error("文件读取失败"));
    };
    reader.readAsDataURL(file);
  });
}
