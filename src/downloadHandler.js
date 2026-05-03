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
          // Tri pour obtenir la plus haute résolution possible
          const sortedThumbs = [...data.thumbnails].sort((a, b) =>
            ((b.width || 0) * (b.height || 0)) - ((a.width || 0) * (a.height || 0))
          );
          thumbUrl = sortedThumbs[0].url;
        }

        // Fallback pour YouTube Music / Playlists où la miniature est dans les entries
        if (!thumbUrl && data.entries && data.entries[0]) {
          const first = data.entries[0];
          const thumbs = first.thumbnails || [];
          thumbUrl = first.thumbnail || (thumbs.length > 0
            ? [...thumbs].sort((a, b) => ((b.width || 0) * (b.height || 0)) - ((a.width || 0) * (a.height || 0)))[0].url
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

      this.sendUpdate('status', total > 1 ? `Playlist de ${total} vidéos trouvée.` : 'Vidéo trouvée.', '#0984e3');

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
    const videoUrl = (isPlaylist && entry?.id) ? `https://www.youtube.com/watch?v=${entry.id}` : this.url;

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

    // On télécharge la miniature par track si :
    // 1. L'option thumbnail est cochée ET
    // 2. (On n'est pas en mode playlist OU l'option usePlaylistThumbnail n'est pas cochée OU on n'a pas encore de pochette globale)
    if (this.options.thumbnail && (!isPlaylist || !this.options.usePlaylistThumbnail || !this.playlistCoverPath)) {
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
      let actualThumbPath = this.resolveThumbnailPath(files, currentId, isPlaylist);

      // Stratégie de repli : si on voulait la pochette de playlist mais qu'elle manque,
      // on utilise la pochette de ce titre comme nouvelle pochette "globale" pour toute la playlist.
      if (isPlaylist && this.options.usePlaylistThumbnail && !this.playlistCoverPath && actualThumbPath) {
        try {
          const fallbackPath = path.join(this.folder, `playlist_cover_fallback_${Date.now()}.jpg`);
          await fs.copyFile(actualThumbPath, fallbackPath);
          this.playlistCoverPath = fallbackPath;
          console.log(`[Thumbnail Fallback] Pochette du titre utilisée comme pochette de playlist : ${this.playlistCoverPath}`);
          // On met à jour le chemin actuel pour utiliser ce nouveau fichier "global" stable
          actualThumbPath = this.playlistCoverPath;
        } catch (err) {
          console.error("[Thumbnail Fallback] Erreur lors de la création du fallback :", err);
        }
      }

      console.log(`[Thumbnail Debug] Utilisation de la miniature : ${actualThumbPath}`);

      let metadata = { title: entry.title || '', artist: '' };

      if (infoJsonFile) {
        try {
          metadata = await this.extractAndCleanMetadata(infoJsonFile, index, playlistTitle);
          const raw = metadata._raw;

          console.log(`[Lyrics Debug] Option 'Paroles' activée: ${this.options.lyrics}`);
          // Récupération des paroles avant le traitement audio
          if (this.options.lyrics && raw.title && raw.artist) {
            console.log(`[Lyrics Debug] Tentative de récupération des paroles pour: "${raw.title}" par "${raw.artist}" (Durée: ${raw.duration}s)`);
            const lyricsData = await this.fetchLyricsData(raw.title, raw.artist, raw.duration);
            if (lyricsData) {
              console.log(`[Lyrics Debug] Paroles récupérées avec succès (Synced: ${!!lyricsData.synced}, Plain: ${!!lyricsData.plain}).`);
              // Si LRCLIB a trouvé un artiste plus précis, on le met à jour
              if (lyricsData.artistName && lyricsData.artistName !== raw.artist && this.options.artist) {
                metadata.artist = lyricsData.artistName;
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
          // Crop au centre pour faire un carré + Redimensionnement HD 1000x1000 avec filtre Lanczos
          '-filter_complex', '[1:v]crop=min(iw\\,ih):min(iw\\,ih),scale=1000:1000:flags=lanczos[v]',
          '-map', '0:a', '-map', '[v]',
          '-map_metadata', '0', // Copie explicite de toutes les métadonnées (incl. paroles)
          '-c:a', 'copy', '-c:v', 'mjpeg', '-q:v', '1', '-id3v2_version', '3',
          '-metadata:s:v', 'title=Album cover', '-disposition:v:0', 'attached_pic'
        ].concat(tempMp3Path);

        await this.runCommand(this.ffmpegPath, ffmpegThumbArgs);
        await fs.rename(tempMp3Path, fullMp3Path);
      }

      // 3.5 Injection finale des paroles (Passage dédié après tout traitement FFmpeg)
      const hasLyrics = this.options.lyrics && metadata.lyrics;
      if (hasLyrics) {
        console.log(`[Lyrics Debug] Injection finale des paroles via node-id3 (USLT + COMM)...`);

        const tags = {
          artist: metadata.artist,
          albumArtist: metadata.albumArtist || metadata.artist,
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
          // Flag Compilation (TCMP) : aide Apple Music à regrouper si c'est une playlist variée
          partOfCompilation: isPlaylist && !this.options.usePlaylistThumbnail,
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

  /** Resolve which thumbnail to use based on options and availability */
  resolveThumbnailPath(files, currentId, isPlaylist) {
    if (isPlaylist && this.options.usePlaylistThumbnail && this.playlistCoverPath) {
      return this.playlistCoverPath;
    }
    if (this.options.thumbnail) {
      const thumbFile = files.find(f => f.includes(currentId) && ['.jpg', '.webp', '.png'].some(ext => f.endsWith(ext)));
      return thumbFile ? path.join(this.folder, thumbFile) : null;
    }
    return null;
  }

  /** Logic to extract, clean and filter metadata based on user options */
  async extractAndCleanMetadata(infoJsonFile, index, playlistTitle) {
    const content = await fs.readFile(path.join(this.folder, infoJsonFile), 'utf8');
    const info = JSON.parse(content);

    const rawMeta = {
      title: info.title || '',
      artist: info.uploader || info.channel || info.webpage_url_domain || '',
      date: info.upload_date ? info.upload_date.substring(0, 4) : '',
      album: info.playlist_title || playlistTitle || '',
      track: info.playlist_index || index,
      duration: info.duration || 0
    };

    const cleaned = this.cleanMetadata(rawMeta.title, rawMeta.artist);

    const metadata = {};
    if (this.options.title) metadata.title = cleaned.title;
    if (this.options.artist) metadata.artist = cleaned.artist;
    if (this.options.artist) metadata.albumArtist = cleaned.artist; // Important pour Apple Music
    if (this.options.date) metadata.date = rawMeta.date;
    if (this.options.track) metadata.track = rawMeta.track;
    if (this.options.album) {
      metadata.album = (this.options.usePlaylistThumbnail ? playlistTitle : rawMeta.album) || playlistTitle;
      if (this.options.usePlaylistThumbnail) metadata.albumArtist = playlistTitle; // Uniformise l'album
    }

    // On attache la durée et les versions nettoyées pour le traitement ultérieur (lyrics)
    metadata._raw = { ...cleaned, duration: rawMeta.duration };

    return metadata;
  }

  async safeUnlink(filePath) {
    try {
      await fs.access(filePath);
      await fs.unlink(filePath);
    } catch {
      // File doesn't exist or already removed
    }
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