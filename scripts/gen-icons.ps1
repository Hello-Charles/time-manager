# gen-icons.ps1 - one-off: generate all app icon files from the user's duck PNG
# ASCII-only on purpose (PowerShell 5.1 default encoding)
Add-Type -AssemblyName System.Drawing

$root = 'D:\vibecoding\时间管理app\assets\images'
$src  = 'D:\vibecoding\时间管理app\assets\images\icon-source-duck.png'
$pf   = [System.Drawing.Imaging.PixelFormat]::Format32bppArgb

function Get-BBox([System.Drawing.Bitmap]$bmp) {
  $minX = $bmp.Width; $minY = $bmp.Height; $maxX = -1; $maxY = -1
  for ($y = 0; $y -lt $bmp.Height; $y++) {
    for ($x = 0; $x -lt $bmp.Width; $x++) {
      if ($bmp.GetPixel($x, $y).A -gt 128) {
        if ($x -lt $minX) { $minX = $x }
        if ($x -gt $maxX) { $maxX = $x }
        if ($y -lt $minY) { $minY = $y }
        if ($y -gt $maxY) { $maxY = $y }
      }
    }
  }
  return @{ x = $minX; y = $minY; w = ($maxX - $minX + 1); h = ($maxY - $minY + 1) }
}

function New-Canvas([int]$w, [int]$h) {
  return New-Object System.Drawing.Bitmap($w, $h, $pf)
}

function Center-On([System.Drawing.Bitmap]$content, [int]$cw, [int]$ch, [int]$fitSize) {
  $scale = [Math]::Min($fitSize / $content.Width, $fitSize / $content.Height)
  $dw = [int]($content.Width * $scale); $dh = [int]($content.Height * $scale)
  $out = New-Canvas $cw $ch
  $g = [System.Drawing.Graphics]::FromImage($out)
  $g.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
  $g.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::HighQuality
  $g.PixelOffsetMode = [System.Drawing.Drawing2D.PixelOffsetMode]::HighQuality
  $g.DrawImage($content, [int](($cw - $dw) / 2), [int](($ch - $dh) / 2), $dw, $dh)
  $g.Dispose()
  return ,$out
}

function Cover-Resize([System.Drawing.Bitmap]$content, [int]$cw, [int]$ch) {
  $scale = [Math]::Max($cw / $content.Width, $ch / $content.Height)
  $dw = [int]($content.Width * $scale); $dh = [int]($content.Height * $scale)
  $out = New-Canvas $cw $ch
  $g = [System.Drawing.Graphics]::FromImage($out)
  $g.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
  $g.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::HighQuality
  $g.PixelOffsetMode = [System.Drawing.Drawing2D.PixelOffsetMode]::HighQuality
  $g.DrawImage($content, [int](($cw - $dw) / 2), [int](($ch - $dh) / 2), $dw, $dh)
  $g.Dispose()
  return ,$out
}

function To-WhiteSilhouette([System.Drawing.Bitmap]$bmp) {
  $out = New-Canvas $bmp.Width $bmp.Height
  for ($y = 0; $y -lt $bmp.Height; $y++) {
    for ($x = 0; $x -lt $bmp.Width; $x++) {
      $a = $bmp.GetPixel($x, $y).A
      if ($a -gt 0) { $out.SetPixel($x, $y, [System.Drawing.Color]::FromArgb($a, 255, 255, 255)) }
    }
  }
  return ,$out
}

function Save-Png([System.Drawing.Bitmap]$bmp, [string]$path) {
  $bmp.Save($path, [System.Drawing.Imaging.ImageFormat]::Png)
  $bmp.Dispose()
  Write-Host "saved $path"
}

$srcBmp = New-Object System.Drawing.Bitmap($src)

# 1. keep the source image in the repo + use it directly as icon.png (1024x1024)
Copy-Item $src "$root\icon-source-duck.png" -Force
Copy-Item $src "$root\icon.png" -Force
Write-Host "copied icon-source-duck.png + icon.png"

# crop away transparent margins once, reuse for all derived sizes
$bbox = Get-BBox $srcBmp
Write-Host ("bbox: x={0} y={1} w={2} h={3}" -f $bbox.x, $bbox.y, $bbox.w, $bbox.h)
$rect = New-Object System.Drawing.Rectangle($bbox.x, $bbox.y, $bbox.w, $bbox.h)
$cropped = $srcBmp.Clone($rect, $pf)
$srcBmp.Dispose()

# 2. adaptive icon foreground 512x512, duck ~66% of canvas (safe zone)
$fg = Center-On $cropped 512 512 340
Save-Png $fg "$root\android-icon-foreground.png"

# 3. monochrome layer 432x432: white silhouette, alpha preserved
$monoColor = Center-On $cropped 432 432 285
$mono = To-WhiteSilhouette $monoColor
$monoColor.Dispose()
Save-Png $mono "$root\android-icon-monochrome.png"

# 4. splash icon: duck ~150px centered on 228x213 transparent canvas
$splash = Center-On $cropped 228 213 150
Save-Png $splash "$root\splash-icon.png"

# 5. favicon 48x48: cover-fill
$fav = Cover-Resize $cropped 48 48
Save-Png $fav "$root\favicon.png"

$cropped.Dispose()
Write-Host "done"
