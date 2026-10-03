export interface CameraConnectionConfig {
  baseUrl: string;
  port: number;
  protocol: 'http' | 'https';
  firmwareProfile: string;
}

export interface CameraCapabilities {
  loopRecording: boolean;
  loopDurations: number[];
  videoResolutions: string[];
  downloadFiles: boolean;
  listFiles: boolean;
  remoteRecording: boolean;
  livePreview: boolean;
}

export interface CameraStatus {
  isRecording: boolean;
  batteryLevel: number | null; // 0-100
  sdCardAvailableSpace: number | null; // percentage or bytes
}

export interface MediaFile {
  name: string;
  path: string;
  url: string;
  size: number; // bytes
  date: Date;
  duration?: number; // seconds
}

export interface LocalVideo {
  id: string;
  fileName: string;
  blob: Blob;
  size: number;
  date: Date;
  duration?: number;
  thumbnail?: string; // base64 or blob url
}

export interface CameraService {
  connect(): Promise<boolean>;
  disconnect(): Promise<void>;
  getConnectionStatus(): boolean;
  getCameraInfo(): Promise<{ model: string; firmware: string }>;
  getCapabilities(): Promise<CameraCapabilities>;
  getStatus(): Promise<CameraStatus>;
  startRecording(): Promise<boolean>;
  stopRecording(): Promise<boolean>;
  getMediaFiles(): Promise<MediaFile[]>;
  getLatestVideo(): Promise<MediaFile | null>;
  downloadVideo(file: MediaFile): Promise<Blob>;
  deleteVideo(file: MediaFile): Promise<boolean>;
}

export interface ConnectionDiagnosticsResult {
  wifiConnected: boolean;
  cameraReachable: boolean;
  httpServerReachable: boolean;
  statusEndpointReachable: boolean;
  modelIdentified: boolean;
  firmwareIdentified: boolean;
  listFilesSupported: boolean;
  recordingControlSupported: boolean;
  downloadSupported: boolean;
  errors: Record<string, string>;
  cameraIp?: string;
}
