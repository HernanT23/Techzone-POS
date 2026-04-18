$WshShell = New-Object -ComObject WScript.Shell
$DesktopPath = [System.Environment]::GetFolderPath('Desktop')
$Shortcut = $WshShell.CreateShortcut("$DesktopPath\Techzone ERP.lnk")
$Shortcut.TargetPath = "C:\Techzone_POS\release\Techzone ERP-portable.exe"
$Shortcut.WorkingDirectory = "C:\Techzone_POS\release"
$Shortcut.IconLocation = "C:\Techzone_POS\release\Techzone ERP-portable.exe,0"
$Shortcut.Save()

Write-Host "✅ Acceso directo creado en el escritorio."
