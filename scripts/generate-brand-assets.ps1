Add-Type -AssemblyName System.Drawing

$root = Split-Path -Parent $PSScriptRoot
$assets = Join-Path $root "public\assets"

function Save-Jpeg([System.Drawing.Bitmap]$bitmap, [string]$path, [long]$quality) {
  $codec = [System.Drawing.Imaging.ImageCodecInfo]::GetImageEncoders() | Where-Object { $_.MimeType -eq "image/jpeg" }
  $params = [System.Drawing.Imaging.EncoderParameters]::new(1)
  $params.Param[0] = [System.Drawing.Imaging.EncoderParameter]::new([System.Drawing.Imaging.Encoder]::Quality, $quality)
  $bitmap.Save($path, $codec, $params)
}

function Generate-OgImage {
  $outPath = Join-Path $root "public\og-image.jpg"
  $socialPath = Join-Path $root "public\social-preview.png"
  $iconPath = Join-Path $assets "icon-512.png"
  $target = [System.Drawing.Bitmap]::new(1200, 630)
  $graphics = [System.Drawing.Graphics]::FromImage($target)
  $graphics.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::AntiAlias
  $graphics.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
  $graphics.PixelOffsetMode = [System.Drawing.Drawing2D.PixelOffsetMode]::HighQuality

  $bg = [System.Drawing.Drawing2D.LinearGradientBrush]::new(
    [System.Drawing.Rectangle]::new(0, 0, 1200, 630),
    [System.Drawing.Color]::FromArgb(255, 17, 27, 43),
    [System.Drawing.Color]::FromArgb(255, 2, 5, 11),
    35
  )
  $graphics.FillRectangle($bg, 0, 0, 1200, 630)

  $field = [System.Drawing.Drawing2D.LinearGradientBrush]::new(
    [System.Drawing.Rectangle]::new(0, 390, 1200, 240),
    [System.Drawing.Color]::FromArgb(120, 20, 130, 73),
    [System.Drawing.Color]::FromArgb(220, 4, 34, 22),
    90
  )
  $graphics.FillRectangle($field, 0, 390, 1200, 240)

  $linePen = [System.Drawing.Pen]::new([System.Drawing.Color]::FromArgb(48, 255, 255, 255), 2)
  for ($x = 80; $x -lt 1200; $x += 110) {
    $graphics.DrawLine($linePen, $x, 390, $x + 70, 630)
  }

  $cupPen = [System.Drawing.Pen]::new([System.Drawing.Color]::FromArgb(100, 241, 199, 91), 12)
  $graphics.DrawEllipse($cupPen, 690, 75, 350, 350)
  $graphics.DrawLine($cupPen, 865, 410, 865, 530)
  $graphics.DrawLine($cupPen, 770, 540, 960, 540)

  if (Test-Path $iconPath) {
    $icon = [System.Drawing.Bitmap]::FromFile($iconPath)
    $graphics.DrawImage($icon, [System.Drawing.Rectangle]::new(78, 72, 172, 172))
    $icon.Dispose()
  }

  $goldBrush = [System.Drawing.SolidBrush]::new([System.Drawing.Color]::FromArgb(255, 241, 199, 91))
  $whiteBrush = [System.Drawing.SolidBrush]::new([System.Drawing.Color]::FromArgb(255, 248, 243, 230))
  $mutedBrush = [System.Drawing.SolidBrush]::new([System.Drawing.Color]::FromArgb(220, 205, 216, 232))
  $titleFont = [System.Drawing.Font]::new("Arial", 70, [System.Drawing.FontStyle]::Bold)
  $brandFont = [System.Drawing.Font]::new("Arial", 30, [System.Drawing.FontStyle]::Bold)
  $copyFont = [System.Drawing.Font]::new("Arial", 28, [System.Drawing.FontStyle]::Regular)
  $pillFont = [System.Drawing.Font]::new("Arial", 22, [System.Drawing.FontStyle]::Bold)

  $graphics.DrawString("FULBITO ARENA", $brandFont, $whiteBrush, 280, 92)
  $graphics.DrawString("TU LIGA ENTRA", $titleFont, $whiteBrush, 78, 278)
  $graphics.DrawString("EN MODO JUEGO", $titleFont, $whiteBrush, 78, 352)
  $graphics.DrawString("Canchas, equipos, fixture, tabla y camino a la copa.", $copyFont, $mutedBrush, 82, 468)

  $pillBrush = [System.Drawing.Drawing2D.LinearGradientBrush]::new(
    [System.Drawing.Rectangle]::new(82, 536, 650, 58),
    [System.Drawing.Color]::FromArgb(255, 241, 199, 91),
    [System.Drawing.Color]::FromArgb(255, 161, 106, 30),
    0
  )
  $graphics.FillRectangle($pillBrush, 82, 536, 650, 58)
  $graphics.DrawString("PWA + GOOGLE LOGIN + SUPABASE", $pillFont, [System.Drawing.SolidBrush]::new([System.Drawing.Color]::FromArgb(255, 5, 7, 13)), 108, 552)

  $vignette = [System.Drawing.Drawing2D.LinearGradientBrush]::new(
    [System.Drawing.Rectangle]::new(0, 0, 1200, 630),
    [System.Drawing.Color]::FromArgb(0, 0, 0, 0),
    [System.Drawing.Color]::FromArgb(92, 0, 0, 0),
    90
  )
  $graphics.FillRectangle($vignette, 0, 0, 1200, 630)

  $graphics.Dispose()
  Save-Jpeg $target $outPath 92
  $target.Save($socialPath, [System.Drawing.Imaging.ImageFormat]::Png)
  $target.Dispose()
}

function Rasterize-Icon([int]$size) {
  $svgPath = (Join-Path $assets "icon.svg").Replace("\", "/")
  $outPath = Join-Path $assets "icon-$size.png"
  $url = "file:///$svgPath"
  & npx playwright screenshot "--viewport-size=$size,$size" $url $outPath
  if ($LASTEXITCODE -ne 0) {
    throw "Playwright no pudo rasterizar icon-$size.png"
  }
}

Rasterize-Icon 512
Rasterize-Icon 192
Generate-OgImage
