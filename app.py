# YouTube Downloader - VERSION 2026 FIABLE & OPTIMISÉE
import os
import subprocess
import tkinter as tk
from tkinter import ttk, filedialog, messagebox
import threading
import ctypes
import sys

# Détection du dossier de l'exécutable (PyInstaller ou script normal)
if getattr(sys, 'frozen', False):
    BASE_PATH = sys._MEIPASS
else:
    BASE_PATH = os.path.dirname(os.path.abspath(__file__))

# Identifiant d'application Windows (pour la barre des tâches)
myappid = 'YouTubeDownloader.Danny.2026'
try:
    ctypes.windll.shell32.SetCurrentProcessExplicitAppUserModelID(myappid)
except AttributeError:
    pass  # pas sous Windows

# ---------------------------------------
# Fenêtre principale
# ---------------------------------------
root = tk.Tk()
root.title("YouTube Downloader 2026")
root.configure(bg="#f0f2f5")
root.geometry("860x720")
root.minsize(460, 380)

# Plein écran avec F11 / Échap pour quitter
root.rowconfigure(0, weight=1)
root.columnconfigure(0, weight=1)

def toggle_fullscreen(event=None):
    root.attributes("-fullscreen", not root.attributes("-fullscreen"))

root.bind("<F11>", toggle_fullscreen)
root.bind("<Escape>", lambda e: root.attributes("-fullscreen", False))

# Style moderne
style = ttk.Style()
style.theme_use("clam")
style.configure("TProgressbar", thickness=24, background="#27ae60", troughcolor="#ecf0f1")
style.map("TProgressbar", background=[("active", "#2ecc71")])

# Frame principale
main_frame = tk.Frame(root, bg="#f0f2f5")
main_frame.grid(sticky="nsew", padx=20, pady=20)
main_frame.columnconfigure(0, weight=1)

for i in range(10):
    main_frame.rowconfigure(i, weight=1 if i in (2,4,7) else 0)

# Titre
tk.Label(main_frame, text="YouTube Downloader", font=("Segoe UI", 28, "bold"),
         bg="#f0f2f5", fg="#2c3e50").grid(row=0, column=0, pady=(10, 20), sticky="ew")

# URL
tk.Label(main_frame, text="URL YouTube :", font=("Segoe UI", 12, "bold"),
         bg="#f0f2f5", fg="#34495e", anchor="w").grid(row=1, column=0, sticky="ew", pady=(0,5))

url_entry = tk.Text(main_frame, height=3, font=("Segoe UI", 11),
                    relief="flat", bd=1, highlightthickness=2, highlightbackground="#bdc3c7",
                    highlightcolor="#3498db", wrap="word")
url_entry.grid(row=2, column=0, sticky="ew", pady=(0,15))
url_entry.insert("1.0", "https://www.youtube.com/watch?v=")

# Format
tk.Label(main_frame, text="Format :", font=("Segoe UI", 12, "bold"),
         bg="#f0f2f5", fg="#34495e", anchor="w").grid(row=3, column=0, sticky="ew", pady=(0,5))

format_var = tk.StringVar(value="mp3")
format_frame = tk.Frame(main_frame, bg="#f0f2f5")
format_frame.grid(row=4, column=0, sticky="ew", pady=(0,20))

tk.Radiobutton(format_frame, text="MP3 (Audio seulement)", variable=format_var, value="mp3",
               font=("Segoe UI", 12), bg="#f0f2f5", fg="#2c3e50", selectcolor="#ecf0f1",
               activebackground="#f0f2f5").pack(side="left", padx=80)

tk.Radiobutton(format_frame, text="MP4 (Vidéo)", variable=format_var, value="mp4",
               font=("Segoe UI", 12), bg="#f0f2f5", fg="#2c3e50", selectcolor="#ecf0f1",
               activebackground="#f0f2f5").pack(side="right", padx=80)

# Bouton Télécharger
download_btn = tk.Button(main_frame, text="TÉLÉCHARGER", bg="#27ae60", fg="white",
                         font=("Segoe UI", 15, "bold"), relief="flat", cursor="hand2",
                         activebackground="#2ecc71", activeforeground="white",
                         padx=40, pady=12)
download_btn.grid(row=5, column=0, pady=20)

# Progression
percent_label = tk.Label(main_frame, text="0%", font=("Segoe UI", 18, "bold"),
                         bg="#f0f2f5", fg="#2c3e50")
