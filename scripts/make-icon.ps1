# Generate app icon: blue gradient rounded square + white hexagon (same as sidebar logo)
# Output: assets/icon.png (256x256) and assets/icon.ico (multi-size, for electron-builder)
Add-Type -AssemblyName System.Drawing

function New-AppIconBitmap([int]$size) {
  $bmp = New-Object System.Drawing.Bitmap($size, $size)
  $g = [System.Drawing.Graphics]::FromImage($bmp)
  $g.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::AntiAlias
  $s = $size / 256.0

  # background: diagonal gradient rounded square
  $grad = New-Object System.Drawing.Drawing2D.LinearGradientBrush(
    (New-Object System.Drawing.PointF([single]0, [single]0)),
    (New-Object System.Drawing.PointF([single]$size, [single]$size)),
    [System.Drawing.Color]::FromArgb(59, 111, 224),
    [System.Drawing.Color]::FromArgb(122, 162, 255))
  $gp = New-Object System.Drawing.Drawing2D.GraphicsPath
  $r = 56 * $s
  $gp.AddArc(0, 0, $r, $r, 180, 90)
  $gp.AddArc($size - $r, 0, $r, $r, 270, 90)
  $gp.AddArc($size - $r, $size - $r, $r, $r, 0, 90)
  $gp.AddArc(0, $size - $r, $r, $r, 90, 90)
  $gp.CloseFigure()
  $g.FillPath($grad, $gp)

  # white hexagon (pointy-top, matches the sidebar hex)
  $cx = $size * 0.5
  $cy = $size * 0.52
  $R = $size * 0.34
  $pts = @()
  foreach ($deg in -90, -30, 30, 90, 150, 210) {
    $a = $deg * [Math]::PI / 180
    $pts += New-Object System.Drawing.PointF(
      [single]($cx + $R * [Math]::Cos($a)),
      [single]($cy + $R * [Math]::Sin($a)))
  }
  $g.FillPolygon([System.Drawing.Brushes]::White, $pts)

  $g.Dispose()
  return $bmp
}

$root = Split-Path -Parent $PSScriptRoot
New-Item -ItemType Directory -Force -Path (Join-Path $root 'assets') | Out-Null

$b = New-AppIconBitmap 256
$b.Save((Join-Path $root 'assets\icon.png'), [System.Drawing.Imaging.ImageFormat]::Png)
$b.Dispose()

# ICO: embedded multi-size PNG entries
$sizes = 16, 24, 32, 48, 64, 128, 256
$imgs = @()
foreach ($sz in $sizes) {
  $ib = New-AppIconBitmap $sz
  $m2 = New-Object System.IO.MemoryStream
  $ib.Save($m2, [System.Drawing.Imaging.ImageFormat]::Png)
  $imgs += , @($sz, $m2.ToArray())
  $ib.Dispose()
}
$ms = New-Object System.IO.MemoryStream
$bw = New-Object System.IO.BinaryWriter($ms)
$bw.Write([uint16]0); $bw.Write([uint16]1); $bw.Write([uint16]$imgs.Count)
$dataOffset = 6 + 16 * $imgs.Count
foreach ($pair in $imgs) {
  $sz = [int]$pair[0]; $bytes = [byte[]]$pair[1]
  $dim = if ($sz -ge 256) { [byte]0 } else { [byte]$sz }
  $bw.Write($dim); $bw.Write($dim); $bw.Write([byte]0); $bw.Write([byte]0)
  $bw.Write([uint16]1); $bw.Write([uint16]32)
  $bw.Write([uint32]$bytes.Length); $bw.Write([uint32]$dataOffset)
  $dataOffset += $bytes.Length
}
foreach ($pair in $imgs) { $bw.Write([byte[]]$pair[1]) }
$bw.Flush()
[System.IO.File]::WriteAllBytes((Join-Path $root 'assets\icon.ico'), $ms.ToArray())
Write-Host 'OK: assets/icon.png + assets/icon.ico'
