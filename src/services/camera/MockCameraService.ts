import { CameraService, CameraCapabilities, CameraStatus, MediaFile } from '../../types/camera';

export class MockCameraService implements CameraService {
  private connected = false;
  private recording = false;
  private mockFiles: MediaFile[] = [
    {
      name: 'VID_20231001_100000.mp4',
      path: '/A/DCIM/100AKASO/VID_20231001_100000.mp4',
      url: '#',
      size: 1024 * 1024 * 50, // 50MB
      date: new Date(Date.now() - 1000 * 60 * 60), // 1 hour ago
      duration: 120,
    }
  ];

  async connect(): Promise<boolean> {
    await this.delay(1000);
    this.connected = true;
    return true;
  }

  async disconnect(): Promise<void> {
    await this.delay(500);
    this.connected = false;
  }

  getConnectionStatus(): boolean {
    return this.connected;
  }

  async getCameraInfo(): Promise<{ model: string; firmware: string; }> {
    await this.delay(200);
    return { model: 'AKASO EK7000 (Mock)', firmware: 'v1.0.0-mock' };
  }

  async getCapabilities(): Promise<CameraCapabilities> {
    return {
      loopRecording: true,
      loopDurations: [1, 3, 5],
      videoResolutions: ['1080P60', '4K25'],
      downloadFiles: true,
      listFiles: true,
      remoteRecording: true,
      livePreview: true,
    };
  }

  async getStatus(): Promise<CameraStatus> {
    return {
      isRecording: this.recording,
      batteryLevel: 85,
      sdCardAvailableSpace: 80,
    };
  }

  async startRecording(): Promise<boolean> {
    await this.delay(500);
    this.recording = true;
    return true;
  }

  async stopRecording(): Promise<boolean> {
    await this.delay(500);
    this.recording = false;
    
    // Add a mock file when recording stops
    this.mockFiles.push({
      name: `VID_${Date.now()}.mp4`,
      path: `/A/DCIM/100AKASO/VID_${Date.now()}.mp4`,
      url: '#',
      size: 1024 * 1024 * 10, // 10MB
      date: new Date(),
      duration: 60,
    });
    
    return true;
  }

  async getMediaFiles(): Promise<MediaFile[]> {
    await this.delay(800);
    return [...this.mockFiles];
  }

  async getLatestVideo(): Promise<MediaFile | null> {
    const files = await this.getMediaFiles();
    if (files.length === 0) return null;
    return files.reduce((latest, current) => 
      current.date > latest.date ? current : latest
    );
  }

  async downloadVideo(file: MediaFile): Promise<Blob> {
    await this.delay(2000); // simulate download time
    
    // create a fake video blob (using an empty mp4 or just a text blob for testing)
    const content = 'Mock video content for ' + file.name;
    const blob = new Blob([content], { type: 'video/mp4' });
    return blob;
  }

  async deleteVideo(file: MediaFile): Promise<boolean> {
    await this.delay(500);
    this.mockFiles = this.mockFiles.filter(f => f.name !== file.name);
    return true;
  }

  private delay(ms: number) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}
