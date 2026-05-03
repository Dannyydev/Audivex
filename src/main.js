const { app, BrowserWindow, ipcMain, dialog, Notification } = require('electron');
const { autoUpdater } = require('electron-updater');
const { execFile } = require('child_process');
const path = require('path');
const DownloadHandler = require('./downloadHandler');

let mainWindow;

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 960,
    height: 700,
    minWidth: 320, // Conserve la largeur minimale actuelle
    minHeight: 380, // Augmente la hauteur minimale pour accommoder le contenu et le padding
    backgroundColor: '#f8f9fa',
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      nodeIntegration: false,
      contextIsolation: true
    },
    autoHideMenuBar: true
  });

  mainWindow.loadFile(path.join(__dirname, 'index.html'));

  mainWindow.on('closed', () => {
    mainWindow = null;
  });

  // Gestion des mises à jour automatiques
  if (app.isPackaged) {
    // Vérifier les mises à jour immédiatement au lancement
    autoUpdater.checkForUpdates();
  }
}

// Initialisation des événements d'update en dehors de createWindow pour éviter les doublons
if (app.isPackaged) {
  const sendUpdateMsg = (text, type) => {
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.send('update-msg', text, type);
    }
  };

  autoUpdater.on('checking-for-update', () => sendUpdateMsg('Reherche des mises à jour...', 'info'));

  autoUpdater.on('update-available', (info) => {
    sendUpdateMsg(`Version (v${info.version}) disponible et est en cours de téléchargement`, 'info');
  });

  autoUpdater.on('error', (err) => {
    console.error('Update error:', err);
    sendUpdateMsg('Erreur de mise à jour. Vérifiez votre connexion ou contactez le support.', 'error');
  });

  autoUpdater.on('update-downloaded', (info) => {
    sendUpdateMsg('Mise à jour téléchargée. Redémarrez l\'application pour l\'appliquer.', 'success');
    const notif = new Notification({
      title: `La version v${info.version} est prête`,
      body: `Cliquez ici pour installer la mise à jour et passer sur Audivex.`,
    });
    notif.on('click', () => autoUpdater.quitAndInstall());
    notif.show();
  });
}

app.whenReady().then(createWindow);

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow();
  }
});

// Gestionnaires IPC (Communication Front <-> Back)
ipcMain.handle('select-folder', async () => {
  if (!mainWindow || mainWindow.isDestroyed()) return null;
  const result = await dialog.showOpenDialog(mainWindow, {
    properties: ['openDirectory']
  });
  return result.filePaths[0];
});

/** Helper for yt-dlp metadata extraction */
async function getMetadataViaYtDlp(url) {
  const resourcePath = app.isPackaged
    ? path.join(process.resourcesPath, 'bin')
    : path.join(__dirname, '..', 'bin');
  const binaryName = process.platform === 'win32' ? 'yt-dlp.exe' : 'yt-dlp';
  const ytDlpPath = path.join(resourcePath, binaryName);

  const args = [url, '--dump-single-json', '--flat-playlist', '--no-warnings'];

  return new Promise((resolve, reject) => {
    execFile(ytDlpPath, args, { maxBuffer: 1024 * 1024 * 10 }, (error, stdout, stderr) => {
      if (error) return reject(stderr || error.message);
      try {
        const data = JSON.parse(stdout);
        const isPlaylist = data._type === 'playlist';
        resolve({
          isPlaylist,
          title: data.title,
          thumbnail: isPlaylist
            ? (data.thumbnail || data.thumbnails?.slice(-1)[0]?.url || data.entries?.[0]?.thumbnail)
            : data.thumbnail,
          uploader: data.uploader || data.channel || '',
          count: data.entries?.length || 0,
          duration: data.duration_string || '--:--'
        });
      } catch (e) { reject("Format de données invalide"); }
    });
  });
}

// Récupération des métadonnées (Prévisualisation)
ipcMain.handle('get-video-info', async (event, url) => {
  // --- FAST PATH: Tentative via oEmbed (YouTube API publique) ---
  if ((url.includes('youtube.com') || url.includes('youtu.be'))) {
    try {
      const oembedUrl = `https://www.youtube.com/oembed?url=${encodeURIComponent(url)}&format=json`;
      const res = await fetch(oembedUrl);
      if (!res.ok) throw new Error();

      const data = await res.json();
      const isPlaylist = url.includes('list=');

      // Fallback vers yt-dlp si oEmbed manque de miniatures pour les playlists
      if (isPlaylist && !data.thumbnail_url) throw new Error();

      return {
        isPlaylist,
        title: data.title,
        thumbnail: data.thumbnail_url,
        uploader: data.author_name,
        count: isPlaylist ? null : 0,
        duration: null
      };
    } catch {
      // Silence error, continue to slow path
    }
  }

  // --- SLOW PATH: yt-dlp ---
  try {
    return await getMetadataViaYtDlp(url);
  } catch (err) {
    console.error("Metadata extraction failed:", err);
    throw new Error("Impossible de récupérer les informations de la vidéo.");
  }
});

ipcMain.on('start-download', (event, { url, folder, options }) => {
  if (!mainWindow || mainWindow.isDestroyed()) return;
  const handler = new DownloadHandler(url, folder, mainWindow, options);
  handler.start();
});

// Pour appliquer la mise à jour si l'utilisateur le demande (optionnel, sinon ça se fait au prochain lancement)
ipcMain.on('restart-app', () => {
  autoUpdater.quitAndInstall();
});

ipcMain.handle('get-app-version', () => {
  return app.getVersion();
});
