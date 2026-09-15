param([Parameter(Mandatory=$true)][string]$FixtureDirectory)
$ErrorActionPreference = 'Stop'
$ProgressPreference = 'SilentlyContinue'
function Assert-That($Condition, [string]$Message) { if (-not $Condition) { throw $Message } }

# Parse actual generated scripts using the same Windows PowerShell as the launcher.
foreach ($File in Get-ChildItem -LiteralPath $FixtureDirectory -Filter '*.ps1') {
    $Tokens=$null; $Errors=$null
    $null=[System.Management.Automation.Language.Parser]::ParseFile($File.FullName,[ref]$Tokens,[ref]$Errors)
    if ($Errors.Count) { throw ($File.Name + ': ' + (($Errors | ForEach-Object { $_.Message + ' line ' + $_.Extent.StartLineNumber }) -join '; ')) }
}
$SetParameters=(Get-Command Microsoft.PowerShell.LocalAccounts\Set-LocalUser).Parameters
Assert-That $SetParameters.ContainsKey('UserMayChangePassword') 'Windows Set-LocalUser parameter mismatch'
Write-Host 'PASS: all generated scripts parse in Windows PowerShell 5.1; update parameter exists.'

# Account cmdlets below are test doubles. No real local-account cmdlets execute.
function Get-LocalUser { [CmdletBinding()]param([string]$Name) if ($global:Users.ContainsKey($Name)) { $global:Users[$Name] } }
function New-LocalUser {
    [CmdletBinding()]param($Name,$Password,$FullName,$Description,[switch]$AccountNeverExpires,[switch]$PasswordNeverExpires,[switch]$UserMayNotChangePassword)
    $global:Users[$Name]=[pscustomobject]@{ Name=$Name; SID="sid-$Name"; Description=$Description; FullName=$FullName }
    $global:Operations.Add("create:$Name")
}
function Set-LocalUser {
    [CmdletBinding()]param($Name,$Password,$FullName,$Description,[switch]$AccountNeverExpires,[bool]$PasswordNeverExpires,[bool]$UserMayChangePassword)
    Assert-That (-not $UserMayChangePassword) 'Password changes should stay disabled'
    $global:Users[$Name].FullName=$FullName
    $global:Operations.Add("update:$Name")
}
function Remove-LocalUser { [CmdletBinding()]param($Name) $global:Users.Remove($Name); $global:Operations.Add("remove:$Name") }
function Enable-LocalUser { [CmdletBinding()]param($Name) }
function Get-LocalGroup { [CmdletBinding()]param($Name,$SID) if ($SID) { [pscustomobject]@{Name='Users'} } else { [pscustomobject]@{Name=$Name} } }
function New-LocalGroup { [CmdletBinding()]param($Name,$Description) throw 'Unexpected group creation in fixture' }
function Get-LocalGroupMember {
    [CmdletBinding()]param($Group)
    $Name=if ($Group -is [string]) {$Group} else {$Group.Name}
    foreach ($Key in @($global:Members[$Name])) { if ($global:Users.ContainsKey($Key)) { [pscustomobject]@{Name="TEST\$Key"; SID="sid-$Key"} } }
}
function Add-LocalGroupMember {
    [CmdletBinding()]param($Group,$Member)
    if ($global:FailMembership) { throw 'Simulated membership failure' }
    $Name=if ($Group -is [string]) {$Group} else {$Group.Name}
    $global:Members[$Name] += $Member.Name
}

