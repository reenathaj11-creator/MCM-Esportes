package com.mcm.esportes;

import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

import java.io.BufferedReader;
import java.io.InputStreamReader;
import java.io.OutputStream;
import java.net.InetSocketAddress;
import java.net.Socket;
import java.net.URI;
import java.nio.charset.StandardCharsets;

/**
 * Sonda RTSP da câmera 70mai: abre TCP e envia DESCRIBE, devolvendo o
 * status exato por path (200/401/404/timeout). Só diagnóstico.
 */
@CapacitorPlugin(name = "RtspProbe")
public class RtspProbePlugin extends Plugin {

    @PluginMethod
    public void describe(PluginCall call) {
        final String url = call.getString("url");
        if (url == null || url.isEmpty()) {
            call.reject("URL vazia");
            return;
        }
        new Thread(() -> {
            try {
                URI uri = new URI(url);
                String host = uri.getHost();
                int port = uri.getPort() == -1 ? 554 : uri.getPort();
                if (host == null) {
                    call.reject("Host inválido");
                    return;
                }
                Socket socket = new Socket();
                try {
                    socket.connect(new InetSocketAddress(host, port), 5000);
                    socket.setSoTimeout(6000);
                    StringBuilder headers = new StringBuilder();
                    int status = 0;
                    // Replica byte a byte o app oficial (PCAPdroid 10/06):
                    // OPTIONS com URL completa + User-Agent Lavf (FFmpeg).
                    // O servidor ("rtsp_demo") responde 200 a isso; com
                    // "OPTIONS *" ou outro User-Agent ele ficava mudo.
                    try {
                        String optReq = "OPTIONS " + url + " RTSP/1.0\r\n"
                                + "CSeq: 1\r\n"
                                + "User-Agent: Lavf58.12.100\r\n"
                                + "\r\n";
                        OutputStream optOut = socket.getOutputStream();
                        optOut.write(optReq.getBytes(StandardCharsets.US_ASCII));
                        optOut.flush();
                        headers.append(readHeaders(socket));
                    } catch (Exception e) {
                        headers.append("OPTIONS-erro: ").append(e.getMessage()).append("\n");
                    }
                    socket.close();
                    // 2) DESCRIBE no MESMO socket, CSeq 2, mesmo User-Agent
                    // (sequência exata do oficial: OPTIONS/1 → DESCRIBE/2).
                    try {
                        String req = "DESCRIBE " + url + " RTSP/1.0\r\n"
                                + "Accept: application/sdp\r\n"
                                + "CSeq: 2\r\n"
                                + "User-Agent: Lavf58.12.100\r\n"
                                + "\r\n";
                        OutputStream out = socket.getOutputStream();
                        out.write(req.getBytes(StandardCharsets.US_ASCII));
                        out.flush();
                        String desc = readHeaders(socket);
                        headers.append(desc);
                        // Extrai o status da primeira linha do DESCRIBE
                        String first = desc.contains("\n") ? desc.substring(0, desc.indexOf("\n")) : desc;
                        String[] parts = first.split(" ", 3);
                        if (parts.length >= 2) {
                            try { status = Integer.parseInt(parts[1]); } catch (NumberFormatException ignored) {}
                        }
                    } catch (Exception e) {
                        headers.append("DESCRIBE-erro: ").append(e.getMessage()).append("\n");
                    }
                    JSObject ret = new JSObject();
                    ret.put("ok", status == 200);
                    ret.put("status", status);
                    ret.put("detail", headers.toString());
                    call.resolve(ret);
                } finally {
                    try { socket.close(); } catch (Exception ignored) {}
                }
            } catch (Exception e) {
                JSObject ret = new JSObject();
                ret.put("ok", false);
                ret.put("status", 0);
                ret.put("detail", e.getClass().getSimpleName() + ": " + e.getMessage());
                call.resolve(ret);
            }
        }).start();
    }

