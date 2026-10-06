# Protocolo das Câmeras 70mai — Análise Real do APK v4.3.1

> **Fonte:** Engenharia reversa do APK `com.banyac.midrive.app.intl_4.3.1`, extraído do APKMirror.  
> Análise via extração de strings dos arquivos DEX (`classes.dex` a `classes6.dex`).  
> Data da análise: 2026-09-26

---

## ✅ O que foi confirmado no código do app

### 1. IP e RTSP — CONFIRMADOS

```
rtsp://192.168.0.1:554/livestream/12
```

- **IP padrão:** `192.168.0.1`
- **Porta RTSP:** `554`
- **Path do live stream:** `/livestream/12`
- **Resolução do stream:** Provavelmente baixa (preview, não gravação)
- **Nível de confiança:** ✅ ALTO — string literal encontrada no DEX

---

### 2. Endpoints HTTP/CGI — CONFIRMADOS

Encontrados literalmente no `classes3.dex`:

| Endpoint | Descrição provável |
|---|---|
| `/cgi-bin/Config.cgi` | Configuração geral (câmera, gravação, loop) |
| `/cgi-bin/fileupload.cgi` | Upload de arquivo para a câmera |
| `/cgi-bin/FWupload.cgi` | Upload de firmware |
| `/cgi-bin/FWupload7zip.cgi` | Upload de firmware comprimido |
| `/cgi-bin/liveMJPEG` | Live preview via MJPEG (HTTP stream de imagens) |
| `/cgi-bin/staticMJPEG` | Preview estático via MJPEG |
| `/cgi-bin2/Config.cgi` | Configuração alternativa (versão 2 do CGI) |
| `getgpsfilelist.cgi` | Lista de arquivos GPS |

> ⚠️ Os parâmetros (`?cmd=`, `?action=`, etc.) são passados via `GET` ou `POST`. Precisam ser capturados via Wireshark/proxy para identificar exatamente quais parâmetros cada endpoint aceita.

---

### 3. Sistema de Autenticação — signkey CONFIRMADO

```
signkey
&signkey=
```

- O app usa um parâmetro `signkey` em algumas requisições.  
- Esse parâmetro é um hash/assinatura calculado dinamicamente pelo app para autenticar comandos sensíveis (como iniciar/parar gravação).
- **Para contornar:** Capturar o `signkey` via Wireshark enquanto usa o app oficial, ou fazer engenharia reversa da classe Java responsável por gerar o hash.

---

### 4. Nomes de Modelos Internos — CONFIRMADOS

O app suporta esses modelos de hardware (identificados nos nomes de classe Java):

| Classe Java Interna | Chip | Modelo Provável |
|---|---|---|
| `Mai1400DashCam` | Mstar | M300 (base, 1080p) |
| `Mai1400DashCam3K` | Mstar | M300 (3K) |
| `Mai14003KDashCam` | Mstar | M310 Plus (3K) |
| `Mai14004KDashCam` | Mstar | Modelos 4K |
| `MaiHisiDashCam` | HiSilicon | Linha Hisi (LTE/4G) |
| `Mai2840HisiDashCam` | HiSilicon | Modelos LTE avançados |

> 🎯 O **M300** e o **M310 Plus** estão ambos provavelmente no grupo `Mai1400` (chip Mstar). Isso significa que **compartilham o mesmo protocolo CGI**. A M310 Plus provavelmente é `Mai14003KDashCam` (variante 3K do chip 1400).

---

### 5. Estrutura de Arquivos no SD Card

Encontrado nos strings:

```
R.MP4        → Arquivo de gravação normal (ex: 20240926_143200R.MP4)
RS.MP4       → Arquivo de gravação de estacionamento/segurança
temp.mp4     → Arquivo temporário (gravação em andamento)
temp_rs.mp4  → Arquivo temporário de segurança
```

- Os arquivos de gravação em loop ficam com sufixo **`R.MP4`**
- O arquivo ainda sendo gravado aparece como **`temp.mp4`**
- A pasta de acesso é provavelmente acessível via HTTP direto: `http://192.168.0.1/sdcard/Normal/`

