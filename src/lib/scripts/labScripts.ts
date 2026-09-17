/**
 * Centralized repository for ICT Lab PowerShell scripts.
 * These scripts are used for PC setup, lockdown, and synchronization.
 */

/**
 * Wraps a PowerShell payload in a self-contained CMD launcher. Teachers can
 * double-click the downloaded file; the launcher requests UAC, runs the
 * embedded script with ExecutionPolicy Bypass, and always pauses on failure.
 */
export const getInteractiveCommandLauncher = (powershellScript: string, windowTitle: string) => {
  const safeTitle = windowTitle.replace(/[&|<>^%]/g, ' ').trim() || 'ICT Lab Setup';
  const normalizedScript = powershellScript.replace(/\r?\n/g, '\r\n');
  const batchHeader = `@echo off\r
setlocal EnableExtensions DisableDelayedExpansion\r
chcp 65001 >nul\r
title ${safeTitle}\r
set "ICTLAB_LAUNCHER_PATH=%~f0"\r
set "ICTLAB_PACKAGE_DIR=%~dp0"\r
\r
"%SystemRoot%\\System32\\WindowsPowerShell\\v1.0\\powershell.exe" -NoLogo -NoProfile -Command "if ((New-Object Security.Principal.WindowsPrincipal([Security.Principal.WindowsIdentity]::GetCurrent())).IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)) { exit 0 } else { exit 1 }" >nul 2>&1\r
if errorlevel 1 (\r
  echo Administrator permission is required. Please approve the Windows UAC prompt...\r
  "%SystemRoot%\\System32\\WindowsPowerShell\\v1.0\\powershell.exe" -NoLogo -NoProfile -ExecutionPolicy Bypass -Command "try { Start-Process -FilePath $env:ICTLAB_LAUNCHER_PATH -WorkingDirectory $env:ICTLAB_PACKAGE_DIR -Verb RunAs -ErrorAction Stop; exit 0 } catch { Write-Host $_.Exception.Message -ForegroundColor Red; exit 1 }"\r
  if errorlevel 1 (\r
    echo.\r
    echo ERROR: Administrator permission was cancelled or could not be started.\r
    pause\r
  )\r
  exit /b\r
)\r
\r
set "ICTLAB_CMD_LAUNCHER=1"\r
"%SystemRoot%\\System32\\WindowsPowerShell\\v1.0\\powershell.exe" -NoLogo -NoProfile -ExecutionPolicy Bypass -Command "$ErrorActionPreference='Stop'; try { $Raw=Get-Content -LiteralPath $env:ICTLAB_LAUNCHER_PATH -Raw -Encoding UTF8; $Marker='#<ICTLAB_POWERSHELL>'; $Start=$Raw.LastIndexOf($Marker); if ($Start -lt 0) { throw 'Embedded PowerShell marker not found.' }; $Script=$Raw.Substring($Start + $Marker.Length); Invoke-Expression $Script } catch { Write-Host ''; Write-Host ('LAUNCH FAILED: ' + $_.Exception.Message) -ForegroundColor Red; exit 1 }"\r
set "ICTLAB_EXIT_CODE=%ERRORLEVEL%"\r
echo.\r
if not "%ICTLAB_EXIT_CODE%"=="0" echo Script stopped with error code %ICTLAB_EXIT_CODE%.\r
echo Press any key to close this window.\r
pause >nul\r
exit /b %ICTLAB_EXIT_CODE%\r
\r
#<ICTLAB_POWERSHELL>\r
`;

  return `${batchHeader}${normalizedScript}`;
};

// ============================================================================
// 1. USB LISTENER SCRIPT (Embedded inside Setup)
// ============================================================================
const USB_LISTENER_SCRIPT = `
#Requires -Version 5.1
Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"
$ProgressPreference = "SilentlyContinue"

# ============================================================
# ICT LAB USB LISTENER
# Runs permanently as SYSTEM
# ============================================================

$BaseDirectory = "C:\\ProgramData\\ICTLab"
$ConfigPath = Join-Path $BaseDirectory "device-config.json"
$LogDirectory  = Join-Path $BaseDirectory "Logs"
$StageDirectory = Join-Path $BaseDirectory "Staging"
$LogFile = Join-Path $LogDirectory "UsbListener.log"
$SourceIdentifier = "ICTLab.UsbArrival"
$LastExecution = @{}
$DebounceSeconds = 60
$CompletedScripts = @{}

New-Item -ItemType Directory -Path $LogDirectory -Force | Out-Null
New-Item -ItemType Directory -Path $StageDirectory -Force | Out-Null

function Write-ICTLog {
    param([string]$Message, [string]$Level = "INFO")
    $Timestamp = (Get-Date).ToString("yyyy-MM-dd HH:mm:ss")
    Add-Content -LiteralPath $LogFile -Value "[$Timestamp][$Level] $Message" -Encoding UTF8
}

function Get-ICTVolume {
    param([string]$DriveName)
    $DeviceId = $DriveName.TrimEnd("\\")
    if ($DeviceId -notmatch "^[A-Za-z]:$") { return $null }

    for ($Attempt = 1; $Attempt -le 10; $Attempt++) {
        try {
            # Do not build a WQL filter from a drive string. Enumerating and
            # comparing here avoids "Invalid query" for values such as E:\\.
            $Disk = Get-CimInstance -ClassName Win32_LogicalDisk -ErrorAction Stop |
                Where-Object {
                    [string]::Equals(
                        [string]$_.DeviceID,
                        [string]$DeviceId,
                        [System.StringComparison]::OrdinalIgnoreCase
                    )
                } |
                Select-Object -First 1
            if ($null -ne $Disk) { return $Disk }
        } catch { }
        Start-Sleep -Milliseconds 250
    }
    return $null
}

function Test-ICTUsbVolume {
    param($Volume)
    if ($null -eq $Volume) { return $false }
    if ([int]$Volume.DriveType -eq 2) { return $true }

    try {
        $DeviceId = [string]$Volume.DeviceID
        if ($DeviceId -notmatch "^[A-Za-z]:$") { return $false }
        $StorageDisk = Get-Partition -DriveLetter $DeviceId.Substring(0, 1) -ErrorAction Stop |
            Get-Disk -ErrorAction Stop |
            Select-Object -First 1
        return (
            $null -ne $StorageDisk -and
            [string]::Equals([string]$StorageDisk.BusType, "USB", [System.StringComparison]::OrdinalIgnoreCase)
        )
    } catch {
        return $false
    }
}

function Invoke-ICTAdminUsb {
    param([string]$DriveName)
    try {
        $DriveRoot = $DriveName.TrimEnd("\\")
        $Now = Get-Date
        if ($LastExecution.ContainsKey($DriveRoot)) {
            if (($Now - $LastExecution[$DriveRoot]).TotalSeconds -lt $DebounceSeconds) { return }
        }

        if (-not (Test-Path -LiteralPath $ConfigPath -PathType Leaf)) { return }
        $DeviceConfig = Get-Content -LiteralPath $ConfigPath -Raw -Encoding UTF8 | ConvertFrom-Json
        $SyncFolderName = [string]$DeviceConfig.syncFolderName
        $ExpectedSyncToken = [string]$DeviceConfig.syncToken
        if ([string]::IsNullOrWhiteSpace($ExpectedSyncToken)) { throw "Device sync token is missing. Run the current installer." }
        if ([string]::IsNullOrWhiteSpace($SyncFolderName)) { $SyncFolderName = "ICTLabSync" }

        # Check for GlobalSync.ps1 in ICTLabSync folder or USB root
        $GlobalScriptName = "GlobalSync.ps1"
        $UsbScriptPath = Join-Path "$DriveRoot\" ("$SyncFolderName\" + $GlobalScriptName)
        if (-not (Test-Path -LiteralPath $UsbScriptPath -PathType Leaf)) {
            $UsbScriptPath = Join-Path "$DriveRoot\" $GlobalScriptName
        }

        if (-not (Test-Path -LiteralPath $UsbScriptPath -PathType Leaf)) {
            return
        }

        # Check auth header marker (strip optional UTF-8 BOM or leading noise)
        $RawHeader = (Get-Content -LiteralPath $UsbScriptPath -TotalCount 1 -Encoding UTF8)
        $ActualHeader = if ($RawHeader) { ($RawHeader -replace '^[^#]*', '').Trim() } else { '' }
        if ($ActualHeader -notmatch '^#\\s*ICTLAB-AUTH:') {
            Write-ICTLog "GlobalSync script on $DriveRoot is missing # ICTLAB-AUTH header. USB ignored." "WARN"
            return
        }

        $ActualToken = ($ActualHeader -replace '^#\\s*ICTLAB-AUTH:\\s*', '').Trim()
        $IsTokenValid = [string]::Equals($ActualToken, $ExpectedSyncToken, [System.StringComparison]::Ordinal)

        if (-not $IsTokenValid) {
            Write-ICTLog "GlobalSync authorization token is invalid. USB ignored." "ERROR"
            return
        }

        $ScriptHash = (Get-FileHash -LiteralPath $UsbScriptPath -Algorithm SHA256).Hash
        if ($CompletedScripts.ContainsKey($DriveRoot) -and $CompletedScripts[$DriveRoot] -eq $ScriptHash) { return }

        # Valid USB with GlobalSync detected! Update debounce timestamp
        $LastExecution[$DriveRoot] = $Now
        Write-ICTLog "Valid ICT Lab Sync USB detected on $DriveRoot ($UsbScriptPath)."

        # Audio + Visual Notification: USB detected & Starting Sync
        try { [console]::beep(900, 180); [console]::beep(1300, 250) } catch { }
        try {
            if (Get-Command msg.exe -ErrorAction SilentlyContinue) {
                Start-Process -FilePath "msg.exe" -ArgumentList @("*", "/time:5", "ICT Lab: រកឃើញ USB Sync ($DriveRoot)! កំពុងចាប់ផ្តើម Sync គណនីសិស្ស... សូមរង់ចាំ") -WindowStyle Hidden -ErrorAction SilentlyContinue
            }
        } catch { }

        $LocalScriptPath = Join-Path $StageDirectory $GlobalScriptName
        # Normalize legacy UTF-8 files to UTF-8 BOM for Windows PowerShell 5.1.
        $SyncText = Get-Content -LiteralPath $UsbScriptPath -Raw -Encoding UTF8
        Set-Content -LiteralPath $LocalScriptPath -Value $SyncText -Encoding UTF8

        $PowerShellExe = Join-Path $env:SystemRoot "System32\\WindowsPowerShell\\v1.0\\powershell.exe"
        Write-ICTLog "Executing ICT Lab sync for $env:COMPUTERNAME."

        try {
            $Process = Start-Process -FilePath $PowerShellExe \`
                -ArgumentList @("-NoLogo", "-NoProfile", "-NonInteractive", "-ExecutionPolicy", "Bypass", "-File", "\`"$LocalScriptPath\`"", "-UsbDrive", "\`"$DriveRoot\`"") \`
                -WindowStyle Hidden -Wait -PassThru
            Write-ICTLog "Sync script finished. ExitCode=$($Process.ExitCode)"

            if ($Process.ExitCode -in @(0, 10, 11)) { $CompletedScripts[$DriveRoot] = $ScriptHash }
            if ($Process.ExitCode -eq 0) {
                try { [console]::beep(1200, 150); [console]::beep(1600, 300) } catch { }
                try {
                    if (Get-Command msg.exe -ErrorAction SilentlyContinue) {
                        Start-Process -FilePath "msg.exe" -ArgumentList @("*", "/time:8", "ICT Lab: ការ Sync គណនីសិស្សទទួលបានជោគជ័យ ១០០%! សិស្សអាច Login ប្រើ PC បានហើយ។") -WindowStyle Hidden -ErrorAction SilentlyContinue
                    }
                } catch { }
            } elseif ($Process.ExitCode -notin @(10, 11)) {
                try { [console]::beep(400, 600) } catch { }
                try {
                    if (Get-Command msg.exe -ErrorAction SilentlyContinue) {
                        Start-Process -FilePath "msg.exe" -ArgumentList @("*", "/time:10", "ICT Lab [កំហុស]: ការ Sync មិនជោគជ័យ (ExitCode $($Process.ExitCode))! សូមបើក File '2_Sync_PC_Now.cmd' លើ USB ដើម្បីពិនិត្យ Error។") -WindowStyle Hidden -ErrorAction SilentlyContinue
                    }
                } catch { }
            }
        } finally {
            Remove-Item -LiteralPath $LocalScriptPath -Force -ErrorAction SilentlyContinue
            $LastExecution[$DriveRoot] = Get-Date
        }
    } catch {
        Write-ICTLog "USB processing failure: $($_.Exception.Message)" "ERROR"
    }
}

Write-ICTLog "ICT Lab USB Listener starting."

try {
    # Scan on startup for any already inserted USB
    try {
        $MountedUsbDrives = @(
            Get-CimInstance -ClassName Win32_LogicalDisk -ErrorAction SilentlyContinue |
                Where-Object { Test-ICTUsbVolume -Volume $_ }
        )
        foreach ($MountedUsb in $MountedUsbDrives) {
            if (-not [string]::IsNullOrWhiteSpace([string]$MountedUsb.DeviceID)) {
                Invoke-ICTAdminUsb -DriveName ([string]$MountedUsb.DeviceID)
            }
        }
    } catch {
        Write-ICTLog "Initial USB scan failed: $($_.Exception.Message)" "WARN"
    }

    try {
        Register-CimIndicationEvent -Namespace "root/cimv2" \`
            -Query "SELECT * FROM Win32_VolumeChangeEvent WHERE EventType = 2 OR EventType = 3" \`
            -SourceIdentifier $SourceIdentifier -ErrorAction SilentlyContinue | Out-Null
    } catch { }

    while ($true) {
        # 1. Event wait with 2-second timeout (wakes up immediately if event received, or times out after 2s)
        try {
            $Event = Wait-Event -SourceIdentifier $SourceIdentifier -Timeout 2 -ErrorAction SilentlyContinue
            if ($null -ne $Event) {
                try {
                    $EvType = [int]$Event.SourceEventArgs.NewEvent.EventType
                    $DriveName = [string]$Event.SourceEventArgs.NewEvent.DriveName
                    if (-not ([string]::IsNullOrWhiteSpace($DriveName))) {
                        $DriveClean = $DriveName.TrimEnd("\\")
                        if ($EvType -eq 3) {
                            $CompletedScripts.Remove($DriveClean)
                            $LastExecution.Remove($DriveClean)
                            Write-ICTLog "USB $DriveClean disconnect event detected. Ready for next insertion."
                        } elseif ($EvType -eq 2) {
                            Invoke-ICTAdminUsb -DriveName $DriveName
                        }
                    }
                } finally {
                    Remove-Event -EventIdentifier $Event.EventIdentifier -ErrorAction SilentlyContinue
                }
            }
        } catch { }

        # 2. Dual-Engine Proactive polling fallback: check all mounted USB/removable drives every 2 seconds
        try {
            $MountedUsbDrives = @(
                Get-CimInstance -ClassName Win32_LogicalDisk -ErrorAction SilentlyContinue |
                    Where-Object { Test-ICTUsbVolume -Volume $_ }
            )

            # Clean up tracking for any drives that have been unplugged/removed
            $ActiveDriveLetters = @($MountedUsbDrives | ForEach-Object { [string]$_.DeviceID })
            $TrackedDrives = @($CompletedScripts.Keys) + @($LastExecution.Keys) | Select-Object -Unique
            foreach ($Td in $TrackedDrives) {
                if ($ActiveDriveLetters -notcontains $Td) {
                    $CompletedScripts.Remove($Td)
                    $LastExecution.Remove($Td)
                    Write-ICTLog "USB $Td disconnected. Cache cleared for next insertion."
                }
            }

            foreach ($MountedUsb in $MountedUsbDrives) {
                if (-not [string]::IsNullOrWhiteSpace([string]$MountedUsb.DeviceID)) {
                    Invoke-ICTAdminUsb -DriveName ([string]$MountedUsb.DeviceID)
                }
            }
        } catch { }

        Start-Sleep -Seconds 1
    }
} finally {
    Unregister-Event -SourceIdentifier $SourceIdentifier -ErrorAction SilentlyContinue
    Write-ICTLog "ICT Lab USB Listener stopped."
}
`;

