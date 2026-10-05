import { CameraService, CameraCapabilities, CameraStatus, MediaFile } from '../../types/camera';
import { Real70maiProtocol } from './70maiProtocol';

export class Xiaomi70maiCameraService implements CameraService {
  private protocol = new Real70maiProtocol();
  private connected = false;

  // ----- Pareamento -----

  isPaired(): boolean {
    return this.protocol.isPaired();
  }

  unpair(): void {
    this.protocol.unpair();
  }

  exportToken(): string | null {
    return this.protocol.exportToken();
  }

  importToken(token: string): boolean {
    return this.protocol.importToken(token);
  }

  async isReachable(): Promise<boolean> {
    return this.protocol.handshake();
  }

  async pair(onProgress: (message: string) => void): Promise<boolean> {
    const ok = await this.protocol.pair(onProgress);
    this.connected = ok;
    return ok;
  }

  // ----- Conexão -----

  async connect(): Promise<boolean> {
    this.connected = await this.protocol.getStatus();
    return this.connected;
  }

  async disconnect(): Promise<void> {
    this.connected = false;
  }

  getConnectionStatus(): boolean {
    return this.connected;
  }

  // ----- Info -----

  async getCameraInfo() {
    return { model: 'Xiaomi 70mai M310 Plus', firmware: 'cardvapi' };
  }

  async getCapabilities(): Promise<CameraCapabilities> {
    return {
      loopRecording: true,
      loopDurations: [60],
      videoResolutions: ['3K'],
      downloadFiles: true,
      listFiles: true,
      remoteRecording: true,
      livePreview: false, // preview MJPEG requer endpoint a validar
    };
  }

  async getStatus(): Promise<CameraStatus> {
    const sd = await this.protocol.getSdState();
    return {
      // getdeviceattr/reportFileList.cgi não expõe "gravando" de forma simples;
      // a dashcam grava sempre que ligada com SD.
      isRecording: !!sd,
      batteryLevel: 100,
      sdCardAvailableSpace: sd ? Math.max(0, Math.round(((sd.totalMb - sd.usedMb) / Math.max(sd.totalMb, 1)) * 100)) : null,
    };
  }

  async startRecording(): Promise<boolean> {
    return this.protocol.setRecording(true);
  }

  async stopRecording(): Promise<boolean> {
    return this.protocol.setRecording(false);
  }

  /** Liga/desliga o modo álbum (necessário para preview e download) */
  async setAlbumMode(enable: boolean): Promise<boolean> {
    return this.protocol.setAlbumMode(enable);
  }

  // ----- Arquivos -----

  private toMediaFile(entry: { path: string; name: string; size: number }): MediaFile {
    return {
      name: entry.name,
      path: entry.path,
      url: this.protocol.fileUrl(entry.path, entry.name),
      size: entry.size,
      date: parseFileDate(entry.name),
    };
  }

  async getMediaFiles(): Promise<MediaFile[]> {
    const entries = await this.protocol.getFileList(0); // 0 = Normal (gravação contínua)
    return entries.map(e => this.toMediaFile(e));
  }

  async getLatestVideo(): Promise<MediaFile | null> {
    const files = await this.getMediaFiles();
    if (files.length === 0) return null;
    return files[files.length - 1]; // nomes ordenados = cronológico
  }

  async downloadVideo(file: MediaFile): Promise<Blob> {
    return this.protocol.downloadVideo(file.url);
  }

  async deleteVideo(_file: MediaFile): Promise<boolean> {
    // Sem comando de delete no cardvapi conhecido — o loop recording resolve
    return false;
  }
}

// Nomes de arquivo: NOyyyymmdd-HHMMSS-xxxxxx.mp4 (prefixo = tipo do arquivo)
function parseFileDate(name: string): Date {
  const m = name.match(/^[A-Z]{2}(\d{8})-(\d{6})-/);
  if (!m) return new Date();
  const [, d, t] = m;
  return new Date(
    Number(d.slice(0, 4)), Number(d.slice(4, 6)) - 1, Number(d.slice(6, 8)),
    Number(t.slice(0, 2)), Number(t.slice(2, 4)), Number(t.slice(4, 6)),
  );
}
