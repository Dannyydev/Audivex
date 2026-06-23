const { execFile, spawn } = require('child_process');
const path = require('path');
const fs = require('fs').promises;
const { app } = require('electron');
const { processAudioChannels } = require('./audioProcessor');
const NodeID3 = require('node-id3');

class DownloadHandler {

  constructor(url, folder, window, options = {}, onComplete = null, onItemSuccess = null) {

    this.url = url;
    this.folder = folder;
    this.window = window;
    this.onComplete = onComplete;
    this.onItemSuccess = onItemSuccess;
    this.options = {
      usePlaylistThumbnail: false,
      ...options
    };
    this.playlistCoverPath = null;
    this.etaHistory = [];
    this.smoothedEta = 0;
    this.lastEtaUpdate = 0;
    this.maxProgress = 0; // Track maximum progress to prevent backward jumps

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

      this.downloadStartTime = Date.now();
      this.sendUpdate('status', "Préparation en cours...", '#0984e3');

      const info = await this.runCommand(this.ytDlpPath, [
        this.url,
        '--dump-single-json',
        '--flat-playlist',
        '--yes-playlist',
        '--ignore-errors',
        '--no-warnings',
        '--user-agent', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        '--extractor-args', 'youtube:player_client=web,android,mweb',
        '--no-check-certificates',
        '--geo-bypass',
      ]);

      const data = JSON.parse(info);

      const isPlaylist = data._type === 'playlist' || (data.entries && data.entries.length > 1);
      console.log(`[Start] Playlist détectée: ${isPlaylist}, Entries: ${data.entries?.length || 0}, Type: ${data._type}`);

      if (isPlaylist && this.options.thumbnail !== false && this.options.usePlaylistThumbnail) {
        let thumbUrl = data.thumbnail;

        if (!thumbUrl && data.thumbnails && data.thumbnails.length > 0) {
          const sortedThumbs = [...data.thumbnails].sort((a, b) =>
            ((b.width || 0) * (b.height || 0)) - ((a.width || 0) * (a.height || 0))
          );
          thumbUrl = sortedThumbs[0].url;
        }

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
            const response = await fetch(thumbUrl, {
              headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
              },
              signal: AbortSignal.timeout(10000)
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

      let processed = 0;
      let successCount = 0;
      let lastSuccessfulMetadata = null;
      const failures = [];

      const CONCURRENCY_LIMIT = 4;

      let currentIndex = 0;
      const workers = [];

      const worker = async () => {
        while (currentIndex < total) {
          const idx = currentIndex++;
          const entry = entries[idx];
          const index = idx + 1;

          try {
            const itemResult = await this.processItem(index, isPlaylist, entry, data.title, total);
            successCount++;
            if (this.onItemSuccess) this.onItemSuccess();
            if (!isPlaylist || total === 1) {
              lastSuccessfulMetadata = itemResult;
            }
          } catch (err) {
            console.error(`[Process Error] ${entry.title || entry.id}:`, err);
            failures.push({
              title: entry.title || entry.id || `Vidéo #${index}`,
              index: index,
              thumbnail: entry.thumbnail || (entry.thumbnails && entry.thumbnails[0]?.url) || ''
            });
          }
          processed++;
        }
      };

      for (let i = 0; i < Math.min(CONCURRENCY_LIMIT, total); i++) {
        workers.push(worker());
      }

      await Promise.allSettled(workers);

      if (failures.length === 0) {
        this.sendUpdate('complete', { isPlaylist: total > 1, total: successCount, lastDownloaded: lastSuccessfulMetadata, failures: [] });
      } else {
        if (successCount > 0) {
          const msg = `${successCount} terminés, ${failures.length} échec(s).`;
          this.sendUpdate('status', msg, '#e67e22');
          this.sendUpdate('complete', { isPlaylist: total > 1, total: successCount, lastDownloaded: lastSuccessfulMetadata, failures: failures });
        } else {
          this.sendUpdate('error', `${failures.length} échecs. Premier : ${failures[0].title}`);
        }
      }

    } catch (e) {
      console.error(e);
      this.sendUpdate('error', `Erreur: ${e.message}`);
    } finally {
      if (this.playlistCoverPath) {
        await this.safeUnlink(this.playlistCoverPath);
      }
      this.sendUpdate('finish');
    }
  }

  // Envoie la progression pour une étape d'un item (0.0 à 1.0 par item)
  sendItemProgress(index, total, stepProgress) {
    // Pour les playlists : progression cumulative globale (0-100% sur toute la playlist)
    // Pour un seul téléchargement : progression de l'item (0-100%)
    const globalPercent = total > 1
      ? ((index - 1) / total) * 100 + (stepProgress * 100 / total)
      : stepProgress * 100;

    // Ne jamais descendre en dessous du progrès maximum atteint (workers concurrents)
    const finalPercent = Math.max(globalPercent, this.maxProgress);
    this.maxProgress = finalPercent;

    // Calcul de l'ETA avec lissage exponentiel et fenêtre glissante
    let etaSeconds = 0;
    if (this.downloadStartTime && finalPercent >= 2) {
      const now = Date.now();

      // Throttle: ne pas mettre à jour l'ETA plus d'une fois par 1 seconde
      if (now - this.lastEtaUpdate < 1000 && this.smoothedEta > 0) {
        etaSeconds = Math.round(this.smoothedEta);
      } else {
        this.lastEtaUpdate = now;
        const elapsed = (now - this.downloadStartTime) / 1000;

        // Garder seulement l'historique des 15 dernières secondes
        this.etaHistory = this.etaHistory.filter(p => (now - p.time) < 15000);
        this.etaHistory.push({ time: now, progress: finalPercent });

        // Besoin d'au moins 2 points pour une estimation
        if (this.etaHistory.length >= 2) {
          const recent = this.etaHistory.slice(-3);
          const oldest = recent[0];
          const newest = recent[recent.length - 1];
          const timeDiff = (newest.time - oldest.time) / 1000;
          const progressDiff = newest.progress - oldest.progress;

          if (timeDiff >= 0.5 && progressDiff >= 0.5) {
            const rate = progressDiff / timeDiff;
            const remaining = 100 - finalPercent;
            const rawEta = remaining / rate;

            // Lissage exponentiel (alpha = 0.3)
            const alpha = 0.3;
            const previousEta = this.smoothedEta;
            this.smoothedEta = this.smoothedEta === 0 ? rawEta : (alpha * rawEta + (1 - alpha) * this.smoothedEta);

            // Clamp: ne pas changer l'ETA de plus de 40% d'un coup
            if (previousEta > 0 && this.smoothedEta > 0) {
              const maxChange = previousEta * 0.4;
              const minAllowed = previousEta - maxChange;
              const maxAllowed = previousEta + maxChange;
              this.smoothedEta = Math.max(minAllowed, Math.min(maxAllowed, this.smoothedEta));
            }

            etaSeconds = Math.max(0, Math.round(this.smoothedEta));
          }
        }
      }
    }

    this.sendUpdate('progress', Math.min(finalPercent, 100), index, total, etaSeconds);
  }

  async processItem(index, isPlaylist, entry, playlistTitle, total = 1) {
    const isMp4 = this.options.format === 'mp4';

    const extTemplate = isMp4 ? 'mp4' : '%(ext)s';
    const rawAudioTemplate = path.join(
      this.folder,
      `${String(index).padStart(3, '0')}_%(id)s.${extTemplate}`
    );

    const videoUrl = (isPlaylist && entry?.id) ? `https://www.youtube.com/watch?v=${entry.id}` : this.url;

    let finalDest = "";

    const ytDlpArgs = [
      videoUrl,
      '--ffmpeg-location', this.ffmpegPath,
      '--user-agent', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      '--extractor-args', 'youtube:player_client=web,android,mweb',
      '--no-check-certificates',
      '--no-warnings',
      '--sleep-interval', '2',
      '--max-sleep-interval', '5',
      '--retries', '10',
      '--fragment-retries', '10',
      '--concurrent-fragments', '1',
      '--force-ipv4',
      '--referer', 'https://www.youtube.com/',
    ];

    if (isMp4) {
      const q = this.options.videoQuality || 'best';
      const formatStr = q === 'best' ? 'bestvideo+bestaudio/best' : `bestvideo[height<=${q}]+bestaudio/best`;
      ytDlpArgs.push('-f', formatStr, '--merge-output-format', 'mp4');
      ytDlpArgs.push('--windows-filenames', '--no-mtime', '-o', rawAudioTemplate);

      // ⚠️ Les cookies du navigateur ne sont utilisés QUE si format MP4 ET sous-titres cochés
      if (isMp4 && this.options.subtitles === true) {
        ytDlpArgs.push('--write-subs', '--write-auto-subs', '--embed-subs', '--ignore-errors');
        const browser = this.options.subtitlesBrowser || 'chrome';
        ytDlpArgs.push('--cookies-from-browser', browser);
      }
    } else {
      ytDlpArgs.push(
        '-f', 'bestaudio/best',
        '-x',
        '--parse-metadata', 'playlist_title:%(album)s',
        '--write-info-json',
        '--windows-filenames',
        '--no-mtime',
        '-o', rawAudioTemplate
      );
      if (this.options.thumbnail && (!isPlaylist || !this.options.usePlaylistThumbnail || !this.playlistCoverPath)) {
        ytDlpArgs.push('--write-thumbnail', '--convert-thumbnails', 'jpg');
      }
    }

    try {
      if (isMp4) {
        // === ÉTAPES MP4 ===
        // Étape 1/5 : Téléchargement
        this.sendItemProgress(index, total, 0.05);
        await this.runCommand(this.ytDlpPath, ytDlpArgs);
        this.sendItemProgress(index, total, 0.40);

        const files = await fs.readdir(this.folder);
        const currentId = entry.id || '';

        const mp4File = files.find(f => f.includes(currentId) && f.endsWith('.mp4'));
        if (!mp4File) throw new Error(`Fichier vidéo non trouvé pour ${videoUrl}`);

        const fullRawPath = path.join(this.folder, mp4File);

        // Étape 2/5 : Métadonnées
        this.sendItemProgress(index, total, 0.50);
        const rawTitle = entry.title || `Vidéo ${index}`;
        const rawArtist = entry.uploader || entry.channel || '';
        const cleaned = this.cleanMetadata(rawTitle, rawArtist);

        // Étape 3/5 : Paroles (si coché)
        if (this.options.lyrics) {
          this.sendItemProgress(index, total, 0.60);
          try {
            await this.fetchLyricsData(cleaned.title, cleaned.artist, 0);
          } catch (_) { /* silencieux */ }
        }

        // Étape 4/5 : Renommage final
        this.sendItemProgress(index, total, 0.85);
        const finalBaseName = (cleaned.artist && cleaned.title)
          ? `${cleaned.artist} - ${cleaned.title}`
          : (cleaned.title || `Vidéo ${index}`);

        const safeFinalName = finalBaseName.replace(/[\\/:*?"<>|]/g, '_').trim() + '.mp4';
        finalDest = path.join(this.folder, safeFinalName);

        await fs.rename(fullRawPath, finalDest);

        // Terminé
        this.sendItemProgress(index, total, 1.0);

        return {
          title: cleaned.title,
          artist: cleaned.artist,
          thumbnail: null,
          finalDest: finalDest
        };

      } else {
        // === ÉTAPES MP3 ===
        // Étape 1/7 : Téléchargement audio
        this.sendItemProgress(index, total, 0.10);
        await this.runCommand(this.ytDlpPath, ytDlpArgs);
        this.sendItemProgress(index, total, 0.30);

        const files = await fs.readdir(this.folder);
        const currentId = entry.id || '';

        const rawAudioFile = files.find(f => f.includes(currentId) && !f.endsWith('.mp3') && !f.endsWith('.json') && !['.jpg', '.webp', '.png'].some(ext => f.endsWith(ext)));
        const infoJsonFile = files.find(f => f.includes(currentId) && f.endsWith('.info.json'));

        if (!rawAudioFile) throw new Error(`Fichier audio non trouvé pour ${videoUrl}`);

        // Étape 2/7 : Métadonnées + Paroles
        this.sendItemProgress(index, total, 0.35);
        let actualThumbPath = this.resolveThumbnailPath(files, currentId, isPlaylist);

        if (isPlaylist && this.options.usePlaylistThumbnail && !this.playlistCoverPath && actualThumbPath) {
          try {
            const fallbackPath = path.join(this.folder, `playlist_cover_fallback_${Date.now()}.jpg`);
            await fs.copyFile(actualThumbPath, fallbackPath);
            this.playlistCoverPath = fallbackPath;
            actualThumbPath = this.playlistCoverPath;
          } catch (err) {
            console.error("[Thumbnail Fallback] Erreur :", err);
          }
        }

        let metadata = { title: entry.title || '', artist: '' };

        if (infoJsonFile) {
          try {
            metadata = await this.extractAndCleanMetadata(infoJsonFile, index, playlistTitle);
            const raw = metadata._raw;

            if (this.options.lyrics && raw.title && raw.artist) {
              this.sendItemProgress(index, total, 0.45);
              const lyricsData = await this.fetchLyricsData(raw.title, raw.artist, raw.duration);
              if (lyricsData) {
                if (lyricsData.artistName && lyricsData.artistName !== raw.artist && this.options.artist) {
                  metadata.artist = lyricsData.artistName;
                }
                metadata.lyrics = lyricsData.synced || lyricsData.plain;
                metadata.plainLyrics = lyricsData.plain || lyricsData.synced;
              }
            }
          } catch (err) { console.error("Metadata error:", err); }
        }

        const fullRawPath = path.join(this.folder, rawAudioFile);
        const mp3BaseName = path.basename(rawAudioFile, path.extname(rawAudioFile));
        const fullMp3Path = path.join(this.folder, `${mp3BaseName}.mp3`);

        // Étape 3/7 : Conversion MP3 + Canaux
        this.sendItemProgress(index, total, 0.55);
        await processAudioChannels(fullRawPath, fullMp3Path, metadata, {
          ffmpegPath: this.ffmpegPath,
          ffprobePath: this.ffprobePath
        });
        this.sendItemProgress(index, total, 0.65);

        // Étape 4/7 : Intégration Miniature (si cochée)
        if (actualThumbPath && this.options.thumbnail !== false) {
          this.sendItemProgress(index, total, 0.70);
          const tempMp3Path = path.join(this.folder, `${mp3BaseName}_temp.mp3`);

          const ffmpegThumbArgs = [
            '-y', '-i', fullMp3Path, '-i', actualThumbPath,
            '-filter_complex', '[1:v]crop=min(iw\\,ih):min(iw\\,ih),scale=1000:1000:flags=lanczos[v]',
            '-map', '0:a', '-map', '[v]',
            '-map_metadata', '0',
            '-c:a', 'copy', '-c:v', 'mjpeg', '-q:v', '1', '-id3v2_version', '3',
            '-metadata:s:v', 'title=Album cover', '-disposition:v:0', 'attached_pic'
          ].concat(tempMp3Path);

          await this.runCommand(this.ffmpegPath, ffmpegThumbArgs);
          await fs.rename(tempMp3Path, fullMp3Path);
        }

        // Étape 5/7 : Injection finale des paroles
        const hasLyrics = this.options.lyrics && metadata.lyrics;
        if (hasLyrics) {
          this.sendItemProgress(index, total, 0.80);
          const tags = {
            title: metadata.title || undefined,
            artist: metadata.artist || undefined,
            albumArtist: metadata.albumArtist || metadata.artist || undefined,
            album: metadata.album || undefined,
            year: metadata.date || undefined,
            trackNumber: metadata.track || undefined,
            unsynchronisedLyrics: {
              language: 'eng',
              text: metadata.plainLyrics
            },
            comment: {
              language: 'eng',
              text: metadata.plainLyrics
            },
            partOfCompilation: isPlaylist && !this.options.usePlaylistThumbnail,
            userDefinedText: [
              { description: "LYRICS_SYNCED", value: metadata.lyrics }
            ]
          };
          NodeID3.update(tags, fullMp3Path);
        }

        // Étape 6/7 : Renommage final
        this.sendItemProgress(index, total, 0.90);
        const finalBaseName = (metadata.artist && metadata.title)
          ? `${metadata.artist} - ${metadata.title}`
          : (metadata.title || mp3BaseName);

        const safeFinalName = finalBaseName.replace(/[\\/:*?"<>|]/g, '_').trim() + '.mp3';
        finalDest = path.join(this.folder, safeFinalName);

        await fs.rename(fullMp3Path, finalDest);

        // Terminé
        this.sendItemProgress(index, total, 1.0);

        return {
          title: metadata.title,
          artist: metadata.artist,
          thumbnail: actualThumbPath,
          finalDest: finalDest
        };
      }
    } finally {
      // NETTOYAGE
      try {
        const currentId = entry.id || '';
        if (currentId && currentId.length > 5) {
          const remaining = await fs.readdir(this.folder);
          for (const file of remaining) {
            const fullPath = path.join(this.folder, file);
            if (file.includes(currentId) && fullPath !== finalDest) {
              await this.safeUnlink(fullPath);
            }
          }
        }
      } catch (e) { console.error("Cleanup error:", e); }
    }
  }

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
    if (this.options.artist) metadata.albumArtist = cleaned.artist;
    if (this.options.date) metadata.date = rawMeta.date;
    if (this.options.track) metadata.track = rawMeta.track;
    if (this.options.album) {
      metadata.album = (this.options.usePlaylistThumbnail ? playlistTitle : rawMeta.album) || playlistTitle;
      if (this.options.usePlaylistThumbnail) metadata.albumArtist = playlistTitle;
    }

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

  cleanMetadata(rawTitle, rawArtist) {
    let title = rawTitle;
    let artist = rawArtist;

    const separators = [' - ', ' – ', ' — ', ' | ', ' : '];
    for (const sep of separators) {
      if (title.includes(sep)) {
        const parts = title.split(sep);
        const potentialArtist = parts[0].trim();
        const potentialTitle = parts.slice(1).join(sep).trim();

        if (potentialArtist.length < 100) {
          artist = potentialArtist;
          title = potentialTitle;
          break;
        }
      }
    }

    const cleanup = (str) => {
      return str
        .replace(/[\(\[][^\]\)]*(official|video|audio|lyrics|lyric|clip|hq|hd|4k|8k|vevo|version|explicit|clean|visualizer|topic)[^\]\)]*[\)\]]/gi, '')
        .replace(/\s*[\-\|]\s*(official|video|audio|lyrics|lyric|clip|hq|hd|4k|8k|vevo|version|explicit|clean|visualizer|topic).*/gi, '')
        .replace(/\s+(?:ft\.?|feat\.?|featuring)\s+/gi, ', ')
        .replace(/\s{2,}/g, ' ')
        .trim();
    };

    artist = artist.replace(/\s*[-|]?\s*(vevo|topic|official|channel|music)\b.*/gi, '').trim();

    return {
      title: cleanup(title),
      artist: cleanup(artist)
    };
  }

  async fetchLyricsData(title, artist, duration) {
    try {
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

      cleanedTitle = cleanedTitle.replace(/\s*[\(\[][^\]\)]*(Music Video|Official|Lyrics|Audio)[^\]\)]*[\)\]]/gi, '');
      cleanedTitle = cleanedTitle.trim();

      const url = `https://lrclib.net/api/get?artist_name=${encodeURIComponent(artist)}&track_name=${encodeURIComponent(cleanedTitle)}&duration=${Math.round(duration)}`;
      const response = await fetch(url, { signal: AbortSignal.timeout(10000) });
      console.log(`[Lyrics Debug] URL LRCLIB (cleaned title): ${url}`);
      if (!response.ok) return null;

      const data = await response.json();

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

      console.log(`[Exec] Running: ${command}`, args);
      execFile(
        command,
        args,
        {
          maxBuffer: 1024 * 1024 * 50,
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