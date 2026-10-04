import { LocalVideo } from '../types/camera';

export type ShareResult = 'shared' | 'queued' | 'downloaded';

const PENDING_KEY = 'mcm_pending_shares';

class ShareService {
  /**
   * Compartilha o vídeo via folha de compartilhamento nativa (WhatsApp etc).
   * Sem internet (ex: conectado no Wi-Fi da câmera), o envio entra numa fila
   * local e pode ser concluído quando o 5G voltar.
   */
  async shareVideo(video: LocalVideo): Promise<ShareResult> {
    if (!navigator.onLine) {
      this.enqueue(video.id);
      return 'queued';
    }

    const file = new File([video.blob], video.fileName, { type: video.blob.type || 'video/mp4' });

    if (navigator.canShare && navigator.canShare({ files: [file] })) {
      try {
        await navigator.share({
          title: 'MCM Esportes',
          text: 'Confira esta jogada!',
          files: [file],
        });
        this.removePending(video.id);
        return 'shared';
      } catch {
        // Compartilhamento cancelado ou falhou — segue para o fallback
      }
    }

    // Fallback: baixa o arquivo
    this.downloadVideo(video);
    return 'downloaded';
  }

  downloadVideo(video: LocalVideo): void {
    const url = URL.createObjectURL(video.blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = video.fileName;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }

  // ---------- Fila de envios pendentes (offline) ----------

  getPendingShares(): string[] {
    try {
      return JSON.parse(localStorage.getItem(PENDING_KEY) || '[]');
    } catch {
      return [];
    }
  }

  enqueue(videoId: string): void {
    const pending = this.getPendingShares();
    if (!pending.includes(videoId)) {
      pending.push(videoId);
      localStorage.setItem(PENDING_KEY, JSON.stringify(pending));
    }
  }

  removePending(videoId: string): void {
    const pending = this.getPendingShares().filter(id => id !== videoId);
    localStorage.setItem(PENDING_KEY, JSON.stringify(pending));
  }
}

export const shareService = new ShareService();
