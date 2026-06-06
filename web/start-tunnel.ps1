do {
    Write-Host "Starting localtunnel..."
    npx localtunnel --port 3000 --subdomain kasirkuyk
    Write-Host "Tunnel crashed. Restarting in 5 seconds..."
    Start-Sleep -Seconds 5
} while ($true)
