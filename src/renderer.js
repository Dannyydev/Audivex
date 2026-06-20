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
const downloadCompleteCard = document.getElementById('downloadCompleteCard');
const downloadCompleteThumb = document.getElementById('downloadCompleteThumb');
const downloadCompleteTitle = document.getElementById('downloadCompleteTitle');
const settingsBtn = document.getElementById('settingsBtn'); // New: Reference to the settings button
const settingsModal = document.getElementById('settingsModal');
const closeSettings = document.getElementById('closeSettings');
const container = document.querySelector('.container');
const failedDownloadsContainer = document.getElementById('failedDownloadsContainer');
const playlistThumbOption = document.getElementById('playlistThumbOption');
const languageSelectionOverlay = document.getElementById('languageSelectionOverlay'); // New
const initialLanguageSelect = document.getElementById('initialLanguageSelect'); // New
const confirmLanguageBtn = document.getElementById('confirmLanguageBtn'); // New

// New Elements for MP4
const formatRadios = document.querySelectorAll('.format-radio');
const videoQualitySelect = document.getElementById('videoQualitySelect');
const mp3Options = document.getElementById('mp3Options');
const mp4Options = document.getElementById('mp4Options');
const checkSubtitles = document.getElementById('checkSubtitles');

// Localization strings
const languageStrings = {
    'fr': {
        // Main UI
        urlInputPlaceholder: "Collez votre lien YouTube ici...",
        pasteBtnTitle: "Coller depuis le presse-papier",
        downloadBtnText: "Télécharger",
        statusReady: "Prêt à télécharger",
        settingsBtnTitle: "Paramètres généraux",
        menuBtnTitle: "Options de métadonnées",

        // Options Menu
        checkTitle: "Titre",
        checkArtist: "Artiste",
        checkAlbum: "Album",
        checkDate: "Année",
        checkTrack: "N° Piste",
        checkThumb: "Pochette",
        checkPlaylistThumb: "Pochette Playlist",
        checkLyrics: "Paroles",

        // Preview Card
        previewLoadingTitle: "Recherche des infos...",
        previewLoadingMeta: "Veuillez patienter...",
        previewNotFoundTitle: "Vidéo non trouvée",
        previewNotFoundMeta: "Vérifiez le lien ou la visibilité.",
        playlistDetected: "Playlist détectée",
        titlesCount: "titres", // e.g., "3 titres"
        videoPrefix: "Vidéo #", // for failure card meta
        notAvailable: "Non disponible", // for failure card meta

        // Settings Modal
        settingsModalTitle: "Paramètres d'Audivex",
        autoUpdateSetting: "Rechercher les mises à jour automatiquement",
        languageSetting: "Langue de l'interface",

        // Initial Language Selection
        initialLanguageSelectionTitle: "Choisissez votre langue",
        initialLanguageSelectionDescription: "Veuillez sélectionner la langue de l'interface pour Audivex.",
        initialLanguageLabel: "Langue de l'interface",
        confirmLanguageButton: "Continuer",

        // Format & Quality
        videoQualityLabel: "Qualité vidéo :",
        optQualityBest: "Meilleure qualité",
        labelSubtitles: "Sous-titres (si disponible)",

        // TOS Overlay

        tosWelcome: "Bienvenue sur Audivex !",
        tosDescription: "Pour continuer, veuillez confirmer avoir pris connaissance de nos documents légaux.<br>Vous devez avoir lu les conditions d'utilisation et la politique de confidentialité afin de comprendre les autorisations et les règles encadrant l'utilisation d'Audivex.",
        tosPrivacy: "J'ai lu la <a href=\"https://audivex.fr/Confidentialite\" class=\"tos-link\">politique de confidentialité</a>",
        tosConditions: "J'accepte les <a href=\"https://audivex.fr/Conditions\" class=\"tos-link\">conditions d'utilisation</a>",
        tosValidate: "Valider et continuer",

        // Status messages (from renderer.js)
        invalidUrl: "URL invalide.",
        clipboardError: "Impossible de lire le presse-papier (accès refusé ?)",
        downloading: "Téléchargement...",
        downloaded: "Téléchargé :",
        playlistDownloadComplete: "Téléchargement de la playlist terminé !",
        videos: "vidéos",
        downloadComplete: "Téléchargement terminé ! 🎧",
        failedDownloadsHeader: "Échecs de téléchargement :"
    },
    'en': {
        // Main UI
        urlInputPlaceholder: "Paste your YouTube link here...",
        pasteBtnTitle: "Paste from clipboard",
        downloadBtnText: "Download",
        statusReady: "Ready to download",
        settingsBtnTitle: "General Settings",
        menuBtnTitle: "Metadata Options",

        // Options Menu
        checkTitle: "Title",
        checkArtist: "Artist",
        checkAlbum: "Album",
        checkDate: "Year",
        checkTrack: "Track No.",
        checkThumb: "Thumbnail",
        checkPlaylistThumb: "Playlist Thumbnail",
        checkLyrics: "Lyrics",

        // Preview Card
        previewLoadingTitle: "Searching info...",
        previewLoadingMeta: "Please wait...",
        previewNotFoundTitle: "Video not found",
        previewNotFoundMeta: "Check the link or visibility.",
        playlistDetected: "Playlist detected",
        titlesCount: "titles",
        videoPrefix: "Video #",
        notAvailable: "Not available",

        // Settings Modal
        settingsModalTitle: "Audivex Settings",
        autoUpdateSetting: "Check for updates automatically",
        languageSetting: "Interface language",

        // Initial Language Selection
        initialLanguageSelectionTitle: "Choose your language",
        initialLanguageSelectionDescription: "Please select the interface language for Audivex.",
        initialLanguageLabel: "Interface language",
        confirmLanguageButton: "Continue",

        // Format & Quality
        videoQualityLabel: "Video Quality:",
        optQualityBest: "Best quality",
        labelSubtitles: "Subtitles (if available.)",

        // TOS Overlay

        tosWelcome: "Welcome to Audivex!",
        tosDescription: "To continue, please confirm that you have read our legal documents.<br>You must have read the terms of use and the privacy policy to understand the permissions and rules governing the use of Audivex.",
        tosPrivacy: "I have read the <a href=\"https://audivex.fr/Confidentialite\" class=\"tos-link\">privacy policy</a>",
        tosConditions: "I accept the <a href=\"https://audivex.fr/Conditions\" class=\"tos-link\">terms of use</a>",
        tosValidate: "Validate and continue",

        // Status messages
        invalidUrl: "Invalid URL.",
        clipboardError: "Could not read clipboard (access denied?)",
        downloading: "Downloading...",
        downloaded: "Downloaded:",
        playlistDownloadComplete: "Playlist download complete!",
        videos: "videos",
        downloadComplete: "Download complete! 🎧",
        failedDownloadsHeader: "Download failures:"
    },
    'es': {
        // Main UI
        urlInputPlaceholder: "Pega tu enlace de YouTube aquí...",
        pasteBtnTitle: "Pegar desde el portapapeles",
        downloadBtnText: "Descargar",
        statusReady: "Listo para descargar",
        settingsBtnTitle: "Ajustes generales",
        menuBtnTitle: "Opciones de metadatos",

        // Options Menu
        checkTitle: "Título",
        checkArtist: "Artista",
        checkAlbum: "Álbum",
        checkDate: "Año",
        checkTrack: "Nº Pista",
        checkThumb: "Portada",
        checkPlaylistThumb: "Portada de la lista",
        checkLyrics: "Letras",

        // Preview Card
        previewLoadingTitle: "Buscando información...",
        previewLoadingMeta: "Por favor, espere...",
        previewNotFoundTitle: "Video no encontrado",
        previewNotFoundMeta: "Verifique el enlace o la visibilidad.",
        playlistDetected: "Lista de reproducción detectada",
        titlesCount: "títulos",
        videoPrefix: "Video #",
        notAvailable: "No disponible",

        // Settings Modal
        settingsModalTitle: "Ajustes de Audivex",
        autoUpdateSetting: "Buscar actualizaciones automáticamente",
        languageSetting: "Idioma de la interfaz",

        // Initial Language Selection
        initialLanguageSelectionTitle: "Elige tu idioma",
        initialLanguageSelectionDescription: "Por favor, selecciona el idioma de la interfaz para Audivex.",
        initialLanguageLabel: "Idioma de la interfaz",
        confirmLanguageButton: "Continuar",

        // Format & Quality
        videoQualityLabel: "Calidad de video:",
        optQualityBest: "Mejor calidad",
        labelSubtitles: "Subtítulos (si está disponible)",

        // TOS Overlay

        tosWelcome: "¡Bienvenido a Audivex!", // Welcome to Audivex!
        tosDescription: "Para continuar, confirme que ha leído nuestros documentos legales.<br>Debe haber leído las condiciones de uso y la política de privacidad para comprender los permisos y las reglas que rigen el uso de Audivex.", // To continue, please confirm that you have read our legal documents. You must have read the terms of use and the privacy policy to understand the permissions and rules governing the use of Audivex.
        tosPrivacy: "He leído la <a href=\"https://audivex.fr/Confidentialite\" class=\"tos-link\">política de privacidad</a>", // I have read the privacy policy
        tosConditions: "Acepto las <a href=\"https://audivex.fr/Conditions\" class=\"tos-link\">condiciones de uso</a>", // I accept the terms of use
        tosValidate: "Validar y continuar",

        // Status messages
        invalidUrl: "URL no válida.",
        downloading: "Descargando...",
        downloadComplete: "¡Descarga completada! 🎧"
    },
    'it': {
        // Main UI
        urlInputPlaceholder: "Incolla il tuo link YouTube qui...",
        pasteBtnTitle: "Incolla dal clipboard",
        downloadBtnText: "Scarica",
        statusReady: "Pronto per il download",
        settingsBtnTitle: "Impostazioni generali",
        menuBtnTitle: "Opzioni metadati",

        // Options Menu
        checkTitle: "Titolo",
        checkArtist: "Artista",
        checkAlbum: "Album",
        checkDate: "Anno",
        checkTrack: "N° Traccia",
        checkThumb: "Copertina",
        checkPlaylistThumb: "Copertina Playlist",
        checkLyrics: "Testo",

        // Preview Card
        previewLoadingTitle: "Ricerca info...",
        previewLoadingMeta: "Attendere prego...",
        previewNotFoundTitle: "Video non trovato",
        previewNotFoundMeta: "Verifica il link o la visibilità.",
        playlistDetected: "Playlist rilevata",
        titlesCount: "titoli", // e.g., "3 titres"
        videoPrefix: "Video #", // for failure card meta
        notAvailable: "Non disponibile", // for failure card meta

        // Settings Modal
        settingsModalTitle: "Impostazioni di Audivex",
        autoUpdateSetting: "Ricerca aggiornamenti automaticamente",
        languageSetting: "Lingua dell'interfaccia",

        // Initial Language Selection
        initialLanguageSelectionTitle: "Scegli la tua lingua",
        initialLanguageSelectionDescription: "Per favore, seleziona la lingua dell'interfaccia per Audivex.",
        initialLanguageLabel: "Lingua dell'interfaccia",
        confirmLanguageButton: "Continuare",

        // Format & Quality
        videoQualityLabel: "Qualità video :",
        optQualityBest: "Migliore qualità",
        labelSubtitles: "Sottotitoli (se disponibile)",

        // TOS Overlay

        tosWelcome: "Benvenuto su Audivex!",
        tosDescription: "Per continuare, si prega di confermare di aver preso conoscenza dei nostri documenti legali.<br>È necessario aver letto i termini di utilizzo e la politica sulla privacy per comprendere le autorizzazioni e le regole che disciplinano l'uso di Audivex.",
        tosPrivacy: "Ho letto la <a href=\"https://audivex.fr/Confidentialite\" class=\"tos-link\">politica sulla privacy</a>",
        tosConditions: "Accetto i <a href=\"https://audivex.fr/Conditions\" class=\"tos-link\">termini di utilizzo</a>",
        tosValidate: "Conferma e continua",

        // Status messages (from renderer.js)
        invalidUrl: "URL non valido.",
        clipboardError: "Impossibile leggere dagli appunti (accesso negato?)",
        downloading: "Download...",
        downloaded: "Scaricato :",
        playlistDownloadComplete: "Download della playlist completato!",
        videos: "video",
        downloadComplete: "Download completato! 🎧",
        failedDownloadsHeader: "Download falliti :"
    },
    'de': {
        // Main UI
        urlInputPlaceholder: "Füge deinen YouTube-Link hier ein...",
        pasteBtnTitle: "Aus der Zwischenablage einfügen",
        downloadBtnText: "Herunterladen",
        statusReady: "Bereit zum Herunterladen",
        settingsBtnTitle: "Allgemeine Einstellungen",
        menuBtnTitle: "Metadaten-Optionen",

        // Options Menu
        checkTitle: "Titel",
        checkArtist: "Künstler",
        checkAlbum: "Album",
        checkDate: "Jahr",
        checkTrack: "Nr. Titel",
        checkThumb: "Deckblatt",
        checkPlaylistThumb: "Copertina Playlist",
        checkLyrics: "Liedtext",

        // Preview Card
        previewLoadingTitle: "Suche Infos...",
        previewLoadingMeta: "Bitte warten...",
        previewNotFoundTitle: "Video nicht gefunden",
        previewNotFoundMeta: "Überprüfe den Link oder die Sichtbarkeit.",
        playlistDetected: "Playlist detected",
        titlesCount: "Titel", // e.g., "3 titres"
        videoPrefix: "Video #", // for failure card meta
        notAvailable: "Nicht verfügbar", // for failure card meta

        // Settings Modal
        settingsModalTitle: "Einstellungen von Audivex",
        autoUpdateSetting: "Automatische Suche nach Updates",
        languageSetting: "Sprache der Oberfläche",

        // Initial Language Selection
        initialLanguageSelectionTitle: "Wähle deine Sprache",
        initialLanguageSelectionDescription: "Bitte wähle die Sprache der Oberfläche für Audivex.",
        initialLanguageLabel: "Sprache der Oberfläche",
        confirmLanguageButton: "Fortfahren",

        // Format & Quality
        videoQualityLabel: "Videoqualität:",
        optQualityBest: "Beste Qualität",
        labelSubtitles: "Untertitel (falls verfügbar)",

        // TOS Overlay

        tosWelcome: "Willkommen bei Audivex!",
        tosDescription: "Um fortzufahren, bestätigen Sie bitte, dass Sie unsere rechtlichen Dokumente gelesen haben.<br>Sie müssen die Nutzungsbedingungen und die Datenschutzrichtlinie gelesen haben, um die Berechtigungen und Regeln zu verstehen, die die Nutzung von Audivex regeln.",
        tosPrivacy: "Ich habe die <a href=\"https://audivex.fr/Confidentialite\" class=\"tos-link\">Datenschutzrichtlinie</a> gelesen",
        tosConditions: "Ich akzeptiere die <a href=\"https://audivex.fr/Conditions\" class=\"tos-link\">Nutzungsbedingungen</a>",
        tosValidate: "Fortfahren",

        // Status messages (from renderer.js)
        invalidUrl: "Ungültige URL.",
        clipboardError: "Clipboard kann nicht gelesen werden (Zugriff verweigert?)",
        downloading: "Herunterladen...",
        downloaded: "Heruntergeladen :",
        playlistDownloadComplete: "Playlist-Download abgeschlossen!",
        videos: "Videos",
        downloadComplete: "Download abgeschlossen! 🎧",
        failedDownloadsHeader: "Fehlgeschlagene Downloads :"
    },
    'ru': {
        // Main UI
        urlInputPlaceholder: "Вставьте вашу ссылку на YouTube сюда...",
        pasteBtnTitle: "Вставить из буфера обмена",
        downloadBtnText: "Скачать",
        statusReady: "Готов к скачиванию",
        settingsBtnTitle: "Общие настройки",
        menuBtnTitle: "Опции метаданных",

        // Options Menu
        checkTitle: "Название",
        checkArtist: "Артист",
        checkAlbum: "Альбом",
        checkDate: "Год",
        checkTrack: "Номер трека",
        checkThumb: "Обложка",
        checkPlaylistThumb: "Обложка плейлиста",
        checkLyrics: "Текст песни",

        // Preview Card
        previewLoadingTitle: "Поиск информации...",
        previewLoadingMeta: "Пожалуйста, подождите...",
        previewNotFoundTitle: "Видео не найдено",
        previewNotFoundMeta: "Проверьте ссылку или видимость.",
        playlistDetected: "Обнаружен плейлист",
        titlesCount: "Titel", // e.g., "3 titres"
        videoPrefix: "Видео #", // for failure card meta
        notAvailable: "Недоступно", // for failure card meta

        // Settings Modal
        settingsModalTitle: "Настройки Audivex",
        autoUpdateSetting: "Автоматический поиск обновлений",
        languageSetting: "Язык интерфейса",

        // Initial Language Selection
        initialLanguageSelectionTitle: "Выберите язык",
        initialLanguageSelectionDescription: "Пожалуйста, выберите язык интерфейса для Audivex.",
        initialLanguageLabel: "Язык интерфейса",
        confirmLanguageButton: "Продолжить",

        // Format & Quality
        videoQualityLabel: "Качество видео:",
        optQualityBest: "Лучшее качество",
        labelSubtitles: "Субтитры (если доступны)",

        // TOS Overlay

        tosWelcome: "Добро пожаловать в Audivex!",
        tosDescription: "Чтобы продолжить, пожалуйста, подтвердите, что вы ознакомились с нашими правовыми документами.<br>Вы должны прочитать условия использования и политику конфиденциальности, чтобы понять разрешения и правила, регулирующие использование Audivex.",
        tosPrivacy: "Я прочитал <a href=\"https://audivex.fr/Confidentialite\" class=\"tos-link\">политику конфиденциальности</a>",
        tosConditions: "Я принимаю <a href=\"https://audivex.fr/Conditions\" class=\"tos-link\">условия использования</a>",
        tosValidate: "Продолжить",

        // Status messages (from renderer.js)
        invalidUrl: "Неверный URL.",
        clipboardError: "Не удалось прочитать буфер обмена (отказ в доступе?)",
        downloading: "Загрузка...",
        downloaded: "Загружено :",
        playlistDownloadComplete: "Загрузка плейлиста завершена!",
        videos: "Видео",
        downloadComplete: "Загрузка завершена! 🎧",
        failedDownloadsHeader: "Не удалось загрузить :"
    },
    'ja': {
        // Main UI
        urlInputPlaceholder: "ここにYouTubeリンクを貼り付けてください...",
        pasteBtnTitle: "クリップボードから貼り付ける",
        downloadBtnText: "ダウンロード",
        statusReady: "ダウンロード準備完了",
        settingsBtnTitle: "一般設定",
        menuBtnTitle: "メタデータオプション",

        // Options Menu
        checkTitle: "タイトル",
        checkArtist: "アーティスト",
        checkAlbum: "アルバム",
        checkDate: "年",
        checkTrack: "トラック番号",
        checkThumb: "カバー画像",
        checkPlaylistThumb: "プレイリストのカバー",
        checkLyrics: "歌詞",

        // Preview Card
        previewLoadingTitle: "情報の検索中...",
        previewLoadingMeta: "少々お待ちください...",
        previewNotFoundTitle: "動画が見つかりません",
        previewNotFoundMeta: "リンクを確認するか、動画が公開されているか確認してください。",
        playlistDetected: "プレイリストが検出されました",
        titlesCount: "タイトル",
        videoPrefix: "動画 #",
        notAvailable: "利用不可",

        // Settings Modal
        settingsModalTitle: "Audivexの設定",
        autoUpdateSetting: "自動更新チェック",
        languageSetting: "インターフェース言語",

        // Initial Language Selection
        initialLanguageSelectionTitle: "言語を選択してください",
        initialLanguageSelectionDescription: "Audivexのインターフェース言語を選択してください。",
        initialLanguageLabel: "インターフェース言語",
        confirmLanguageButton: "続行",

        // Format & Quality
        videoQualityLabel: "動画の品質:",
        optQualityBest: "最高品質",
        labelSubtitles: "字幕（利用可能な場合）",

        // TOS Overlay
        tosWelcome: "Audivexへようこそ！",
        tosDescription: "続行するには、当社の法的文書を確認したことを確認してください。<br>Audivexの使用を規定する許可と規則を理解するには、利用規約とプライバシーポリシーを読む必要があります。",
        tosPrivacy: "私は<a href=\"https://audivex.fr/Confidentialite\" class=\"tos-link\">プライバシーポリシー</a>を読みました",
        tosConditions: "私は<a href=\"https://audivex.fr/Conditions\" class=\"tos-link\">利用規約</a>に同意します",
        tosValidate: "続行",

        // Status messages (from renderer.js)
        invalidUrl: "無効なURLです。",
        clipboardError: "クリップボードを読み取れませんでした（アクセス拒否？）",
        downloading: "ダウンロード中...",
        downloaded: "ダウンロード完了：",
        playlistDownloadComplete: "プレイリストのダウンロードが完了しました！",
        videos: "動画",
        downloadComplete: "ダウンロード完了！ 🎧",
        failedDownloadsHeader: "ダウンロードに失敗しました："
    }

};

