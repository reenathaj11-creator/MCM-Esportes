import { LocalVideo } from '../types/camera';

class ShareService {
  async shareVideo(video: LocalVideo): Promise<boolean> {
    const file = new File([video.blob], video.fileName, { type: video.blob.type || 'video/mp4' });
    
    if (navigator.canShare && navigator.canShare({ files: [file] })) {
      try {
        await navigator.share({
          title: 'AKASO Video',
          text: 'Confira este vídeo que gravei!',
          files: [file],
        });
        return true;
      } catch (error) {
        console.error('Error sharing video:', error);
        // Fallback if sharing is cancelled or fails
      }
    }
    
    // Fallback: trigger download
    this.downloadVideo(video);
    return false;
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
}

export const shareService = new ShareService();
