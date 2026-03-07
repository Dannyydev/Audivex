# Youtube Downloader v1.0.0
import os
import sys
import subprocess
import threading
import ctypes
import re
import tkinter as tk
from tkinter import ttk, filedialog

# =========================
# BASE PATH (PyInstaller OK)
# =========================
if getattr(sys, 'frozen', False):
    BASE_PATH = sys._MEIPASS
else:
    BASE_PATH = os.path.dirname(os.path.abspath(__file__))

# =========================
# WINDOWS APP ID
# =========================
try:
    ctypes.windll.shell32.SetCurrentProcessExplicitAppUserModelID(
        "YoutubeDownloader"
    )
except:
    pass

# =========================
# TKINTER WINDOW
# =========================
root = tk.Tk()
root.title("Youtube Downloader")
root.geometry("960x700")
root.minsize(520, 420)
root.configure(bg="#ffffff")

# =========================
# ICON
# =========================
icon_path = os.path.join(BASE_PATH, "icon.ico")
if os.path.exists(icon_path):
    root.iconbitmap(icon_path)

root.bind("<F11>", lambda e: root.attributes("-fullscreen", not root.attributes("-fullscreen")))
root.bind("<Escape>", lambda e: root.attributes("-fullscreen", False))

# =========================
# STYLE
# =========================
style = ttk.Style()
style.theme_use("clam")
style.configure(
    "TProgressbar",
    thickness=26,
    background="#6c5ce7",
    troughcolor="#dfe6e9"
)

# =========================
# LAYOUT
# =========================
main = tk.Frame(root, bg="#ffffff", padx=30, pady=25)
main.pack(fill="both", expand=True)
main.columnconfigure(0, weight=1)

# =========================
# TITLE
# =========================
tk.Label(
    main,
    text="Youtube Downloader",
    font=("San Francisco", 26, "bold"),
    bg="#ffffff",
    fg="#2d3436"
).pack(pady=(40, 5))

tk.Label(
    main,
    text="High Quality MP3",
    font=("San Francisco", 12),
    bg="#ffffff",
    fg="#636e72"
).pack(pady=(0, 40))

# =========================
# INPUT
# =========================
url_entry = tk.Entry(
    main,
    font=("San Francisco", 14),
    relief="flat",
    justify="center",
    bg="#f1f2f6",
    fg="#2d3436",
    insertbackground="black"
)
url_entry.pack(fill="x", ipady=10, padx=40)
url_entry.insert(0, "YouTube link (video or playlist)")
url_entry.bind("<FocusIn>", lambda args: url_entry.delete('0', 'end') if "YouTube" in url_entry.get() else None)

# =========================
# BUTTON
# =========================
download_btn = tk.Button(
    main,
    text="Download",
    bg="#6c5ce7",
    fg="white",
    font=("San Francisco", 14, "bold"),
    relief="flat",
    cursor="hand2",
    activebackground="#a29bfe",
    activeforeground="white",
    padx=40,
    pady=10
)
download_btn.pack(pady=30)

# =========================
# PROGRESS
# =========================
progress_bar = ttk.Progressbar(main, mode="determinate", maximum=100)
progress_bar.pack(fill="x", padx=40, pady=(0, 20))

status_label = tk.Label(
    main,
    text="Ready",
    font=("San Francisco", 11),
    bg="#ffffff",
    fg="#636e72",
    wraplength=480
)
status_label.pack(pady=10)

# =========================
# DOWNLOAD LOGIC
# =========================
def download_mp3():
    url = url_entry.get().strip()
    
    if not url or "YouTube link" in url:
        status_label.config(text="Veuillez entrer une URL valide.", fg="#e74c3c")
        return

    if "youtube.com" not in url and "youtu.be" not in url:
        status_label.config(text="Ce lien ne semble pas être une vidéo YouTube.", fg="#e74c3c")
        return

    folder = filedialog.askdirectory(title="Choisir le dossier de destination")
    if not folder:
        status_label.config(text="Téléchargement annulé.", fg="#636e72")
        return

    ytdlp = os.path.join(BASE_PATH, "yt-dlp.exe")
    ffmpeg = os.path.join(BASE_PATH, "ffmpeg.exe")

    if not os.path.exists(ytdlp) or not os.path.exists(ffmpeg):
        status_label.config(text="Erreur : yt-dlp.exe ou ffmpeg.exe introuvable.", fg="#e74c3c")
        return

    progress_bar["value"] = 0
    status_label.config(text="Analyzing URL...", fg="#0984e3")
    download_btn.config(state="disabled")

    def run():
        os.environ["PATH"] = BASE_PATH + os.pathsep + os.environ.get("PATH", "")

        cmd = [
            ytdlp,
            "--newline",
            "--ffmpeg-location", ffmpeg,
            "-f", "bestaudio/best",
            "-x",
            "--audio-format", "mp3",
            "--audio-quality", "0",
            "--embed-thumbnail",
            "--embed-metadata",
            "--yes-playlist",
            "--extractor-args", "youtube:player_client=auto",
            "--js-runtimes", "deno",
            "-o", os.path.join(
                folder,
                "%(title)s.%(ext)s"
            ),
            url
        ]


        logs = []

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
                logs.append(line)
                line = line.strip()

                match = re.search(r'(\d+(?:\.\d+)?)%', line)
                if match:
                    v = float(match.group(1))
                    root.after(0, lambda v=v: progress_bar.config(value=v))

                if "Downloading" in line:
                    root.after(0, lambda: status_label.config(text="Downloading..."))
                elif "Extracting" in line or "Converting" in line:
                    root.after(0, lambda: status_label.config(text="Converting to MP3..."))
                elif "Embedding" in line:
                    root.after(0, lambda: status_label.config(text="Embedding artwork..."))

            process.wait()

            if process.returncode == 0:
                root.after(0, lambda: (
                    progress_bar.config(value=100),
                    status_label.config(text="Download complete 🎧", fg="#00b894")
                ))
            else:
                # Show last error line
                error_msg = "Erreur lors du téléchargement."
                for l in reversed(logs):
                    if "ERROR:" in l:
                        error_msg = l.replace("ERROR:", "").strip()
                        break
                root.after(0, lambda: status_label.config(text=error_msg, fg="#e74c3c"))

        except Exception as e:
            root.after(0, lambda: status_label.config(text=f"Erreur critique : {str(e)}", fg="#e74c3c"))

        finally:
            root.after(0, lambda: download_btn.config(state="normal"))

    threading.Thread(target=run, daemon=True).start()

download_btn.config(command=download_mp3)

root.mainloop()
