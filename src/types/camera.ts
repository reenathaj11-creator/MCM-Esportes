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
  /** Liga/desliga o modo álbum (70mai exige para preview/download) */
  setAlbumMode?(enable: boolean): Promise<boolean>;
  /** Re-registra o app na câmera */
  registerClient?(): Promise<boolean>;
  /** Registra testando IPs candidatos; devolve o cru (para diagnóstico) */
  debugRegister?(): Promise<{ http: number; code: string; body: string }>;
  /** URL de preview assinada (live/static MJPEG) */
  previewUrl?(kind: 'live' | 'static' | 'live-cgi' | 'static-cgi'): string;
  /** Comando cru para diagnóstico (HTTP + código + trecho) */
  debugCommand?(command: string, params?: Record<string, string | number>): Promise<{ http: number; code: string; body: string }>;
  /** URL assinada pronta (para <img>/fetch manual) */
  signedCommandUrl?(command: string, params?: Record<string, string | number>): string;
  /** Resposta crua (até 8KB) para diagnóstico em campo */
  debugRaw?(command: string, params?: Record<string, string | number>): Promise<{ http: number; text: string }>;
  getMediaFiles(): Promise<MediaFile[]>;
  getLatestVideo(): Promise<MediaFile | null>;
  downloadVideo(file: MediaFile): Promise<Blob>;
  deleteVideo(file: MediaFile): Promise<boolean>;

  /** true quando a rede da câmera é alcançável mas o app ainda não foi pareado */
  isReachable?(): Promise<boolean>;
  /** true quando existe token pareado salvo */
  isPaired?(): boolean;
  /** Executa o fluxo de pareamento (câmera exige confirmação física no botão lateral) */
  pair?(onProgress: (message: string) => void): Promise<boolean>;
  /** Remove o token pareado (nova pareação ao resetar a câmera) */
  unpair?(): void;
  /** Exporta o token pareado (compartilhar com outro aparelho autorizado) */
  exportToken?(): string | null;
  /** Importa um token existente. Retorna false se o formato for inválido */
  importToken?(token: string): boolean;
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