// Shared bootstrap for scripts that a teacher starts manually.
// It elevates once, waits for the elevated process, and keeps failures visible.
const INTERACTIVE_ADMIN_BOOTSTRAP = `
Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"
$ProgressPreference = "SilentlyContinue"

function Complete-ICTInteractiveRun {
    param([int]$ExitCode)
    Write-Host ""
    if ([string]$env:ICTLAB_CMD_LAUNCHER -ne "1") {
        try { [void](Read-Host "Press Enter to close this window") } catch { }
    }
    exit $ExitCode
}

$CurrentIdentity = [Security.Principal.WindowsIdentity]::GetCurrent()
$CurrentPrincipal = New-Object Security.Principal.WindowsPrincipal($CurrentIdentity)
if (-not $CurrentPrincipal.IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)) {
    $ScriptPath = ''
    $ScriptPathProperty = $MyInvocation.MyCommand.PSObject.Properties['Path']
    if ($null -ne $ScriptPathProperty) {
        $ScriptPath = [string]$ScriptPathProperty.Value
    }
    if ([string]::IsNullOrWhiteSpace($ScriptPath)) {
        Write-Host "ERROR: Save this file as a .ps1 file before running it." -ForegroundColor Red
        Complete-ICTInteractiveRun -ExitCode 1
    }

    try {
        Write-Host "Administrator permission is required. Please approve the Windows prompt..." -ForegroundColor Yellow
        $PowerShellExe = Join-Path $env:SystemRoot "System32\\WindowsPowerShell\\v1.0\\powershell.exe"
        $ElevatedProcess = Start-Process -FilePath $PowerShellExe -Verb RunAs -ArgumentList @(
            "-NoLogo",
            "-NoProfile",
            "-ExecutionPolicy",
            "Bypass",
            "-File",
            "\`"$ScriptPath\`""
        ) -Wait -PassThru
        exit $ElevatedProcess.ExitCode
    } catch {
        Write-Host "ERROR: Administrator permission was cancelled or could not be started." -ForegroundColor Red
        Write-Host $_.Exception.Message -ForegroundColor Red
        Complete-ICTInteractiveRun -ExitCode 1
    }
}
`;