// Helper function for translation
const _t = (key) => languageStrings[currentLanguage][key] || key;

// List of checkbox IDs for easier management
const metadataCheckboxes = [
    'checkTitle', 'checkArtist', 'checkAlbum',
    'checkDate', 'checkTrack', 'checkThumb', 'checkPlaylistThumb', 'checkLyrics'
]; // Existing metadata options
const userSettingsCheckboxes = ['disableAutoUpdates'];

let debounceTimer; // Timer pour éviter trop de requêtes
let isCurrentPlaylist = false; // Etat global pour la réactivité du menu
// Regex unifiée pour éviter les duplications et incohérences
// Supporte : youtube.com, youtu.be, shorts, playlists, embeds
const YOUTUBE_REGEX = /^(https?:\/\/)?(www\.)?(youtube\.com|youtu\.be)\/(watch\?v=|playlist\?list=|embed\/|shorts\/)?[a-zA-Z0-9_-]{11,}/;

let currentLanguage = localStorage.getItem('appLanguage') || 'en'; // Default to English for the very first run
const languageSelect = document.getElementById('languageSelect');

// Au chargement de la page
document.addEventListener('DOMContentLoaded', async () => {
    // 1. Charger les réglages sauvegardés (pour currentLanguage)
    loadSettings();

    applyTranslations(); // Apply translations on load

    // Cacher la carte de téléchargement terminé au démarrage
    if (downloadCompleteCard) downloadCompleteCard.style.display = 'none';

    try {
        const version = await window.api.getAppVersion();
        // On met à jour le titre qui contient la version dans le README
        document.querySelector('h1').title = `v${version}`;
        if (versionLabel) versionLabel.textContent = `v${version}`;

        // Set initial language select value
        if (languageSelect) languageSelect.value = currentLanguage;
        languageSelect?.addEventListener('change', handleLanguageChange);

        // Cacher l'option playlist thumb par défaut au chargement
        if (playlistThumbOption) playlistThumbOption.style.display = 'none';

        // --- Gestion de l'overlay TOS et de la sélection de langue initiale ---
        const tosOverlay = document.getElementById('tosOverlay');
        const checkPrivacy = document.getElementById('checkPrivacy');
        const checkConditions = document.getElementById('checkConditions');
        const tosBtn = document.getElementById('tosBtn');
        const acceptedVersion = localStorage.getItem('acceptedVersion');

        // Si la version enregistrée diffère de la version actuelle, on affiche l'overlay
        if (acceptedVersion !== version) {
            // First, show the language selection overlay
            languageSelectionOverlay.style.display = 'flex';
            container.classList.add('blurred');

            // Apply translations to the language selection overlay immediately
            applyTranslations();

            // Set initial value of the initialLanguageSelect
            if (initialLanguageSelect) initialLanguageSelect.value = currentLanguage;

            initialLanguageSelect?.addEventListener('change', (e) => {
                currentLanguage = e.target.value;
                saveSettings(); // Save the chosen language immediately
                applyTranslations(); // Apply translations to the language selection modal itself
            });

            confirmLanguageBtn?.addEventListener('click', () => {
                languageSelectionOverlay.style.display = 'none';
                // Then, show the TOS overlay
                tosOverlay.style.display = 'flex';
                // Apply translations to the TOS overlay now that language is chosen
                applyTranslations();

                const updateTOSBtn = () => {
                    tosBtn.disabled = !(checkPrivacy.checked && checkConditions.checked);
                };

                checkPrivacy.addEventListener('change', updateTOSBtn);
                checkConditions.addEventListener('change', updateTOSBtn);
                updateTOSBtn(); // Initial check

                tosBtn.addEventListener('click', () => {
                    localStorage.setItem('acceptedVersion', version);
                    tosOverlay.style.display = 'none';
                    container.classList.remove('blurred');
                });

                tosOverlay.querySelectorAll('a').forEach(link => {
                    link.addEventListener('click', (e) => { e.preventDefault(); window.api.openExternal(link.href); });
                });
            });
        } else {
            // If TOS already accepted, just apply translations to the whole UI
            applyTranslations();
        }

        // Initialisation des boutons sociaux ici pour être sûr que le DOM est prêt
        document.querySelectorAll('.social-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.preventDefault();
                const url = btn.getAttribute('href');
                window.api.openExternal(url);
            });
        });

    } catch (e) { console.error("Failed to get app version", e); }
});

