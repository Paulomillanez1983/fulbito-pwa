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
  $sourcePath = Join-Path $root "public\brand-reference.png"
  $outPath = Join-Path $root "public\og-image.jpg"
  $source = [System.Drawing.Bitmap]::FromFile($sourcePath)
  $target = [System.Drawing.Bitmap]::new(1200, 630)
  $graphics = [System.Drawing.Graphics]::FromImage($target)
  $graphics.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::AntiAlias
  $graphics.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
  $graphics.PixelOffsetMode = [System.Drawing.Drawing2D.PixelOffsetMode]::HighQuality

  $cropHeight = [int]($source.Width * 630 / 1200)
  $srcRect = [System.Drawing.Rectangle]::new(0, 0, $source.Width, $cropHeight)
  $dstRect = [System.Drawing.Rectangle]::new(0, 0, 1200, 630)
  $graphics.DrawImage($source, $dstRect, $srcRect, [System.Drawing.GraphicsUnit]::Pixel)

  $vignette = [System.Drawing.Drawing2D.LinearGradientBrush]::new(
    [System.Drawing.Rectangle]::new(0, 0, 1200, 630),
    [System.Drawing.Color]::FromArgb(0, 0, 0, 0),
    [System.Drawing.Color]::FromArgb(92, 0, 0, 0),
    90
  )
  $graphics.FillRectangle($vignette, 0, 0, 1200, 630)

  $graphics.Dispose()
  Save-Jpeg $target $outPath 92
  $target.Dispose()
  $source.Dispose()
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

Generate-OgImage
Rasterize-Icon 512
Rasterize-Icon 192
