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
        String url = call.getString("url");
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
                    String req = "DESCRIBE " + url + " RTSP/1.0\r\n"
                            + "CSeq: 1\r\n"
                            + "Accept: application/sdp\r\n"
                            + "User-Agent: MCM-Esportes\r\n"
                            + "\r\n";
                    OutputStream out = socket.getOutputStream();
                    out.write(req.getBytes(StandardCharsets.US_ASCII));
                    out.flush();

                    BufferedReader reader = new BufferedReader(
                            new InputStreamReader(socket.getInputStream(), StandardCharsets.US_ASCII));
                    StringBuilder headers = new StringBuilder();
                    String line;
                    int status = 0;
                    boolean first = true;
                    while ((line = reader.readLine()) != null) {
                        if (first) {
                            first = false;
                            // Esperado: RTSP/1.0 200 OK
                            String[] parts = line.split(" ", 3);
                            if (parts.length >= 2) {
                                try { status = Integer.parseInt(parts[1]); } catch (NumberFormatException ignored) {}
                            }
                        }
                        headers.append(line).append("\n");
                        if (line.isEmpty()) break; // fim dos headers
                        if (headers.length() > 2000) break;
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
}