// --- Gestion du Menu Sandwich ---
menuBtn.addEventListener('click', (e) => { // Existing event listener for the options menu
    e.stopPropagation(); // Empêche la fermeture immédiate via le clic document
    optionsMenu.classList.toggle('show');
});
menuBtn.title = _t('menuBtnTitle');

settingsBtn.addEventListener('click', (e) => { // New event listener for the settings button
    settingsModal.classList.add('show');
    container.classList.add('blurred');
    optionsMenu.classList.remove('show'); // Close metadata menu if open
});

closeSettings.addEventListener('click', () => {
    settingsModal.classList.remove('show');
    container.classList.remove('blurred');
});

// Fermer le menu si on clique ailleurs
document.addEventListener('click', (e) => {
    if (!optionsMenu.contains(e.target) && e.target !== menuBtn) {
        optionsMenu.classList.remove('show');
    }
    if (e.target === settingsModal) {
        settingsModal.classList.remove('show');
        container.classList.remove('blurred');
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
    // Load user settings from localStorage
    userSettingsCheckboxes.forEach(id => {
        const saved = localStorage.getItem(id);
        const el = document.getElementById(id);
        if (saved !== null && el) {
            el.checked = saved === 'true';
        }
    });
    const savedLanguage = localStorage.getItem('appLanguage');
    if (savedLanguage) {
        currentLanguage = savedLanguage;
    }

    // Load format and quality settings
    const savedFormat = localStorage.getItem('formatOption') || 'mp3';
    document.querySelector(`input[name="format"][value="${savedFormat}"]`).checked = true;
    const savedQuality = localStorage.getItem('videoQualitySelect') || 'best';
    if (videoQualitySelect) videoQualitySelect.value = savedQuality;
    updateFormatUI(savedFormat);

    // Initialiser le choix pour les mises à jour auto au backend
    const disableAutoUpdatesCheckbox = document.getElementById('disableAutoUpdates');
    if (disableAutoUpdatesCheckbox && window.api && window.api.setAutoUpdatePreference) {
        // Attention : si la case s'appelle "Rechercher automatiquement" mais a pour ID "disableAutoUpdates",
        // il se peut que la logique soit inversée. Actuellement on envoie l'état tel quel.
        // On force un petit délai pour être sûr que le main process écoute
        setTimeout(() => {
            window.api.setAutoUpdatePreference(disableAutoUpdatesCheckbox.checked);
        }, 500);
    }
}

function saveSettings() {
    metadataCheckboxes.forEach(id => {
        const el = document.getElementById(id);
        if (el) {
            localStorage.setItem(id, el.checked);
        }
    });
    // Save user settings to localStorage
    userSettingsCheckboxes.forEach(id => {
        const el = document.getElementById(id);
        if (el) localStorage.setItem(id, el.checked);
    });
    localStorage.setItem('appLanguage', currentLanguage);

    const selectedFormat = document.querySelector('input[name="format"]:checked').value;
    localStorage.setItem('formatOption', selectedFormat);
    if (videoQualitySelect) localStorage.setItem('videoQualitySelect', videoQualitySelect.value);
    if (checkSubtitles) localStorage.setItem('checkSubtitles', checkSubtitles.checked);
}

// Ajouter l'écouteur de sauvegarde sur chaque checkbox
metadataCheckboxes.forEach(id => {
    document.getElementById(id)?.addEventListener('change', saveSettings);
});
if (checkSubtitles) {
    checkSubtitles.addEventListener('change', saveSettings);
}

// Ecouteurs pour le format et qualité
formatRadios.forEach(radio => {
    radio.addEventListener('change', (e) => {
        updateFormatUI(e.target.value);
        saveSettings();
    });
});
if (videoQualitySelect) {
    videoQualitySelect.addEventListener('change', saveSettings);
}

function updateFormatUI(format) {
    if (format === 'mp4') {
        if (mp3Options) mp3Options.style.display = 'none';
        if (mp4Options) mp4Options.style.display = 'flex';
    } else {
        if (mp3Options) mp3Options.style.display = 'block';
        if (mp4Options) mp4Options.style.display = 'none';
    }
}

// Handle language change
function handleLanguageChange() {
    currentLanguage = languageSelect.value;
    saveSettings();
    applyTranslations();
}

// Function to apply translations to the UI
function applyTranslations() {
    // Main UI
    urlInput.placeholder = _t('urlInputPlaceholder');
    pasteBtn.title = _t('pasteBtnTitle');
    downloadBtn.querySelector('span').textContent = _t('downloadBtnText');
    statusLabel.textContent = _t('statusReady');
    settingsBtn.title = _t('settingsBtnTitle');
    menuBtn.title = _t('menuBtnTitle');

    // Options Menu
    document.getElementById('checkTitle').nextSibling.textContent = _t('checkTitle');
    document.getElementById('checkArtist').nextSibling.textContent = _t('checkArtist');
    document.getElementById('checkAlbum').nextSibling.textContent = _t('checkAlbum');
    document.getElementById('checkDate').nextSibling.textContent = _t('checkDate');
    document.getElementById('checkTrack').nextSibling.textContent = _t('checkTrack');
    document.getElementById('checkThumb').nextSibling.textContent = _t('checkThumb');
    document.getElementById('checkPlaylistThumb').nextSibling.textContent = _t('checkPlaylistThumb');
    document.getElementById('checkLyrics').nextSibling.textContent = _t('checkLyrics');

    // Settings Modal
    document.querySelector('#settingsModal .modal-header h3').textContent = _t('settingsModalTitle');
    document.querySelector('.settings-option #disableAutoUpdates').closest('.settings-option').querySelector('.option-text').textContent = _t('autoUpdateSetting');
    document.querySelector('.settings-option #languageSelect').closest('.settings-option').querySelector('.option-text').textContent = _t('languageSetting');

    // Initial Language Selection Overlay
    if (languageSelectionOverlay) {
        document.getElementById('initialLanguageSelectionTitle').textContent = _t('initialLanguageSelectionTitle');
        document.getElementById('initialLanguageSelectionDescription').textContent = _t('initialLanguageSelectionDescription');
        document.getElementById('initialLanguageLabel').textContent = _t('initialLanguageLabel');
        document.getElementById('confirmLanguageBtn').textContent = _t('confirmLanguageButton');
        if (initialLanguageSelect) initialLanguageSelect.value = currentLanguage;
    }

    // Format & Quality
    if (document.getElementById('videoQualityLabelText')) {
        document.getElementById('videoQualityLabelText').textContent = _t('videoQualityLabel');
    }
    if (document.getElementById('optQualityBest')) {
        document.getElementById('optQualityBest').textContent = _t('optQualityBest');
    }
    if (document.getElementById('labelSubtitles')) {
        document.getElementById('labelSubtitles').textContent = _t('labelSubtitles');
    }

    // TOS Overlay
    document.querySelector('#tosOverlay h2').textContent = _t('tosWelcome');
    document.querySelector('#tosOverlay p').innerHTML = _t('tosDescription');
    document.getElementById('labelPrivacy').innerHTML = _t('tosPrivacy');
    document.getElementById('labelConditions').innerHTML = _t('tosConditions');
    document.getElementById('tosBtn').textContent = _t('tosValidate');

    // Set language select value
    if (languageSelect) languageSelect.value = currentLanguage;
}

// Add event listener for the new user setting checkbox
const disableAutoUpdatesCheckbox = document.getElementById('disableAutoUpdates');
if (disableAutoUpdatesCheckbox) {
    disableAutoUpdatesCheckbox.addEventListener('change', saveSettings);
    disableAutoUpdatesCheckbox.addEventListener('change', () => window.api.setAutoUpdatePreference(disableAutoUpdatesCheckbox.checked));
}

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
        urlInput.value = text; // Keep original URL for processing
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
                    ? (info.count ? `${info.count} ${_t('titlesCount')}` : _t('playlistDetected'))
                    : `${info.uploader}${info.duration ? ` • ${info.duration}` : ""}`;

                updatePlaylistOptionVisibility();
                previewThumb.src = info.thumbnail;
                previewThumb.style.opacity = "1";
            } catch (err) {
                setPreviewState('error', err.message); // Pass error message for potential display
            }
        } else { setPreviewState('error', _t('invalidUrl')); }
    }, 300);
});

