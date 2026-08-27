# Compress photos: images-raw/*.jpg -> images/*.jpg
# EXIF orientation applied, longest side <= 1200px, JPEG quality 75,
# target <= 300KB each (lower quality in steps if needed).
Add-Type -AssemblyName System.Drawing

$rawDir = Join-Path $PSScriptRoot "images-raw"
$outDir = Join-Path $PSScriptRoot "images"
if (-not (Test-Path $outDir)) { New-Item -ItemType Directory -Path $outDir | Out-Null }

$jpegCodec = [System.Drawing.Imaging.ImageCodecInfo]::GetImageEncoders() | Where-Object { $_.MimeType -eq 'image/jpeg' }

function Get-ExifFlip([System.Drawing.Image]$img) {
  try {
    $prop = $img.GetPropertyItem(0x0112)
    $o = [BitConverter]::ToUInt16($prop.Value, 0)
    switch ($o) {
      3 { return [System.Drawing.RotateFlipType]::Rotate180FlipNone }
      6 { return [System.Drawing.RotateFlipType]::Rotate90FlipNone }
      8 { return [System.Drawing.RotateFlipType]::Rotate270FlipNone }
      2 { return [System.Drawing.RotateFlipType]::RotateNoneFlipX }
      4 { return [System.Drawing.RotateFlipType]::Rotate180FlipX }
      5 { return [System.Drawing.RotateFlipType]::Rotate90FlipX }
      7 { return [System.Drawing.RotateFlipType]::Rotate270FlipX }
      default { return $null }
    }
  } catch { return $null }
}

function Save-JpegQuality([System.Drawing.Bitmap]$bmp, [string]$path, [int]$q) {
  $ep = New-Object System.Drawing.Imaging.EncoderParameters(1)
  $ep.Param[0] = New-Object System.Drawing.Imaging.EncoderParameter([System.Drawing.Imaging.Encoder]::Quality, [long]$q)
  $bmp.Save($path, $jpegCodec, $ep)
  $ep.Dispose()
}

Get-ChildItem (Join-Path $rawDir "*.jpg") | Sort-Object Name | ForEach-Object {
  $src = [System.Drawing.Image]::FromFile($_.FullName)

  # EXIF orientation
  $flip = Get-ExifFlip $src
  if ($flip -ne $null) { $src.RotateFlip($flip) }

  $maxSide = 1200
  $scale = [Math]::Min(1.0, $maxSide / [Math]::Max($src.Width, $src.Height))
  $w = [int][Math]::Round($src.Width * $scale)
  $h = [int][Math]::Round($src.Height * $scale)
  if ($w -lt 1) { $w = 1 }; if ($h -lt 1) { $h = 1 }

  $bmp = New-Object System.Drawing.Bitmap($w, $h)
  $g = [System.Drawing.Graphics]::FromImage($bmp)
  $g.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
  $g.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::HighQuality
  $g.PixelOffsetMode = [System.Drawing.Drawing2D.PixelOffsetMode]::HighQuality
  $g.Clear([System.Drawing.Color]::White)   # JPEG has no alpha; avoid black background
  $g.DrawImage($src, 0, 0, $w, $h)
  $g.Dispose()
  $src.Dispose()

  $outPath = Join-Path $outDir $_.Name
  # Quality ladder: 75 -> down to 40; still too big -> reduce maxSide to 1000
  $q = 75
  do {
    Save-JpegQuality $bmp $outPath $q
    $size = (Get-Item $outPath).Length
    if ($size -le 300KB -or $q -le 40) { break }
    $q -= 10
  } while ($true)
  if ($size -gt 300KB) {
    $w2 = [int][Math]::Round($w * 1000.0 / $maxSide)
    $h2 = [int][Math]::Round($h * 1000.0 / $maxSide)
    $bmp2 = New-Object System.Drawing.Bitmap($w2, $h2)
    $g2 = [System.Drawing.Graphics]::FromImage($bmp2)
    $g2.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
    $g2.DrawImage($bmp, 0, 0, $w2, $h2)
    $g2.Dispose()
    Save-JpegQuality $bmp2 $outPath 75
    $size = (Get-Item $outPath).Length
    $bmp2.Dispose()
  }
  $bmp.Dispose()

  $kb = [int]($size / 1KB)
  Write-Output ("{0,-32} {1}x{2} -> {3} KB" -f $_.Name, $w, $h, $kb)
}