// ============================================================================
// 2. SETUP LAB PC SCRIPT
// ============================================================================
export const getSetupScript = (configBase64: string) => `
#Requires -Version 5.1
[CmdletBinding()]
param()
${INTERACTIVE_ADMIN_BOOTSTRAP}

Write-Host "========================================" -ForegroundColor Cyan
Write-Host " ICT LAB PC SETUP & LOCKDOWN" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan

$SetupExitCode = 0
$ICTRoot = "C:\\ProgramData\\ICTLab"
$GroupName = "ICTLabStudents"

try {
$InstallConfigJson = [System.Text.Encoding]::UTF8.GetString([Convert]::FromBase64String("${configBase64}"))
$InstallConfig = $InstallConfigJson | ConvertFrom-Json
if ([string]::IsNullOrWhiteSpace([string]$InstallConfig.usbLabel)) {
    throw "USB label must be configured in the ICT Lab System before setup."
}

$MachineGuid = (Get-ItemProperty -Path "HKLM:\\SOFTWARE\\Microsoft\\Cryptography" -Name "MachineGuid").MachineGuid
function ConvertTo-ICTPcNumber {
    param([string]$Value)
    $Normalized = ([string]$Value).Trim().ToUpperInvariant()
    if ($Normalized -match '^PC[-_ ]?(\\d{1,3})$') {
        return "PC-{0:D2}" -f [int]$Matches[1]
    }
    return $null
}

$AssignmentBatchId = [string]$InstallConfig.labId
if ($null -ne $InstallConfig.PSObject.Properties['assignmentBatchId'] -and -not [string]::IsNullOrWhiteSpace([string]$InstallConfig.assignmentBatchId)) {
    $AssignmentBatchId = ([string]$InstallConfig.assignmentBatchId).Trim()
}

$PcNumber = $null
if ($null -ne $InstallConfig.PSObject.Properties['pcNumber']) {
    $PcNumber = ConvertTo-ICTPcNumber -Value ([string]$InstallConfig.pcNumber)
}
$ExistingConfigPath = Join-Path $ICTRoot "device-config.json"
if ([string]::IsNullOrWhiteSpace($PcNumber) -and (Test-Path -LiteralPath $ExistingConfigPath -PathType Leaf)) {
    try {
        $ExistingDeviceConfig = Get-Content -LiteralPath $ExistingConfigPath -Raw -Encoding UTF8 | ConvertFrom-Json
        $ExistingLabId = if ($null -ne $ExistingDeviceConfig.PSObject.Properties['labId']) { [string]$ExistingDeviceConfig.labId } else { '' }
        $ExistingAssignmentBatchId = if ($null -ne $ExistingDeviceConfig.PSObject.Properties['assignmentBatchId']) { [string]$ExistingDeviceConfig.assignmentBatchId } else { '' }
        if (
            [string]::Equals($ExistingLabId, [string]$InstallConfig.labId, [System.StringComparison]::OrdinalIgnoreCase) -and
            [string]::Equals($ExistingAssignmentBatchId, $AssignmentBatchId, [System.StringComparison]::Ordinal)
        ) {
            $PcNumber = ConvertTo-ICTPcNumber -Value ([string]$ExistingDeviceConfig.pcNumber)
            if (-not [string]::IsNullOrWhiteSpace($PcNumber)) {
                Write-Host "This installer batch already configured this PC. Retained: $PcNumber" -ForegroundColor Green
            }
        }
    } catch { }
}
if ([string]::IsNullOrWhiteSpace($PcNumber)) {
    # ------------------------------------------------------------------------
    # AUTO PC ASSIGNMENT
    # Always use the shared USB state. The installer itself may be launched
    # from Desktop/Downloads, so ICTLAB_PACKAGE_DIR must not be trusted as the
    # assignment location unless it resolves to the configured USB.
    # ------------------------------------------------------------------------
    $ExpectedUsbLabel = ([string]$InstallConfig.usbLabel).Trim()
    $AssignmentDirectory = $null
    $AssignmentDrive = $null

    Write-Host "Searching for shared ICT Lab USB..." -ForegroundColor Yellow

    $LogicalDrives = @(Get-CimInstance -ClassName Win32_LogicalDisk -ErrorAction Stop)
    $UsbCandidates = @()

    foreach ($LogicalDrive in $LogicalDrives) {
        $DeviceId = ([string]$LogicalDrive.DeviceID).Trim()
        if ($DeviceId -notmatch '^[A-Za-z]:$') { continue }

        $CandidateDirectory = Join-Path $DeviceId "ICTLabSync"
        if (-not (Test-Path -LiteralPath $CandidateDirectory -PathType Container)) { continue }

        # Prefer the configured volume label. This is more dependable than
        # Win32_LogicalDisk.DriveType because some USB sticks appear as type 3.
        $VolumeLabel = ([string]$LogicalDrive.VolumeName).Trim()
        $LabelMatches = [string]::Equals(
            $VolumeLabel,
            $ExpectedUsbLabel,
            [System.StringComparison]::OrdinalIgnoreCase
        )
        if (-not $LabelMatches) { continue }

        # Determine the physical bus when Windows Storage cmdlets support it.
        # A failed bus lookup is not fatal because the configured label plus
        # ICTLabSync folder already identifies the intended shared media.
        $BusType = ''
        $IsPhysicalUsb = ([int]$LogicalDrive.DriveType -eq 2)
        if (-not $IsPhysicalUsb) {
            try {
                $DriveLetter = $DeviceId.Substring(0, 1)
                $StorageDisk = Get-Partition -DriveLetter $DriveLetter -ErrorAction Stop |
                    Get-Disk -ErrorAction Stop |
                    Select-Object -First 1
                if ($null -ne $StorageDisk) {
                    $BusType = [string]$StorageDisk.BusType
                    $IsPhysicalUsb = [string]::Equals(
                        $BusType,
                        'USB',
                        [System.StringComparison]::OrdinalIgnoreCase
                    )
                }
            } catch {
                Write-Host "USB bus detection warning for $DeviceId : $($_.Exception.Message)" -ForegroundColor DarkYellow
            }
        }

        $UsbCandidates += [pscustomobject]@{
            Drive = $LogicalDrive
            Directory = $CandidateDirectory
            DeviceId = $DeviceId
            VolumeLabel = $VolumeLabel
            BusType = $BusType
            IsPhysicalUsb = $IsPhysicalUsb
        }
    }

    if ($UsbCandidates.Count -eq 0) {
        # Fallback 1: Check if installer is running directly from a drive containing ICTLabSync
        $LauncherPkgDir = if ($null -ne $env:ICTLAB_PACKAGE_DIR) { [string]$env:ICTLAB_PACKAGE_DIR.TrimEnd('\\') } else { '' }
        if (-not [string]::IsNullOrWhiteSpace($LauncherPkgDir)) {
            $CandidateFromLauncher = if ((Split-Path -Leaf $LauncherPkgDir) -ieq "ICTLabSync") { $LauncherPkgDir } else { Join-Path $LauncherPkgDir "ICTLabSync" }
            if (Test-Path -LiteralPath $CandidateFromLauncher -PathType Container) {
                $LauncherDriveLetter = if ($LauncherPkgDir.Length -ge 2 -and $LauncherPkgDir[1] -eq ':') { $LauncherPkgDir.Substring(0, 2) } else { $LauncherPkgDir }
                $LauncherLogical = $LogicalDrives | Where-Object { [string]::Equals([string]$_.DeviceID, $LauncherDriveLetter, [System.StringComparison]::OrdinalIgnoreCase) } | Select-Object -First 1
                if ($null -ne $LauncherLogical) {
                    $UsbCandidates += [pscustomobject]@{
                        Drive = $LauncherLogical
                        Directory = $CandidateFromLauncher
                        DeviceId = $LauncherDriveLetter
                        VolumeLabel = [string]$LauncherLogical.VolumeName
                        BusType = ''
                        IsPhysicalUsb = ($LauncherLogical.DriveType -eq 2)
                    }
                    Write-Host "Detected ICT Lab package from launcher drive: $LauncherDriveLetter" -ForegroundColor Green
                }
            }
        }
    }

    if ($UsbCandidates.Count -eq 0) {
        # Fallback 2: Check any logical/removable drive containing ICTLabSync folder regardless of volume label (excluding system OS drive)
        foreach ($LogicalDrive in $LogicalDrives) {
            $DeviceId = ([string]$LogicalDrive.DeviceID).Trim()
            if ($DeviceId -notmatch '^[A-Za-z]:$' -or [string]::Equals($DeviceId, [string]$env:SystemDrive, [System.StringComparison]::OrdinalIgnoreCase)) { continue }
            $CandidateDirectory = Join-Path $DeviceId "ICTLabSync"
            if (Test-Path -LiteralPath $CandidateDirectory -PathType Container) {
                $UsbCandidates += [pscustomobject]@{
                    Drive = $LogicalDrive
                    Directory = $CandidateDirectory
                    DeviceId = $DeviceId
                    VolumeLabel = ([string]$LogicalDrive.VolumeName).Trim()
                    BusType = ''
                    IsPhysicalUsb = ([int]$LogicalDrive.DriveType -eq 2)
                }
            }
        }
        if ($UsbCandidates.Count -gt 0) {
            Write-Host "Detected ICT Lab USB by folder (Volume label did not match '$ExpectedUsbLabel'): $($UsbCandidates[0].DeviceId)" -ForegroundColor Yellow
        }
    }

    if ($UsbCandidates.Count -eq 0) {
        Write-Host "Expected USB label: $ExpectedUsbLabel" -ForegroundColor DarkYellow
        Write-Host "Mounted drives:" -ForegroundColor DarkGray
        foreach ($Drive in $LogicalDrives) {
            Write-Host ("  {0}  Label='{1}'  DriveType={2}" -f $Drive.DeviceID, $Drive.VolumeName, $Drive.DriveType) -ForegroundColor DarkGray
        }
        throw "Cannot find the shared ICT Lab USB. Insert the USB labeled '$ExpectedUsbLabel' that contains the ICTLabSync folder, then run setup again."
    }

    if ($UsbCandidates.Count -gt 1) {
        $CandidateNames = ($UsbCandidates | ForEach-Object { "$($_.DeviceId) [$($_.VolumeLabel)]" }) -join ', '
        throw "More than one matching ICT Lab USB was found: $CandidateNames. Keep only one shared installer USB inserted."
    }

    $SelectedUsb = $UsbCandidates[0]
    $AssignmentDrive = $SelectedUsb.Drive
    $AssignmentDirectory = [string]$SelectedUsb.Directory
    $AssignmentDriveRoot = [string]$SelectedUsb.DeviceId

    Write-Host "Assignment Directory: $AssignmentDirectory" -ForegroundColor DarkGray
    Write-Host "Assignment Drive: $AssignmentDriveRoot" -ForegroundColor DarkGray
    Write-Host "USB Label: $($SelectedUsb.VolumeLabel)" -ForegroundColor DarkGray
    if (-not [string]::IsNullOrWhiteSpace([string]$SelectedUsb.BusType)) {
        Write-Host "USB BusType: $($SelectedUsb.BusType)" -ForegroundColor DarkGray
    }

    # Shared counter used by every PC in this installer batch.
    $AssignmentStatePath = Join-Path $AssignmentDirectory "ICTLab_PC_Assignment.json"
    $NextNumber = 1

    if (Test-Path -LiteralPath $AssignmentStatePath -PathType Leaf) {
        try {
            $AssignmentState = Get-Content -LiteralPath $AssignmentStatePath -Raw -Encoding UTF8 | ConvertFrom-Json
            $StateBatchId = [string]$AssignmentState.assignmentBatchId

            if ([string]::Equals($StateBatchId, $AssignmentBatchId, [System.StringComparison]::Ordinal)) {
                $ParsedNextNumber = 0
                if (
                    -not [int]::TryParse([string]$AssignmentState.nextNumber, [ref]$ParsedNextNumber) -or
                    $ParsedNextNumber -lt 1
                ) {
                    throw "Invalid nextNumber in assignment state."
                }
                $NextNumber = $ParsedNextNumber
            } else {
                Write-Host "Assignment batch changed. Counter will restart from PC-01 for this batch." -ForegroundColor Yellow
            }
        } catch {
            throw "The USB assignment file is damaged: $($_.Exception.Message)"
        }
    }

    # Extract broken PCs list from installer configuration if provided
    $BrokenPcs = @()
    if ($null -ne $InstallConfig.PSObject.Properties['brokenPcs'] -and $null -ne $InstallConfig.brokenPcs) {
        $BrokenPcs = @($InstallConfig.brokenPcs | ForEach-Object { ConvertTo-ICTPcNumber -Value ([string]$_) } | Where-Object { $null -ne $_ })
    }

    # Automatically skip any PC number marked as broken/issue in the system
    $CandidatePc = "PC-{0:D2}" -f $NextNumber
    while ($BrokenPcs -contains $CandidatePc -and $NextNumber -le 999) {
        Write-Host "==========================================================" -ForegroundColor Yellow
        Write-Host " [NOTICE] $CandidatePc is registered as BROKEN/DEFECTIVE in ICT Lab System." -ForegroundColor Yellow
        Write-Host " [AUTO-SKIP] Skipping $CandidatePc -> checking next PC..." -ForegroundColor Cyan
        Write-Host "==========================================================" -ForegroundColor Yellow
        $NextNumber++
        $CandidatePc = "PC-{0:D2}" -f $NextNumber
    }

    if ($NextNumber -gt 999) {
        throw "The USB assignment counter exceeded PC-999."
    }

    $PcNumber = "PC-{0:D2}" -f $NextNumber

    # Interactive confirmation and manual override:
    Write-Host ""
    Write-Host "----------------------------------------------------------" -ForegroundColor DarkGray
    Write-Host " Logical PC Assignment:" -ForegroundColor Green
    Write-Host " Auto-detected PC Name: $PcNumber" -ForegroundColor White
    if ($BrokenPcs.Count -gt 0) {
        Write-Host " (Auto-skipped Broken PCs: $($BrokenPcs -join ', '))" -ForegroundColor DarkYellow
    }
    Write-Host "----------------------------------------------------------" -ForegroundColor DarkGray
    Write-Host "Press [ENTER] to confirm '$PcNumber' or type another PC number (e.g. PC-05): " -NoNewline -ForegroundColor Green
    
    $UserOverride = Read-Host
    if (-not [string]::IsNullOrWhiteSpace($UserOverride)) {
        $ParsedOverride = ConvertTo-ICTPcNumber -Value $UserOverride
        if ($null -ne $ParsedOverride) {
            $PcNumber = $ParsedOverride
            Write-Host "Overridden PC Name: $PcNumber" -ForegroundColor Yellow
            $OverrideNumber = [int]($PcNumber -replace '\\D', '')
            if ($OverrideNumber -ge $NextNumber) {
                $NextNumber = $OverrideNumber
            }
        } else {
            Write-Host "Invalid format '$UserOverride'. Keeping '$PcNumber'." -ForegroundColor DarkYellow
        }
    }

    # Calculate subsequent PC number for next computer, skipping any broken PCs as well
    $NextForSubsequent = $NextNumber + 1
    $SubsequentCandidate = "PC-{0:D2}" -f $NextForSubsequent
    while ($BrokenPcs -contains $SubsequentCandidate -and $NextForSubsequent -le 999) {
        Write-Host (" [INFO] Subsequent PC $SubsequentCandidate is also broken. Will prepare for PC-{0:D2} next." -f ($NextForSubsequent + 1)) -ForegroundColor DarkGray
        $NextForSubsequent++
        $SubsequentCandidate = "PC-{0:D2}" -f $NextForSubsequent
    }

    $NextAssignmentState = [ordered]@{
        version = 1
        assignmentBatchId = $AssignmentBatchId
        nextNumber = $NextForSubsequent
        lastAssignedPc = $PcNumber
        lastComputerName = [string]$env:COMPUTERNAME
        updatedAt = (Get-Date).ToString("o")
    }

    try {
        # Write through a temporary file first so a partial write cannot corrupt
        # the shared assignment state if the USB is unexpectedly removed.
        $AssignmentTempPath = "$AssignmentStatePath.tmp"
        $NextAssignmentState |
            ConvertTo-Json -Depth 4 |
            Set-Content -LiteralPath $AssignmentTempPath -Encoding UTF8 -Force
        Move-Item -LiteralPath $AssignmentTempPath -Destination $AssignmentStatePath -Force
    } catch {
        throw "Cannot update the USB assignment counter. Make sure the USB is writable and remains inserted: $($_.Exception.Message)"
    }

    Write-Host "Assigned logical name: $PcNumber" -ForegroundColor Green
    Write-Host ("The next new PC will receive PC-{0:D2}." -f $NextForSubsequent) -ForegroundColor Cyan
}
if ([string]::IsNullOrWhiteSpace($PcNumber)) {
    throw "Automatic logical PC assignment failed."
}
$DeviceConfig = [ordered]@{
    version = 3
    labId = [string]$InstallConfig.labId
    labName = [string]$InstallConfig.labName
    deviceId = [string]$MachineGuid
    pcNumber = $PcNumber
    pcName = [string]$env:COMPUTERNAME
    friendlyName = $PcNumber
    assignmentBatchId = if ($null -ne $InstallConfig.PSObject.Properties['assignmentBatchId']) { [string]$InstallConfig.assignmentBatchId } else { [string]$InstallConfig.labId }
    expectedUsbLabel = ([string]$InstallConfig.usbLabel).Trim()
    syncFolderName = "ICTLabSync"
    syncToken = [string]$InstallConfig.syncToken
    installedAt = (Get-Date).ToString("o")
}

# 1. Ensure Directory
New-Item -ItemType Directory -Path $ICTRoot -Force | Out-Null
New-Item -ItemType Directory -Path "$ICTRoot\\Backup" -Force | Out-Null
$DeviceConfig | ConvertTo-Json -Depth 6 | Set-Content -LiteralPath "$ICTRoot\\device-config.json" -Encoding UTF8

# 2. Keep AppLocker unchanged.
# Enabling AppLocker here can block legitimate non-admin applications outside
# Windows and Program Files, and Windows 10/11 protects AppIDSvc from a clean
# automatic rollback. Application blocking needs an explicit, reviewed policy.
Write-Host "[1/7] Preserving the current AppLocker policy..." -ForegroundColor Yellow
Write-Host "       AppLocker allow-list is not enabled by automatic setup." -ForegroundColor DarkGray

# 3. Configure Windows sign-in screen so ICT Lab local users can be enumerated.
Write-Host "[2/7] Configuring Windows Login Screen..." -ForegroundColor Yellow
$LoginEnumerationPolicyPath = "HKLM:\\SOFTWARE\\Policies\\Microsoft\\Windows\\System"
$WinlogonPolicyPath = "HKLM:\\SOFTWARE\\Microsoft\\Windows\\CurrentVersion\\Policies\\System"
$LoginPolicyBackupPath = "$ICTRoot\\Backup\\login-screen-policy.json"

function Get-ICTRegistryDwordState {
    param([string]$Path, [string]$Name)

    $Exists = $false
    $Value = $null
    if (Test-Path -LiteralPath $Path) {
        try {
            $RegistryObject = Get-ItemProperty -LiteralPath $Path -ErrorAction Stop
            $RegistryProperty = $RegistryObject.PSObject.Properties[$Name]
            if ($null -ne $RegistryProperty) {
                $Exists = $true
                $Value = [int]$RegistryProperty.Value
            }
        } catch { }
    }

    return [ordered]@{
        path = $Path
        name = $Name
        exists = $Exists
        value = $Value
    }
}

# Preserve the pre-ICT Lab values once so Factory Reset can restore them.
if (-not (Test-Path -LiteralPath $LoginPolicyBackupPath -PathType Leaf)) {
    $LoginPolicyBackup = [ordered]@{
        version = 1
        enumerateLocalUsers = (Get-ICTRegistryDwordState -Path $LoginEnumerationPolicyPath -Name "EnumerateLocalUsers")
        dontDisplayLastUserName = (Get-ICTRegistryDwordState -Path $WinlogonPolicyPath -Name "DontDisplayLastUserName")
        hideFastUserSwitching = (Get-ICTRegistryDwordState -Path $WinlogonPolicyPath -Name "HideFastUserSwitching")
    }
    $LoginPolicyBackup | ConvertTo-Json -Depth 6 | Set-Content -LiteralPath $LoginPolicyBackupPath -Encoding UTF8
}

function Set-ICTRegistryDword {
    param([string]$Path, [string]$Name, [int]$Value)
    try {
        if (-not (Test-Path -LiteralPath $Path)) {
            New-Item -Path $Path -Force -ErrorAction SilentlyContinue | Out-Null
        }
        Set-ItemProperty -LiteralPath $Path -Name $Name -Value $Value -Type DWord -Force -ErrorAction SilentlyContinue | Out-Null
    } catch {
        try {
            $RegKey = $Path -replace '^HKLM:\\', 'HKLM\'
            & reg.exe add $RegKey /v $Name /t REG_DWORD /d $Value /f *>$null
        } catch { }
    }
}

Set-ICTRegistryDword -Path $LoginEnumerationPolicyPath -Name "EnumerateLocalUsers" -Value 1
Set-ICTRegistryDword -Path $WinlogonPolicyPath -Name "DontDisplayLastUserName" -Value 0
Set-ICTRegistryDword -Path $WinlogonPolicyPath -Name "HideFastUserSwitching" -Value 0

Write-Host "       Local ICT Lab users will be available on the Windows sign-in screen." -ForegroundColor DarkGray

# 4. Create Local Group & Configure Windows Local Password Policy
Write-Host "[3/7] Creating $GroupName group & configuring local policy..." -ForegroundColor Yellow
if (-not (Get-LocalGroup -Name $GroupName -ErrorAction SilentlyContinue)) {
    New-LocalGroup -Name $GroupName -Description "Students managed by ICT Lab System" | Out-Null
}

try {
    # Disable Windows Local Password Complexity (so simple student passwords work reliably on all Windows editions)
    $SecDbPath = Join-Path "$ICTRoot\\Backup" "secedit.sdb"
    $SecCfgExport = Join-Path "$ICTRoot\\Backup" "sec_export.inf"
    $SecCfgImport = Join-Path "$ICTRoot\\Backup" "sec_import.inf"
    & secedit.exe /export /cfg $SecCfgExport /quiet
    if (Test-Path -LiteralPath $SecCfgExport) {
        $SecContent = Get-Content -LiteralPath $SecCfgExport -Raw -Encoding Unicode
        $SecContent = $SecContent -replace "PasswordComplexity\\s*=\\s*\\d+", "PasswordComplexity = 0"
        $SecContent = $SecContent -replace "MinimumPasswordLength\\s*=\\s*\\d+", "MinimumPasswordLength = 0"
        $SecContent = $SecContent -replace "PasswordHistorySize\\s*=\\s*\\d+", "PasswordHistorySize = 0"
        $SecContent = $SecContent -replace "MaximumPasswordAge\\s*=\\s*\\d+", "MaximumPasswordAge = -1"
        Set-Content -LiteralPath $SecCfgImport -Value $SecContent -Encoding Unicode
        & secedit.exe /configure /db $SecDbPath /cfg $SecCfgImport /areas SECURITYPOLICY /quiet
        Remove-Item -LiteralPath $SecCfgExport, $SecCfgImport -Force -ErrorAction SilentlyContinue
        Write-Host "       Local password complexity disabled (student passwords will not be blocked by Windows)." -ForegroundColor DarkGray
    }
} catch {
    Write-Host "       Note: Password policy adjustment notice: $($_.Exception.Message)" -ForegroundColor DarkGray
}

# 4. Disable Offline Games & Browser Games (Solitaire, Spider, FreeCell, Dino, Surf)
Write-Host "[4/7] Disabling Offline Games (Solitaire Card Games, Chrome Dino, Edge Surf)..." -ForegroundColor Yellow
$ChromePolicyPath = "HKLM:\\SOFTWARE\\Policies\\Google\\Chrome"
$EdgePolicyPath = "HKLM:\\SOFTWARE\\Policies\\Microsoft\\Edge"
$CloudContentPath = "HKLM:\\SOFTWARE\\Policies\\Microsoft\\Windows\\CloudContent"

try {
    if ([bool]$InstallConfig.policies.blockBrowserGames) {
        # 1. Block Chrome Dino & Edge Surf
        Set-ICTRegistryDword -Path $ChromePolicyPath -Name "AllowDinosaurEasterEgg" -Value 0
        Set-ICTRegistryDword -Path $EdgePolicyPath -Name "AllowSurfGame" -Value 0
        
        # 2. Block Windows Consumer Features (prevents Windows from auto-installing/suggesting games)
        Set-ICTRegistryDword -Path $CloudContentPath -Name "DisableWindowsConsumerFeatures" -Value 1

        # 3. Remove Windows Preinstalled Card Games (Microsoft Solitaire Collection, Candy Crush, etc.)
        try {
            Write-Host "       Removing built-in card games (Microsoft Solitaire Collection, FreeCell, Spider)..." -ForegroundColor DarkGray
            Get-AppxPackage -AllUsers *SolitaireCollection* -ErrorAction SilentlyContinue | Remove-AppxPackage -AllUsers -ErrorAction SilentlyContinue
            Get-AppxProvisionedPackage -Online -ErrorAction SilentlyContinue | Where-Object { $_.DisplayName -like "*Solitaire*" } | Remove-AppxProvisionedPackage -Online -ErrorAction SilentlyContinue
            Get-AppxPackage -AllUsers *CandyCrush* -ErrorAction SilentlyContinue | Remove-AppxPackage -AllUsers -ErrorAction SilentlyContinue
            Get-AppxProvisionedPackage -Online -ErrorAction SilentlyContinue | Where-Object { $_.DisplayName -like "*CandyCrush*" } | Remove-AppxProvisionedPackage -Online -ErrorAction SilentlyContinue
        } catch { }
    } else {
        try { if (Test-Path -LiteralPath $ChromePolicyPath) { Remove-ItemProperty -LiteralPath $ChromePolicyPath -Name "AllowDinosaurEasterEgg" -Force -ErrorAction SilentlyContinue } } catch { }
        try { if (Test-Path -LiteralPath $EdgePolicyPath) { Remove-ItemProperty -LiteralPath $EdgePolicyPath -Name "AllowSurfGame" -Force -ErrorAction SilentlyContinue } } catch { }
        try { if (Test-Path -LiteralPath $CloudContentPath) { Remove-ItemProperty -LiteralPath $CloudContentPath -Name "DisableWindowsConsumerFeatures" -Force -ErrorAction SilentlyContinue } } catch { }
    }
} catch {
    Write-Host "       Note: Game policy configuration encountered non-fatal notice: $($_.Exception.Message)" -ForegroundColor DarkGray
}

# 4.1 Install Logon Script for USB Blocking and Game Restrictions
Write-Host "[5/7] Configuring Student USB Blocking & Offline Game Lockdown..." -ForegroundColor Yellow
$LogonScriptPath = "$ICTRoot\\LogonScript.ps1"
$LogonScriptCode = @'
$StudentGroup = "ICTLabStudents"
$IsStudent = $false

try {
    # Check current process security token groups (works reliably for Limited users without admin permissions)
    $CurrentTokenGroups = @([System.Security.Principal.WindowsIdentity]::GetCurrent().Groups | ForEach-Object { $_.Value })
    $StudentLocalGroup = Get-LocalGroup -Name $StudentGroup -ErrorAction SilentlyContinue
    if ($null -ne $StudentLocalGroup -and $CurrentTokenGroups -contains $StudentLocalGroup.SID.Value) {
        $IsStudent = $true
    }
} catch { }

# Fallback check by username if group SID comparison could not be performed
if (-not $IsStudent) {
    try {
        if (Get-LocalGroupMember -Group $StudentGroup -Member $env:USERNAME -ErrorAction SilentlyContinue) {
            $IsStudent = $true
        }
    } catch { }
}

$RegistryPath = "HKCU:\\SOFTWARE\\Policies\\Microsoft\\Windows\\RemovableStorageDevices"
$ExplorerPolicyPath = "HKCU:\\Software\\Microsoft\\Windows\\CurrentVersion\\Policies\\Explorer"
$DisallowRunPath = "HKCU:\\Software\\Microsoft\\Windows\\CurrentVersion\\Policies\\Explorer\\DisallowRun"

if ($IsStudent) {
    # 1. Block USB Flash drives
    try {
        if (-not (Test-Path -LiteralPath $RegistryPath)) {
            New-Item -Path $RegistryPath -Force -ErrorAction SilentlyContinue | Out-Null
        }
        Set-ItemProperty -LiteralPath $RegistryPath -Name "Deny_All" -Value 1 -Type DWord -Force -ErrorAction SilentlyContinue
    } catch { }

    # 2. Block offline card games executables (Solitaire, Spider, FreeCell, Hearts, Minesweeper)
    try {
        if (-not (Test-Path -LiteralPath $ExplorerPolicyPath)) {
            New-Item -Path $ExplorerPolicyPath -Force -ErrorAction SilentlyContinue | Out-Null
        }
        Set-ItemProperty -LiteralPath $ExplorerPolicyPath -Name "DisallowRun" -Value 1 -Type DWord -Force -ErrorAction SilentlyContinue

        if (-not (Test-Path -LiteralPath $DisallowRunPath)) {
            New-Item -Path $DisallowRunPath -Force -ErrorAction SilentlyContinue | Out-Null
        }
        $BlockedExes = @("sol.exe", "spider.exe", "freecell.exe", "mshearts.exe", "winmine.exe", "Solitaire.exe", "SolitaireCollection.exe", "Hearts.exe", "FreeCell.exe", "SpiderSolitaire.exe")
        $Idx = 1
        foreach ($Exe in $BlockedExes) {
            Set-ItemProperty -LiteralPath $DisallowRunPath -Name ([string]$Idx) -Value $Exe -Type String -Force -ErrorAction SilentlyContinue
            $Idx++
        }
    } catch { }

    # 3. Terminate any running offline card game processes
    try {
        Get-Process -Name sol, spider, freecell, mshearts, winmine, Solitaire, FreeCell, SpiderSolitaire -ErrorAction SilentlyContinue | Stop-Process -Force -ErrorAction SilentlyContinue
    } catch { }
} else {
    try {
        if (Test-Path -LiteralPath $RegistryPath) {
            Remove-ItemProperty -LiteralPath $RegistryPath -Name "Deny_All" -Force -ErrorAction SilentlyContinue
        }
    } catch { }
    try {
        if (Test-Path -LiteralPath $ExplorerPolicyPath) {
            Remove-ItemProperty -LiteralPath $ExplorerPolicyPath -Name "DisallowRun" -Force -ErrorAction SilentlyContinue
        }
    } catch { }
    try {
        if (Test-Path -LiteralPath $DisallowRunPath) {
            Remove-Item -LiteralPath $DisallowRunPath -Recurse -Force -ErrorAction SilentlyContinue
        }
    } catch { }
}
'@
try {
    Set-Content -LiteralPath $LogonScriptPath -Value $LogonScriptCode -Encoding UTF8
} catch { }

try {
    $LogonTaskName = "ICTLab Student Policy Logon"
    Unregister-ScheduledTask -TaskName $LogonTaskName -Confirm:$false -ErrorAction SilentlyContinue | Out-Null
    $LogonPowerShellExe = Join-Path $env:SystemRoot "System32\\WindowsPowerShell\\v1.0\\powershell.exe"
    $LogonAction = New-ScheduledTaskAction -Execute $LogonPowerShellExe -Argument "-NoProfile -NonInteractive -WindowStyle Hidden -ExecutionPolicy Bypass -File \`"$LogonScriptPath\`""
    $LogonTrigger = New-ScheduledTaskTrigger -AtLogOn
    $LogonPrincipal = New-ScheduledTaskPrincipal -GroupId "S-1-5-32-545" -RunLevel Limited
    Register-ScheduledTask -TaskName $LogonTaskName -Action $LogonAction -Trigger $LogonTrigger -Principal $LogonPrincipal -Force | Out-Null
} catch {
    Write-Host "       Note: Scheduled task setup for student policy returned: $($_.Exception.Message)" -ForegroundColor DarkGray
}
# 5. Install SYSTEM Listener
Write-Host "[6/7] Installing USB Listener Service..." -ForegroundColor Yellow
$ListenerCode = @'
${USB_LISTENER_SCRIPT}
'@

Set-Content -Path "$ICTRoot\\UsbListener.ps1" -Value $ListenerCode -Encoding UTF8

$TaskName = "ICTLab USB Listener"
Stop-ScheduledTask -TaskName $TaskName -ErrorAction SilentlyContinue
Unregister-ScheduledTask -TaskName $TaskName -Confirm:$false -ErrorAction SilentlyContinue | Out-Null

# Terminate any leftover background PowerShell processes running UsbListener.ps1
try {
    Get-CimInstance Win32_Process -ErrorAction SilentlyContinue | Where-Object {
        $_.CommandLine -like "*UsbListener.ps1*"
    } | ForEach-Object {
        try { Stop-Process -Id $_.ProcessId -Force -ErrorAction SilentlyContinue } catch { }
    }
} catch { }

$ListenerPowerShellExe = Join-Path $env:SystemRoot "System32\\WindowsPowerShell\\v1.0\\powershell.exe"
$Action = New-ScheduledTaskAction -Execute $ListenerPowerShellExe -Argument "-NoProfile -NonInteractive -ExecutionPolicy Bypass -WindowStyle Hidden -File \`"$ICTRoot\\UsbListener.ps1\`""
$Trigger = New-ScheduledTaskTrigger -AtStartup
$Principal = New-ScheduledTaskPrincipal -UserId "SYSTEM" -LogonType ServiceAccount -RunLevel Highest
$Settings = New-ScheduledTaskSettingsSet -StartWhenAvailable -RestartCount 3 -RestartInterval (New-TimeSpan -Minutes 1) -ExecutionTimeLimit ([TimeSpan]::Zero) -MultipleInstances IgnoreNew

Register-ScheduledTask -TaskName $TaskName -Action $Action -Trigger $Trigger -Principal $Principal -Settings $Settings -Force | Out-Null
Start-ScheduledTask -TaskName $TaskName -ErrorAction SilentlyContinue

$ListenerActive = $false
$TaskState = "Unknown"
for ($Attempt = 0; $Attempt -lt 15; $Attempt++) {
    Start-Sleep -Milliseconds 400
    $TaskObj = Get-ScheduledTask -TaskName $TaskName -ErrorAction SilentlyContinue
    if ($null -ne $TaskObj) {
        $TaskState = [string]$TaskObj.State
        if ($TaskState -in @("Running", "Ready")) {
            $ListenerActive = $true
            break
        }
    }
}

if ($ListenerActive) {
    Write-Host "USB Listener status: Active ($TaskState)" -ForegroundColor Green
} else {
    Write-Host "Notice: USB Listener registered (State: $TaskState). It will automatically activate on system restart." -ForegroundColor DarkYellow
}
Write-Host "Listener log: $ICTRoot\\Logs\\UsbListener.log" -ForegroundColor Cyan

Write-Host "[7/7] Setup Complete!" -ForegroundColor Green
Write-Host "Logical identity $PcNumber was saved for Windows PC $env:COMPUTERNAME." -ForegroundColor Green
Write-Host "This PC is now ready to receive Sync USBs." -ForegroundColor Green
} catch {
    $SetupExitCode = 1
    $ErrorMessage = $_.Exception.Message
    $ErrorPosition = [string]$_.InvocationInfo.PositionMessage
    $ErrorStack = [string]$_.ScriptStackTrace
    Write-Host ""
    Write-Host "SETUP FAILED: $ErrorMessage" -ForegroundColor Red
    if (-not [string]::IsNullOrWhiteSpace($ErrorPosition)) {
        Write-Host $ErrorPosition -ForegroundColor DarkYellow
    }
    try {
        New-Item -ItemType Directory -Path $ICTRoot -Force | Out-Null
        Add-Content -LiteralPath "$ICTRoot\\Install.log" -Value @(
            "[$(Get-Date -Format o)] SETUP FAILED: $ErrorMessage",
            $ErrorPosition,
            $ErrorStack,
            "---"
        ) -Encoding UTF8
        Write-Host "Log: $ICTRoot\\Install.log" -ForegroundColor Yellow
    } catch { }
}

Complete-ICTInteractiveRun -ExitCode $SetupExitCode
`;

