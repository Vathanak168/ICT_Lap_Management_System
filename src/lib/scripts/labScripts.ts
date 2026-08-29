/**
 * Centralized repository for ICT Lab PowerShell scripts.
 * These scripts are used for PC setup, lockdown, and synchronization.
 */

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

$ExpectedVolumeLabel = "ICTADMIN"
$SyncFolderName = "ICTLabSync"

$BaseDirectory = "C:\\ProgramData\\ICTLab"
$LogDirectory  = Join-Path $BaseDirectory "Logs"
$StageDirectory = Join-Path $BaseDirectory "Staging"
$LogFile = Join-Path $LogDirectory "UsbListener.log"
$SourceIdentifier = "ICTLab.UsbArrival"
$LastExecution = @{}
$DebounceSeconds = 5

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
            $Disk = Get-CimInstance -ClassName Win32_LogicalDisk -Filter "DeviceID='$DeviceId'" -ErrorAction Stop
            if ($null -ne $Disk) { return $Disk }
        } catch { }
        Start-Sleep -Milliseconds 250
    }
    return $null
}

function Invoke-ICTAdminUsb {
    param([string]$DriveName)
    try {
        $DriveRoot = $DriveName.TrimEnd("\\")
        $Now = Get-Date
        if ($LastExecution.ContainsKey($DriveRoot)) {
            if (($Now - $LastExecution[$DriveRoot]).TotalSeconds -lt $DebounceSeconds) { return }
        }
        $LastExecution[$DriveRoot] = $Now

        $Volume = Get-ICTVolume -DriveName $DriveRoot
        if ($null -eq $Volume) { return }
        
        $VolumeLabel = [string]$Volume.VolumeName
        if ($VolumeLabel -cne $ExpectedVolumeLabel) { return }
        
        Write-ICTLog "ICTADMIN volume detected on $DriveRoot."

        $ComputerScriptName = "$($env:COMPUTERNAME).ps1"
        $UsbScriptPath = Join-Path "$DriveRoot\\" ("$SyncFolderName\\" + $ComputerScriptName)

        if (-not (Test-Path -LiteralPath $UsbScriptPath -PathType Leaf)) {
            Write-ICTLog "No script for this PC: $UsbScriptPath"
            return
        }

        Write-ICTLog "PC-specific script found: $UsbScriptPath"

        # NOTE: Authenticode Signature check is skipped in this version 
        # to simplify the React app's payload generation.
        # It can be enabled later if required.

        $LocalScriptPath = Join-Path $StageDirectory $ComputerScriptName
        Copy-Item -LiteralPath $UsbScriptPath -Destination $LocalScriptPath -Force

        $PowerShellExe = Join-Path $env:SystemRoot "System32\\WindowsPowerShell\\v1.0\\powershell.exe"
        Write-ICTLog "Executing ICT Lab sync for $env:COMPUTERNAME."

        try {
            $Process = Start-Process -FilePath $PowerShellExe \`
                -ArgumentList @("-NoLogo", "-NoProfile", "-NonInteractive", "-ExecutionPolicy", "Bypass", "-File", "\`"$LocalScriptPath\`"") \`
                -WindowStyle Hidden -Wait -PassThru
            Write-ICTLog "Sync script finished. ExitCode=$($Process.ExitCode)"
        } finally {
            Remove-Item -LiteralPath $LocalScriptPath -Force -ErrorAction SilentlyContinue
        }
    } catch {
        Write-ICTLog "USB processing failure: $($_.Exception.Message)" "ERROR"
    }
}

Write-ICTLog "ICT Lab USB Listener starting."

try {
    Register-CimIndicationEvent -Namespace "root/cimv2" \`
        -Query "SELECT * FROM Win32_VolumeChangeEvent WHERE EventType = 2" \`
        -SourceIdentifier $SourceIdentifier | Out-Null

    while ($true) {
        $Event = Wait-Event -SourceIdentifier $SourceIdentifier
        try {
            $DriveName = [string]$Event.SourceEventArgs.NewEvent.DriveName
            if (-not ([string]::IsNullOrWhiteSpace($DriveName))) {
                Invoke-ICTAdminUsb -DriveName $DriveName
            }
        } finally {
            Remove-Event -EventIdentifier $Event.EventIdentifier -ErrorAction SilentlyContinue
        }
    }
} finally {
    Unregister-Event -SourceIdentifier $SourceIdentifier -ErrorAction SilentlyContinue
    Write-ICTLog "ICT Lab USB Listener stopped."
}
`;

// ============================================================================
// 2. SETUP LAB PC SCRIPT
// ============================================================================
export const getSetupScript = () => `
#Requires -Version 5.1
#Requires -RunAsAdministrator
[CmdletBinding()]
param()

Write-Host "========================================" -ForegroundColor Cyan
Write-Host " ICT LAB PC SETUP & LOCKDOWN" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan

$ICTRoot = "C:\\ProgramData\\ICTLab"
$GroupName = "ICTLabStudents"

# 1. Ensure Directory
New-Item -ItemType Directory -Path $ICTRoot -Force | Out-Null
New-Item -ItemType Directory -Path "$ICTRoot\\Backup" -Force | Out-Null

# 2. Backup AppLocker
Write-Host "[1/5] Backing up current AppLocker policy..." -ForegroundColor Yellow
Import-Module AppLocker
Get-AppLockerPolicy -Local -Xml | Set-Content -LiteralPath "$ICTRoot\\Backup\\AppLocker-before-ICTLab.xml" -Encoding UTF8

# 3. Create Local Group
Write-Host "[2/5] Creating $GroupName group..." -ForegroundColor Yellow
if (-not (Get-LocalGroup -Name $GroupName -ErrorAction SilentlyContinue)) {
    New-LocalGroup -Name $GroupName -Description "Students managed by ICT Lab System" | Out-Null
}

# 4. Disable Browser Games
Write-Host "[3/5] Disabling Chrome Dino and Edge Surf..." -ForegroundColor Yellow
New-Item -Path "HKLM:\\SOFTWARE\\Policies\\Google\\Chrome" -Force -ErrorAction SilentlyContinue | Out-Null
Set-ItemProperty -Path "HKLM:\\SOFTWARE\\Policies\\Google\\Chrome" -Name "AllowDinosaurEasterEgg" -Value 0 -Type DWord
New-Item -Path "HKLM:\\SOFTWARE\\Policies\\Microsoft\\Edge" -Force -ErrorAction SilentlyContinue | Out-Null
Set-ItemProperty -Path "HKLM:\\SOFTWARE\\Policies\\Microsoft\\Edge" -Name "AllowSurfGame" -Value 0 -Type DWord

# 5. Install SYSTEM Listener
Write-Host "[4/5] Installing USB Listener Service..." -ForegroundColor Yellow
$ListenerCode = @'
${USB_LISTENER_SCRIPT}
'@

Set-Content -Path "$ICTRoot\\UsbListener.ps1" -Value $ListenerCode -Encoding UTF8

$TaskName = "ICTLab USB Listener"
Unregister-ScheduledTask -TaskName $TaskName -ErrorAction SilentlyContinue | Out-Null

$Action = New-ScheduledTaskAction -Execute "powershell.exe" -Argument "-NoProfile -WindowStyle Hidden -File \`"$ICTRoot\\UsbListener.ps1\`""
$Trigger = New-ScheduledTaskTrigger -AtStartup
$Principal = New-ScheduledTaskPrincipal -UserId "SYSTEM" -LogonType ServiceAccount -RunLevel Highest
$Settings = New-ScheduledTaskSettingsSet -StartWhenAvailable

Register-ScheduledTask -TaskName $TaskName -Action $Action -Trigger $Trigger -Principal $Principal -Settings $Settings -Force | Out-Null
Start-ScheduledTask -TaskName $TaskName

Write-Host "[5/5] Setup Complete!" -ForegroundColor Green
Write-Host "This PC ($env:COMPUTERNAME) is now ready to receive Sync USBs." -ForegroundColor Green
Pause
`;

// ============================================================================
// 3. FACTORY RESET SCRIPT
// ============================================================================
export const getResetScript = () => `
#Requires -Version 5.1
#Requires -RunAsAdministrator

[CmdletBinding()]
param()

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"
$ProgressPreference = "SilentlyContinue"

# ============================================================
# ICT LAB FACTORY RESET
# ============================================================
$ICTRoot = "C:\\ProgramData\\ICTLab"
$GroupName = "ICTLabStudents"
$AppLockerBackup = "$ICTRoot\\Backup\\AppLocker-before-ICTLab.xml"

Write-Host "========================================" -ForegroundColor Cyan
Write-Host " ICT LAB FACTORY RESET" -ForegroundColor Cyan
Write-Host " Computer: $env:COMPUTERNAME" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan

# 1. Stop Listener
Write-Host "[1/5] Removing Scheduled Tasks..." -ForegroundColor Yellow
Stop-ScheduledTask -TaskName "ICTLab USB Listener" -ErrorAction SilentlyContinue
Unregister-ScheduledTask -TaskName "ICTLab USB Listener" -Confirm:$false -ErrorAction SilentlyContinue

# 2. Restore Browser Policies
Write-Host "[2/5] Restoring Browser Policies..." -ForegroundColor Yellow
Remove-ItemProperty -Path "HKLM:\\SOFTWARE\\Policies\\Google\\Chrome" -Name "AllowDinosaurEasterEgg" -ErrorAction SilentlyContinue
Remove-ItemProperty -Path "HKLM:\\SOFTWARE\\Policies\\Microsoft\\Edge" -Name "AllowSurfGame" -ErrorAction SilentlyContinue

# 3. Delete Student Accounts
Write-Host "[3/5] Deleting Student Accounts..." -ForegroundColor Yellow
$StudentGroup = Get-LocalGroup -Name $GroupName -ErrorAction SilentlyContinue
if ($null -ne $StudentGroup) {
    $Members = Get-LocalGroupMember -Group $GroupName -ErrorAction SilentlyContinue
    foreach ($Member in $Members) {
        $Sid = $Member.SID
        if ($null -ne $Sid) {
            # Skip built-in accounts just in case
            if ($Sid.Value -notmatch -- "-500$|-501$|-503$|-504$") {
                try {
                    Remove-LocalUser -SID $Sid -ErrorAction Stop
                    Write-Host "  Removed: $($Member.Name)" -ForegroundColor Green
                } catch {
                    Write-Host "  Failed to remove: $($Member.Name)" -ForegroundColor Red
                }
            }
        }
    }
    Remove-LocalGroup -Name $GroupName -ErrorAction SilentlyContinue
}

# 4. Restore AppLocker
Write-Host "[4/5] Restoring AppLocker..." -ForegroundColor Yellow
try {
    Import-Module AppLocker -ErrorAction Stop
    if (Test-Path -LiteralPath $AppLockerBackup) {
        Set-AppLockerPolicy -XmlPolicy $AppLockerBackup -ErrorAction Stop
        Write-Host "  Restored previous AppLocker policy." -ForegroundColor Green
    }
} catch {
    Write-Host "  Failed to restore AppLocker." -ForegroundColor Red
}

# 5. Clean up Files
Write-Host "[5/5] Removing Files..." -ForegroundColor Yellow
if (Test-Path -LiteralPath $ICTRoot) {
    Remove-Item -LiteralPath $ICTRoot -Recurse -Force -ErrorAction SilentlyContinue
}

Write-Host ""
Write-Host "========================================" -ForegroundColor Green
Write-Host " RESET COMPLETE" -ForegroundColor Green
Write-Host "========================================" -ForegroundColor Green
Pause
`;

// ============================================================================
// 4. SYNC PAYLOAD SCRIPT GENERATOR
// ============================================================================
/**
 * Generates the per-PC synchronization script.
 * We encode the tasks as Base64 to prevent any PowerShell injection 
 * vulnerabilities caused by student names or passwords containing quotes/symbols.
 */
export const getSyncPayloadScript = (pcNumber: string, tasksBase64: string) => `
# ============================================================
# ICT LAB SYNC SCRIPT
# Target PC: ${pcNumber}
# Generated: ${new Date().toLocaleString()}
# ============================================================

$ErrorActionPreference = "Stop"

$ExpectedComputerName = "${pcNumber}"
if ($env:COMPUTERNAME -ne $ExpectedComputerName) {
    Write-Error "CRITICAL: This script is intended for $ExpectedComputerName, but ran on $($env:COMPUTERNAME)."
    Exit 1
}

$PayloadBase64 = "${tasksBase64}"

try {
    $Json = [System.Text.Encoding]::UTF8.GetString([Convert]::FromBase64String($PayloadBase64))
    $Tasks = $Json | ConvertFrom-Json
} catch {
    Write-Error "Failed to parse payload."
    Exit 1
}

$GroupName = "ICTLabStudents"

# Ensure group exists just in case
if (-not (Get-LocalGroup -Name $GroupName -ErrorAction SilentlyContinue)) {
    New-LocalGroup -Name $GroupName -Description "Students managed by ICT Lab System" | Out-Null
}

$SuccessCount = 0
$FailCount = 0

foreach ($Task in $Tasks) {
    $Action = $Task.action
    $StudentId = $Task.studentId
    $Password = $Task.password
    $StudentName = $Task.studentName

    try {
        if ($Action -eq "UPSERT") {
            # Check if user exists
            $User = Get-LocalUser -Name $StudentId -ErrorAction SilentlyContinue
            
            if ($null -eq $User) {
                # ADD
                $SecurePass = ConvertTo-SecureString $Password -AsPlainText -Force
                New-LocalUser -Name $StudentId -Password $SecurePass -FullName $StudentName -Description "ICTLabManaged:v1" -AccountNeverExpires | Out-Null
                Add-LocalGroupMember -Group $GroupName -Member $StudentId -ErrorAction SilentlyContinue
                Write-Host "[ADD] $StudentId ($StudentName) - Success" -ForegroundColor Green
            } else {
                # UPDATE
                $SecurePass = ConvertTo-SecureString $Password -AsPlainText -Force
                Set-LocalUser -Name $StudentId -Password $SecurePass | Out-Null
                Add-LocalGroupMember -Group $GroupName -Member $StudentId -ErrorAction SilentlyContinue
                Write-Host "[UPDATE] $StudentId ($StudentName) - Success" -ForegroundColor Green
            }
        } 
        elseif ($Action -eq "REMOVE") {
            # Check if user exists
            $User = Get-LocalUser -Name $StudentId -ErrorAction SilentlyContinue
            if ($null -ne $User) {
                Remove-LocalUser -Name $StudentId -ErrorAction Stop
                Write-Host "[REMOVE] $StudentId - Success" -ForegroundColor Yellow
            } else {
                Write-Host "[SKIP] $StudentId not found on this PC." -ForegroundColor DarkGray
            }
        }
        $SuccessCount++
    } catch {
        Write-Host "[ERROR] Failed to $Action $StudentId : $($_.Exception.Message)" -ForegroundColor Red
        $FailCount++
    }
}

Write-Host "========================================="
Write-Host " SYNC COMPLETED"
Write-Host " Success: $SuccessCount | Failed: $FailCount"
Write-Host "========================================="
`;
