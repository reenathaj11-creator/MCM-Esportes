import { CameraService, CameraCapabilities, CameraStatus, MediaFile, CameraConnectionConfig } from '../../types/camera';
import { Real70maiProtocol } from './70maiProtocol';

export class Xiaomi70maiCameraService implements CameraService {
  private protocol = new Real70maiProtocol();
  private connected = false;

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

  async getCameraInfo() {
    return { model: 'Xiaomi 70mai M310 Plus', firmware: 'Unknown' };
  }

  async getCapabilities(): Promise<CameraCapabilities> {
    return {
      loopRecording: true,
      loopDurations: [60],
      videoResolutions: ['3K'],
      downloadFiles: true,
      listFiles: true,
      remoteRecording: true,
      livePreview: true,
    };
  }

  async getStatus(): Promise<CameraStatus> {
    return {
      isRecording: true,
      batteryLevel: 100,
      sdCardAvailableSpace: 1000,
    };
  }

  async startRecording(): Promise<boolean> { return true; }
  async stopRecording(): Promise<boolean> { return true; }

  async getMediaFiles(): Promise<MediaFile[]> {
    const files = await this.protocol.getFileList();
    return files.map(name => ({
      name,
      path: `/mnt/sd/Normal/${name}`,
      url: `http://192.168.0.1/mnt/sd/Normal/${name}`,
      size: 0,
      date: new Date()
    }));
  }

  async getLatestVideo(): Promise<MediaFile | null> {
    const files = await this.getMediaFiles();
    if (files.length === 0) return null;
    return files[files.length - 1]; // assumindo que a ordem retorna a mais recente no final
  }

  async downloadVideo(file: MediaFile): Promise<Blob> {
    return await this.protocol.downloadVideo(file.url);
  }

  async deleteVideo(file: MediaFile): Promise<boolean> {
    // A ser implementado
    return false;
  }
}
