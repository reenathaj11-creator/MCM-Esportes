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
      // Tenta um simples GET na raiz ou diretório para ver se a câmera responde
      const response = await fetch(`${this.baseUrl}/mnt/`, { method: 'GET', mode: 'no-cors' });
      // no-cors não nos dá status legível, então assumimos conectado se não lançar exceção
      return true;
    } catch (e) {
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
