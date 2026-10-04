import { Capacitor, CapacitorHttp } from '@capacitor/core';
import { MediaFile } from '../../types/camera';

/**
 * Protocolo real para a Xiaomi 70mai (M300 / M310 Plus)
 * Baseado na análise do APK 4.3.1
 *
 * IMPORTANTE: a câmera não envia headers CORS. No navegador (Vercel/localhost)
 * o fetch cross-origin falha; no APK usamos CapacitorHttp (camada nativa),
 * que não passa por CORS e consegue ler o conteúdo das respostas.
 */
export class Real70maiProtocol {
  private ip = '192.168.0.1';
  private baseUrl = `http://${this.ip}`;

  // Como confirmamos via fotos do painel, a câmera expõe a árvore de diretórios via HTTP.
  // O cartão SD fica montado em /mnt/sd/
  private sdCardUrl = `${this.baseUrl}/mnt/sd/Normal/`;

  // GET que funciona nas duas plataformas: nativo (sem CORS) ou navegador
  private async httpGet(url: string, timeoutMs = 5000): Promise<{ status: number; text: string }> {
    if (Capacitor.isNativePlatform()) {
      const resp = await CapacitorHttp.get({ url, connectTimeout: timeoutMs, readTimeout: timeoutMs });
      const text = typeof resp.data === 'string' ? resp.data : JSON.stringify(resp.data ?? '');
      return { status: resp.status, text };
    }

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), timeoutMs);
    const resp = await fetch(url, { signal: controller.signal, cache: 'no-store' });
    clearTimeout(timeout);
    return { status: resp.status, text: await resp.text() };
  }

  async getStatus() {
    try {
      const { status, text } = await this.httpGet(`${this.baseUrl}/mnt/`, 3000);
      if (status < 200 || status >= 400) return false;

      // No APK, o celular SÓ pode estar falando com a câmera nesse IP
      // (na rede Wi-Fi dela, 192.168.0.1 é a própria câmera).
      if (Capacitor.isNativePlatform()) return true;

      // No navegador (dev/PC), valida o conteúdo para não confundir com o
      // roteador da casa, que também costuma morar em 192.168.0.1.
      return /sd card|sdcard|mnt\/sd|Normal|Index of|MP4|href/i.test(text);
    } catch {
      return false;
    }
  }

  async getFileList() {
    try {
      const { status, text } = await this.httpGet(this.sdCardUrl);
      if (status < 200 || status >= 400) throw new Error(`HTTP ${status}`);

      // O diretório retorna um HTML. Vamos parsear todos os links <a> que terminam em R.MP4
      const regex = /href="([^"]+R\.MP4)"/g;
      const matches = [...text.matchAll(regex)];

      return matches.map(m => m[1]);
    } catch (error) {
      console.error('Erro ao listar arquivos:', error);
      return [];
    }
  }

  async getLatestVideoUrl() {
    const files = await this.getFileList();
    if (files.length === 0) return null;

    // Os nomes geralmente vêm como YYYYMMDD_HHMMSSR.MP4
    // Vamos ordenar alfabeticamente e pegar o último
    files.sort();
    const latest = files[files.length - 1];

    // O link pode vir absoluto ou relativo dependendo do servidor web da câmera.
    if (latest.startsWith('http')) {
      return latest;
    }
    return `${this.sdCardUrl}${latest}`;
  }

  async downloadVideo(url: string): Promise<Blob> {
    if (Capacitor.isNativePlatform()) {
      // Camada nativa retorna o conteúdo binário em base64
      const resp = await CapacitorHttp.get({
        url,
        responseType: 'blob',
        connectTimeout: 5000,
        readTimeout: 120000, // vídeos são grandes
      });
      if (resp.status < 200 || resp.status >= 400) throw new Error(`Falha no download: HTTP ${resp.status}`);
      return base64ToBlob(resp.data as string, 'video/mp4');
    }

    const response = await fetch(url);
    if (!response.ok) throw new Error(`Falha no download: ${response.statusText}`);
    return await response.blob();
  }
}

// Converte base64 (CapacitorHttp) em Blob sem estourar a memória de uma vez
function base64ToBlob(base64: string, mime: string): Blob {
  const chunkSize = 1024 * 1024; // 1MB por fatia
  const parts: Uint8Array<ArrayBuffer>[] = [];
  for (let offset = 0; offset < base64.length; offset += chunkSize) {
    const slice = base64.slice(offset, offset + chunkSize);
    const binary = atob(slice);
    const buffer = new ArrayBuffer(binary.length);
    const bytes = new Uint8Array(buffer);
    for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
    parts.push(bytes);
  }
  return new Blob(parts, { type: mime });
}
