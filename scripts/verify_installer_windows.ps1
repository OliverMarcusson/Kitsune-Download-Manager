#!/usr/bin/env pwsh
Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

$HostName = 'com.kitsune.dm'
$Checks = 0
$Failures = 0

function Write-CheckPass {
    param([string]$Name, [string]$Detail)
    $script:Checks++
    Write-Output ("CHECK|{0}|PASS|{1}" -f $Name, $Detail)
}

function Write-CheckFail {
    param([string]$Name, [string]$Detail)
    $script:Checks++
    $script:Failures++
    Write-Output ("CHECK|{0}|FAIL|{1}" -f $Name, $Detail)
}

function Test-ManifestContent {
    param(
        [Parameter(Mandatory = $true)][string]$ManifestPath,
        [Parameter(Mandatory = $true)][string]$ExpectedOrigin,
        [Parameter(Mandatory = $true)][string]$ExpectedShimPath
    )

    try {
        $jsonRaw = Get-Content -Path $ManifestPath -Raw -Encoding UTF8
        $manifest = $jsonRaw | ConvertFrom-Json
    }
    catch {
        return "invalid json: $($_.Exception.Message)"
    }

    if ($manifest.name -ne $HostName) {
        return "name mismatch: expected $HostName got $($manifest.name)"
    }

    if ($manifest.type -ne 'stdio') {
        return "type mismatch: expected stdio got $($manifest.type)"
    }

    if ($manifest.path -ne $ExpectedShimPath) {
        return "path mismatch: expected $ExpectedShimPath got $($manifest.path)"
    }

    if (-not ($manifest.path -match '^[A-Za-z]:\\')) {
        return "path is not absolute windows path: $($manifest.path)"
    }

    if ($manifest.allowed_origins -isnot [System.Array] -or $manifest.allowed_origins.Count -lt 1) {
        return 'allowed_origins missing or empty'
    }

    if (-not ($manifest.allowed_origins -contains $ExpectedOrigin)) {
        return "allowed_origins missing expected origin: $ExpectedOrigin"
    }

    foreach ($origin in $manifest.allowed_origins) {
        if ($origin -notmatch '^chrome-extension://[a-p]{32}/$') {
            return "invalid origin format: $origin"
        }
        if ($origin.Contains('*')) {
            return "wildcard origin is not allowed: $origin"
        }
    }

    return $null
}

if (-not $IsWindows) {
    Write-Output 'RESULT|UNSUPPORTED|reason=windows-only verification script executed on non-windows environment'
    exit 2
}

$InstallDir = $env:KITSUNE_DM_VERIFY_INSTALL_DIR
if ([string]::IsNullOrWhiteSpace($InstallDir)) {
    $InstallDir = Join-Path $env:ProgramFiles 'Kitsune Download Manager'
}

$ManifestPath = $env:KITSUNE_DM_VERIFY_MANIFEST_PATH
if ([string]::IsNullOrWhiteSpace($ManifestPath)) {
    $ManifestPath = Join-Path $InstallDir 'resources\installer\native-host\com.kitsune.dm.json'
}

$ShimPath = $env:KITSUNE_DM_VERIFY_SHIM_PATH
if ([string]::IsNullOrWhiteSpace($ShimPath)) {
    $ShimPath = Join-Path $InstallDir 'resources\installer\bin\kitsune-shim.exe'
}

$ExtIdFile = $env:KITSUNE_DM_VERIFY_EXT_ID_FILE
if ([string]::IsNullOrWhiteSpace($ExtIdFile)) {
    $ExtIdFile = Join-Path $InstallDir 'resources\installer\extension_id_source.txt'
}

$AppBinaryPath = $env:KITSUNE_DM_VERIFY_APP_BINARY
if ([string]::IsNullOrWhiteSpace($AppBinaryPath)) {
    $AppBinaryPath = Join-Path $InstallDir 'Kitsune Download Manager.exe'
}

