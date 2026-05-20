# Push Job Search Copilot to GitHub (private repo by default)
# Run from project root:  .\scripts\push-to-github.ps1
# Optional:  .\scripts\push-to-github.ps1 -RepoName "my-repo-name" -Public

param(
  [string]$RepoName = "job-search-copilot",
  [switch]$Public
)

$ErrorActionPreference = "Stop"
Set-Location (Join-Path $PSScriptRoot "..")

if (-not (Get-Command git -ErrorAction SilentlyContinue)) {
  Write-Error "git is not installed or not on PATH."
}
if (-not (Get-Command gh -ErrorAction SilentlyContinue)) {
  Write-Error "GitHub CLI (gh) is not installed. Install from https://cli.github.com/"
}

if (-not (Test-Path .git)) {
  git init
  Write-Host "Initialized git repository."
}

# Ensure secrets are not committed
$gitignorePath = ".gitignore"
$required = @(".env", ".env.local", ".env*.local")
if (Test-Path $gitignorePath) {
  $content = Get-Content $gitignorePath -Raw
  foreach ($line in $required) {
    if ($content -notmatch [regex]::Escape($line)) {
      Add-Content $gitignorePath $line
    }
  }
} else {
  @"
node_modules
.next
out
.env
.env.local
.env*.local
"@ | Set-Content $gitignorePath
}

git add -A
$status = git status --porcelain
if ($status) {
  $msg = @"
Job Search Copilot: LinkedIn find jobs, analyzer, profile filters, applications.

Includes job discovery, hard requirements, applied-company exclusions, and resume match scoring.
"@
  git commit -m $msg.Trim()
  Write-Host "Created commit."
} else {
  Write-Host "No changes to commit."
}

$branch = git branch --show-current
if (-not $branch) {
  git checkout -b main
  $branch = "main"
}

gh auth status 2>&1 | Out-Host
if ($LASTEXITCODE -ne 0) {
  Write-Host "Run: gh auth login"
  exit 2
}

$hasOrigin = git remote | Select-String -Pattern "^origin$"
if (-not $hasOrigin) {
  $visibility = if ($Public) { "--public" } else { "--private" }
  gh repo create $RepoName $visibility --source=. --remote=origin --push
} else {
  git push -u origin HEAD
}

$url = gh repo view --json url -q .url
Write-Host ""
Write-Host "Done."
Write-Host "Repository: $url"
Write-Host "Branch: $branch"