---

### 6. Listagem de Arquivos

Encontrados:

```
fileList
filelist=
getFileList
getMediaList
setFileList
setMediaList
```

Esses são métodos internos do app para obter a lista de arquivos da câmera. A chamada HTTP correspondente é provavelmente:

```
GET http://192.168.0.1/cgi-bin/Config.cgi?action=getfilelist
```
ou
```
GET http://192.168.0.1/cgi-bin/Config.cgi?cmd=getMediaList
```

> ⚠️ O formato exato dos parâmetros ainda precisa ser capturado via Wireshark ou proxy (como Charles Proxy ou Proxyman) com o app oficial conectado à câmera.

---

### 7. Live Preview MJPEG

Confirmado no DEX:

```
/cgi-bin/liveMJPEG
/cgi-bin/staticMJPEG
```

Isso significa que a câmera transmite preview via **MJPEG** (um stream de imagens JPEG rápidas), além do RTSP. O MJPEG é mais fácil de usar em um `<img>` HTML com refresh rápido ou `<video>` via MediaSource API.

Provável URL:
```
http://192.168.0.1/cgi-bin/liveMJPEG
```

---

### 8. Acesso Direto ao SD Card

Encontrado:
```
/sdcard/
SDCard
SDCardInfo
```

Muito provável que os arquivos MP4 possam ser baixados diretamente via HTTP:
```
http://192.168.0.1/sdcard/Normal/20240926_143200R.MP4
```

---

## 🧱 Arquitetura do App 70mai (descoberta)

O app usa **dois protocolos diferentes** dependendo do chip da câmera:

| Protocolo | Chip | Módulo Java |
|---|---|---|
| `cardvapi` | Mstar (M300, M310) | `com.banyac.dashcam.interactor.cardvapi.*` |
| `hisicardvapi` | HiSilicon (LTE models) | `com.banyac.dashcam.interactor.hisicardvapi.*` |

O **M300 e M310 Plus usam o protocolo `cardvapi` (Mstar)**. Toda a nossa implementação deve ser baseada nesse protocolo.

---

## ✅ Preview ao vivo — RESOLVIDO (2026-10-06)

O app oficial **não usa MJPEG** para o preview: ele toca o stream **RTSP**
(`rtsp://192.168.0.1:554/livestream/12`) com o player nativo **IjkPlayer/FFmpeg**
(`libijkplayer.so`, `playLiveStream`, config `Camera.Preview.RTSP.av` nos DEX).

Por isso o preview nunca funcionou no nosso app: a M310 Plus não serve
`/cgi-bin/liveMJPEG` e nenhum WebView/`<img>` toca RTSP.

**Solução implementada:** plugin nativo `RtspLivePlugin` (Capacitor) com
**ExoPlayer Media3 + módulo RTSP**, que sobrepõe um `PlayerView` ao WebView
no retângulo do container do preview (Main.tsx). Fallback para MJPEG/álbum
permanece para o navegador.

---

## ❓ O que ainda precisamos descobrir (via Wireshark/proxy)

1. **Parâmetros exatos do `Config.cgi`** para:
   - Listar arquivos normais
   - Obter status de gravação
   - Iniciar/parar gravação
   - Ler status do SD card

2. **Formato exato do `signkey`** (qual algoritmo gera o hash)

3. **Caminho exato das pastas no SD** (`Normal/`, `Event/`, etc.)

4. **Como o app distingue o arquivo mais recente** (por nome, timestamp, ou via API)

---

## Próximos Passos para Integração Real

1. Conectar um celular Android à câmera M300 ou M310 Plus pelo Wi-Fi.
2. Instalar o app **70mai** oficial.
3. Usar o **Proxyman** (iOS) ou **Charles Proxy** (Android) para capturar o tráfego HTTP entre o app e a câmera.
4. Registrar cada chamada feita (listar arquivos, preview, download) com todos os parâmetros.
5. Atualizar o arquivo `70maiProtocol.ts` com os endpoints reais capturados.
