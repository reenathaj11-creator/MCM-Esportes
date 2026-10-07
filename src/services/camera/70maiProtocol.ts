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
const CLIENT_IP_KEY = 'mcm_70mai_client_ip';
const BASE_URL = 'http://192.168.0.1';

/** IPs prováveis do celular na rede da câmera (o .2 é o mais comum) */
const IP_CANDIDATES = [
  '192.168.0.2', '192.168.0.3', '192.168.0.4',
  '192.168.0.5', '192.168.0.10', '192.168.0.20',
];

/** Descobre IPs locais via WebRTC (sem permissão; pode vir mascarado em alguns Chromes) */
function detectLocalIps(timeoutMs = 2500): Promise<string[]> {
  return new Promise(resolve => {
    const found = new Set<string>();
    try {
      const pc = new RTCPeerConnection({ iceServers: [] });
      pc.createDataChannel('x');
      const timer = setTimeout(() => { try { pc.close(); } catch { /* ignore */ } resolve([...found]); }, timeoutMs);
      pc.onicecandidate = e => {
        if (!e.candidate) {
          clearTimeout(timer);
          try { pc.close(); } catch { /* ignore */ }
          resolve([...found]);
          return;
        }
        const m = /(\d{1,3}(?:\.\d{1,3}){3})/.exec(e.candidate.candidate);
        if (m && m[1] !== '127.0.0.1' && !m[1].startsWith('0.')) found.add(m[1]);
      };
      pc.createOffer()
        .then(o => pc.setLocalDescription(o))
        .catch(() => { clearTimeout(timer); resolve([...found]); });
    } catch {
      resolve([...found]);
    }
  });
}

interface CameraJsonResponse {
  ResultCode: string;
  Result?: Record<string, unknown> | unknown[] | null;
}

/**
 * Normaliza a resposta da câmera, aceitando os 2 formatos observados:
 * - JSON: {"ResultCode": 0, "Result": {...}}   (interpolação varia número/texto)
 * - Texto puro: "resultcode: 0\nToken: abc\n..." (M310 Plus)
 */
function parseCameraJson(text: string): CameraJsonResponse {
  const fixed = text.replace(/,\s*\]\}/, ']}'); // bug de vírgula do getfilecount.cgi

  // 1) Tenta JSON
  try {
    const parsed = JSON.parse(fixed);
    let result = parsed?.Result ?? null;
    if (typeof result === 'string') {
      try { result = JSON.parse(result); } catch { /* mantém string */ }
    }
    return { ResultCode: String(parsed?.ResultCode ?? ''), Result: result };
  } catch {
    // segue para texto puro
  }

  // 2) Texto puro: linhas "chave: valor" ou "chave=valor" (case-insensitive)
  const map: Record<string, string> = {};
  for (const line of text.split(/\r?\n/)) {
    const m = line.match(/^\s*([\w.\-]+)\s*[:=]\s*(.+?)\s*$/);
    if (m) map[m[1].toLowerCase()] = m[2];
  }

  return {
    ResultCode: map['resultcode'] ?? map['result_code'] ?? '',
    Result: map,
  };
}

export class Real70maiProtocol {
  // ---------- HTTP ----------

