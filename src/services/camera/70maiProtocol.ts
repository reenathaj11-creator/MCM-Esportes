import { Capacitor, CapacitorHttp } from '@capacitor/core';
import { md5 } from '../../utils/md5';

/**
 * Protocolo cardvapi das 70mai (M300 / M310 Plus, chip Mstar).
 * Baseado na engenharia reversa do APK 4.3.1 + projeto open-source
 * 70MaiM300Toolbox (XuZhen86).
 *
 * Autenticação: todo comando exige token de pareamento (32 hex) e
 * signkey = MD5(comando + '?' + params + token).
 * O pareamento inicial exige apertar o botão lateral da câmera.
 */

const MAGIC_STRING = '73VpsAfdety8FDd0';
const TOKEN_STORAGE_KEY = 'mcm_70mai_token';
const BASE_URL = 'http://192.168.0.1';

interface CameraJsonResponse {
  ResultCode: string;
  Result?: Record<string, unknown> | unknown[] | null;
}

/**
 * Normaliza a resposta da câmera:
 * - ResultCode pode vir como número (0) ou texto ("0") dependendo do firmware
 * - Result às vezes vem como string JSON (serializada duas vezes)
 */
function parseCameraJson(text: string): CameraJsonResponse {
  const fixed = text.replace(/,\s*\]\}/, ']}'); // bug de vírgula do getfilecount.cgi
  const parsed = JSON.parse(fixed);

  const resultCode = String(parsed?.ResultCode ?? '');
  let result = parsed?.Result ?? null;
  if (typeof result === 'string') {
    try {
      result = JSON.parse(result);
    } catch {
      // mantém como string
    }
  }

  return { ResultCode: resultCode, Result: result };
}

export class Real70maiProtocol {
  // ---------- HTTP ----------

