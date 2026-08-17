param(
  [string]$CertificatePath = "$PSScriptRoot\certs\location-guardian-root.crt"
)

$resolved = Resolve-Path -LiteralPath $CertificatePath -ErrorAction Stop
Import-Certificate -FilePath $resolved -CertStoreLocation Cert:\CurrentUser\Root | Out-Null
Write-Host "已信任位置守护局域网证书：$resolved"
