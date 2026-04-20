Write-Host "🚀 Iniciando conexión con GitHub..." -ForegroundColor Cyan

# 1. Init
if (-not (Test-Path .git)) {
    git init
    Write-Host "✅ Repositorio inicializado." -ForegroundColor Green
}

# 2. Add
git add .
Write-Host "✅ Archivos agregados." -ForegroundColor Green

# 3. Commit
git commit -m "🚀 Techzone ERP v1.1.5 - Sincronización Web y Desktop (Cache Purge)"
Write-Host "✅ Punto de control creado." -ForegroundColor Green

# 4. Branch
git branch -M main
Write-Host "✅ Rama principal configurada." -ForegroundColor Green

# 5. Remote
if (git remote) {
    git remote remove origin
}
git remote add origin https://github.com/HernanT23/Techzone-POS.git
Write-Host "✅ Conectado a GitHub (Hernan2d/Techzone-POS)." -ForegroundColor Green

# 6. Push
Write-Host "📤 Subiendo archivos a GitHub... (Es posible que se abra una ventana de login)" -ForegroundColor Yellow
git push -u origin main

Write-Host "`n✨ ¡PROCESO COMPLETADO! ✨" -ForegroundColor Green
Write-Host "Ya puedes cerrar esta ventana."
pause