// ============================================================================
// 3. FACTORY RESET SCRIPT
// ============================================================================
export const getResetScript = () => `
#Requires -Version 5.1
[CmdletBinding()]
param()
${INTERACTIVE_ADMIN_BOOTSTRAP}

# ============================================================
# ICT LAB FULL SYSTEM RESET
# (EXCEPT GAME BANS - GAMES REMAIN PERMANENTLY BANNED)
# ============================================================
$ICTRoot = "C:\\ProgramData\\ICTLab"
$GroupName = "ICTLabStudents"
$ResetExitCode = 0

try {

Write-Host "========================================" -ForegroundColor Cyan
Write-Host " ICT LAB SYSTEM RESET" -ForegroundColor Cyan
Write-Host " Computer: $env:COMPUTERNAME" -ForegroundColor Cyan
Write-Host " Scope: Reset all ICT Lab files, services & accounts" -ForegroundColor Cyan
Write-Host " Policy: Games Remain Permanently Banned" -ForegroundColor Green
Write-Host "========================================" -ForegroundColor Cyan

# 1. Stop & Remove All ICTLab Scheduled Tasks & Background Processes
Write-Host "[1/5] Removing Scheduled Tasks & Terminating Services..." -ForegroundColor Yellow
Stop-ScheduledTask -TaskName "ICTLab USB Listener" -ErrorAction SilentlyContinue
Unregister-ScheduledTask -TaskName "ICTLab USB Listener" -Confirm:$false -ErrorAction SilentlyContinue

Stop-ScheduledTask -TaskName "ICTLab Student Policy Logon" -ErrorAction SilentlyContinue
Unregister-ScheduledTask -TaskName "ICTLab Student Policy Logon" -Confirm:$false -ErrorAction SilentlyContinue

Get-ScheduledTask -TaskName "ICTLab*" -ErrorAction SilentlyContinue | Unregister-ScheduledTask -Confirm:$false -ErrorAction SilentlyContinue

# Terminate lingering background PowerShell processes running ICTLab scripts
try {
    Get-CimInstance Win32_Process -ErrorAction SilentlyContinue | Where-Object { 
        $null -ne $_.CommandLine -and (
            $_.CommandLine -like "*UsbListener.ps1*" -or 
            $_.CommandLine -like "*GlobalSync.ps1*" -or 
            $_.CommandLine -like "*ManualSync.ps1*" -or 
            $_.CommandLine -like "*LogonScript.ps1*"
        )
    } | ForEach-Object {
        try { 
            Stop-Process -Id $_.ProcessId -Force -ErrorAction SilentlyContinue 
            Write-Host "       Stopped running process (PID: $($_.ProcessId))" -ForegroundColor DarkGray
        } catch { }
    }
} catch { }

# 2. PERMANENTLY ENFORCE & PRESERVE GAME BANS (NEVER UNBAN GAMES)
# Explicitly keeping games blocked as requested: Chrome Dino, Edge Surf, Windows Consumer Games
Write-Host "[2/5] Ensuring Game Bans Remain Permanently Active..." -ForegroundColor Yellow

$ChromePolicyPath = "HKLM:\\SOFTWARE\\Policies\\Google\\Chrome"
$EdgePolicyPath = "HKLM:\\SOFTWARE\\Policies\\Microsoft\\Edge"
$CloudContentPath = "HKLM:\\SOFTWARE\\Policies\\Microsoft\\Windows\\CloudContent"

# Chrome Dino Easter Egg Game -> 0 (Disabled)
try {
    if (-not (Test-Path -LiteralPath $ChromePolicyPath)) { New-Item -Path $ChromePolicyPath -Force -ErrorAction SilentlyContinue | Out-Null }
    Set-ItemProperty -LiteralPath $ChromePolicyPath -Name "AllowDinosaurEasterEgg" -Value 0 -Type DWord -Force -ErrorAction SilentlyContinue | Out-Null
    Write-Host "       Chrome Dino game: Blocked (Permanent)" -ForegroundColor Green
} catch { }

# Edge Surf Game -> 0 (Disabled)
try {
    if (-not (Test-Path -LiteralPath $EdgePolicyPath)) { New-Item -Path $EdgePolicyPath -Force -ErrorAction SilentlyContinue | Out-Null }
    Set-ItemProperty -LiteralPath $EdgePolicyPath -Name "AllowSurfGame" -Value 0 -Type DWord -Force -ErrorAction SilentlyContinue | Out-Null
    Write-Host "       Edge Surf game: Blocked (Permanent)" -ForegroundColor Green
} catch { }

# Windows Consumer Features / Game Suggestions -> 1 (Disabled)
try {
    if (-not (Test-Path -LiteralPath $CloudContentPath)) { New-Item -Path $CloudContentPath -Force -ErrorAction SilentlyContinue | Out-Null }
    Set-ItemProperty -LiteralPath $CloudContentPath -Name "DisableWindowsConsumerFeatures" -Value 1 -Type DWord -Force -ErrorAction SilentlyContinue | Out-Null
    Write-Host "       Windows Consumer Games: Blocked (Permanent)" -ForegroundColor Green
} catch { }

# Terminate any running offline card games
try {
    Get-Process -Name sol, spider, freecell, mshearts, winmine, Solitaire, FreeCell, SpiderSolitaire -ErrorAction SilentlyContinue | Stop-Process -Force -ErrorAction SilentlyContinue
} catch { }

# Remove built-in card games and consumer games (Microsoft Solitaire Collection, Candy Crush)
try {
    Get-AppxPackage -AllUsers *SolitaireCollection* -ErrorAction SilentlyContinue | Remove-AppxPackage -AllUsers -ErrorAction SilentlyContinue
    Get-AppxProvisionedPackage -Online -ErrorAction SilentlyContinue | Where-Object { $_.DisplayName -like "*Solitaire*" } | Remove-AppxProvisionedPackage -Online -ErrorAction SilentlyContinue
    Get-AppxPackage -AllUsers *CandyCrush* -ErrorAction SilentlyContinue | Remove-AppxPackage -AllUsers -ErrorAction SilentlyContinue
    Get-AppxProvisionedPackage -Online -ErrorAction SilentlyContinue | Where-Object { $_.DisplayName -like "*CandyCrush*" } | Remove-AppxProvisionedPackage -Online -ErrorAction SilentlyContinue
} catch { }

function Set-ICTRegistryDword {
    param([string]$Path, [string]$Name, [int]$Value)
    try {
        if (-not (Test-Path -LiteralPath $Path)) {
            New-Item -Path $Path -Force -ErrorAction SilentlyContinue | Out-Null
        }
        Set-ItemProperty -LiteralPath $Path -Name $Name -Value $Value -Type DWord -Force -ErrorAction SilentlyContinue | Out-Null
    } catch {
        try {
            $RegKey = $Path -replace '^HKLM:\\', 'HKLM\'
            & reg.exe add $RegKey /v $Name /t REG_DWORD /d $Value /f *>$null
        } catch { }
    }
}

# 3. Restore Windows Sign-in Policy (from backup)
Write-Host "[3/5] Restoring Windows Sign-in Policy..." -ForegroundColor Yellow
$LoginPolicyBackupPath = "$ICTRoot\\Backup\\login-screen-policy.json"
if (Test-Path -LiteralPath $LoginPolicyBackupPath -PathType Leaf) {
    try {
        $LoginPolicyBackup = Get-Content -LiteralPath $LoginPolicyBackupPath -Raw -Encoding UTF8 | ConvertFrom-Json
        foreach ($State in @($LoginPolicyBackup.enumerateLocalUsers, $LoginPolicyBackup.dontDisplayLastUserName, $LoginPolicyBackup.hideFastUserSwitching)) {
            if ($null -eq $State) { continue }
            $Path = [string]$State.path
            $Name = [string]$State.name
            if ([bool]$State.exists) {
                Set-ICTRegistryDword -Path $Path -Name $Name -Value ([int]$State.value)
            } else {
                try {
                    Remove-ItemProperty -LiteralPath $Path -Name $Name -Force -ErrorAction SilentlyContinue
                } catch {
                    try {
                        $RegKey = $Path -replace '^HKLM:\\', 'HKLM\'
                        & reg.exe delete $RegKey /v $Name /f *>$null
                    } catch { }
                }
            }
        }
        Write-Host "       Restored pre-install sign-in policy." -ForegroundColor Green
    } catch {
        Write-Host "       Note: Could not restore previous login policy: $($_.Exception.Message)" -ForegroundColor DarkYellow
    }
}

# Clear any leftover RemovableStorage restrictions from current admin session
try {
    $RemovableStoragePath = "HKCU:\\SOFTWARE\\Policies\\Microsoft\\Windows\\RemovableStorageDevices"
    if (Test-Path -LiteralPath $RemovableStoragePath) {
        Remove-ItemProperty -LiteralPath $RemovableStoragePath -Name "Deny_All" -Force -ErrorAction SilentlyContinue
    }
} catch { }

$UserListRegistry = "HKLM:\\SOFTWARE\\Microsoft\\Windows NT\\CurrentVersion\\Winlogon\\SpecialAccounts\\UserList"

function Remove-ICTUserProfileClean {
    param([string]$Username, [string]$Sid)
    try {
        if (-not [string]::IsNullOrWhiteSpace($Sid)) {
            $Profile = Get-CimInstance -ClassName Win32_UserProfile -ErrorAction SilentlyContinue |
                Where-Object { [string]$_.SID -eq $Sid } | Select-Object -First 1
            if ($null -ne $Profile) {
                Remove-CimInstance -InputObject $Profile -ErrorAction SilentlyContinue
                return
            }
        }
        $ProfileDir = "C:\\Users\\$Username"
        if (Test-Path -LiteralPath $ProfileDir) {
            Remove-Item -LiteralPath $ProfileDir -Recurse -Force -ErrorAction SilentlyContinue
        }
    } catch { }
}

# 4. Delete Student Accounts, User Profiles & Group
Write-Host "[4/5] Deleting Student Accounts & User Profiles..." -ForegroundColor Yellow

$StudentGroup = Get-LocalGroup -Name $GroupName -ErrorAction SilentlyContinue
if ($null -ne $StudentGroup) {
    $Members = Get-LocalGroupMember -Group $GroupName -ErrorAction SilentlyContinue
    foreach ($Member in $Members) {
        $Sid = $Member.SID
        if ($null -ne $Sid) {
            # Skip built-in accounts (500=Admin, 501=Guest, 503=DefaultAccount, 504=WDAGUtilityAccount)
            if ($Sid.Value -notmatch "-500$|-501$|-503$|-504$") {
                $LocalUsername = ([string]$Member.Name).Split('\\')[-1]
                try {
                    if (Test-Path -LiteralPath $UserListRegistry) {
                        Remove-ItemProperty -LiteralPath $UserListRegistry -Name $LocalUsername -Force -ErrorAction SilentlyContinue
                    }
                    Remove-ICTUserProfileClean -Username $LocalUsername -Sid $Sid.Value
                    Remove-LocalUser -SID $Sid -ErrorAction Stop
                    Write-Host "       Removed user: $($Member.Name)" -ForegroundColor Green
                } catch {
                    try {
                        Remove-LocalUser -Name $LocalUsername -ErrorAction Stop
                        Write-Host "       Removed user: $LocalUsername" -ForegroundColor Green
                    } catch {
                        Write-Host "       Notice: Could not remove $($Member.Name)" -ForegroundColor DarkGray
                    }
                }
            }
        }
    }
    Remove-LocalGroup -Name $GroupName -ErrorAction SilentlyContinue
    Write-Host "       Removed group: $GroupName" -ForegroundColor Green
}

# Delete any remaining ICTLabManaged users (even if group was missing or corrupted)
$AllLocalUsers = Get-LocalUser -ErrorAction SilentlyContinue
foreach ($User in $AllLocalUsers) {
    if ($null -ne $User.Description -and $User.Description -like "*ICTLabManaged*") {
        try {
            if (Test-Path -LiteralPath $UserListRegistry) {
                Remove-ItemProperty -LiteralPath $UserListRegistry -Name $User.Name -Force -ErrorAction SilentlyContinue
            }
            Remove-ICTUserProfileClean -Username $User.Name -Sid ([string]$User.SID)
            Remove-LocalUser -Name $User.Name -ErrorAction Stop
            Write-Host "       Removed managed account: $($User.Name)" -ForegroundColor Green
        } catch { }
    }
}

# 5. Clean Up All ICTLab Files and Folders
Write-Host "[5/5] Removing ICT Lab Files & Folders..." -ForegroundColor Yellow
Start-Sleep -Milliseconds 500

if (Test-Path -LiteralPath $ICTRoot) {
    # Remove files with retries in case handles are closing
    for ($attempt = 0; $attempt -lt 5; $attempt++) {
        try {
            Remove-Item -LiteralPath $ICTRoot -Recurse -Force -ErrorAction Stop
            Write-Host "       Removed: $ICTRoot" -ForegroundColor Green
            break
        } catch {
            Get-ChildItem -LiteralPath $ICTRoot -Recurse -ErrorAction SilentlyContinue |
                Sort-Object -Property FullName -Descending |
                ForEach-Object {
                    try { Remove-Item -LiteralPath $_.FullName -Force -Recurse -ErrorAction SilentlyContinue } catch { }
                }
            try { Remove-Item -LiteralPath $ICTRoot -Force -Recurse -ErrorAction SilentlyContinue } catch { }
            Start-Sleep -Milliseconds 200
        }
    }
}

try { [console]::beep(1200, 150); [console]::beep(1600, 250) } catch { }

Write-Host ""
Write-Host "========================================" -ForegroundColor Green
Write-Host " RESET COMPLETE - SYSTEM IS CLEAN!" -ForegroundColor Green
Write-Host "========================================" -ForegroundColor Green
Write-Host "1. All ICT Lab scheduled tasks, services, and files were removed." -ForegroundColor Green
Write-Host "2. All student accounts, profiles, and groups were deleted." -ForegroundColor Green
Write-Host "3. Windows sign-in policy was restored to pre-install state." -ForegroundColor Green
Write-Host "4. Browser & Windows Game Bans remain PERMANENTLY ACTIVE and LOCKED." -ForegroundColor Green
Write-Host "This PC is clean and ready for a fresh install." -ForegroundColor Cyan
} catch {
    $ResetExitCode = 1
    Write-Host "RESET ENCOUNTERED ERROR: $($_.Exception.Message)" -ForegroundColor Red
}

Complete-ICTInteractiveRun -ExitCode $ResetExitCode
`;

