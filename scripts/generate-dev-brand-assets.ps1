Add-Type -AssemblyName System.Drawing

$root = Resolve-Path (Join-Path $PSScriptRoot "..")
$assetsDir = Join-Path $root "assets/images"

$iconInPath = Join-Path $assetsDir "logo-splash-512-appicon-v3.png"
$foregroundInPath = Join-Path $assetsDir "logo-splash-512-foreground-padded-v3.png"
$splashInPath = Join-Path $assetsDir "logo-splash-v2.png"

$iconOutPath = Join-Path $assetsDir "logo-splash-512-appicon-dev.png"
$foregroundOutPath = Join-Path $assetsDir "logo-splash-512-foreground-padded-dev.png"
$splashOutPath = Join-Path $assetsDir "logo-splash-dev.png"

function Clamp-Byte([double]$value) {
  if ($value -lt 0) { return 0 }
  if ($value -gt 255) { return 255 }
  return [int][Math]::Round($value)
}

function RgbToHsv([byte]$r, [byte]$g, [byte]$b) {
  $rf = $r / 255.0
  $gf = $g / 255.0
  $bf = $b / 255.0
  $max = [Math]::Max($rf, [Math]::Max($gf, $bf))
  $min = [Math]::Min($rf, [Math]::Min($gf, $bf))
  $delta = $max - $min

  $h = 0.0
  if ($delta -gt 0) {
    if ($max -eq $rf) {
      $h = 60 * ((($gf - $bf) / $delta) % 6)
    } elseif ($max -eq $gf) {
      $h = 60 * ((($bf - $rf) / $delta) + 2)
    } else {
      $h = 60 * ((($rf - $gf) / $delta) + 4)
    }
  }

  if ($h -lt 0) { $h += 360 }
  $s = if ($max -eq 0) { 0.0 } else { $delta / $max }
  $v = $max

  return @{ H = $h; S = $s; V = $v }
}

function HsvToRgb([double]$h, [double]$s, [double]$v) {
  $c = $v * $s
  $x = $c * (1 - [Math]::Abs((($h / 60) % 2) - 1))
  $m = $v - $c
  $rf = 0.0; $gf = 0.0; $bf = 0.0

  if ($h -lt 60) { $rf = $c; $gf = $x; $bf = 0 }
  elseif ($h -lt 120) { $rf = $x; $gf = $c; $bf = 0 }
  elseif ($h -lt 180) { $rf = 0; $gf = $c; $bf = $x }
  elseif ($h -lt 240) { $rf = 0; $gf = $x; $bf = $c }
  elseif ($h -lt 300) { $rf = $x; $gf = 0; $bf = $c }
  else { $rf = $c; $gf = 0; $bf = $x }

  return @{
    R = Clamp-Byte (($rf + $m) * 255.0)
    G = Clamp-Byte (($gf + $m) * 255.0)
    B = Clamp-Byte (($bf + $m) * 255.0)
  }
}

function New-RedVariantBitmap([System.Drawing.Bitmap]$source) {
  $bmp = New-Object System.Drawing.Bitmap($source.Width, $source.Height, [System.Drawing.Imaging.PixelFormat]::Format32bppArgb)
  for ($y = 0; $y -lt $source.Height; $y++) {
    for ($x = 0; $x -lt $source.Width; $x++) {
      $px = $source.GetPixel($x, $y)
      if ($px.A -eq 0) {
        $bmp.SetPixel($x, $y, [System.Drawing.Color]::FromArgb(0, 0, 0, 0))
        continue
      }
      $hsv = RgbToHsv $px.R $px.G $px.B
      # Keep neutral backgrounds unchanged; recolor only saturated logo pixels.
      if ($hsv.S -lt 0.25 -or $hsv.V -lt 0.15) {
        $bmp.SetPixel($x, $y, $px)
        continue
      }

      $newH = 358.0
      $newS = [Math]::Max(0.55, $hsv.S * 0.92)
      $newV = [Math]::Min(1.0, $hsv.V * 1.01)
      $rgb = HsvToRgb $newH $newS $newV
      $bmp.SetPixel($x, $y, [System.Drawing.Color]::FromArgb($px.A, $rgb.R, $rgb.G, $rgb.B))
    }
  }
  return $bmp
}

function Save-Png([System.Drawing.Bitmap]$bmp, [string]$path) {
  $bmp.Save($path, [System.Drawing.Imaging.ImageFormat]::Png)
}

$iconIn = [System.Drawing.Bitmap]::FromFile($iconInPath)
$iconOut = New-RedVariantBitmap $iconIn
Save-Png $iconOut $iconOutPath
$iconIn.Dispose()
$iconOut.Dispose()

$fgIn = [System.Drawing.Bitmap]::FromFile($foregroundInPath)
$fgOut = New-RedVariantBitmap $fgIn
Save-Png $fgOut $foregroundOutPath
$fgIn.Dispose()
$fgOut.Dispose()

$splashIn = [System.Drawing.Bitmap]::FromFile($splashInPath)
$splashOut = New-RedVariantBitmap $splashIn
Save-Png $splashOut $splashOutPath
$splashIn.Dispose()
$splashOut.Dispose()

Write-Output "Generated dev branding assets from prod style."