  private async httpGetText(url: string, timeoutMs = 8000, headers: Record<string, string> = {}): Promise<{ status: number; text: string }> {
    if (Capacitor.isNativePlatform()) {
      const resp = await CapacitorHttp.get({ url, connectTimeout: timeoutMs, readTimeout: timeoutMs, headers });
      const text = typeof resp.data === 'string' ? resp.data : JSON.stringify(resp.data ?? '');
      return { status: resp.status, text };
    }

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), timeoutMs);
    const resp = await fetch(url, { signal: controller.signal, cache: 'no-store', headers });
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

  /** Monta a URL assinada de um comando cardvapi (timestamp + signkey MD5) */
  private signedUrl(command: string, params: Record<string, string | number> = {}): string {
    const token = this.getToken();
    if (!token) throw new Error('Câmera não pareada');

    const query: Record<string, string> = {};
    for (const [key, value] of Object.entries(params)) {
      query['-' + key] = String(value);
    }
    query['-timestamp'] = String(Math.floor(Date.now() / 1000));

    const paramsStr = Object.entries(query).map(([k, v]) => `${k}=${v}`).join('&');
    query['-signkey'] = md5(`${command}?${paramsStr}${token}`);

    return `${BASE_URL}/cgi-bin/${command}?` +
      Object.entries(query).map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(v)}`).join('&');
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
    const url = this.signedUrl(command, params);
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

  async pair(onProgress: (message: string) => void, accountId?: string): Promise<boolean> {
    let bindText = '';
    let lastConfirm = '';
    const seenCodes = new Set<string>();
    try {
      // 1) Bind pelo fluxo LEGADO (BindByBanya.cgi) — era o que pareava em campo.
      //    usr numérico: ID real da conta 70mai se informado, senão aleatório.
      //    Se a câmera responder "seca" (sem token), tenta de novo com um seed hex.
      onProgress('Enviando solicitação de pareamento...');
      const cleanId = (accountId ?? '').trim();
      const numericId = /^\d+$/.test(cleanId)
        ? cleanId
        : String(Math.floor(1000000 + Math.random() * 9000000));
      if (/^\d+$/.test(cleanId)) onProgress('Usando ID da sua conta 70mai...');

      const doBind = async (usr: string): Promise<{ token: string; timestamp: string }> => {
        const url = `${BASE_URL}/cgi-bin/BindByBanya.cgi?&-usr=${usr}&-signkey=${this.pairKey(usr)}`;
        const { status, text } = await this.httpGetText(url);
        bindText = text;
        if (status !== 200) throw new Error(`HTTP ${status}: ${text.slice(0, 200)}`);
        const resp = parseCameraJson(text);
        if (resp.ResultCode !== '0') throw new Error(`Pareamento recusado: ${text.slice(0, 200)}`);
        const result = resp.Result as Record<string, unknown> | null;
        return {
          token: String(result?.Token ?? result?.token ?? ''),
          timestamp: String(result?.timestamp ?? result?.Timestamp ?? ''),
        };
      };

      let bind = await doBind(numericId).catch(() => null);
      let seed = '';
      if (!bind || !bind.token || !bind.timestamp) {
        // Fallback: M310 Plus com resposta "resultcode: 0" seca aceita o seed
        seed = Array.from(crypto.getRandomValues(new Uint8Array(16)))
          .map(b => b.toString(16).padStart(2, '0'))
          .join('');
        bind = await doBind(seed);
        if (!bind.timestamp) bind.timestamp = String(Math.floor(Date.now() / 1000));
      }
      // M300 devolve um Token novo no corpo; na resposta seca usa-se o seed.
      const realToken = bind.token || seed;

      // 2/3) Aguarda confirmação física na câmera
      onProgress(bind.token
        ? 'Câmera respondeu com token. Aperte o botão dela agora!'
        : 'Câmera aceitou o vínculo (sem token na resposta — usando o seed). Aperte o botão dela agora!');
      const confirmUrl = `${BASE_URL}/cgi-bin/UserconfirmByBanya.cgi?&-timestamp=${bind.timestamp}&-signkey=${this.pairKey(bind.timestamp)}`;

      for (let attempt = 0; attempt < 30; attempt++) {
        await new Promise(r => setTimeout(r, 1000));
        try {
          const { text: confirmText, status: confirmStatus } = await this.httpGetText(confirmUrl, 4000);
          lastConfirm = `HTTP ${confirmStatus}: ${confirmText.slice(0, 160)}`;
          const confirmResp = parseCameraJson(confirmText);
          seenCodes.add(confirmResp.ResultCode || '(vazio)');
          if (attempt % 5 === 0 || attempt < 2) {
            onProgress(`⚠️ Aperte o botão de confirmação da câmera agora! (${attempt + 1}s/30s) Última: ${lastConfirm}`);
          }
          if (confirmResp.ResultCode === '0') {
            // 4) Registra o cliente com o token definitivo
            localStorage.setItem(TOKEN_STORAGE_KEY, realToken);
            onProgress('Confirmado! Registrando app...');
            await this.registerClient(); // best-effort (só existe nos Hisi)

            // 5) Validação real: um comando autenticado tem que funcionar
            onProgress('Validando acesso...');
            const check = await this.command('getwifi.cgi', {}, 4000);
            if (check.ResultCode === '0') {
              onProgress('✅ Câmera pareada com sucesso!');
              return true;
            }
            // Token não valeu: desfaz para permitir nova tentativa limpa
            localStorage.removeItem(TOKEN_STORAGE_KEY);
            throw new Error(`Token rejeitado pela câmera. Resposta: ${JSON.stringify(check).slice(0, 200)}`);
          }
          if (confirmResp.ResultCode === '701') {
            throw new Error(`Câmera recusou o pareamento (701): ${confirmText.slice(0, 160)}`);
          }
        } catch (e: any) {
          if (/Token rejeitado|recusou o pareamento/.test(e?.message ?? '')) throw e;
          if (!lastConfirm) lastConfirm = `erro: ${String(e?.message ?? e).slice(0, 120)}`;
          // tenta de novo
        }
      }

      throw new Error(`Tempo esgotado aguardando a confirmação na câmera. Bind: ${bindText.slice(0, 200)} | Códigos vistos: ${[...seenCodes].join(', ') || '(nenhum)'} | Última confirm: ${lastConfirm || '(sem resposta)'}`);
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

  // ---------- Modo álbum / registro / controle ----------

  /** Avisa a câmera que um app está conectado (o app oficial envia a cada poucos segundos) */
  async registerClient(): Promise<boolean> {
    try {
      return (await this.debugRegister()).code === '0';
    } catch {
      return false;
    }
  }

  /**
   * Registro no formato EXATO do app oficial (PCAPdroid 10/06, conexão #97):
   *   GET /cgi-bin/client.cgi?&operation=register&ip=192.168.1.15
   *       &timestamp=<seg>&signkey=<md5 sem hífens + token>
   *   headers _os_: Android, _ver_: 4.4.0, _product_: 70mai
   *   → {"ResultCode":"0"}
   * O formato cardvapi com hífens (-operation=...) devolve -5555 na M310.
   * O ip 192.168.1.15 é constante no APK oficial (literal no DEX).
   */
  private async registerOfficial(): Promise<{ http: number; code: string; body: string }> {
    const token = this.getToken();
    if (!token) throw new Error('Câmera não pareada');
    const ts = String(Math.floor(Date.now() / 1000));
    const paramsStr = `operation=register&ip=192.168.1.15&timestamp=${ts}`;
    const sign = md5(`client.cgi?${paramsStr}${token}`);
    const url = `${BASE_URL}/cgi-bin/client.cgi?&${paramsStr}&signkey=${sign}`;
    const { status, text } = await this.httpGetText(url, 8000, {
      '_os_': 'Android',
      '_ver_': '4.4.0',
      '_product_': '70mai',
    });
    let code = '';
    try { code = parseCameraJson(text).ResultCode || '(vazio)'; }
    catch { code = '(binário/ilegível)'; }
    return { http: status, code, body: text.slice(0, 120) };
  }

  /**
   * Registra o app na câmera. Tenta 1º o formato oficial (sem hífens,
   * ip 192.168.1.15); se falhar, cai no formato cardvapi com o IP real.
   */
  async debugRegister(): Promise<{ http: number; code: string; body: string }> {
    let officialNote = '';
    try {
      const official = await this.registerOfficial();
      if (official.code === '0') {
        localStorage.setItem(CLIENT_IP_KEY, '192.168.1.15');
        return { http: official.http, code: official.code, body: 'oficial ip=192.168.1.15 ok' };
      }
      officialNote = `oficial ${official.http}/${official.code} ${official.body.slice(0, 60)} | `;
    } catch (e: any) {
      officialNote = `oficial erro ${String(e?.message ?? e).slice(0, 60)} | `;
    }
    const tried: string[] = [];
    const cached = localStorage.getItem(CLIENT_IP_KEY);
    const rtcIps = await detectLocalIps().catch(() => [] as string[]);
    const queue = [
      ...new Set([
        ...(cached ? [cached] : []),
        ...rtcIps.filter(ip => ip.startsWith('192.168.0.')),
        ...IP_CANDIDATES,
      ]),
    ].slice(0, 8);
    let last: { http: number; code: string; body: string } = { http: 0, code: 'erro', body: 'sem resposta' };
    for (const ip of queue) {
      tried.push(ip);
      last = await this.debugCommand('client.cgi', { operation: 'register', ip });
      if (last.code === '0') {
        localStorage.setItem(CLIENT_IP_KEY, ip);
        return { http: last.http, code: last.code, body: `ip=${ip} ok (ordem: ${tried.join(',')})` };
      }
    }
    return { http: last.http, code: last.code, body: `${officialNote}falhou em ${tried.join(',')} | última: ${last.body}` };
  }

  /**
   * Testa matriz IP × construção de signkey no client.cgi oficial.
   * Fundo: PCAPdroid mostra nossa requisição byte-igual à oficial (#97)
   * exceto signkey/timestamp, mas tudo volta -5555 — então varia o que
   * pode entrar no hash (leading &, path) e o IP (conflito com o registro
   * do app oficial no mesmo 192.168.1.15). Reporta hits code 0 + total.
   */
  async testRegisterFormats(): Promise<string> {
    const token = this.getToken();
    if (!token) return 'sem token pareado';
    const ts = String(Math.floor(Date.now() / 1000));
    const headers = {
      '_os_': 'Android', '_ver_': '4.4.0', '_product_': '70mai',
      'User-Agent': 'volley/0',
    };
    const ips = ['192.168.1.15', '192.168.0.20', '192.168.1.16'];
    const hits: string[] = [];
    let tried = 0;
    for (const ip of ips) {
      const base = `operation=register&ip=${ip}&timestamp=${ts}`;
      const variants: Array<[string, string]> = [
        ['cmd?+token', md5(`client.cgi?${base}${token}`)],
        ['raw&', md5(`client.cgi?${'&' + base}${token}`)],
        ['path', md5(`/cgi-bin/client.cgi?${'&' + base}${token}`)],
        ['params+token', md5(`${base}${token}`)],
        ['sem token', md5(`client.cgi?${base}`)],
      ];
      for (const [name, sign] of variants) {
        tried++;
        try {
          const url = `${BASE_URL}/cgi-bin/client.cgi?&${base}&signkey=${sign}`;
          const { text } = await this.httpGetText(url, 5000, headers);
          let code = '';
          try { code = parseCameraJson(text).ResultCode || '(vazio)'; }
          catch { code = '(ilegível)'; }
          if (code === '0') hits.push(`HIT ip=${ip} ${name}`);
        } catch { /* tenta próxima */ }
      }
    }
    if (hits.length > 0) return hits.join(' | ');
    return `0 hits em ${tried} tentativas (3 ips x 5 algos), tudo -5555 ou erro`;
  }

  /**
   * URL de preview (live/static MJPEG) ASSINADA com o token pareado.
   * A M310 exige timestamp+signkey até no stream (sem isso: resultcode -4444).
   */
  previewUrl(kind: 'live' | 'static' | 'live-cgi' | 'static-cgi'): string {
    const cmd =
      kind === 'live' ? 'liveMJPEG'
      : kind === 'static' ? 'staticMJPEG'
      : kind === 'live-cgi' ? 'liveMJPEG.cgi'
      : 'staticMJPEG.cgi';
    try {
      return this.signedUrl(cmd);
    } catch {
      return `${BASE_URL}/cgi-bin/${cmd}`;
    }
  }

  /** URL assinada pronta (para <img>/fetch manual) */
  signedCommandUrl(command: string, params: Record<string, string | number> = {}): string {
    return this.signedUrl(command, params);
  }

  /** Resposta crua (até 8KB) para diagnóstico em campo */
  async debugRaw(command: string, params: Record<string, string | number> = {}): Promise<{ http: number; text: string }> {
    const url = this.signedUrl(command, params);
    const { status, text } = await this.httpGetText(url, 15000);
    return { http: status, text: text.slice(0, 8000) };
  }

  /** Config.cgi no formato EXATO do app oficial: sem hífens, timestamp em ms.
   *  Ex.: configRaw('get','Camera.Preview.RTSP.av') ou configRaw('set','Video','capture').
   *  É por aqui que saem snapshot (Video=capture) e o modo de preview (RTSP.av). */
  async configRaw(action: 'get' | 'set', prop: string, value?: string): Promise<{ http: number; text: string }> {
    const token = this.getToken();
    if (!token) throw new Error('Câmera não pareada');
    const ts = String(Date.now());
    const kv = value === undefined ? prop : `${prop}=${value}`;
    const base = `action=${action}&${kv}&timestamp=${ts}`;
    const sign = md5(base + token);
    const url = `${BASE_URL}/cgi-bin/Config.cgi?${base}&signkey=${sign}`;
    const { status, text } = await this.httpGetText(url, 15000);
    return { http: status, text: text.slice(0, 8000) };
  }

  /**
   * Liga o servidor de stream antes do RTSP (fluxo do app oficial).
   * Ordem: álbum OFF (volta a gravar) -> setwifistream enable=1 -> consulta RTSP.av.
   * Best-effort: nunca lança, devolve log curto para exibir na tela.
   */
  async enableLiveStream(): Promise<string> {
    const logs: string[] = [];
    try { await this.command('setaccessalbum.cgi', { enable: 0 }).catch(() => null); } catch { /* best-effort */ }
    // O app oficial registra o cliente a cada poucos segundos e a câmera
    // valida o IP de origem (register com IP errado devolve -5555).
    // Sem register válido o servidor RTSP pode ficar mudo.
    try {
      const reg = await this.debugRegister();
      logs.push(`register: ${reg.code} ${reg.body.slice(0, 60)}`);
    } catch (e: any) {
      logs.push(`register: ${String(e?.message ?? e).slice(0, 60)}`);
    }
    try {
      const r = await this.debugCommand('setwifistream.cgi', { enable: 1 });
      logs.push(`setwifistream enable=1: HTTP ${r.http} code ${r.code}`);
    } catch (e: any) {
      logs.push(`setwifistream: ${String(e?.message ?? e).slice(0, 60)}`);
    }
    try {
      const r = await this.configRaw('get', 'Camera.Preview.RTSP.av');
      logs.push(`RTSP.av: HTTP ${r.http} ${r.text.slice(0, 80)}`);
    } catch (e: any) {
      logs.push(`RTSP.av: ${String(e?.message ?? e).slice(0, 60)}`);
    }
    return logs.join(' | ');
  }

  /** GET livre em path da câmera (ex.: / , /etc/passwd) — só leitura, sem auth */
  async debugGet(path: string): Promise<{ http: number; text: string }> {
    const p = path.startsWith('/') ? path : `/${path}`;
    const { status, text } = await this.httpGetText(`${BASE_URL}${p}`, 10000);
    return { http: status, text: text.slice(0, 4000) };
  }

  /** Executa um comando e devolve o cru (HTTP + código + trecho) para diagnóstico em campo */
  async debugCommand(
    command: string,
    params: Record<string, string | number> = {},
  ): Promise<{ http: number; code: string; body: string }> {
    try {
      const url = this.signedUrl(command, params);
      const { status, text } = await this.httpGetText(url, 8000);
      let code = '';
      try {
        code = parseCameraJson(text).ResultCode || '(vazio)';
      } catch {
        code = '(binário/ilegível)';
      }
      return { http: status, code, body: text.slice(0, 120) };
    } catch (e: any) {
      return { http: 0, code: 'erro', body: String(e?.message ?? e).slice(0, 120) };
    }
  }

  async setRecording(enable: boolean): Promise<boolean> {
    return this.setAlbumMode(enable);
  }

  /**
   * Modo álbum da 70mai (setaccessalbum.cgi): pausa a gravação em loop e
   * libera preview MJPEG + listagem/download. Exigido antes do liveMJPEG
   * (sem ele a câmera responde resultcode -4444).
   */
  async setAlbumMode(enable: boolean): Promise<boolean> {
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
