# run-in-development-mode.ps1


$frontendPath = ".\frontend"
$backendPath = ".\backend"


Write-Host "Installing frontend dependencies..."
Push-Location $frontendPath
npm install
Pop-Location


Write-Host "Installing backend dependencies..."
Push-Location $backendPath
npm install
Pop-Location

# Iniciar ambos os servidores em janelas separadas
Write-Host "Starting frontend..."
Start-Process powershell -ArgumentList "cd $frontendPath; npm run dev" -WindowStyle Normal

Write-Host "Starting backend..."
Start-Process powershell -ArgumentList "cd $backendPath; npm run dev" -WindowStyle Normal