// ============================================================================
// 4. SYNC PAYLOAD SCRIPT GENERATOR
// ============================================================================
/**
 * Generates the per-PC synchronization script.
 * We encode the tasks as Base64 to prevent any PowerShell injection 
 * vulnerabilities caused by student names or passwords containing quotes/symbols.
 */
export const getGlobalSyncScript = (payloadBase64: string, syncToken: string) => `# ICTLAB-AUTH:${syncToken}
# ============================================================
# ICT Lab - Shared Roster Sync
# The same active-student roster is applied to every installed lab PC.
# ============================================================

[CmdletBinding()]
param(
    [string]$UsbDrive = ""
)

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"
$GroupName = "ICTLabStudents"
$ManagedMarker = "ICTLabManaged:v2"
$LogDirectory = "C:\\ProgramData\\ICTLab\\Logs"
$LogFile = Join-Path $LogDirectory "GlobalSync.log"
$SyncMutex = New-Object System.Threading.Mutex($false, "Global\\ICTLab.AccountSync")
$HasSyncLock = $false
try {
    try { $HasSyncLock = $SyncMutex.WaitOne(0) } catch [System.Threading.AbandonedMutexException] { $HasSyncLock = $true }
    if (-not $HasSyncLock) { Write-Host "Another ICT Lab sync is running. Try again after it completes."; Exit 12 }
New-Item -ItemType Directory -Path $LogDirectory -Force | Out-Null

function Write-SyncLog {
    param([string]$Message, [string]$Level = "INFO")
    $Time = (Get-Date).ToString("yyyy-MM-dd HH:mm:ss")
    Add-Content -LiteralPath $LogFile -Value "[$Time][$Level] $Message" -Encoding UTF8
    $HostColor = switch ($Level) {
        "ERROR" { "Red" }
        "WARN"  { "Yellow" }
        default { "Green" }
    }
    Write-Host " [$Level] $Message" -ForegroundColor $HostColor
}

function Show-ICTSyncNotification {
    param(
        [string]$Message,
        [string]$Title = "ICT Lab PC Sync",
        [string]$Icon = "Information",
        [int]$TimeoutSeconds = 7
    )

    # 1. Beeps for audible feedback
    try {
        if ($Icon -eq "Error") {
            [console]::beep(400, 300); [console]::beep(400, 300)
        } else {
            [console]::beep(1000, 120); [console]::beep(1400, 180)
        }
    } catch { }

    # 2. Windows msg.exe broadcast (shows native dialog across sessions from SYSTEM/Admin)
    try {
        $BroadcastMsg = "$Title - $Message"
        & msg.exe * /TIME:$TimeoutSeconds $BroadcastMsg 2>$null
    } catch { }

    # 3. Interactive dialog on active user desktop
    try {
        $ActiveUser = (Get-CimInstance Win32_ComputerSystem -ErrorAction SilentlyContinue).UserName
        if (-not [string]::IsNullOrWhiteSpace($ActiveUser)) {
            $NotifyTask = "ICTLab_Sync_Notice_" + (Get-Random -Minimum 1000 -Maximum 9999)
            $IconVal = switch ($Icon) {
                "Error" { 16 }
                "Warning" { 48 }
                default { 64 }
            }
            $EscTitle = ($Title -replace "['\`"\$]", " ").Trim()
            $EscMsg = ($Message -replace "['\`"\$]", " ").Trim()
            $Code = 'Add-Type -AssemblyName System.Windows.Forms; [System.Windows.Forms.MessageBox]::Show(\"' + $EscMsg + '\", \"' + $EscTitle + '\", 0, ' + $IconVal + ') | Out-Null'
            $NotifyPowerShellExe = Join-Path $env:SystemRoot "System32\\WindowsPowerShell\\v1.0\\powershell.exe"
            $Action = New-ScheduledTaskAction -Execute $NotifyPowerShellExe -Argument "-NoProfile -NonInteractive -WindowStyle Hidden -Command \`"$Code\`""
            $Principal = New-ScheduledTaskPrincipal -UserId $ActiveUser -LogonType Interactive
            Register-ScheduledTask -TaskName $NotifyTask -Action $Action -Principal $Principal -Force | Out-Null
            Start-ScheduledTask -TaskName $NotifyTask
            Start-Sleep -Milliseconds 600
            Unregister-ScheduledTask -TaskName $NotifyTask -Confirm:$false -ErrorAction SilentlyContinue | Out-Null
        }
    } catch { }
}

# Auto-detect USB drive if not passed
if ([string]::IsNullOrWhiteSpace($UsbDrive)) {
    try {
        $Candidate = Get-CimInstance -ClassName Win32_LogicalDisk -ErrorAction SilentlyContinue |
            Where-Object { Test-Path -LiteralPath (Join-Path "$($_.DeviceID)\\" "ICTLabSync") -PathType Container } |
            Select-Object -First 1
        if ($null -ne $Candidate) { $UsbDrive = [string]$Candidate.DeviceID }
    } catch { }
}
if (-not [string]::IsNullOrWhiteSpace($UsbDrive) -and $UsbDrive -match '^([A-Za-z]:)') {
    $UsbDrive = $Matches[1]
}

function Normalize-ICTPcNumber {
    param([string]$Value)
    if ([string]::IsNullOrWhiteSpace($Value)) { return "" }
    $Trimmed = $Value.Trim().ToUpperInvariant()
    if ($Trimmed -match '^PC[-_ ]?(\\d+)$') {
        return "PC-{0:D2}" -f [int]$Matches[1]
    }
    if ($Trimmed -match '^\\d+$') {
        return "PC-{0:D2}" -f [int]$Trimmed
    }
    return $Trimmed
}

function Test-ManagedUser {
    param($User)
    if ($null -eq $User) { return $false }
    return ([string]$User.Description).StartsWith("ICTLabManaged:", [System.StringComparison]::OrdinalIgnoreCase)
}

$UserListRegistry = "HKLM:\\SOFTWARE\\Microsoft\\Windows NT\\CurrentVersion\\Winlogon\\SpecialAccounts\\UserList"
$LoginEnumerationPolicyPath = "HKLM:\\SOFTWARE\\Policies\\Microsoft\\Windows\\System"
$WinlogonPolicyPath = "HKLM:\\SOFTWARE\\Microsoft\\Windows\\CurrentVersion\\Policies\\System"

function Set-ICTLoginScreenPolicy {
    # Enumerate local accounts on the sign-in screen (especially relevant on
    # domain-joined PCs) and allow Windows to show user tiles instead of forcing
    # only an Other User prompt. A domain GPO can still override these values.
    try {
        if (-not (Test-Path -LiteralPath $LoginEnumerationPolicyPath)) {
            New-Item -Path $LoginEnumerationPolicyPath -Force -ErrorAction SilentlyContinue | Out-Null
        }
        Set-ItemProperty -LiteralPath $LoginEnumerationPolicyPath -Name "EnumerateLocalUsers" -Value 1 -Type DWord -Force -ErrorAction SilentlyContinue | Out-Null
    } catch { }

    try {
        if (-not (Test-Path -LiteralPath $WinlogonPolicyPath)) {
            New-Item -Path $WinlogonPolicyPath -Force -ErrorAction SilentlyContinue | Out-Null
        }
        Set-ItemProperty -LiteralPath $WinlogonPolicyPath -Name "DontDisplayLastUserName" -Value 0 -Type DWord -Force -ErrorAction SilentlyContinue | Out-Null
        Set-ItemProperty -LiteralPath $WinlogonPolicyPath -Name "HideFastUserSwitching" -Value 0 -Type DWord -Force -ErrorAction SilentlyContinue | Out-Null
    } catch { }
}

function Set-ICTLoginScreenUserVisibility {
    param(
        [Parameter(Mandatory = $true)][string]$Username,
        [Parameter(Mandatory = $true)][bool]$Visible
    )

    try {
        if ($Visible) {
            if (-not (Test-Path -LiteralPath $UserListRegistry)) {
                New-Item -Path $UserListRegistry -Force -ErrorAction SilentlyContinue | Out-Null
            }
            Set-ItemProperty -LiteralPath $UserListRegistry -Name $Username -Value 1 -Type DWord -Force -ErrorAction SilentlyContinue | Out-Null
        } elseif (Test-Path -LiteralPath $UserListRegistry) {
            Remove-ItemProperty -LiteralPath $UserListRegistry -Name $Username -Force -ErrorAction SilentlyContinue | Out-Null
        }
    } catch { }
}

function Test-ValidUsername {
    param([string]$Username)
    if ([string]::IsNullOrWhiteSpace($Username) -or $Username.Length -gt 20) { return $false }
    $InvalidUsernameCharacters = [char[]]@(
        34,  # "
        47,  # /
        92,  # backslash
        91,  # [
        93,  # ]
        58,  # :
        59,  # ;
        124, # |
        61,  # =
        44,  # ,
        43,  # +
        42,  # *
        63,  # ?
        60,  # <
        62,  # >
        64   # @
    )
    return $Username.IndexOfAny($InvalidUsernameCharacters) -lt 0
}

try {
    $Json = [System.Text.Encoding]::UTF8.GetString([Convert]::FromBase64String("${payloadBase64}"))
    $Payload = $Json | ConvertFrom-Json
} catch {
    Write-SyncLog "Failed to parse sync payload." "ERROR"
    try { [console]::beep(400, 500) } catch { }
    Exit 1
}

if ([int]$Payload.version -ne 3) {
    Write-SyncLog "Unsupported payload version." "ERROR"
    try { [console]::beep(400, 500) } catch { }
    Exit 1
}

$DeviceConfigPath = "C:\\ProgramData\\ICTLab\\device-config.json"
if (-not (Test-Path -LiteralPath $DeviceConfigPath -PathType Leaf)) {
    Write-SyncLog "Device configuration is missing." "ERROR"
    try { [console]::beep(400, 500) } catch { }
    Exit 1
}
$DeviceConfig = Get-Content -LiteralPath $DeviceConfigPath -Raw -Encoding UTF8 | ConvertFrom-Json
# Installed legacy PCs can have a different labId; the configured token is the authorization boundary.
$PackageToken = [System.Text.Encoding]::UTF8.GetString([Convert]::FromBase64String("${btoa(unescape(encodeURIComponent(syncToken)))}"))
if ([string]$DeviceConfig.syncToken -cne $PackageToken) { throw "This sync package has a different device token. Export with the installed lab settings." }
$LocalPcNumber = Normalize-ICTPcNumber -Value ([string]$DeviceConfig.pcNumber)
if ([string]::IsNullOrWhiteSpace($LocalPcNumber)) {
    Write-SyncLog "PC number is missing from device configuration. Run the latest installer." "ERROR"
    try { [console]::beep(400, 500) } catch { }
    Exit 1
}

$MatchingTargets = @($Payload.targets | Where-Object {
    $TargetPc = Normalize-ICTPcNumber -Value ([string]$_.pcNumber)
    [string]::Equals($TargetPc, $LocalPcNumber, [System.StringComparison]::OrdinalIgnoreCase)
})
if ($MatchingTargets.Count -eq 0) {
    Write-SyncLog "No sync work for $LocalPcNumber in payload $($Payload.payloadId)."
    Show-ICTSyncNotification -Title "ICT Lab Sync - $LocalPcNumber" -Message "កុំព្យូទ័រ $LocalPcNumber មិនមានទិន្នន័យត្រូវ Sync ក្នុង USB នេះទេ។" -Icon "Warning" -TimeoutSeconds 6
    try { [console]::beep(1000, 100) } catch { }
    Exit 10
}
if ($MatchingTargets.Count -ne 1) { throw "Duplicate PC targets rejected." }

$Target = $MatchingTargets[0]
$ExpectedStudents = @($Target.accounts)
$RemoveStudentIds = @($Target.removeStudentIds)
$PayloadGuid = [guid]::Empty
if (-not [guid]::TryParse([string]$Payload.payloadId, [ref]$PayloadGuid)) { throw "Invalid payload ID. Export a new sync package." }
$ReceiptDirectory = "C:\\ProgramData\\ICTLab\\Receipts"
New-Item -ItemType Directory -Path $ReceiptDirectory -Force | Out-Null
$ReceiptName = "$($PayloadGuid.ToString())-$LocalPcNumber.json"
$ReceiptPath = Join-Path $ReceiptDirectory $ReceiptName
function Export-ICTReceipt {
    param($Receipt)
    if (-not [string]::IsNullOrWhiteSpace($UsbDrive)) {
        $UsbReceipts = Join-Path "$($UsbDrive.TrimEnd('\\'))\\" "ICTLabSync\\Receipts"
        New-Item -ItemType Directory -Path $UsbReceipts -Force | Out-Null
        $Receipt | ConvertTo-Json -Depth 8 | Set-Content -LiteralPath (Join-Path $UsbReceipts $ReceiptName) -Encoding UTF8
    }
}
if (Test-Path -LiteralPath $ReceiptPath) {
    $PreviousReceipt = Get-Content -LiteralPath $ReceiptPath -Raw -Encoding UTF8 | ConvertFrom-Json
    if ($PreviousReceipt.status -eq "SUCCESS") {
        Export-ICTReceipt -Receipt $PreviousReceipt
        Write-SyncLog "This payload was already applied successfully to $LocalPcNumber."
        Exit 11
    }
}
$SyncMode = ([string]$Payload.mode).Trim().ToUpperInvariant()
$DeleteMissingUsers = ($SyncMode -eq "FULL" -and [bool]$Payload.deleteMissingUsers)
if ($ExpectedStudents.Count -eq 0 -and $RemoveStudentIds.Count -eq 0) {
    Write-SyncLog "Empty target rejected for $LocalPcNumber." "ERROR"
    Show-ICTSyncNotification -Title "ICT Lab Sync - $LocalPcNumber" -Message "គ្មានទិន្នន័យគណនីសម្រាប់ម៉ាស៊ីន $LocalPcNumber ទេ។" -Icon "Warning" -TimeoutSeconds 6
    try { [console]::beep(400, 500) } catch { }
    Exit 1
}

# On-Screen Notification: Sync Starting
Show-ICTSyncNotification -Title "ICT Lab Sync - $LocalPcNumber" -Message "កំពុងដំណើរការ Sync គណនីសិស្ស ($($ExpectedStudents.Count) នាក់) លើ $LocalPcNumber... សូមរង់ចាំ (កុំទាន់ដក USB)!" -Icon "Information" -TimeoutSeconds 4

if (-not (Get-LocalGroup -Name $GroupName -ErrorAction SilentlyContinue)) {
    New-LocalGroup -Name $GroupName -Description "Students managed by ICT Lab System" | Out-Null
}

# Built-in Users group (SID S-1-5-32-545) has the normal interactive-logon
# rights on standalone Windows PCs. ICTLabStudents is only our management group,
# so every managed student must also be a member of the built-in Users group.
$BuiltinUsersSid = New-Object System.Security.Principal.SecurityIdentifier("S-1-5-32-545")
$BuiltinUsersGroup = Get-LocalGroup -SID $BuiltinUsersSid -ErrorAction Stop

Set-ICTLoginScreenPolicy

$ExpectedIds = @{}
foreach ($Student in $ExpectedStudents) {
    $ExpectedId = ([string]$Student.studentId).Trim()
    if (-not [string]::IsNullOrWhiteSpace($ExpectedId)) { $ExpectedIds[$ExpectedId] = $true }
}

$SuccessCount = 0
$RemovedCount = 0
$FailCount = 0
$SkippedCount = 0

function Remove-ICTUserProfile {
    param([string]$Username, [string]$Sid)
    try {
        if (-not [string]::IsNullOrWhiteSpace($Sid)) {
            $Profile = Get-CimInstance -ClassName Win32_UserProfile -ErrorAction SilentlyContinue |
                Where-Object { [string]$_.SID -eq $Sid } | Select-Object -First 1
            if ($null -ne $Profile) {
                Remove-CimInstance -InputObject $Profile -ErrorAction SilentlyContinue
                return
            }
        }
        $ProfileDir = "C:\\Users\\$Username"
        if (Test-Path -LiteralPath $ProfileDir) {
            Remove-Item -LiteralPath $ProfileDir -Recurse -Force -ErrorAction SilentlyContinue
        }
    } catch { }
}

foreach ($StudentIdToRemove in $RemoveStudentIds) {
    $RemoveId = ([string]$StudentIdToRemove).Trim()
    if ([string]::IsNullOrWhiteSpace($RemoveId)) { continue }
    try {
        $LocalUser = Get-LocalUser -Name $RemoveId -ErrorAction SilentlyContinue
        if ($null -eq $LocalUser) {
            Write-SyncLog "Remove skipped because account does not exist: $RemoveId"
            $SkippedCount++
        } elseif (Test-ManagedUser -User $LocalUser) {
            $UserSid = if ($null -ne $LocalUser.SID) { if ($LocalUser.SID -is [System.Security.Principal.SecurityIdentifier]) { $LocalUser.SID.Value } else { [string]$LocalUser.SID } } else { '' }
            Set-ICTLoginScreenUserVisibility -Username $RemoveId -Visible $false
            Remove-LocalUser -Name $RemoveId -ErrorAction Stop
            Remove-ICTUserProfile -Username $RemoveId -Sid $UserSid
            Write-SyncLog "[REMOVE] $RemoveId on $LocalPcNumber"
            $RemovedCount++
        } else {
            throw "Refusing to remove unmanaged account $RemoveId."
        }
    } catch {
        if ($_.Exception.Message -like "*logged on*" -or $_.Exception.Message -like "*session*") {
            Write-SyncLog "Account $RemoveId is currently logged in. Removal skipped for active session." "WARN"
            $SkippedCount++
        } else {
            Write-SyncLog "Failed to remove $($RemoveId): $($_.Exception.Message)" "ERROR"
            $FailCount++
        }
    }
}

if ($DeleteMissingUsers) {
    $LocalStudents = @(Get-LocalGroupMember -Group $GroupName -ErrorAction SilentlyContinue)
    foreach ($Local in $LocalStudents) {
        $LocalUsername = ([string]$Local.Name) -replace ".*\\\\", ""
        if (-not $ExpectedIds.ContainsKey($LocalUsername)) {
            try {
                $LocalUser = Get-LocalUser -Name $LocalUsername -ErrorAction SilentlyContinue
                if (Test-ManagedUser -User $LocalUser) {
                    $UserSid = if ($null -ne $LocalUser.SID) { if ($LocalUser.SID -is [System.Security.Principal.SecurityIdentifier]) { $LocalUser.SID.Value } else { [string]$LocalUser.SID } } else { '' }
                    Set-ICTLoginScreenUserVisibility -Username $LocalUsername -Visible $false
                    Remove-LocalUser -Name $LocalUsername -ErrorAction Stop
                    Remove-ICTUserProfile -Username $LocalUsername -Sid $UserSid
                    Write-SyncLog "[DELETE] $LocalUsername"
                    $RemovedCount++
                } else {
                    Write-SyncLog "Skipped unmanaged account $LocalUsername during delete." "WARN"
                    $SkippedCount++
                }
            } catch {
                if ($_.Exception.Message -like "*logged on*" -or $_.Exception.Message -like "*session*") {
                    Write-SyncLog "Account $LocalUsername is currently logged in. Deletion skipped for active session." "WARN"
                    $SkippedCount++
                } else {
                    Write-SyncLog "Failed to delete $($LocalUsername): $($_.Exception.Message)" "ERROR"
                    $FailCount++
                }
            }
        }
    }
}

function Ensure-ICTGroupMember {
    param($Group, [string]$Username)
    try {
        $LocalAccount = Get-LocalUser -Name $Username -ErrorAction Stop
        Add-LocalGroupMember -Group $Group -Member $LocalAccount -ErrorAction Stop
    } catch {
        if ($_.CategoryInfo.Reason -eq 'MemberExists' -or $_.Exception.Message -like "*already a member*") {
            return
        }
        $GroupNameStr = if ($Group -is [string]) { $Group } else { [string]$Group.Name }
        $NetOutput = (& net.exe localgroup "$GroupNameStr" "$Username" /add 2>&1)
        if ($LASTEXITCODE -ne 0 -and $NetOutput -notlike "*already a member*" -and $NetOutput -notlike "*ជាសមាជិករួចហើយ*") {
            throw "Failed to add $Username to group $GroupNameStr : $NetOutput"
        }
    }
}

foreach ($Student in $ExpectedStudents) {
    $StudentId = ([string]$Student.studentId).Trim()
    $StudentName = ([string]$Student.studentName).Trim()
    $Password = [string]$Student.password

    try {
        if (-not (Test-ValidUsername -Username $StudentId)) { throw "Invalid Windows username." }
        if ([string]::IsNullOrWhiteSpace($StudentName)) {
            $StudentName = $StudentId
        }
        if ([string]::IsNullOrWhiteSpace($Password)) { throw "Password is required." }

        $SecurePass = ConvertTo-SecureString $Password -AsPlainText -Force
        $User = Get-LocalUser -Name $StudentId -ErrorAction SilentlyContinue

        if ($null -eq $User) {
            New-LocalUser -Name $StudentId -Password $SecurePass -FullName $StudentName -Description $ManagedMarker -AccountNeverExpires -PasswordNeverExpires -UserMayNotChangePassword | Out-Null
            Ensure-ICTGroupMember -Group $GroupName -Username $StudentId
            Ensure-ICTGroupMember -Group $BuiltinUsersGroup -Username $StudentId
            Enable-LocalUser -Name $StudentId -ErrorAction Stop
            Set-ICTLoginScreenUserVisibility -Username $StudentId -Visible $true
            Write-SyncLog "[CREATE] $StudentId ($StudentName)"
            Write-SyncLog "[LOGIN] $StudentId enabled, added to built-in Users, and registered for the Windows sign-in screen. Sign out or restart to refresh LogonUI."
        } else {
            if (-not (Test-ManagedUser -User $User)) {
                throw "Username already belongs to an unmanaged local account."
            }
            Set-LocalUser -Name $StudentId -Password $SecurePass -FullName $StudentName -Description $ManagedMarker -AccountNeverExpires -PasswordNeverExpires $true -UserMayChangePassword $false
            Ensure-ICTGroupMember -Group $GroupName -Username $StudentId
            Ensure-ICTGroupMember -Group $BuiltinUsersGroup -Username $StudentId
            Enable-LocalUser -Name $StudentId -ErrorAction Stop
            Set-ICTLoginScreenUserVisibility -Username $StudentId -Visible $true
            Write-SyncLog "[UPDATE] $StudentId ($StudentName)"
            Write-SyncLog "[LOGIN] $StudentId enabled, added to built-in Users, and registered for the Windows sign-in screen."
        }
        $SuccessCount++
    } catch {
        Write-SyncLog "Failed to sync $($StudentId): $($_.Exception.Message)" "ERROR"
        $FailCount++
    }
}

Write-SyncLog "Sync completed. PC=$LocalPcNumber Mode=$SyncMode Success=$SuccessCount Failed=$FailCount Skipped=$SkippedCount DeleteMissing=$DeleteMissingUsers Payload=$($Payload.payloadId)"

# Write status to USB SyncHistory.log if USB is accessible
if (-not [string]::IsNullOrWhiteSpace($UsbDrive)) {
    try {
        $UsbSyncFolder = Join-Path "$($UsbDrive.TrimEnd('\\'))\\" "ICTLabSync"
        if (Test-Path -LiteralPath $UsbSyncFolder -PathType Container) {
            $HistoryFile = Join-Path $UsbSyncFolder "SyncHistory.log"
            $Timestamp = (Get-Date).ToString("yyyy-MM-dd HH:mm:ss")
            $StatusText = if ($FailCount -eq 0) { "SUCCESS" } else { "FAILED ($FailCount errors)" }
            $LogLine = "[$Timestamp] $LocalPcNumber : $StatusText (Created/Updated: $SuccessCount, Skipped: $SkippedCount, Removed: $RemovedCount)"
            Add-Content -LiteralPath $HistoryFile -Value $LogLine -Encoding UTF8 -Force
        }
    } catch {
        Write-SyncLog "Failed to write USB SyncHistory: $($_.Exception.Message)" "WARN"
    }
}

if ($FailCount -gt 0) {
    $FailMsg = "ការធ្វើសមកាលកម្មលើ $LocalPcNumber បរាជ័យ! ជោគជ័យ $SuccessCount នាក់, បរាជ័យ $FailCount នាក់។ សូមពិនិត្យមើល C:\\ProgramData\\ICTLab\\Logs\\GlobalSync.log"
    Show-ICTSyncNotification -Title "ICT Lab Sync - បរាជ័យ" -Message $FailMsg -Icon "Error" -TimeoutSeconds 10
    try { [console]::beep(400, 600) } catch { }
    Exit 1
}

$TaskIds = @()
if ($null -ne $Target.PSObject.Properties['taskIds']) { $TaskIds = @($Target.taskIds) }
$Receipt = [ordered]@{
    version = 1; status = "SUCCESS"; payloadId = [string]$Payload.payloadId
    labId = [string]$Payload.labId; academicYear = [string]$Payload.academicYear
    pcNumber = $LocalPcNumber; taskIds = $TaskIds; completedAt = (Get-Date).ToString("o")
    updated = $SuccessCount; removed = $RemovedCount; skipped = $SkippedCount
}
$Receipt | ConvertTo-Json -Depth 8 | Set-Content -LiteralPath $ReceiptPath -Encoding UTF8
try {
    Export-ICTReceipt -Receipt $Receipt
} catch {
    Write-SyncLog "Notice: Could not write receipt to USB: $($_.Exception.Message)" "WARN"
}

# Success notification
$AccountSummary = ($ExpectedStudents | ForEach-Object { "$($_.studentId) ($($_.studentName))" }) -join ", "
if ($AccountSummary.Length -gt 120) { $AccountSummary = $AccountSummary.Substring(0, 117) + "..." }
$SuccessMsg = "ធ្វើសមកាលកម្មលើ $LocalPcNumber ជោគជ័យ ១០០%! បង្កើត/កែប្រែគណនី: $SuccessCount នាក់ ($AccountSummary), លុបគណនីចាស់: $RemovedCount នាក់។ លោកគ្រូអាចដក USB ចេញបានហើយ!"
Show-ICTSyncNotification -Title "ICT Lab Sync - ជោគជ័យ" -Message $SuccessMsg -Icon "Information" -TimeoutSeconds 8

# Audible notification: Sync Success
try { [console]::beep(1200, 150); [console]::beep(1600, 300) } catch { }
Exit 0
} catch {
    Write-Host ("SYNC FAILED: " + $_.Exception.Message) -ForegroundColor Red
    try { Write-SyncLog $_.Exception.Message "ERROR" } catch { }
    Exit 1
} finally {
    if ($HasSyncLock) { $SyncMutex.ReleaseMutex() }
    $SyncMutex.Dispose()
}

`;