function setPreviewState(state) {
    previewCard.style.display = 'flex';
    previewThumb.style.opacity = "0.5";
    if (state === 'loading') {
        previewTitle.textContent = _t('previewLoadingTitle');
        previewMeta.textContent = _t('previewLoadingMeta');
        isCurrentPlaylist = false;
        updatePlaylistOptionVisibility();
    } else if (state === 'error') {
        previewTitle.textContent = _t('previewNotFoundTitle');
        previewMeta.textContent = _t('previewNotFoundMeta');
    }
}

downloadBtn.addEventListener('click', async () => {
    const url = urlInput.value.trim();

    if (!url || !YOUTUBE_REGEX.test(url)) {
        updateStatus(_t('invalidUrl'), 'error');
        return;
    }

    const folder = await window.api.selectFolder();
    if (!folder) return;

    // On masque le bouton pour éviter les doubles clics et les bugs de processus
    downloadBtn.style.display = 'none';
    downloadBtn.classList.add('loading');
    downloadBtn.querySelector('span').textContent = _t('downloading');
    progressBar.style.width = '0%';
    // On vide les anciens échecs
    if (failedDownloadsContainer) failedDownloadsContainer.innerHTML = '';

    // Récupération des options de métadonnées et de format
    const options = {
        format: document.querySelector('input[name="format"]:checked').value,
        videoQuality: document.getElementById('videoQualitySelect')?.value || 'best',
        subtitles: document.getElementById('checkSubtitles')?.checked ?? false,
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
    else if (color === '#e67e22') type = 'warning';
    updateStatus(text, type);
});

window.api.onProgress((percent, completed, total) => {
    progressBar.style.width = `${percent}%`;
    updateStatus(`${_t('downloaded')} ${completed}/${total}`, 'info');
});

window.api.onComplete((result) => { // result contient maintenant lastDownloaded
    progressBar.style.width = '100%';
    if (failedDownloadsContainer) failedDownloadsContainer.innerHTML = '';

    let text = ""; // This text is still in French from main/downloadHandler
    if (result.isPlaylist) {
        text = `${_t('playlistDownloadComplete')} (${result.total} ${_t('videos')}).`;
        if (downloadCompleteCard) downloadCompleteCard.style.display = 'none'; // Cacher la carte pour les playlists
    } else {
        text = _t('downloadComplete');
        if (result.lastDownloaded && downloadCompleteCard) {
            downloadCompleteTitle.textContent = result.lastDownloaded.title;
            downloadCompleteArtist.textContent = result.lastDownloaded.artist;
            // Note: Afficher la miniature locale nécessiterait une gestion spécifique (ex: base64)
            // downloadCompleteThumb.src = result.lastDownloaded.thumbnail;
            downloadCompleteCard.style.display = 'flex'; // Afficher la carte
        } else if (downloadCompleteCard) {
            downloadCompleteCard.style.display = 'none';
        }
    }

    // Affichage des échecs s'il y en a
    if (result.failures && result.failures.length > 0 && failedDownloadsContainer) {
        const title = document.createElement('h4'); // This text is still in French from main/downloadHandler
        title.textContent = _t('failedDownloadsHeader');
        title.style.margin = "1.5em 0 0.5em 0";
        title.style.fontSize = "0.9em";
        failedDownloadsContainer.appendChild(title);

        result.failures.forEach(fail => {
            const card = document.createElement('div');
            card.className = 'preview-card failure-card';
            card.innerHTML = `
                <img class="preview-thumb" src="${fail.thumbnail}" alt="" onerror="this.src='../assets/icon.png'">
                <div class="preview-info">
                    <p class="preview-title">${fail.title}</p> <!-- Title is dynamic -->
                    <p class="preview-meta">${_t('videoPrefix')}${fail.index} • ${_t('notAvailable')}</p>
                </div>
            `;
            failedDownloadsContainer.appendChild(card);
        });
    }

    updateStatus(text, 'success');
});

window.api.onError((msg) => {
    updateStatus(msg, 'error');
});

window.api.onFinish(() => {
    downloadBtn.style.display = 'flex';
    downloadBtn.classList.remove('loading');
    downloadBtn.querySelector('span').textContent = _t('downloadBtnText');
});

// Gestion de l'affichage des mises à jour
window.api.onUpdateMsg((text, type) => {
    updateStatus(text, type);
});