percent_label.grid(row=6, column=0, pady=(10,5))

progress_bar = ttk.Progressbar(main_frame, length=760, mode="determinate", maximum=100)
progress_bar.grid(row=7, column=0, sticky="ew", pady=8)

status_label = tk.Label(main_frame, text="Prêt", font=("Segoe UI", 13), bg="#f0f2f5", fg="#7f8c8d")
status_label.grid(row=8, column=0, pady=(5,10))

# Fonction principale de téléchargement
def download_video():
    url = url_entry.get("1.0", "end-1c").strip()
    if not url or ("youtube.com" not in url.lower() and "youtu.be" not in url.lower()):
        messagebox.showerror("Erreur", "Veuillez entrer une URL YouTube valide.")
        return

    folder = filedialog.askdirectory(title="Choisir le dossier de destination")
    if not folder:
        return

    is_mp3 = format_var.get() == "mp3"

    # Reset interface
    progress_bar["value"] = 0
    percent_label.config(text="0%")
    status_label.config(text="Préparation...", fg="#3498db")
    download_btn.config(state="disabled")

    def run_download():
        ytdlp_path = os.path.join(BASE_PATH, "yt-dlp.exe")          # ou yt-dlp-nightly.exe
        ffmpeg_path = os.path.join(BASE_PATH, "ffmpeg.exe")

        if not os.path.isfile(ytdlp_path):
            root.after(0, lambda: status_label.config(text="Erreur : yt-dlp introuvable", fg="red"))
            root.after(0, lambda: download_btn.config(state="normal"))
            return

        os.environ["PATH"] = BASE_PATH + os.pathsep + os.environ.get("PATH", "")

        cmd = [
            ytdlp_path,
            "--newline",
            "--ffmpeg-location", ffmpeg_path,
            "--no-warnings",
            "-o", os.path.join(folder, "%(title)s.%(ext)s"),
            "--embed-metadata",
            "--embed-thumbnail",
            "--no-playlist",           # sécurité contre les playlists
            url
        ]

        if is_mp3:
            cmd.extend([
                "-x",
                "--audio-format", "mp3",
                "--audio-quality", "0",     # meilleure qualité (V0)
            ])
        else:
            cmd.extend([
                "-f", "bestvideo+bestaudio/best",
                "--merge-output-format", "mp4",
                "--embed-subs",
                "--sub-langs", "all,-live_chat",
            ])

        try:
            process = subprocess.Popen(
                cmd,
                stdout=subprocess.PIPE,
                stderr=subprocess.STDOUT,
                text=True,
                encoding="utf-8",
                errors="replace",
                creationflags=subprocess.CREATE_NO_WINDOW if sys.platform == "win32" else 0
            )

            for line in process.stdout:
                line = line.strip()
                if "[download]" in line and "%" in line:
                    try:
                        percent = float(line.split("%")[0].split()[-1])
                        root.after(0, lambda p=percent: [
                            progress_bar.config(value=p),
                            percent_label.config(text=f"{p:.1f}%")
                        ])
                    except:
                        pass

                if any(kw in line.lower() for kw in ["error", "warning", "failed"]):
                    root.after(0, lambda t=line[:120]: status_label.config(text=t, fg="#e74c3c"))

                elif "Destination:" in line:
                    root.after(0, lambda t=line[:120]: status_label.config(text="Téléchargement en cours..."))

            process.wait()

            if process.returncode == 0:
                root.after(0, lambda: [
                    status_label.config(text="Terminé avec succès ✓", fg="#27ae60"),
                    percent_label.config(text="100%"),
                    progress_bar.config(value=100),
                    messagebox.showinfo("Succès", "Téléchargement terminé !")
                ])
            else:
                root.after(0, lambda: status_label.config(text="Échec du téléchargement", fg="#e74c3c"))

        except Exception as e:
            root.after(0, lambda: status_label.config(text=f"Erreur : {str(e)[:80]}", fg="#e74c3c"))
            messagebox.showerror("Erreur critique", str(e))

        finally:
            root.after(0, lambda: download_btn.config(state="normal"))

    threading.Thread(target=run_download, daemon=True).start()

# Connexion du bouton
download_btn.config(command=download_video)

# Lancement de l'interface
if __name__ == "__main__":
    root.mainloop()