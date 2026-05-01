const { execFile } = require('child_process');
const path = require('path');
const fs = require('fs').promises;
const { app } = require('electron');
const { processAudioChannels } = require('./audioProcessor'); // Importez le nouveau module
const NodeID3 = require('node-id3'); // Outil spécialisé pour les tags ID3

class DownloadHandler {

  constructor(url, folder, window, options = {}) {

    this.url = url;
    this.folder = folder;
    this.window = window;
    this.options = {
      usePlaylistThumbnail: false, // Par défaut, utilise la miniature de chaque titre
      ...options
    };
    this.playlistCoverPath = null;

    const resourcePath = app.isPackaged
      ? path.join(process.resourcesPath, 'bin')
      : path.join(__dirname, '..', 'bin');

    const ytDlpBinary = process.platform === 'win32' ? 'yt-dlp.exe' : 'yt-dlp';
    const ffmpegBinary = process.platform === 'win32' ? 'ffmpeg.exe' : 'ffmpeg';
    const ffprobeBinary = process.platform === 'win32' ? 'ffprobe.exe' : 'ffprobe';

    this.ytDlpPath = path.join(resourcePath, ytDlpBinary);
    this.ffmpegPath = path.join(resourcePath, ffmpegBinary);
    this.ffprobePath = path.join(resourcePath, ffprobeBinary);
  }

  sendUpdate(channel, ...args) {
    if (this.window && !this.window.isDestroyed()) {
      this.window.webContents.send(channel, ...args);
    }
  }