/**
 * Creates a helper that prepares the removable USB on the teacher's PC.
 * After preparation, lab PCs only need the USB to be inserted.
 */
export const getPrepareSyncUsbScript = (configBase64: string, syncScriptBase64: string) => `
#Requires -Version 5.1
[CmdletBinding()]
param()
${INTERACTIVE_ADMIN_BOOTSTRAP}

$UsbMakerExitCode = 0
try {
$ConfigJson = [System.Text.Encoding]::UTF8.GetString([Convert]::FromBase64String("${configBase64}"))
$Config = $ConfigJson | ConvertFrom-Json

function Test-ICTUsbLogicalDrive {
    param($LogicalDrive)
    if ($null -eq $LogicalDrive) { return $false }
    if ([int]$LogicalDrive.DriveType -eq 2) { return $true }

    try {
        $DeviceId = [string]$LogicalDrive.DeviceID
        if ($DeviceId -notmatch "^[A-Za-z]:$") { return $false }
        $StorageDisk = Get-Partition -DriveLetter $DeviceId.Substring(0, 1) -ErrorAction Stop |
            Get-Disk -ErrorAction Stop |
            Select-Object -First 1
        return (
            $null -ne $StorageDisk -and
            [string]::Equals([string]$StorageDisk.BusType, "USB", [System.StringComparison]::OrdinalIgnoreCase)
        )
    } catch {
        return $false
    }
}

$UsbDrives = @(
    Get-CimInstance -ClassName Win32_LogicalDisk -ErrorAction Stop |
        Where-Object { Test-ICTUsbLogicalDrive -LogicalDrive $_ }
)
if ($UsbDrives.Count -eq 0) { throw "Please insert a USB drive and run this file again." }

$SelectedUsb = $null
if ($UsbDrives.Count -eq 1) {
    $SelectedUsb = $UsbDrives[0]
} else {
    Write-Host "Available USB drives:" -ForegroundColor Cyan
    for ($Index = 0; $Index -lt $UsbDrives.Count; $Index++) {
        Write-Host "[$($Index + 1)] $($UsbDrives[$Index].DeviceID) $($UsbDrives[$Index].VolumeName)"
    }
    $Choice = Read-Host "Select USB number"
    $SelectedNumber = 0
    if (-not [int]::TryParse($Choice, [ref]$SelectedNumber) -or $SelectedNumber -lt 1 -or $SelectedNumber -gt $UsbDrives.Count) {
        throw "Invalid USB selection."
    }
    $SelectedUsb = $UsbDrives[$SelectedNumber - 1]
}

$DriveRoot = ([string]$SelectedUsb.DeviceID).TrimEnd("\\")
$UsbLabel = ([string]$Config.usbLabel).Trim()
if ([string]::IsNullOrWhiteSpace($UsbLabel)) { throw "USB label is not configured." }
if ($UsbLabel.Length -gt 11) { throw "USB label must be 11 characters or fewer." }

& "$env:SystemRoot\\System32\\label.exe" $DriveRoot $UsbLabel | Out-Null
if ($LASTEXITCODE -ne 0) { throw "Failed to set the USB volume label." }
$SyncDirectory = Join-Path "$DriveRoot\\" "ICTLabSync"
New-Item -ItemType Directory -Path $SyncDirectory -Force | Out-Null
$ScriptBytes = [Convert]::FromBase64String("${syncScriptBase64}")
[System.IO.File]::WriteAllBytes((Join-Path $SyncDirectory "GlobalSync.ps1"), $ScriptBytes)

Write-Host "========================================" -ForegroundColor Green
Write-Host " AUTO SYNC USB IS READY" -ForegroundColor Green
Write-Host " Drive: $DriveRoot" -ForegroundColor Cyan
Write-Host " Label: $UsbLabel" -ForegroundColor Cyan
Write-Host " File: ICTLabSync\\GlobalSync.ps1" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Green
} catch {
    $UsbMakerExitCode = 1
    Write-Host ""
    Write-Host "USB PREPARATION FAILED: $($_.Exception.Message)" -ForegroundColor Red
}

Complete-ICTInteractiveRun -ExitCode $UsbMakerExitCode
`;

