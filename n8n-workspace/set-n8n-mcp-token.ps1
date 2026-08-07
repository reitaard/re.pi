[CmdletBinding()]
param()

$ErrorActionPreference = "Stop"
$secureToken = Read-Host "Paste the rotated n8n MCP token" -AsSecureString
$tokenPointer = [IntPtr]::Zero
$token = $null

try {
    $tokenPointer = [Runtime.InteropServices.Marshal]::SecureStringToBSTR($secureToken)
    $token = [Runtime.InteropServices.Marshal]::PtrToStringBSTR($tokenPointer)

    if ([string]::IsNullOrWhiteSpace($token)) {
        throw "The token cannot be empty."
    }

    [Environment]::SetEnvironmentVariable("N8N_MCP_TOKEN", $token, "User")
    $env:N8N_MCP_TOKEN = $token

    Write-Host "N8N_MCP_TOKEN was updated for your Windows user and this PowerShell session."
    Write-Host "Restart any already-running Recode process before using the MCP server."
}
finally {
    if ($tokenPointer -ne [IntPtr]::Zero) {
        [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($tokenPointer)
    }

    if ($secureToken) {
        $secureToken.Dispose()
    }

    $token = $null
}
