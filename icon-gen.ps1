# Generate icon-192.png / icon-512.png for PWA (pure ASCII script)
Add-Type -AssemblyName System.Drawing

function New-Icon([int]$size, [string]$filename) {
  $bmp = New-Object System.Drawing.Bitmap($size, $size)
  $g = [System.Drawing.Graphics]::FromImage($bmp)
  $g.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::AntiAlias
  $g.TextRenderingHint = [System.Drawing.Text.TextRenderingHint]::AntiAlias
  $g.Clear([System.Drawing.Color]::Transparent)

  # Rounded orange background (#e8590c)
  $radius = $size * 0.21
  $d = $radius * 2
  $path = New-Object System.Drawing.Drawing2D.GraphicsPath
  $path.AddArc(0, 0, $d, $d, 180, 90)
  $path.AddArc($size - 1 - $d, 0, $d, $d, 270, 90)
  $path.AddArc($size - 1 - $d, $size - 1 - $d, $d, $d, 0, 90)
  $path.AddArc(0, $size - 1 - $d, $d, $d, 90, 90)
  $path.CloseFigure()
  $brush = New-Object System.Drawing.SolidBrush([System.Drawing.Color]::FromArgb(255, 232, 89, 12))
  $g.FillPath($brush, $path)

  # Emoji cooking pan (U+1F373), white, centered
  $emoji = [string][char]::ConvertFromUtf32(0x1F373)
  $font = New-Object System.Drawing.Font("Segoe UI Emoji", [float]($size * 0.52))
  $fmt = New-Object System.Drawing.StringFormat
  $fmt.Alignment = [System.Drawing.StringAlignment]::Center
  $fmt.LineAlignment = [System.Drawing.StringAlignment]::Center
  $rect = New-Object System.Drawing.RectangleF(0, [float]($size * 0.02), $size, $size)
  $g.DrawString($emoji, $font, [System.Drawing.Brushes]::White, $rect, $fmt)

  $out = Join-Path $PSScriptRoot $filename
  $bmp.Save($out, [System.Drawing.Imaging.ImageFormat]::Png)
  $g.Dispose(); $bmp.Dispose()
  Write-Output "saved: $out"
}

New-Icon 192 "icon-192.png"
New-Icon 512 "icon-512.png"
