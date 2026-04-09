# 🎵 Youtube Downloader v1.2.7

Une application simple pour télécharger vos musiques et playlists YouTube en format MP3.

### 📦 Quoi de neuf dans la v1.2.7 ?

*   **[FIX] Correction du nettoyage automatique  🧹** : Correction de la suppression systématique de tous les fichiers temporaires (`.info.json`, `.webp`, `.jpg`, `.m4a`, etc.) grâce à un nouveau système de gestion par préfixe.
*   **[FIX] Correction de l'intégration des miniatures 🖼️** : Correction du bug de filtre FFmpeg sur Windows.
*   **[ADD] Métadonnées ID3 précises 🏷️** : Passage à l'extraction via JSON pour garantir l'exactitude des informations (Artiste, Titre, Année, Album et Numéro de piste).

*   **[ADD] Spatialisation intelligente 🎧** : Moteur audio capable de détecter le multicanal (5.1, 7.1) pour appliquer un downmix spatialisé vers la stéréo.
*   **[ADD] Vitesse optimisée ⚡** : Amélioration de la stratégie de téléchargement en parallèle (Sliding Window) pour les playlists volumineuses.

## ✨ Fonctionnalités

*   🎨 Interface graphique simple et claire.
*   🎬 Téléchargement de vidéos uniques ou de playlists complètes.
*   🎧 Conversion automatique en MP3 avec la meilleure qualité audio disponible.
*   🎧 **Conservation des canaux audio** : Maintien des canaux mono/stéréo et downmix intelligent des sources multicanaux vers le stéréo pour l'MP3.
*   🏷️ **Gestion complète des métadonnées** :
    *   Titre, artiste, pochette, nom de l'album.
    *   Numéro de piste et d'album pour les playlists.
*   📦 **Application robuste** : Gestion d'erreurs améliorée et nettoyage des résidus de téléchargement.

## 🚀 Comment l'utiliser ?

1.  📋 Copiez l'URL d'une vidéo ou d'une playlist YouTube.
2.  📥 Collez l'URL dans l'application.
3.  🖱️ Cliquez sur "Télécharger" et choisissez un dossier.
4.  ✅ Les fichiers MP3 seront sauvegardés dans le dossier sélectionné.

## 🛠️ Informations Techniques

*   **Version** : 1.2.7
*   **Langage** : JavaScript
*   **Dépendances** : `yt-dlp`, `ffmpeg`, `electron`
*   **Développeur** : Danny Berger
