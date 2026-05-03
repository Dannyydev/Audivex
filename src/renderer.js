const urlInput = document.getElementById('urlInput');
const pasteBtn = document.getElementById('pasteBtn');
const downloadBtn = document.getElementById('downloadBtn');
const progressBar = document.getElementById('progressBar');
const statusLabel = document.getElementById('statusLabel');
const previewCard = document.getElementById('previewCard');
const previewThumb = document.getElementById('previewThumb');
const previewTitle = document.getElementById('previewTitle');
const previewMeta = document.getElementById('previewMeta');
const menuBtn = document.getElementById('menuBtn');
const optionsMenu = document.getElementById('optionsMenu');
const versionLabel = document.getElementById('versionLabel');
const playlistThumbOption = document.getElementById('playlistThumbOption');

// Liste des IDs des cases à cocher pour faciliter la gestion
const metadataCheckboxes = [
    'checkTitle', 'checkArtist', 'checkAlbum',
    'checkDate', 'checkTrack', 'checkThumb', 'checkPlaylistThumb', 'checkLyrics'
];

let debounceTimer; // Timer pour éviter trop de requêtes
let isCurrentPlaylist = false; // Etat global pour la réactivité du menu
// Regex unifiée pour éviter les duplications et incohérences
// Supporte : youtube.com, youtu.be, shorts, playlists, embeds
const YOUTUBE_REGEX = /^(https?:\/\/)?(www\.)?(youtube\.com|youtu\.be)\/(watch\?v=|playlist\?list=|embed\/|shorts\/)?[a-zA-Z0-9_-]{11,}/;

// Au chargement de la page
document.addEventListener('DOMContentLoaded', async () => {
    // 1. Charger les réglages sauvegardés
    loadSettings();

    try {
        const version = await window.api.getAppVersion();
        // On met à jour le titre qui contient la version dans le README
        document.querySelector('h1').title = `v${version}`;
        if (versionLabel) versionLabel.textContent = `v${version}`;

        // Cacher l'option playlist thumb par défaut au chargement
        if (playlistThumbOption) playlistThumbOption.style.display = 'none';

    } catch (e) { console.error("Failed to get app version", e); }
});

// --- Gestion du Menu Sandwich ---
menuBtn.addEventListener('click', (e) => {
    e.stopPropagation(); // Empêche la fermeture immédiate via le clic document
    optionsMenu.classList.toggle('show');
});

// Fermer le menu si on clique ailleurs
document.addEventListener('click', (e) => {
    if (!optionsMenu.contains(e.target) && e.target !== menuBtn) {
        optionsMenu.classList.remove('show');
    }
});

// --- Gestion de la Persistance (localStorage) ---
function loadSettings() {
    metadataCheckboxes.forEach(id => {
        const saved = localStorage.getItem(id);
        const el = document.getElementById(id);
        if (saved !== null && el) {
            el.checked = saved === 'true';
        }
    });
}

function saveSettings() {
    metadataCheckboxes.forEach(id => {
        const el = document.getElementById(id);
        if (el) {
            localStorage.setItem(id, el.checked);
        }
    });
}

// Ajouter l'écouteur de sauvegarde sur chaque checkbox
metadataCheckboxes.forEach(id => {
    document.getElementById(id)?.addEventListener('change', saveSettings);
});

// Mise à jour de la visibilité de la sous-option playlist
function updatePlaylistOptionVisibility() {
    if (!playlistThumbOption || !checkThumb) return;
    playlistThumbOption.style.display = (isCurrentPlaylist && checkThumb.checked) ? 'flex' : 'none';
}

// Désactiver "Pochette Playlist" si "Pochette" est décoché
const checkThumb = document.getElementById('checkThumb');
const checkPlaylistThumb = document.getElementById('checkPlaylistThumb');
if (checkThumb && checkPlaylistThumb) {
    checkThumb.addEventListener('change', () => {
        checkPlaylistThumb.disabled = !checkThumb.checked;
        if (!checkThumb.checked) checkPlaylistThumb.checked = false;
        updatePlaylistOptionVisibility();
        saveSettings();
    });
}

function updateStatus(text, type) {
    statusLabel.textContent = text;
    statusLabel.className = ''; // Réinitialise les classes
    if (type) {
        statusLabel.classList.add(type);
    }
}

