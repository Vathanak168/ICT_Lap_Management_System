param([Parameter(Mandatory=$true)][string]$ListenerPath)
$ErrorActionPreference='Stop'
$Code=Get-Content -LiteralPath $ListenerPath -Raw -Encoding UTF8
$Tokens=$null;$Errors=$null
$Ast=[System.Management.Automation.Language.Parser]::ParseInput($Code,[ref]$Tokens,[ref]$Errors)
$Function=$Ast.Find({param($Node) $Node -is [System.Management.Automation.Language.FunctionDefinitionAst] -and $Node.Name -eq 'Invoke-ICTAdminUsb'},$true)
if (-not $Function) { throw 'Listener function not found' }
$Definition=[regex]::Replace($Function.Extent.Text,'\[console\]::beep\([^)]*\)','$null = 0')
Invoke-Expression $Definition

# Every external dependency used by this isolated function is a test double.
function Join-Path { param($Path,$ChildPath) "$Path/$ChildPath" }
function Test-Path { param($LiteralPath,$PathType) $true }
function Get-Content {
    param($LiteralPath,[switch]$Raw,$Encoding,$TotalCount)
    if ($LiteralPath -eq $ConfigPath) { '{"syncFolderName":"ICTLabSync","syncToken":"test-token"}' }
    elseif ($TotalCount) { "# ICTLAB-AUTH:$global:HeaderToken" }
    else { '# safe mock content' }
}
function Get-FileHash { param($LiteralPath,$Algorithm) [pscustomobject]@{Hash=$global:FileHash} }
function Set-Content { param($LiteralPath,$Value,$Encoding) if ($Encoding -ne 'UTF8') { throw 'Staging lost UTF8 encoding' } }
function Remove-Item { param($LiteralPath,[switch]$Force,$ErrorAction) }
function Get-Command { param($Name,$ErrorAction) $null }
function Start-Process { param($FilePath,$ArgumentList,$WindowStyle,[switch]$Wait,[switch]$PassThru) $global:Launches++; [pscustomobject]@{ExitCode=$global:MockExit} }
function Write-ICTLog { param($Message,$Level='INFO') $global:Messages.Add($Message) }
function Assert-That($Condition,$Message) { if (-not $Condition) { throw $Message } }
Set-StrictMode -Version Latest
$ConfigPath='mock-config'; $StageDirectory='mock-stage'; $DebounceSeconds=60
$LastExecution=@{}; $CompletedScripts=@{}
$global:Messages=[System.Collections.Generic.List[string]]::new()
$global:Launches=0; $global:MockExit=0; $global:HeaderToken='wrong'; $global:FileHash='first'
Invoke-ICTAdminUsb 'E:'
Assert-That ($global:Launches -eq 0) 'Wrong token launched sync'
$global:HeaderToken='test-token'
Invoke-ICTAdminUsb 'E:'
Assert-That ($global:Launches -eq 1) ('Correct token failed: '+($global:Messages -join '; '))
$LastExecution.Clear()
Invoke-ICTAdminUsb 'E:'
Assert-That ($global:Launches -eq 1) 'Successful payload repeated after debounce'
$global:FileHash='changed'; $global:MockExit=1
Invoke-ICTAdminUsb 'E:'
Assert-That ($global:Launches -eq 2) 'Changed payload was not launched'
$LastExecution.Clear()
$global:MockExit=0
Invoke-ICTAdminUsb 'E:'
Assert-That ($global:Launches -eq 3) 'Failed payload was not retried'
$LastExecution.Clear(); $global:FileHash='no-work'; $global:MockExit=10
Invoke-ICTAdminUsb 'E:'
$LastExecution.Clear()
Invoke-ICTAdminUsb 'E:'
Assert-That ($global:Launches -eq 4) 'No-work payload was repeatedly run'
Write-Host 'PASS: strict token validation, first launch, deduplication, changed payload, failed retry, no-work suppression.'
