import { MediaFile } from '../../types/camera';

/**
 * Protocolo real para a Xiaomi 70mai (M300 / M310 Plus)
 * Baseado na análise do APK 4.3.1
 */
export class Real70maiProtocol {
  private ip = '192.168.0.1';
  private baseUrl = `http://${this.ip}`;
  
  // Como confirmamos via fotos do painel, a câmera expõe a árvore de diretórios via HTTP.
  // O cartão SD fica montado em /mnt/sd/
  private sdCardUrl = `${this.baseUrl}/mnt/sd/Normal/`;

  async getStatus() {
    try {
      // Valida pelo CONTEÚDO: só considera conectado se o 192.168.0.1 responder
      // algo que só a câmera teria (a listagem do /mnt/ com a pasta do cartão SD).
      // Evita falso positivo quando 192.168.0.1 é o roteador da casa do usuário.
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 3000);

      const response = await fetch(`${this.baseUrl}/mnt/`, {
        signal: controller.signal,
        cache: 'no-store',
      });
      clearTimeout(timeout);

      if (!response.ok) return false;
      const text = await response.text();
      return /sd card|sdcard|mnt\/sd|MP4|Index of/i.test(text);
    } catch {
      return false;
    }
  }

  async getFileList() {
    try {
      const response = await fetch(this.sdCardUrl);
      if (!response.ok) throw new Error('Não foi possível ler o diretório.');
      
      const text = await response.text();
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

  async downloadVideo(url: string) {
    const response = await fetch(url);
    if (!response.ok) throw new Error(`Falha no download: ${response.statusText}`);
    return await response.blob();
  }
}
