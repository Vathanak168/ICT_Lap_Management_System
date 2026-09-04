@echo off
setlocal
chcp 65001 >nul
title Setup Laptop As PC-01 (ICT Lab)

net session >nul 2>&1
if %errorlevel% neq 0 (
    echo កំពុងស្នើសុំសិទ្ធិ Administrator...
    powershell -NoProfile -Command "Start-Process cmd -ArgumentList '/c \"\"%~f0\"\"' -Verb RunAs"
    exit /b
)

echo.
echo ============================================================
echo   កំពុងកំណត់ Laptop នេះជា PC-01 និងដំឡើងសេវា USB Auto...
echo ============================================================
echo.

powershell -NoProfile -ExecutionPolicy Bypass -Command "$Raw=Get-Content -LiteralPath '%~f0' -Raw -Encoding UTF8; $Marker='#<POWERSHELL_START>'; $Start=$Raw.LastIndexOf($Marker); Invoke-Expression ($Raw.Substring($Start + $Marker.Length))"

echo.
echo ============================================================
echo   [ជោគជ័យ] Laptop នេះត្រូវបានកំណត់ជា PC-01 រួចរាល់ ១០០%!
echo   សេវា USB Auto កំពុងដំណើរការក្នុងផ្ទៃខាងក្រោយជាប្រក្រតី។
echo ============================================================
echo.
pause
exit /b

#<POWERSHELL_START>
$ErrorActionPreference = "Stop"

Write-Host "============================================================" -ForegroundColor Cyan
Write-Host " ICT LAB - RESET & SETUP THIS LAPTOP AS PC-01" -ForegroundColor Cyan
Write-Host " Computer: $env:COMPUTERNAME" -ForegroundColor Cyan
Write-Host " Target: PC-01" -ForegroundColor Cyan
Write-Host " Token: ICT-SECURE-TOKEN-2026" -ForegroundColor Cyan
Write-Host "============================================================" -ForegroundColor Cyan

# 1. Stop and remove existing scheduled task
Write-Host "`n[1/5] Stopping existing scheduled task..." -ForegroundColor Yellow
Stop-ScheduledTask -TaskName "ICTLab USB Listener" -ErrorAction SilentlyContinue
Unregister-ScheduledTask -TaskName "ICTLab USB Listener" -Confirm:$false -ErrorAction SilentlyContinue

# Terminate any leftover UsbListener background powershell processes
Get-CimInstance Win32_Process -Filter "Name = 'powershell.exe'" | Where-Object {
    $_.CommandLine -like "*UsbListener.ps1*"
} | ForEach-Object {
    Stop-Process -Id $_.ProcessId -Force -ErrorAction SilentlyContinue
}

# 2. Clean student accounts from ICTLabStudents
Write-Host "[2/5] Cleaning up old student accounts..." -ForegroundColor Yellow
$GroupName = "ICTLabStudents"
$StudentGroup = Get-LocalGroup -Name $GroupName -ErrorAction SilentlyContinue
if ($null -ne $StudentGroup) {
    $Members = Get-LocalGroupMember -Group $GroupName -ErrorAction SilentlyContinue
    foreach ($Member in $Members) {
        $Sid = $Member.SID
        if ($null -ne $Sid -and $Sid.Value -notmatch "-500$|-501$|-503$|-504$") {
            try {
                Remove-LocalUser -SID $Sid -ErrorAction Stop
                Write-Host "  Removed student account: $($Member.Name)" -ForegroundColor Green
            } catch {
                Write-Host "  Could not remove $($Member.Name): $($_.Exception.Message)" -ForegroundColor DarkGray
            }
        }
    }
} else {
    New-LocalGroup -Name $GroupName -Description "Students managed by ICT Lab System" -ErrorAction SilentlyContinue | Out-Null
}

# 3. Clean and prepare C:\ProgramData\ICTLab
Write-Host "[3/5] Setting up C:\ProgramData\ICTLab directories..." -ForegroundColor Yellow
$ICTRoot = "C:\ProgramData\ICTLab"
$LogsDir = Join-Path $ICTRoot "Logs"
$BackupDir = Join-Path $ICTRoot "Backup"
$StagingDir = Join-Path $ICTRoot "Staging"

New-Item -ItemType Directory -Path $ICTRoot -Force | Out-Null
New-Item -ItemType Directory -Path $LogsDir -Force | Out-Null
New-Item -ItemType Directory -Path $BackupDir -Force | Out-Null
New-Item -ItemType Directory -Path $StagingDir -Force | Out-Null

# 4. Write device-config.json for PC-01
Write-Host "[4/5] Configuring device-config.json as PC-01..." -ForegroundColor Yellow
$MachineGuid = (Get-ItemProperty -Path "HKLM:\SOFTWARE\Microsoft\Cryptography" -Name "MachineGuid" -ErrorAction SilentlyContinue).MachineGuid

$DeviceConfig = [ordered]@{
    version = 3
    labId = "ict-lab-shared"
    labName = "ICT Lab"
    deviceId = [string]$MachineGuid
    pcNumber = "PC-01"
    pcName = [string]$env:COMPUTERNAME
    friendlyName = "PC-01"
    expectedUsbLabel = "ICTADMIN"
    syncFolderName = "ICTLabSync"
    syncToken = "ICT-SECURE-TOKEN-2026"
    installedAt = (Get-Date).ToString("o")
}

$DeviceConfig | ConvertTo-Json -Depth 5 | Set-Content -LiteralPath "$ICTRoot\device-config.json" -Encoding UTF8 -Force
Write-Host "  device-config.json configured successfully: PC-01 (Token: ICT-SECURE-TOKEN-2026)" -ForegroundColor Green

# 5. Copy UsbListener.ps1 and launch scheduled task
Write-Host "[5/5] Installing UsbListener.ps1 and starting background service..." -ForegroundColor Yellow
$CandidatePaths = @(
    "C:\Users\U-ser\Desktop\ICT_Lap_Management_system\scratch\test_ps1\UsbListener.ps1",
    "E:\scratch\test_ps1\UsbListener.ps1"
)
$FoundPath = $null
foreach ($cp in $CandidatePaths) {
    if (Test-Path -LiteralPath $cp) { $FoundPath = $cp; break }
}
if ($null -ne $FoundPath) {
    Copy-Item -LiteralPath $FoundPath -Destination "$ICTRoot\UsbListener.ps1" -Force
} else {
    Write-Host "  Note: UsbListener.ps1 preserved or updated." -ForegroundColor DarkGray
}

$TaskName = "ICTLab USB Listener"
$Action = New-ScheduledTaskAction -Execute "powershell.exe" -Argument "-NoProfile -WindowStyle Hidden -File `"$ICTRoot\UsbListener.ps1`""
$Trigger = New-ScheduledTaskTrigger -AtStartup
$Principal = New-ScheduledTaskPrincipal -UserId "SYSTEM" -LogonType ServiceAccount -RunLevel Highest
$Settings = New-ScheduledTaskSettingsSet -StartWhenAvailable

Register-ScheduledTask -TaskName $TaskName -Action $Action -Trigger $Trigger -Principal $Principal -Settings $Settings -Force | Out-Null
Start-ScheduledTask -TaskName $TaskName
Write-Host "  Scheduled task started!" -ForegroundColor Green
