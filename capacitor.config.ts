import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.mcm.esportes',
  appName: 'MCM Esportes',
  webDir: 'dist',
  android: {
    // Permite conteúdo HTTP dentro do app (necessário para falar com a câmera 192.168.0.1)
    allowMixedContent: true,
  },
  server: {
    // Origem do app vira http://localhost → chamadas HTTP à câmera não são mixed content
    androidScheme: 'http',
    // Libera cleartext (HTTP) nas requisições nativas
    cleartext: true,
  },
};

export default config;
