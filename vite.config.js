import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import fs from 'fs'
import path from 'path'

// Plugin que sincroniza dist/ con el .exe instalado para auto-recarga
function syncToReleasPlugin() {
  return {
    name: 'sync-to-release',
    closeBundle() {
      const src = path.resolve('dist');
      // Sincronizar con Carpeta de Proyecto
      const projectDest = path.resolve('release/resources/app/dist');
      // Sincronizar con Escritorio (EL REAL)
      const desktopDest = 'C:/Users/Hernan2d/OneDrive/Escritorio/Techzone ERP/resources/app/dist';

      const copyRecursive = (from, to) => {
        if (!fs.existsSync(to)) return; // Solo si existe la carpeta destino
        fs.readdirSync(from).forEach(file => {
          const s = path.join(from, file);
          const d = path.join(to, file);
          if (fs.statSync(s).isDirectory()) copyRecursive(s, d);
          else fs.copyFileSync(s, d);
        });
      };

      try {
        copyRecursive(src, projectDest);
        copyRecursive(src, desktopDest);
        
        // Sincronizar también la lógica de Electron y DB
        copyRecursive(path.resolve('electron'), 'C:/Users/Hernan2d/OneDrive/Escritorio/Techzone ERP/resources/app/electron');
        copyRecursive(path.resolve('db'), 'C:/Users/Hernan2d/OneDrive/Escritorio/Techzone ERP/resources/app/db');
        
        console.log('📦 Hot-Sync: App del escritorio (UI, Lógica y DB) actualizada ✓');
      } catch (e) {
        console.log('⚠️ Error al sincronizar (la app podría estar abierta con archivos bloqueados)');
      }
    }
  };
}

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react(), syncToReleasPlugin()],
  base: './', // Use relative paths for Electron to fix Blank Screen
})