foreach ($Case in @('success','noWork','wrongLab','wrongToken','unmanaged','removeOnly','full','memberFailure')) {
    $global:Users=@{}
    foreach ($Name in @('existing','removed','otherclass','admin')) {
        $global:Users[$Name]=[pscustomobject]@{Name=$Name;SID="sid-$Name";FullName=$Name;Description=$(if ($Name -eq 'admin') {'Administrator'} else {'ICTLabManaged:v2'})}
    }
    $global:Members=@{ICTLabStudents=@('existing','removed','otherclass');Users=@('existing','removed','otherclass','admin')}
    $global:Operations=[System.Collections.Generic.List[string]]::new()
    $global:FailMembership=($Case -eq 'memberFailure')
    $CaseRoot=Join-Path $FixtureDirectory ($Case+'-'+[guid]::NewGuid().ToString('N'))
    $null=New-Item -ItemType Directory -Path $CaseRoot
    $UsbRoot=Join-Path $CaseRoot 'usb'
    $null=New-Item -ItemType Directory -Path (Join-Path $UsbRoot 'ICTLabSync') -Force
    @{pcNumber='PC-01';labId='test-lab';syncToken='test-token'} | ConvertTo-Json | Set-Content (Join-Path $CaseRoot 'device-config.json') -Encoding UTF8
    $Code=Get-Content -LiteralPath (Join-Path $FixtureDirectory ($Case+'.ps1')) -Raw -Encoding UTF8
    $Code=$Code.Replace('C:\ProgramData\ICTLab',$CaseRoot).Replace('Global\ICTLab.AccountSync',('ICTLab.Test.'+[guid]::NewGuid().ToString('N')))
    $Code=[regex]::Replace($Code,'\[console\]::beep\([^)]*\)','$null = 0')
    $Tokens=$null;$Errors=$null
    $Ast=[System.Management.Automation.Language.Parser]::ParseInput($Code,[ref]$Tokens,[ref]$Errors)
    $Functions=@($Ast.FindAll({param($Node) $Node -is [System.Management.Automation.Language.FunctionDefinitionAst] -and $Node.Name -in @('Show-ICTSyncNotification','Set-ICTLoginScreenPolicy','Set-ICTLoginScreenUserVisibility')},$true))
    foreach ($Function in ($Functions | Sort-Object {$_.Extent.StartOffset} -Descending)) {
        $Code=$Code.Substring(0,$Function.Extent.StartOffset)+('function '+$Function.Name+' { }')+$Code.Substring($Function.Extent.EndOffset)
    }
    $RunPath=Join-Path $CaseRoot 'isolated.ps1'
    Set-Content -LiteralPath $RunPath -Value $Code -Encoding UTF8
    & $RunPath -UsbDrive $UsbRoot
    $Result=$LASTEXITCODE
    $Receipts=@(Get-ChildItem -LiteralPath (Join-Path $UsbRoot 'ICTLabSync') -Filter '*.json' -Recurse)
    switch ($Case) {
        success {
            Assert-That ($Result -eq 0) 'Success fixture failed'
            Assert-That ($global:Operations -contains 'create:newuser') 'Missing CREATE'
            Assert-That ($global:Operations -contains 'update:existing') 'Missing UPDATE'
            Assert-That ($global:Operations -contains 'remove:removed') 'Missing REMOVE'
            Assert-That ($global:Users.ContainsKey('otherclass')) 'DELTA deleted another class'
            Assert-That ($Receipts.Count -eq 1) 'Missing receipt'
            $Before=$global:Operations.Count
            & $RunPath -UsbDrive $UsbRoot
            Assert-That ($LASTEXITCODE -eq 11 -and $global:Operations.Count -eq $Before) 'Duplicate payload changed accounts'
        }
        noWork { Assert-That ($Result -eq 10 -and $global:Operations.Count -eq 0) 'No-work mutated accounts or reported success' }
        wrongLab { Assert-That ($Result -eq 0 -and $Receipts.Count -eq 1) 'Legacy lab metadata prevented authorized sync' }
        wrongToken { Assert-That ($Result -eq 1 -and $global:Operations.Count -eq 0) 'Wrong token was accepted' }
        unmanaged { Assert-That ($Result -eq 1 -and $global:Operations.Count -eq 0 -and $Receipts.Count -eq 0) 'Unmanaged user overwritten or acknowledged' }
        removeOnly { Assert-That ($Result -eq 0 -and $global:Operations.Count -eq 1 -and $Receipts.Count -eq 1) 'Removal-only sync failed' }
        full { Assert-That ($Result -eq 0 -and -not $global:Users.ContainsKey('otherclass') -and $global:Users.ContainsKey('admin')) 'Full roster pruning failed' }
        memberFailure { Assert-That ($Result -eq 1 -and $Receipts.Count -eq 0) 'Membership failure was acknowledged as success' }
    }
    Write-Host "PASS: $Case"
}
