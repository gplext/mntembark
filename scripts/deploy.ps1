<#
  Push committed work to GitHub and start a Coolify deploy, in one command.

    .\scripts\deploy.ps1

  Runs entirely on this computer with your own git login and Coolify token;
  nothing here stores or prints a secret.

  One-time setup for the automatic deploy (optional; without it the script
  pushes and then reminds you to click Redeploy):

    In Coolify: your app -> Webhooks -> copy the "Deploy Webhook" URL
                Keys & Tokens -> API tokens -> create one with deploy rights
    Then, once, in PowerShell:
      [Environment]::SetEnvironmentVariable("COOLIFY_DEPLOY_WEBHOOK", "<deploy webhook url>", "User")
      [Environment]::SetEnvironmentVariable("COOLIFY_TOKEN", "<api token>", "User")
    and open a new PowerShell window.
#>
$ErrorActionPreference = "Stop"
Set-Location (Join-Path $PSScriptRoot "..")

$branch = (git rev-parse --abbrev-ref HEAD).Trim()
if ($branch -ne "main") { throw "You are on '$branch'. Switch to main first: git checkout main" }

$dirty = git status --porcelain --untracked-files=no
if ($dirty) {
  Write-Host "Uncommitted changes (these will NOT be deployed):" -ForegroundColor Yellow
  $dirty | ForEach-Object { Write-Host "  $_" }
}

git fetch origin main --quiet
$ahead = git log --oneline origin/main..HEAD
if (-not $ahead) {
  Write-Host "Nothing new to push - GitHub already has everything committed." -ForegroundColor Green
} else {
  Write-Host "Pushing these commits:" -ForegroundColor Cyan
  $ahead | ForEach-Object { Write-Host "  $_" }
  git push origin main
  if ($LASTEXITCODE -ne 0) { throw "git push failed - see the message above." }
}

$hook  = [Environment]::GetEnvironmentVariable("COOLIFY_DEPLOY_WEBHOOK", "User")
$token = [Environment]::GetEnvironmentVariable("COOLIFY_TOKEN", "User")
if ($hook -and $token) {
  Write-Host "Starting the Coolify deploy..." -ForegroundColor Cyan
  $r = Invoke-RestMethod -Uri $hook -Headers @{ Authorization = "Bearer $token" } -Method Get
  Write-Host "Deploy queued. Live in about 7 minutes - then Ctrl+Shift+R on mntembark.com." -ForegroundColor Green
  if ($r.deployments) { $r.deployments | ForEach-Object { Write-Host "  $($_.message)" } }
} else {
  Write-Host "Pushed. Now click Redeploy in Coolify (or do the one-time setup at the top of this script to make this automatic)." -ForegroundColor Yellow
}