// Fonctionnalité du bouton Coller
pasteBtn.addEventListener('click', async () => {
    try {
        const text = await navigator.clipboard.readText();
        urlInput.value = text;
        // On déclenche l'événement input manuellement pour les futures écoutes
        urlInput.dispatchEvent(new Event('input'));
    } catch (err) {
        updateStatus('Impossible de lire le presse-papier (accès refusé ?)', 'error');
    }
});

// Détection de la frappe pour la prévisualisation (Debounce)
urlInput.addEventListener('input', () => {
    const url = urlInput.value.trim();

    // On nettoie l'ancien timer si l'utilisateur continue d'écrire
    clearTimeout(debounceTimer);

    // Si le champ est vide, on cache la preview
    if (!url) {
        previewCard.style.display = 'none';
        isCurrentPlaylist = false;
        updatePlaylistOptionVisibility();
        return;
    }

    // On attend 300ms après la dernière frappe pour être réactif
    debounceTimer = setTimeout(async () => {
        if (YOUTUBE_REGEX.test(url)) {
            setPreviewState('loading');

            try {
                const info = await window.api.getVideoInfo(url);
                previewTitle.textContent = info.title;
                isCurrentPlaylist = !!info.isPlaylist;

                previewMeta.textContent = isCurrentPlaylist
                    ? (info.count ? `${info.count} titres` : "Playlist détectée")
                    : `${info.uploader}${info.duration ? ` • ${info.duration}` : ""}`;

                updatePlaylistOptionVisibility();
                previewThumb.src = info.thumbnail;
                previewThumb.style.opacity = "1";
            } catch (err) {
                setPreviewState('error');
            }
        }
    }, 300);
});

function setPreviewState(state) {
    previewCard.style.display = 'flex';
    previewThumb.style.opacity = "0.5";
    if (state === 'loading') {
        previewTitle.textContent = "Recherche des infos...";
        previewMeta.textContent = "Veuillez patienter...";
        isCurrentPlaylist = false;
        updatePlaylistOptionVisibility();
    } else if (state === 'error') {
        previewTitle.textContent = "Vidéo non trouvée";
        previewMeta.textContent = "Vérifiez le lien ou la visibilité.";
    }
}

downloadBtn.addEventListener('click', async () => {
    const url = urlInput.value.trim();

    if (!url || !YOUTUBE_REGEX.test(url)) {
        updateStatus("URL invalide.", 'error');
        return;
    }

    const folder = await window.api.selectFolder();
    if (!folder) return;

    downloadBtn.disabled = true;
    downloadBtn.classList.add('loading');
    downloadBtn.querySelector('span').textContent = 'Téléchargement...';
    progressBar.style.width = '0%';

    // Récupération des options de métadonnées
    const options = {
        title: document.getElementById('checkTitle')?.checked ?? true,
        artist: document.getElementById('checkArtist')?.checked ?? true,
        album: document.getElementById('checkAlbum')?.checked ?? true,
        date: document.getElementById('checkDate')?.checked ?? true,
        track: document.getElementById('checkTrack')?.checked ?? true,
        thumbnail: document.getElementById('checkThumb')?.checked ?? true,
        lyrics: document.getElementById('checkLyrics')?.checked ?? true,
        usePlaylistThumbnail: document.getElementById('checkPlaylistThumb')?.checked ?? false
    };

    window.api.startDownload({ url, folder, options });
});

window.api.onStatus((text, color) => {
    // Fait correspondre l'ancienne couleur à un nouveau type de statut
    let type = 'info';
    if (color === '#e74c3c') type = 'error';
    else if (color === '#00b894') type = 'success';
    updateStatus(text, type);
});

window.api.onProgress((percent, completed, total) => {
    progressBar.style.width = `${percent}%`;
    updateStatus(`Téléchargé : ${completed}/${total}`, 'info');
});

window.api.onComplete((result) => {
    progressBar.style.width = '100%';
    const text = result.isPlaylist
        ? `Téléchargement de la playlist terminé ! (${result.total} vidéos).`
        : "Téléchargement terminé ! 🎧";
    updateStatus(text, 'success');
});

window.api.onError((msg) => {
    updateStatus(msg, 'error');
});

window.api.onFinish(() => {
    downloadBtn.disabled = false;
    downloadBtn.classList.remove('loading');
    downloadBtn.querySelector('span').textContent = 'Télécharger';
});

// Gestion de l'affichage des mises à jour
window.api.onUpdateMsg((text, type) => {
    updateStatus(text, type);
});
