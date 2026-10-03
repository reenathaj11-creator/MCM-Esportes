# Troubleshooting (Resolução de Problemas)

## Problemas de Conexão Wi-Fi
**Sintoma:** O celular não consegue se conectar à rede Wi-Fi da câmera.
**Solução:**
- A senha padrão na maioria das EK7000 é `1234567890`. Verifique na tela da câmera quando o Wi-Fi for ativado.
- Se a senha estiver incorreta, você pode redefini-la nas configurações da câmera (via botões físicos).

## Acesso à Internet Indisponível
**Sintoma:** Ao conectar no Wi-Fi da câmera, o celular avisa "Sem conexão com a internet" e tenta usar 4G/5G, derrubando a conexão com a câmera.
**Solução:**
- **Android:** Nas configurações de Wi-Fi, quando avisado sobre a falta de internet, marque a opção "Manter conexão" ou "Não perguntar novamente". Desativar temporariamente os Dados Móveis pode forçar o tráfego pela rede Wi-Fi.
- **iOS:** Desative "Assistência Wi-Fi" em Ajustes -> Celular, para evitar que o iPhone volte para os dados móveis.

## Erros de CORS (Cross-Origin Resource Sharing)
**Sintoma:** O Diagnóstico mostra que a câmera está acessível por IP, mas o navegador bloqueia a requisição HTTP.
**Explicação:** Navegadores modernos impõem políticas estritas de segurança que impedem que um site HTTPS na internet acesse diretamente dispositivos HTTP (sem criptografia) na rede local. Além disso, a câmera pode não retornar os cabeçalhos `Access-Control-Allow-Origin`.
**Solução (MVP/Desenvolvimento):**
- Teste usando o aplicativo em HTTP local (sem HTTPS), como o gerado pelo Vite (`http://192.168.1.X:5173`).
- **Chrome:** Vá para `chrome://flags/#block-insecure-private-network-requests` e mude para **Disabled**.

## O PWA não funciona offline
**Sintoma:** Ao perder a conexão com a internet (para conectar na câmera), o aplicativo não abre na tela inicial.
**Solução:**
- O Service Worker deve estar registrado corretamente e armazenando todos os assets estáticos no Cache API. Acesse o aplicativo ao menos uma vez enquanto tiver internet antes de se conectar ao Wi-Fi da câmera.

## Versões de Firmware Incompatíveis
**Sintoma:** A página Diagnóstico indica falha no "Status Endpoint" ou "Firmware Identified".
**Solução:**
- A AKASO EK7000 possui dezenas de revisões internas. Se os endpoints documentados não funcionarem, será necessário capturar o tráfego do app original (AKASO GO ou iSmart DV) usando um Proxy para descobrir a URL correta do seu modelo.
