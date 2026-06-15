#requires -Version 7
# Persistent, silent delegated sign-in for Microsoft Graph so the SDK reconnects
# across sessions WITHOUT a new device code. Owns its own token cache + identity
# record and hands an access token to Connect-MgGraph -AccessToken. No window,
# no fresh code, fully headless after the one-time login.
#
#   One-time setup : pwsh -File graph-connect.ps1 -Login
#   Before any use : . <path>\graph-connect.ps1 ; Connect-KIGraph ; <Mg cmdlets>
#   Quick re-test  : pwsh -File graph-connect.ps1 -Test
#
# Why this exists: Connect-MgGraph does NOT persist a login across fresh
# PowerShell sessions in an agent/headless context. A plain reconnect uses
# Windows' account broker (WAM) and fails with "a window handle must be
# configured", and -UseDeviceAuthentication prints a brand-new code every time.
# This connector saves an AuthenticationRecord on first login and silently mints
# a fresh token from it every session after.
#
# TenantId only matters for the FIRST login; 'organizations' lets any work/school
# account sign in. After that the tenant is pinned from the saved record, so the
# connector is automatically per-client with nothing to hardcode. If a locked-down
# managed tenant rejects 'organizations' at first login, pass the tenant GUID:
#   pwsh -File graph-connect.ps1 -Login -TenantId '<tenant-guid>'

param([switch]$Login, [switch]$Test, [string]$TenantId = 'organizations')

$script:ClientId  = '14d82eec-204b-4c2f-b7e8-296a70dab67e'   # Microsoft Graph Command Line Tools (built-in public client)
$script:TenantId  = $TenantId
$script:Scopes    = [string[]]@(
  'https://graph.microsoft.com/Mail.ReadWrite',
  'https://graph.microsoft.com/Mail.Send',
  'https://graph.microsoft.com/Calendars.ReadWrite'
)
$script:CacheName = 'ki_graph_cache'
$script:Resolver  = $null

function Get-RecordPath {
  $dir = Join-Path $env:LOCALAPPDATA 'KingIntelligence'
  if (-not (Test-Path $dir)) { New-Item -ItemType Directory -Path $dir -Force | Out-Null }
  return (Join-Path $dir 'graph-auth-record.bin')
}

function Initialize-AzureIdentity {
  if ('Azure.Identity.DeviceCodeCredential' -as [type]) { return }
  $authMod = Get-Module Microsoft.Graph.Authentication -ListAvailable |
             Sort-Object Version -Descending | Select-Object -First 1
  if (-not $authMod) { throw 'Microsoft.Graph.Authentication module not found.' }
  # Script-scoped so the AssemblyResolve handler (fired from the CLR during
  # LoadFrom) can still see these paths. Function-local vars are invisible there.
  $script:Deps = Join-Path $authMod.ModuleBase 'Dependencies'
  $script:Core = Join-Path $script:Deps 'Core'
  $resolver = [System.ResolveEventHandler]{
    param($s, $e)
    $n = ($e.Name -split ',')[0].Trim() + '.dll'
    foreach ($d in @($script:Deps, $script:Core)) {
      $p = Join-Path $d $n
      if (Test-Path $p) { return [System.Reflection.Assembly]::LoadFrom($p) }
    }
    return $null
  }
  [System.AppDomain]::CurrentDomain.add_AssemblyResolve($resolver)
  # Explicitly load the assemblies whose types we name directly. A bare literal
  # like [Azure.Core.TokenRequestContext] does NOT trip the resolver.
  [void][System.Reflection.Assembly]::LoadFrom((Join-Path $script:Core 'Azure.Core.dll'))
  [void][System.Reflection.Assembly]::LoadFrom((Join-Path $script:Deps 'Azure.Identity.dll'))
  $script:Resolver = $resolver
}

function New-Options {
  $o = [Azure.Identity.DeviceCodeCredentialOptions]::new()
  $o.ClientId = $script:ClientId
  $o.TenantId = $script:TenantId
  $tcpo = [Azure.Identity.TokenCachePersistenceOptions]::new()
  $tcpo.Name = $script:CacheName
  $o.TokenCachePersistenceOptions = $tcpo
  # Intentionally NO DeviceCodeCallback: Azure.Identity's default writes the
  # "enter the code ..." message to the console. A PowerShell callback would run
  # on a runspace-less background thread and throw "There is no Runspace available."
  return $o
}

function Connect-KIGraph {
  [CmdletBinding()]
  param([switch]$Login)
  Initialize-AzureIdentity
  $recordPath = Get-RecordPath
  $ctx  = [Azure.Core.TokenRequestContext]::new($script:Scopes)
  $none = [System.Threading.CancellationToken]::None
  if ($Login) {
    $opts   = New-Options                       # first login: TenantId is 'organizations' (or the GUID passed in)
    $cred   = [Azure.Identity.DeviceCodeCredential]::new($opts)
    $record = $cred.Authenticate($ctx, $none)
    $fs = [System.IO.File]::Create($recordPath)
    try { $record.Serialize($fs, $none) } finally { $fs.Dispose() }
    $tok = $cred.GetToken($ctx, $none)
  } else {
    if (-not (Test-Path $recordPath)) { throw 'Not set up yet. Run -Login first.' }
    $fs = [System.IO.File]::OpenRead($recordPath)
    try { $record = [Azure.Identity.AuthenticationRecord]::Deserialize($fs, $none) } finally { $fs.Dispose() }
    # Pin to the tenant we actually logged into, so the silent path is correct
    # for this client without anything hardcoded.
    if ($record.TenantId) { $script:TenantId = $record.TenantId }
    $opts = New-Options
    $opts.AuthenticationRecord = $record
    $opts.DisableAutomaticAuthentication = $true   # silent only: throw instead of prompting if the login lapsed
    $cred = [Azure.Identity.DeviceCodeCredential]::new($opts)
    $tok  = $cred.GetToken($ctx, $none)
  }
  if ($script:Resolver) {
    [System.AppDomain]::CurrentDomain.remove_AssemblyResolve($script:Resolver)
    $script:Resolver = $null
  }
  $secure = ConvertTo-SecureString $tok.Token -AsPlainText -Force
  Connect-MgGraph -AccessToken $secure -NoWelcome -ErrorAction Stop | Out-Null
  return (Get-MgContext)
}

# Retry helper for transient Microsoft 503 / GatewayTimeout / "Cannot query rows
# in a table" errors on the first reads after a connect. Wrap any Mg- read in it.
#   Invoke-KIGraphRetry { Get-MgUserMessage -UserId you@co.com -Top 1 }
function Invoke-KIGraphRetry {
  param([Parameter(Mandatory)][scriptblock]$Script, [int]$Tries = 5, [int]$DelaySeconds = 3)
  for ($i = 1; $i -le $Tries; $i++) {
    try { return & $Script }
    catch {
      if ($i -eq $Tries) { throw }
      Start-Sleep -Seconds $DelaySeconds
    }
  }
}

if ($Login)     { (Connect-KIGraph -Login) | Out-Null; 'LOGIN_OK' }
elseif ($Test)  { (Connect-KIGraph)        | Out-Null; 'RECONNECT_OK' }
