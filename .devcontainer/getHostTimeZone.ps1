$env:TZ = [Windows.Globalization.Calendar,Windows.Globalization,ContentType=WindowsRuntime]::New().GetTimeZone()
[Environment]::SetEnvironmentVariable('TZ', "$env:TZ", 'Process')
[Environment]::SetEnvironmentVariable('TZ', "$env:TZ", 'User')
Write-Host "Host timezone: $env:TZ"