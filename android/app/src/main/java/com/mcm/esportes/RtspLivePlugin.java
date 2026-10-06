package com.mcm.esportes;

import android.graphics.Color;
import android.view.ViewGroup;
import android.widget.FrameLayout;

import androidx.media3.common.MediaItem;
import androidx.media3.common.PlaybackException;
import androidx.media3.common.Player;
import androidx.media3.exoplayer.ExoPlayer;
import androidx.media3.exoplayer.rtsp.RtspMediaSource;
import androidx.media3.exoplayer.source.DefaultMediaSourceFactory;
import androidx.media3.ui.AspectRatioFrameLayout;
import androidx.media3.ui.PlayerView;

import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

/**
 * Preview ao vivo RTSP da 70mai (rtsp://192.168.0.1:554/livestream/12) com
 * ExoPlayer (Media3) — o app oficial usa IjkPlayer/FFmpeg sobre o mesmo fluxo.
 *
 * A M310 Plus NÃO serve preview via /cgi-bin/liveMJPEG; stream ao vivo só
 * existe em RTSP, que o WebView/HTML não toca. Por isso este plugin nativo:
 * um PlayerView sobreposto ao WebView no retângulo (em dp) informado pelo JS.
 */
@CapacitorPlugin(name = "RtspLive")
public class RtspLivePlugin extends Plugin {

    private ExoPlayer player;
    private PlayerView playerView;
    private String currentUrl;

    @PluginMethod
    public void start(final PluginCall call) {
        final String url = call.getString("url");
        if (url == null || url.isEmpty()) {
            call.reject("URL vazia");
            return;
        }
        runOnUi(() -> {
            try {
                if (!url.equals(currentUrl)) {
                    stopInternal();
                }
                // Cria (ou reposiciona) a view antes de preparar o player,
                // garantindo que ela já esteja na tela no retângulo correto.
                ensureView(url);
                applyRect(call);
                call.resolve();
            } catch (Exception e) {
                call.reject("Falha ao iniciar RTSP: " + e.getMessage());
            }
        });
    }

    @PluginMethod
    public void setRect(final PluginCall call) {
        runOnUi(() -> {
            try {
                if (playerView != null) applyRect(call);
                call.resolve();
            } catch (Exception e) {
                call.reject("setRect: " + e.getMessage());
            }
        });
    }

    @PluginMethod
    public void stop(final PluginCall call) {
        runOnUi(() -> {
            stopInternal();
            call.resolve();
        });
    }

    private void runOnUi(Runnable r) {
        if (getActivity() != null) getActivity().runOnUiThread(r);
    }

    private void ensureView(String url) {
        if (playerView != null) return;
        playerView = new PlayerView(getContext());
        playerView.setUseController(false);
        playerView.setResizeMode(AspectRatioFrameLayout.RESIZE_MODE_ZOOM);
        playerView.setBackgroundColor(Color.BLACK);
        ViewGroup root = getActivity().findViewById(android.R.id.content);
        root.addView(playerView, new FrameLayout.LayoutParams(1, 1));

        // Força RTP via TCP: por UDP (padrão) a câmera abre a sessão mas os
        // pacotes de vídeo não chegam -> tela preta sem erro.
        RtspMediaSource.Factory rtspFactory = new RtspMediaSource.Factory()
                .setForceUseRtpTcp(true)
                .setTimeoutMs(10000);
        player = new ExoPlayer.Builder(getContext())
                .setMediaSourceFactory(new DefaultMediaSourceFactory(getContext())
                        .setLiveTargetOffsetMs(500))
                .build();
        playerView.setPlayer(player);
        player.setVolume(0f); // preview silencioso
        currentUrl = url;

        player.addListener(new Player.Listener() {
            @Override
            public void onPlaybackStateChanged(int state) {
                if (state == Player.STATE_READY) emit("ready");
                else if (state == Player.STATE_BUFFERING) emit("buffering");
                else if (state == Player.STATE_IDLE) emit("idle");
                else if (state == Player.STATE_ENDED) emit("ended");
            }

            @Override
            public void onIsPlayingChanged(boolean isPlaying) {
                if (isPlaying) emit("playing");
            }

            @Override
            public void onPlayerError(PlaybackException error) {
                JSObject data = new JSObject();
                data.put("state", "error");
                data.put("message", String.valueOf(error.getMessage()));
                notifyListeners("state", data);
            }
        });

        player.setMediaSource(rtspFactory.createMediaSource(MediaItem.fromUri(url)));
        player.prepare();
        player.setPlayWhenReady(true);

        // Cão de guarda: se em 15s não chegou vídeo (sessão abre mas stream
        // não vem), avisa o JS para cair no plano B (MJPEG/diagnóstico).
        final ExoPlayer p = player;
        new android.os.Handler(android.os.Looper.getMainLooper()).postDelayed(() -> {
            if (player == p && p != null && p.getPlaybackState() != Player.STATE_READY) {
                emit("timeout");
            }
        }, 15000);
    }

    private void emit(String state) {
        JSObject data = new JSObject();
        data.put("state", state);
        notifyListeners("state", data);
    }

    private void applyRect(PluginCall call) {
        if (playerView == null) return;
        float d = getContext().getResources().getDisplayMetrics().density;
        Float xf = call.getFloat("x", 0f);
        Float yf = call.getFloat("y", 0f);
        Float wf = call.getFloat("width", 0f);
        Float hf = call.getFloat("height", 0f);
        FrameLayout.LayoutParams lp = new FrameLayout.LayoutParams(
                (int) (wf * d), (int) (hf * d));
        lp.leftMargin = (int) (xf * d);
        lp.topMargin = (int) (yf * d);
        playerView.setLayoutParams(lp);
    }

    private void stopInternal() {
        if (player != null) {
            try { player.stop(); player.release(); } catch (Exception ignored) {}
            player = null;
        }
        if (playerView != null) {
            try {
                ViewGroup root = getActivity() != null
                        ? getActivity().findViewById(android.R.id.content) : null;
                if (root != null) root.removeView(playerView);
            } catch (Exception ignored) {}
            playerView = null;
        }
        currentUrl = null;
    }

    @Override
    protected void handleOnDestroy() {
        runOnUi(this::stopInternal);
    }
}
