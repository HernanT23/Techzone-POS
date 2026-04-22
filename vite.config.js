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
      // Sincronizar con Instalación Real en AppData (DESBLOQUEADA)
      const desktopDest = 'C:/Users/Hernan2d/AppData/Local/Programs/valery-pos/resources/app/dist';

      const copyRecursive = (from, to) => {
        if (!fs.existsSync(to)) return; // Only sync if the folder exists (manual unlocking)
        fs.readdirSync(from).forEach(file => {
          const s = path.join(from, file);
          const d = path.join(to, file);
          if (fs.statSync(s).isDirectory()) copyRecursive(s, d);
          else fs.copyFileSync(s, d);
        });
      };

      try {
        if (fs.existsSync(src)) {
           copyRecursive(src, projectDest);
           copyRecursive(src, desktopDest);
        }
        
        // Sincronizar también la lógica de Electron y DB
        const appRoot = 'C:/Users/Hernan2d/AppData/Local/Programs/valery-pos/resources/app';
        copyRecursive(path.resolve('electron'), path.join(appRoot, 'electron'));
        copyRecursive(path.resolve('db'), path.join(appRoot, 'db'));
        fs.copyFileSync(path.resolve('package.json'), path.join(appRoot, 'package.json'));
        
        console.log('📦 Hot-Sync: App del escritorio (Desbloqueada) actualizada ✓');
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