/**
 * Standalone runner for student PCs.
 * Teachers can double-click 2_Sync_PC_Now.cmd on the USB to run sync with full on-screen console output.
 */
export const getSyncRunnerScript = () => getInteractiveCommandLauncher(
  `
$ErrorActionPreference = "Stop"
$Root = "C:\\ProgramData\\ICTLab"
$ConfigPath = Join-Path $Root "device-config.json"
$ExitCode = 1
$TaskReady = $false
try {
    if (-not (Test-Path -LiteralPath $ConfigPath)) { throw "Run 1_Install_Lab_PC_AUTO.cmd first." }
    $Config = Get-Content -LiteralPath $ConfigPath -Raw -Encoding UTF8 | ConvertFrom-Json
    $PackageDir = if ($null -ne $env:ICTLAB_PACKAGE_DIR) { [string]$env:ICTLAB_PACKAGE_DIR.TrimEnd('\\') } else { '' }
    $ScriptPath = Join-Path $PackageDir "ICTLabSync\\GlobalSync.ps1"
    if (-not (Test-Path -LiteralPath $ScriptPath)) { $ScriptPath = Join-Path $PackageDir "GlobalSync.ps1" }
    if (-not (Test-Path -LiteralPath $ScriptPath)) { throw "GlobalSync.ps1 is missing. Copy it to USB/ICTLabSync." }
    $RawHeader = (Get-Content -LiteralPath $ScriptPath -TotalCount 1 -Encoding UTF8)
    $Header = if ($RawHeader) { ($RawHeader -replace '^[^#]*', '').Trim() } else { '' }
    $ExpectedHeader = "# ICTLAB-AUTH:" + [string]$Config.syncToken
    if ($Header -cne $ExpectedHeader) { throw "USB sync token does not match this PC." }
    $SyncText = Get-Content -LiteralPath $ScriptPath -Raw -Encoding UTF8
    
    $TaskName = "ICTLab USB Listener"
    $ExistingTask = Get-ScheduledTask -TaskName $TaskName -ErrorAction SilentlyContinue
    if ($null -ne $ExistingTask) {
        Stop-ScheduledTask -TaskName $TaskName -ErrorAction SilentlyContinue
        for ($Attempt = 0; $Attempt -lt 10; $Attempt++) {
            if ((Get-ScheduledTask -TaskName $TaskName).State -ne "Running") { break }
            Start-Sleep -Milliseconds 200
        }
    }

    # Stop any background sync or listener process to prevent mutex contention (Exit Code 12)
    try {
        Get-CimInstance Win32_Process -ErrorAction SilentlyContinue | Where-Object {
            $_.CommandLine -like "*UsbListener.ps1*" -or $_.CommandLine -like "*GlobalSync.ps1*" -or $_.CommandLine -like "*ManualSync.ps1*"
        } | ForEach-Object {
            try { Stop-Process -Id $_.ProcessId -Force -ErrorAction SilentlyContinue } catch { }
        }
    } catch { }

    $ListenerCode = @'
${USB_LISTENER_SCRIPT}
'@
    Set-Content -LiteralPath (Join-Path $Root "UsbListener.ps1") -Value $ListenerCode -Encoding UTF8
    $PowerShellExe = Join-Path $env:SystemRoot "System32\\WindowsPowerShell\\v1.0\\powershell.exe"
    $Action = New-ScheduledTaskAction -Execute $PowerShellExe -Argument "-NoProfile -NonInteractive -ExecutionPolicy Bypass -WindowStyle Hidden -File \`"$Root\\UsbListener.ps1\`""
    $Trigger = New-ScheduledTaskTrigger -AtStartup
    $Principal = New-ScheduledTaskPrincipal -UserId "SYSTEM" -LogonType ServiceAccount -RunLevel Highest
    $Settings = New-ScheduledTaskSettingsSet -StartWhenAvailable -RestartCount 3 -RestartInterval (New-TimeSpan -Minutes 1) -ExecutionTimeLimit ([TimeSpan]::Zero) -MultipleInstances IgnoreNew
    Register-ScheduledTask -TaskName $TaskName -Action $Action -Trigger $Trigger -Principal $Principal -Settings $Settings -Force | Out-Null
    $TaskReady = $true
    
    $Stage = Join-Path $Root "Staging"
    New-Item -ItemType Directory -Path $Stage -Force | Out-Null
    $StagePath = Join-Path $Stage "ManualSync.ps1"
    Set-Content -LiteralPath $StagePath -Value $SyncText -Encoding UTF8
    
    $DriveRoot = if ($PackageDir -match '^([A-Za-z]:)') { $Matches[1] } else { $PackageDir }
    & $PowerShellExe -NoLogo -NoProfile -ExecutionPolicy Bypass -File $StagePath -UsbDrive $DriveRoot
    $ExitCode = $LASTEXITCODE
    switch ($ExitCode) {
        0 { Write-Host "[SUCCESS] Accounts synchronized. Import USB/ICTLabSync/Receipts in PC Sync." -ForegroundColor Green }
        10 { Write-Host "[NO WORK] This USB does not target this PC." -ForegroundColor Yellow }
        11 { Write-Host "[ALREADY APPLIED] This payload previously succeeded. Receipt copied to USB." -ForegroundColor Yellow }
        default { Write-Host "[FAILED] Sync exit code: $ExitCode. Check C:\\ProgramData\\ICTLab\\Logs\\GlobalSync.log" -ForegroundColor Red }
    }
} catch {
    Write-Host ("[FAILED] " + $_.Exception.Message) -ForegroundColor Red
    $ExitCode = 1
} finally {
    if ($TaskReady) {
        try {
            Start-ScheduledTask -TaskName $TaskName -ErrorAction SilentlyContinue
            Write-Host "[OK] Updated USB Listener registered and running." -ForegroundColor Green
        } catch {
            Write-Host ("[NOTICE] Auto Sync listener status: " + $_.Exception.Message) -ForegroundColor DarkYellow
        }
    }
}
exit $ExitCode
`,
  'ICT Lab PC Sync and Listener Repair'
);