    /**
     * Sonda HTTP na câmera (porta 80): devolve status, headers e os
     * primeiros bytes do corpo em HEX. Para stream infinito (FLV), o
     * começo do corpo prova que o endpoint transmite vídeo — o socket
     * é fechado logo em seguida para não baixar o stream inteiro.
     * path ex.: "/liveRTSP/av1"
     */
    @PluginMethod
    public void httpProbe(PluginCall call) {
        final String path = call.getString("path");
        final Integer portOpt = call.getInt("port");
        final int port = (portOpt == null || portOpt <= 0) ? 80 : portOpt;
        if (path == null || path.isEmpty()) {
            call.reject("Path vazio");
            return;
        }
        new Thread(() -> {
            try {
                Socket socket = new Socket();
                try {
                    socket.connect(new InetSocketAddress("192.168.0.1", port), 5000);
                    socket.setSoTimeout(6000);
                    String req = "GET " + path + " HTTP/1.0\r\n"
                            + "Host: 192.168.0.1\r\n"
                            + "User-Agent: MCM-Esportes\r\n"
                            + "Accept: */*\r\n"
                            + "\r\n";
                    socket.getOutputStream().write(req.getBytes(StandardCharsets.US_ASCII));
                    socket.getOutputStream().flush();
                    // Lê resposta como bytes crus (headers ASCII + corpo binário).
                    java.io.InputStream in = socket.getInputStream();
                    java.io.ByteArrayOutputStream head = new java.io.ByteArrayOutputStream();
                    int status = 0;
                    String headers = "";
                    try {
                        int prev3 = -1, prev2 = -1, prev1 = -1;
                        while (head.size() < 4000) {
                            int b = in.read();
                            if (b == -1) break;
                            head.write(b);
                            if (prev3 == '\r' && prev2 == '\n' && prev1 == '\r' && b == '\n') break;
                            prev3 = prev2; prev2 = prev1; prev1 = b;
                        }
                        headers = new String(head.toByteArray(), StandardCharsets.US_ASCII);
                        String first = headers.contains("\n") ? headers.substring(0, headers.indexOf("\n")) : headers;
                        String[] parts = first.trim().split(" ", 3);
                        if (parts.length >= 2) {
                            try { status = Integer.parseInt(parts[1]); } catch (NumberFormatException ignored) {}
                        }
                    } catch (java.net.SocketTimeoutException ste) {
                        headers = "(timeout lendo headers) " + new String(head.toByteArray(), StandardCharsets.US_ASCII);
                    }
                    // Primeiros bytes do corpo (até 32) em HEX — identifica
                    // FLV ("46 4C 56"), JPEG ("FF D8") ou JSON ("7B 22").
                    StringBuilder hex = new StringBuilder();
                    try {
                        // BufferedReader do readHeaders pode ter consumido o
                        // corpo junto; usa available() sem bloquear além do timeout.
                        long deadline = System.currentTimeMillis() + 4000;
                        int count = 0;
                        while (count < 32 && System.currentTimeMillis() < deadline) {
                            try {
                                int b = in.read();
                                if (b == -1) break;
                                if (hex.length() > 0) hex.append(" ");
                                String h = Integer.toHexString(b & 0xFF).toUpperCase();
                                if (h.length() == 1) hex.append("0");
                                hex.append(h);
                                count++;
                                if (in.available() == 0 && count >= 12) break;
                            } catch (java.net.SocketTimeoutException ste) {
                                break;
                            }
                        }
                        if (count == 0) hex.append("(corpo vazio/timeout)");
                    } catch (Exception e) {
                        hex.append("(corpo: ").append(e.getMessage()).append(")");
                    }
                    JSObject ret = new JSObject();
                    ret.put("ok", status == 200);
                    ret.put("status", status);
                    ret.put("detail", headers.toString() + "[corpo " + hex.toString() + "]");
                    call.resolve(ret);
                } finally {
                    try { socket.close(); } catch (Exception ignored) {}
                }
            } catch (Exception e) {
                JSObject ret = new JSObject();
                ret.put("ok", false);
                ret.put("status", 0);
                ret.put("detail", e.getClass().getSimpleName() + ": " + e.getMessage());
                call.resolve(ret);
            }
        }).start();
    }

    /** Lê os headers da resposta até a linha vazia (limite 2KB) */
    private String readHeaders(Socket socket) throws Exception {
        BufferedReader reader = new BufferedReader(
                new InputStreamReader(socket.getInputStream(), StandardCharsets.US_ASCII));
        StringBuilder sb = new StringBuilder();
        String line;
        while ((line = reader.readLine()) != null) {
            sb.append(line).append("\n");
            if (line.isEmpty()) break;
            if (sb.length() > 2000) break;
        }
        return sb.toString();
    }
}