  private async httpGetText(url: string, timeoutMs = 8000): Promise<{ status: number; text: string }> {
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

  // ---------- Autenticação ----------

  isPaired(): boolean {
    return !!localStorage.getItem(TOKEN_STORAGE_KEY);
  }

  unpair(): void {
    localStorage.removeItem(TOKEN_STORAGE_KEY);
  }

  /** Exporta o token pareado (para importar em outro aparelho sem re-parear na câmera) */
  exportToken(): string | null {
    return this.getToken();
  }

  /** Importa um token existente (mesmo valor = mesmos direitos na câmera) */
  importToken(token: string): boolean {
    const clean = token.trim().toLowerCase();
    if (!/^[0-9a-f]{32}$/.test(clean)) return false;
    localStorage.setItem(TOKEN_STORAGE_KEY, clean);
    return true;
  }

  private getToken(): string | null {
    return localStorage.getItem(TOKEN_STORAGE_KEY);
  }

  private pairKey(payload: string): string {
    return md5(payload + MAGIC_STRING);
  }

  /**
   * Assina e executa um comando cardvapi autenticado.
   * GET /cgi-bin/<command>?-<param>=...&-timestamp=...&-signkey=...
   */
  private async command(
    command: string,
    params: Record<string, string | number> = {},
    timeoutMs = 8000,
  ): Promise<CameraJsonResponse> {
    const token = this.getToken();
    if (!token) throw new Error('Câmera não pareada');

    const query: Record<string, string> = {};
    for (const [key, value] of Object.entries(params)) {
      query['-' + key] = String(value);
    }
    query['-timestamp'] = String(Math.floor(Date.now() / 1000));

    const paramsStr = Object.entries(query).map(([k, v]) => `${k}=${v}`).join('&');
    query['-signkey'] = md5(`${command}?${paramsStr}${token}`);

    const url = `${BASE_URL}/cgi-bin/${command}?` +
      Object.entries(query).map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(v)}`).join('&');

    const { text } = await this.httpGetText(url, timeoutMs);
    if (!text) throw new Error('Resposta vazia da câmera');

    try {
      return parseCameraJson(text);
    } catch {
      throw new Error(`Resposta inválida da câmera: ${text.slice(0, 120)}`);
    }
  }

  // ---------- Pareamento ----------
  // Fluxo: 1) BindByBanya com seed → 2) usuário aperta o botão da câmera
  //        3) UserconfirmByBanya em polling → 4) registra cliente

  async pair(onProgress: (message: string) => void): Promise<boolean> {
    try {
      // 1) Envia seed token
      onProgress('Enviando solicitação de pareamento...');
      const seed = Array.from(crypto.getRandomValues(new Uint8Array(16)))
        .map(b => b.toString(16).padStart(2, '0'))
        .join('');

      const bindUrl = `${BASE_URL}/cgi-bin/BindByBanya.cgi?-usr=${seed}&-signkey=${this.pairKey(seed)}`;
      const { status, text } = await this.httpGetText(bindUrl);
      if (status !== 200) throw new Error(`HTTP ${status}`);

      const bindResp = parseCameraJson(text);
      const result = bindResp.Result as any;
      if (bindResp.ResultCode !== '0' || !result?.Token || !result?.timestamp) {
        throw new Error(`Pareamento recusado: ${text.slice(0, 200)}`);
      }

      const realToken: string = result.Token;
      const timestamp: string = result.timestamp;

      // 2/3) Aguarda confirmação física na câmera
      onProgress('⚠️ Aperte o botão de confirmação da câmera agora! (botão lateral, pisca/apita)');
      const confirmUrl = `${BASE_URL}/cgi-bin/UserconfirmByBanya.cgi?-timestamp=${timestamp}&-signkey=${this.pairKey(timestamp)}`;

      for (let attempt = 0; attempt < 30; attempt++) {
        await new Promise(r => setTimeout(r, 1000));
        try {
          const { text: confirmText } = await this.httpGetText(confirmUrl, 4000);
          const confirmResp = parseCameraJson(confirmText);
          if (confirmResp.ResultCode === '0') {
            // 4) Registra o cliente com o token definitivo
            localStorage.setItem(TOKEN_STORAGE_KEY, realToken);
            onProgress('Confirmado! Registrando app...');
            await this.command('client.cgi', { operation: 'register', ip: '192.168.0.2' });
            onProgress('✅ Câmera pareada com sucesso!');
            return true;
          }
        } catch {
          // tenta de novo
        }
      }

      throw new Error('Tempo esgotado aguardando a confirmação na câmera');
    } catch (error: any) {
      onProgress(`❌ Falha no pareamento: ${error.message ?? error}`);
      return false;
    }
  }

  // ---------- Estado ----------

  /** Alcançabilidade de rede (sem auth): útil para saber que estamos no Wi-Fi certo */
  async handshake(): Promise<boolean> {
    for (const path of ['/', '/mnt/']) {
      try {
        const { status, text } = await this.httpGetText(`${BASE_URL}${path}`, 3000);

        // Qualquer resposta HTTP (até 404/503) prova que ALGO respondeu no IP.
        // No APK o celular está no Wi-Fi da câmera: 192.168.0.1 SÓ pode ser ela,
        // inclusive sem cartão SD (quando /mnt/ pode não existir -> 404).
        if (Capacitor.isNativePlatform() && status < 600) return true;

        // No navegador: valida o conteúdo para não confundir com o roteador da casa.
        if (status >= 200 && status < 400 &&
            /sd card|sdcard|mnt|Normal|Index of|MP4|href|cgi-bin/i.test(text)) {
          return true;
        }
      } catch {
        // tenta o próximo caminho
      }
    }
    return false;
  }

  /** Autenticado + respondendo (app funcional) */
  async getStatus(): Promise<boolean> {
    if (!this.isPaired()) return false;
    try {
      const resp = await this.command('getwifi.cgi', {}, 3000);
      return resp.ResultCode === '0';
    } catch {
      return false;
    }
  }

  async getSdState(): Promise<{ state: string; totalMb: number; usedMb: number } | null> {
    try {
      const resp = await this.command('getsdstate.cgi');
      const r = resp.Result as any;
      if (resp.ResultCode !== '0' || !r) return null;
      return {
        state: String(r.sdstate ?? ''),
        totalMb: parseInt(String(r.sdtotal ?? '0'), 10),
        usedMb: parseInt(String(r.sdused ?? '0'), 10),
      };
    } catch {
      return null;
    }
  }

  // ---------- Arquivos ----------

  async getFileList(type = 0): Promise<{ path: string; name: string; size: number }[]> {
    try {
      const counts = await this.command('getfilecount.cgi');
      const list = counts.Result as any[];
      if (counts.ResultCode !== '0' || !Array.isArray(list)) return [];

      const entry = list.find(item => Number(item.type) === type);
      const count = entry ? Number(entry.count) : 0;
      if (count <= 0) return [];

      const files = await this.command('getfilelist.cgi', { start: 1, end: count, type });
      const rows = files.Result as any[];
      if (files.ResultCode !== '0' || !Array.isArray(rows)) return [];

      return rows
        .filter(row => /\.mp4$/i.test(String(row.name)))
        .map(row => {
          let size = Number(row.size) || 0;
          if (size <= 0) size += 4 * 1024 ** 3; // size é int32 e vira negativo em arquivos grandes
          return { path: String(row.path), name: String(row.name), size };
        })
        .sort((a, b) => a.name.localeCompare(b.name));
    } catch (error) {
      console.error('Erro ao listar arquivos:', error);
      return [];
    }
  }

  fileUrl(path: string, name: string): string {
    return `${BASE_URL}/${path}/${name}`;
  }

  async getLatestVideoUrl(): Promise<string | null> {
    const files = await this.getFileList(0);
    if (files.length === 0) return null;
    const latest = files[files.length - 1]; // ordenado por nome = cronológico
    return this.fileUrl(latest.path, latest.name);
  }

  async downloadVideo(url: string): Promise<Blob> {
    if (Capacitor.isNativePlatform()) {
      const resp = await CapacitorHttp.get({
        url,
        responseType: 'blob',
        connectTimeout: 5000,
        readTimeout: 120000,
      });
      if (resp.status < 200 || resp.status >= 400) throw new Error(`Falha no download: HTTP ${resp.status}`);
      return base64ToBlob(resp.data as string, 'video/mp4');
    }

    const response = await fetch(url);
    if (!response.ok) throw new Error(`Falha no download: ${response.statusText}`);
    return await response.blob();
  }

  // ---------- Controle ----------

  async setRecording(enable: boolean): Promise<boolean> {
    try {
      const resp = await this.command('setaccessalbum.cgi', { enable: enable ? 1 : 0 });
      return resp.ResultCode === '0';
    } catch {
      return false;
    }
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