$RegistryKeys = @(
    'HKCU:\Software\Google\Chrome\NativeMessagingHosts\com.kitsune.dm',
    'HKCU:\Software\Chromium\NativeMessagingHosts\com.kitsune.dm',
    'HKCU:\Software\BraveSoftware\Brave-Browser\NativeMessagingHosts\com.kitsune.dm',
    'HKCU:\Software\Microsoft\Edge\NativeMessagingHosts\com.kitsune.dm'
)

Write-Output ("INFO|install_dir|{0}" -f $InstallDir)

if (Test-Path -LiteralPath $InstallDir -PathType Container) {
    Write-CheckPass -Name 'install_dir' -Detail "exists:$InstallDir"
}
else {
    Write-CheckFail -Name 'install_dir' -Detail "missing directory:$InstallDir"
}

if (Test-Path -LiteralPath $AppBinaryPath -PathType Leaf) {
    Write-CheckPass -Name 'app_binary' -Detail "exists:$AppBinaryPath"
}
else {
    Write-CheckFail -Name 'app_binary' -Detail "missing file:$AppBinaryPath"
}

if (Test-Path -LiteralPath $ShimPath -PathType Leaf) {
    Write-CheckPass -Name 'shim_binary' -Detail "exists:$ShimPath"
}
else {
    Write-CheckFail -Name 'shim_binary' -Detail "missing file:$ShimPath"
}

if (Test-Path -LiteralPath $ManifestPath -PathType Leaf) {
    Write-CheckPass -Name 'native_host_manifest_file' -Detail "exists:$ManifestPath"
}
else {
    Write-CheckFail -Name 'native_host_manifest_file' -Detail "missing file:$ManifestPath"
}

$ExtensionId = $null
if (Test-Path -LiteralPath $ExtIdFile -PathType Leaf) {
    $ExtensionId = (Get-Content -Path $ExtIdFile -Raw -Encoding UTF8).Trim()
    if ($ExtensionId -match '^[a-p]{32}$') {
        Write-CheckPass -Name 'extension_id_source' -Detail "valid:$ExtIdFile"
    }
    else {
        Write-CheckFail -Name 'extension_id_source' -Detail "invalid chromium id in:$ExtIdFile"
    }
}
else {
    Write-CheckFail -Name 'extension_id_source' -Detail "missing file:$ExtIdFile"
}

if ($null -ne $ExtensionId -and (Test-Path -LiteralPath $ManifestPath -PathType Leaf)) {
    $expectedOrigin = "chrome-extension://$ExtensionId/"
    $manifestError = Test-ManifestContent -ManifestPath $ManifestPath -ExpectedOrigin $expectedOrigin -ExpectedShimPath $ShimPath
    if ($null -eq $manifestError) {
        Write-CheckPass -Name 'native_host_manifest_content' -Detail 'valid'
    }
    else {
        Write-CheckFail -Name 'native_host_manifest_content' -Detail $manifestError
    }
}
else {
    Write-CheckFail -Name 'native_host_manifest_content' -Detail 'cannot validate manifest without extension id and manifest file'
}

foreach ($keyPath in $RegistryKeys) {
    $checkName = "registry_key:$keyPath"
    if (-not (Test-Path -LiteralPath $keyPath)) {
        Write-CheckFail -Name $checkName -Detail "missing key:$keyPath"
        continue
    }

    try {
        $defaultValue = (Get-Item -LiteralPath $keyPath).GetValue('')
    }
    catch {
        Write-CheckFail -Name $checkName -Detail "unable to read default value:$($_.Exception.Message)"
        continue
    }

    if ([string]::IsNullOrWhiteSpace($defaultValue)) {
        Write-CheckFail -Name $checkName -Detail 'default registry value is empty'
        continue
    }

    if ($defaultValue -ne $ManifestPath) {
        Write-CheckFail -Name $checkName -Detail "default value mismatch: expected $ManifestPath got $defaultValue"
        continue
    }

    Write-CheckPass -Name $checkName -Detail "default_value:$defaultValue"
}

if ($Failures -eq 0) {
    Write-Output ("RESULT|PASS|checks={0} failures={1}" -f $Checks, $Failures)
    exit 0
}

Write-Output ("RESULT|FAIL|checks={0} failures={1}" -f $Checks, $Failures)
exit 1
