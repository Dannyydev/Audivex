# Audivex `v1.3.16`

Une application de bureau dédiée au téléchargement et à la conversion de contenus YouTube en audio haute qualité.

## Fonctionnalités

**Interface utilisateur**
Conçue pour une prise en main immédiate : collez un lien, configurez vos préférences, lancez le téléchargement. Une prévisualisation des métadonnées s'affiche dès la saisie de l'URL.

**Qualité audio**
Conversion automatique en MP3 (VBR Q0) avec gestion intelligente des canaux : mono, stéréo, et downmix spatialisé pour les sources multicanaux.

**Gestion des playlists**
Téléchargement de titres individuels ou de playlists complètes en un clic, avec numérotation automatique des pistes.

**Métadonnées**
Un menu dédié permet de configurer précisément les tags appliqués à chaque fichier : titre, artiste, album, année, numéro de piste, pochette d'album et paroles synchronisées.

**Mises à jour**
Système de mise à jour intégré pour maintenir l'application à jour automatiquement.

## Utilisation

1. Copiez l'URL d'une vidéo ou d'une playlist YouTube.
2. Collez-la dans le champ de saisie (ou utilisez le bouton presse-papiers).
3. Ajustez les préférences de métadonnées si nécessaire via le menu de configuration.
4. Sélectionnez votre dossier de destination et lancez le téléchargement.

## Stack technique

| Composant | Technologie |
|---|---|
| Framework | Electron |
| Moteur de téléchargement | yt-dlp |
| Traitement audio | FFmpeg / ffprobe |
| Interface | HTML, CSS |
| Scriptage | JavaScript |

---

## Dernières modifications

### v1.3.16 -- 07/06/2026

* **Mise à jour** — Mise à jour de **Yt-dlp** afin de supporter les nouveau protocoles **Youtube**

---

Développé par Dannyydev

© 2026 Dan&Tom. Tous droits réservés.

[Audivex](https://audivex.fr/) [Discord](https://discord.gg/VGDB9ceV33)