  async start() {

    try {

      this.sendUpdate('status', "Préparation en cours...", '#0984e3');

      const info = await this.runCommand(this.ytDlpPath, [
        this.url,
        '--dump-single-json',
        '--flat-playlist',
        '--yes-playlist'
      ]);

      const data = JSON.parse(info);

      // Une playlist peut être identifiée par son type ou par la présence d'entrées multiples
      const isPlaylist = data._type === 'playlist' || (data.entries && data.entries.length > 1);
      console.log(`[Start] Playlist détectée: ${isPlaylist}, Entries: ${data.entries?.length || 0}, Type: ${data._type}`);

      // Si c'est une playlist et que l'utilisateur veut la miniature globale
      if (isPlaylist && this.options.thumbnail !== false && this.options.usePlaylistThumbnail) {
        // Stratégie robuste pour trouver la pochette de l'album/playlist
        let thumbUrl = data.thumbnail;

        if (!thumbUrl && data.thumbnails && data.thumbnails.length > 0) {
          thumbUrl = data.thumbnails.reduce((prev, curr) =>
            ((prev.width || 0) * (prev.height || 0) > (curr.width || 0) * (curr.height || 0)) ? prev : curr
          ).url;
        }

        // Fallback pour YouTube Music / Playlists où la miniature est dans les entries
        if (!thumbUrl && data.entries && data.entries[0]) {
          const first = data.entries[0];
          thumbUrl = first.thumbnail || (first.thumbnails && first.thumbnails.length > 0
            ? first.thumbnails.reduce((prev, curr) => ((prev.width || 0) * (prev.height || 0) > (curr.width || 0) * (curr.height || 0)) ? prev : curr).url
            : null);
        }

        console.log(`[Thumbnail] URL détectée pour la playlist: ${thumbUrl}`);

        if (thumbUrl) {
          this.sendUpdate('status', "Téléchargement de la miniature de la playlist...", '#0984e3');
          const tempPath = path.join(this.folder, `playlist_cover_${Date.now()}.jpg`);
          try {
            // Ajout d'un User-Agent pour éviter d'être bloqué par YouTube
            const response = await fetch(thumbUrl, {
              headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
              }
            });
            if (response.ok) {
              const arrayBuffer = await response.arrayBuffer();
              await fs.writeFile(tempPath, Buffer.from(arrayBuffer));
              this.playlistCoverPath = tempPath;
              this.sendUpdate('status', "Pochette de playlist récupérée ✅", '#0984e3');
              console.log(`[Thumbnail] Pochette enregistrée: ${this.playlistCoverPath}`);
            }
          } catch (err) {
            console.error("[Thumbnail] Erreur téléchargement miniature playlist:", err);
          }
        }
      }

      const entries = isPlaylist ? (data.entries || []) : [data];
      const total = entries.length;

      if (total === 0) throw new Error("Aucune vidéo trouvée.");

      const message = total > 1
        ? `Playlist de ${total} vidéos trouvée.`
        : 'Vidéo trouvée.';

      this.sendUpdate('status', message, '#0984e3');

      let completed = 0;
      const errors = [];

      const CONCURRENCY_LIMIT = 8;
      const chunks = [];

      for (let i = 0; i < total; i += CONCURRENCY_LIMIT) {
        chunks.push(entries.slice(i, i + CONCURRENCY_LIMIT));
      }

      this.sendUpdate('progress', 0, 0, total);

      let currentIndex = 1;

      for (const chunk of chunks) {

        const promises = chunk.map((entry, idx) => {

          const index = currentIndex + idx;

          return this.processItem(index, isPlaylist, entry, data.title)
            .then(() => {

              completed++;

              const percent = (completed / total) * 100;

              this.sendUpdate('progress', percent, completed, total);

            })
            .catch(err => {

              console.error(err);
              errors.push(err.message);

            });

        });

        await Promise.allSettled(promises);

        currentIndex += chunk.length;

      }

      if (errors.length === 0) {
        this.sendUpdate('complete', { isPlaylist: total > 1, total });
      } else {
        this.sendUpdate('error', `${errors.length} échecs. Premier: ${errors[0]}`);
      }

    } catch (e) {

      console.error(e);
      this.sendUpdate('error', `Erreur: ${e.message}`);

    } finally {
      // Nettoyage de la miniature de playlist globale
      if (this.playlistCoverPath) {
        await this.safeUnlink(this.playlistCoverPath);
      }

      this.sendUpdate('finish');

    }

  }

  async processItem(index, isPlaylist, entry, playlistTitle) {
    // Utilisation impérative de %(id)s pour éviter les erreurs de système de fichiers Windows
    const rawAudioTemplate = path.join(
      this.folder,
      `${String(index).padStart(3, '0')}_%(id)s.%(ext)s` // Assure que le nom de fichier temporaire est sûr
    );

    // On utilise l'URL directe de la vidéo (via son ID) pour isoler les métadonnées
    const videoUrl = (isPlaylist && entry && entry.id)
      ? `https://www.youtube.com/watch?v=${entry.id}`
      : this.url;

    const filePrefix = `${String(index).padStart(3, '0')}_${entry.id || ''}`; // Utilisé pour le nettoyage
    let finalDest = "";

    const ytDlpArgs = [
      videoUrl,
      '--ffmpeg-location', this.ffmpegPath,
      '-f', 'bestaudio/best',
      '-x',
      '--parse-metadata', 'playlist_title:%(album)s',
      '--write-info-json',
      '--windows-filenames',
      '--no-mtime',
      '-o', rawAudioTemplate
    ];

    // On ne télécharge la miniature par track QUE SI l'option pochette playlist n'est PAS activée.
    // Cela évite de télécharger des images inutiles et la confusion quand les deux boutons sont cochés.
    if (this.options.thumbnail && !this.options.usePlaylistThumbnail) {
      ytDlpArgs.push('--write-thumbnail', '--convert-thumbnails', 'jpg');
    }

    try {
      // 1. Téléchargement
      await this.runCommand(this.ytDlpPath, ytDlpArgs);

      const files = await fs.readdir(this.folder);

      // Recherche des fichiers basée sur l'ID pour être 100% sûr de ne pas se tromper avec les titres
      const currentId = entry.id || '';
      const rawAudioFile = files.find(f => f.includes(currentId) && !f.endsWith('.mp3') && !f.endsWith('.json') && !['.jpg', '.webp', '.png'].some(ext => f.endsWith(ext)));
      const infoJsonFile = files.find(f => f.includes(currentId) && f.endsWith('.info.json'));

      if (!rawAudioFile) throw new Error(`Fichier audio non trouvé pour ${videoUrl}`);

      // Détermination de la miniature à utiliser :
      // 1. Si "Pochette Playlist" est coché, on utilise EXCLUSIVEMENT celle-ci.
      let actualThumbPath = null;
      if (this.options.usePlaylistThumbnail) {
        actualThumbPath = this.playlistCoverPath;
      }
      // 2. Sinon, si l'option "Pochette" générale est active, on cherche la miniature du titre.
      else if (this.options.thumbnail) {
        const thumbFile = files.find(f => f.includes(currentId) && (f.endsWith('.jpg') || f.endsWith('.webp') || f.endsWith('.png')));
        if (thumbFile) actualThumbPath = path.join(this.folder, thumbFile);
      }
      console.log(`[Thumbnail Debug] Utilisation de la miniature: ${actualThumbPath}`);

      // 1.1 Métadonnées
      let metadata = {};
      let durationSec = 0;
      if (infoJsonFile) {
        try {
          const content = await fs.readFile(path.join(this.folder, infoJsonFile), 'utf8');
          const info = JSON.parse(content);
          const fullMetadata = {
            title: info.title || '',
            artist: info.uploader || info.channel || info.webpage_url_domain || '',
            date: info.upload_date ? info.upload_date.substring(0, 4) : '',
            album: info.playlist_title || playlistTitle || '',
            track: info.playlist_index || index
          };
          durationSec = info.duration || 0;

          // --- NETTOYAGE DES MÉTADONNÉES (LOGIQUE INTERNE REGEX) ---
          const cleaned = this.cleanMetadata(fullMetadata.title, fullMetadata.artist);
          fullMetadata.title = cleaned.title;
          fullMetadata.artist = cleaned.artist;
          console.log(`[Cleaner] Metadata final : ${fullMetadata.artist} - ${fullMetadata.title}`);

          // Filtrage selon les options choisies par l'utilisateur
          if (this.options.title) metadata.title = fullMetadata.title;
          if (this.options.artist) metadata.artist = fullMetadata.artist;
          if (this.options.date) metadata.date = fullMetadata.date;
          if (this.options.album) {
            // Si on utilise la pochette de la playlist, on uniformise l'album sur le titre de la playlist pour Apple Music
            metadata.album = (this.options.usePlaylistThumbnail ? playlistTitle : fullMetadata.album) || playlistTitle;
          }
          if (this.options.track) metadata.track = fullMetadata.track;

          console.log(`[Lyrics Debug] Option 'Paroles' activée: ${this.options.lyrics}`);
          // Récupération des paroles avant le traitement audio
          if (this.options.lyrics && fullMetadata.title && fullMetadata.artist) {
            console.log(`[Lyrics Debug] Tentative de récupération des paroles pour: "${fullMetadata.title}" par "${fullMetadata.artist}" (Durée: ${durationSec}s)`);
            const lyricsData = await this.fetchLyricsData(fullMetadata.title, fullMetadata.artist, durationSec);
            if (lyricsData) {
              console.log(`[Lyrics Debug] Paroles récupérées avec succès (Synced: ${!!lyricsData.synced}, Plain: ${!!lyricsData.plain}).`);
              // Si LRCLIB a trouvé un artiste plus précis, on le met à jour
              if (lyricsData.artistName && lyricsData.artistName !== fullMetadata.artist && this.options.artist) {
                metadata.artist = lyricsData.artistName;
                console.log(`[Lyrics Debug] Artiste mis à jour via LRCLIB: ${lyricsData.artistName}`);
              }
              metadata.lyrics = lyricsData.synced || lyricsData.plain;
              metadata.plainLyrics = lyricsData.plain || lyricsData.synced;
            } else { console.log(`[Lyrics Debug] Aucune parole trouvée.`); }
          }

        } catch (err) { console.error("Metadata error:", err); }
      }

      const fullRawPath = path.join(this.folder, rawAudioFile);
      const mp3BaseName = path.basename(rawAudioFile, path.extname(rawAudioFile));
      const fullMp3Path = path.join(this.folder, `${mp3BaseName}.mp3`);

      // 2. Conversion MP3 + Canaux + Métadonnées
      await processAudioChannels(fullRawPath, fullMp3Path, metadata, {
        ffmpegPath: this.ffmpegPath,
        ffprobePath: this.ffprobePath
      });

      // 3. Intégration Miniature (support JPG et WEBP)
      if (actualThumbPath && this.options.thumbnail !== false) {
        const tempMp3Path = path.join(this.folder, `${mp3BaseName}_temp.mp3`);

        const ffmpegThumbArgs = [
          '-y', '-i', fullMp3Path, '-i', actualThumbPath,
          '-filter_complex', '[1:v]crop=min(iw\\,ih):min(iw\\,ih):(iw-min(iw\\,ih))/2:(ih-min(iw\\,ih))/2[v]',
          '-map', '0:a', '-map', '[v]',
          '-map_metadata', '0', // Copie explicite de toutes les métadonnées (incl. paroles)
          '-c:a', 'copy', '-c:v', 'mjpeg', '-id3v2_version', '3',
          '-metadata:s:v', 'title=Album cover', '-disposition:v:0', 'attached_pic'
        ];
        ffmpegThumbArgs.push(tempMp3Path);

        await this.runCommand(this.ffmpegPath, ffmpegThumbArgs);
        await fs.rename(tempMp3Path, fullMp3Path);
      }

      // 3.5 Injection finale des paroles (Passage dédié après tout traitement FFmpeg)
      if (this.options.lyrics && metadata.lyrics) {
        console.log(`[Lyrics Debug] Injection finale des paroles via node-id3 (USLT + COMM)...`);

        const tags = {
          // 'unsynchronisedLyrics' crée le vrai frame USLT pour Apple Music / Lecteur Windows
          unsynchronisedLyrics: {
            language: 'eng',
            text: metadata.plainLyrics
          },
          // On double dans 'comment' pour que ce soit visible dans Windows (Propriétés > Détails)
          comment: {
            language: 'eng',
            text: metadata.plainLyrics
          },
          // Stockage de la version synchronisée pour les lecteurs qui le supportent
          userDefinedText: [
            { description: "LYRICS_SYNCED", value: metadata.lyrics }
          ]
        };

        const success = NodeID3.update(tags, fullMp3Path);
        console.log(`[Lyrics Debug] Résultat de l'injection node-id3: ${success ? 'Succès' : 'Échec'}`);
      }

      // 4. Renommage final sans le préfixe
      const finalBaseName = (metadata.artist && metadata.title)
        ? `${metadata.artist} - ${metadata.title}`
        : (metadata.title || mp3BaseName); // Utilise le titre nettoyé ou le nom de base si le titre est vide

      // Sécurisation du nom de fichier pour Windows (suppression des caractères interdits)
      const safeFinalName = finalBaseName.replace(/[\\/:*?"<>|]/g, '_').trim() + '.mp3';
      finalDest = path.join(this.folder, safeFinalName);

      await fs.rename(fullMp3Path, finalDest);

      return true;
    } finally {
      // 5. NETTOYAGE : basé sur l'ID pour ne pas supprimer les mauvais fichiers
      try {
        const currentId = entry.id || ''; // Assure que currentId est défini
        const remaining = await fs.readdir(this.folder);
        for (const file of remaining) {
          const fullPath = path.join(this.folder, file);
          if (file.includes(currentId) && fullPath !== finalDest) {
            await this.safeUnlink(fullPath);
          }
        }
      } catch (e) { console.error("Cleanup error:", e); }
    }
  }

  async safeUnlink(filePath) {

    await fs.unlink(filePath).catch(() => { });

  }

  /**
   * Nettoie intelligemment le titre et l'artiste sans IA.
   * Sépare "Artiste - Titre" et retire les termes parasites.
   */
  cleanMetadata(rawTitle, rawArtist) {
    let title = rawTitle;
    let artist = rawArtist;

    // 1. Détection du format "Artiste - Titre" dans le titre YouTube
    const separators = [' - ', ' – ', ' — ', ' | ', ' : '];
    for (const sep of separators) {
      if (title.includes(sep)) {
        const parts = title.split(sep);
        const potentialArtist = parts[0].trim();
        const potentialTitle = parts.slice(1).join(sep).trim();

        // On vérifie que la première partie n'est pas trop longue pour être un artiste (sécurité)
        if (potentialArtist.length < 100) {
          artist = potentialArtist;
          title = potentialTitle;
          break;
        }
      }
    }

    // 2. Fonction de nettoyage générique par Regex
    const cleanup = (str) => {
      return str
        // Supprime tout ce qui est entre parenthèses ou crochets contenant des mots clés
        .replace(/[\(\[][^\]\)]*(official|video|audio|lyrics|lyric|clip|hq|hd|4k|8k|vevo|version|explicit|clean|visualizer|topic)[^\]\)]*[\)\]]/gi, '')
        // Supprime les suffixes après un tiret ou une barre si ce sont des termes parasites
        .replace(/\s*[\-\|]\s*(official|video|audio|lyrics|lyric|clip|hq|hd|4k|8k|vevo|version|explicit|clean|visualizer|topic).*/gi, '')
        // Nettoyage des "featuring" : on les transforme en virgule pour uniformiser (ex: "Artiste ft. Autre" -> "Artiste, Autre")
        .replace(/\s+(?:ft\.?|feat\.?|featuring)\s+/gi, ', ')
        // Nettoie les espaces multiples
        .replace(/\s{2,}/g, ' ')
        .trim();
    };

    // 3. Nettoyage final de l'artiste (on enlève VEVO ou "Topic")
    artist = artist.replace(/\s*[-|]?\s*(vevo|topic|official|channel|music)\b.*/gi, '').trim();

    return {
      title: cleanup(title),
      artist: cleanup(artist)
    };
  }

  async fetchLyricsData(title, artist, duration) {
    try {
      // 1. Nettoyage du titre (Suppression de l'artiste si présent au début)
      let cleanedTitle = title;
      const separators = [' - ', ' – ', ' — ', ': '];

      for (const sep of separators) {
        if (cleanedTitle.toLowerCase().includes(artist.toLowerCase() + sep.toLowerCase())) {
          const parts = cleanedTitle.split(new RegExp(sep, 'i'));
          if (parts.length > 1) {
            cleanedTitle = parts.slice(1).join(sep);
            break;
          }
        }
      }

      // 2. Nettoyage des suffixes inutiles
      cleanedTitle = cleanedTitle.replace(/\s*[\(\[][^\]\)]*(Music Video|Official|Lyrics|Audio)[^\]\)]*[\)\]]/gi, '');
      cleanedTitle = cleanedTitle.trim();

      // LRCLIB est une API gratuite et performante pour les paroles LRC
      const url = `https://lrclib.net/api/get?artist_name=${encodeURIComponent(artist)}&track_name=${encodeURIComponent(cleanedTitle)}&duration=${Math.round(duration)}`;
      const response = await fetch(url);
      console.log(`[Lyrics Debug] URL LRCLIB (cleaned title): ${url}`);
      if (!response.ok) return null;

      const data = await response.json();

      // Regex améliorée pour supprimer tous les formats de timestamps [00:00.00], [00:00:00], [00:00], etc.
      const plain = data.plainLyrics || (data.syncedLyrics
        ? data.syncedLyrics.replace(/\[\d+:\d+[\.:]?\d*\]/g, '').replace(/\n{2,}/g, '\n').trim()
        : null);

      return {
        synced: data.syncedLyrics,
        plain: plain
      };
    } catch (e) {
      console.error("[Lyrics] Fetch failed:", e.message);
      return null;
    }
  }

  runCommand(command, args) {

    return new Promise((resolve, reject) => {

      console.log(`[Exec] Running: ${command}`, args); // Log the array directly
      execFile(
        command,
        args,
        {
          maxBuffer: 1024 * 1024 * 10,
          windowsHide: true
        },
        (error, stdout, stderr) => {

          if (error) {
            reject(new Error(stderr || stdout || error.message));
            return;
          }

          resolve(stdout);

        }
      );

    });

  }

}

module.exports = DownloadHandler;