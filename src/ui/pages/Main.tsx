import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Settings, Camera, Clock, ChevronRight } from 'lucide-react';
import { Capacitor, CapacitorHttp } from '@capacitor/core';
import { useAuth } from '../../context/AuthContext';
import { useCamera } from '../../context/CameraContext';
import { videoStorageService } from '../../services/VideoStorageService';
import { LocalVideo } from '../../types/camera';
import { ConnectionGuide } from '../components/ConnectionGuide';
import { RefreshCw, Loader2 } from 'lucide-react';

const LIVE_URL = 'http://192.168.0.1/cgi-bin/liveMJPEG';
const STATIC_URL = 'http://192.168.0.1/cgi-bin/staticMJPEG';
const LIVE_CGI_URL = 'http://192.168.0.1/cgi-bin/liveMJPEG.cgi';
const STATIC_CGI_URL = 'http://192.168.0.1/cgi-bin/staticMJPEG.cgi';

type PreviewStage = 'live' | 'liveCgi' | 'static' | 'staticCgi' | 'error';
const STAGE_ORDER: PreviewStage[] = ['live', 'liveCgi', 'static', 'staticCgi', 'error'];

export default function Main() {
  const { role } = useAuth();
  const navigate = useNavigate();
  const { isConnected, camera } = useCamera();
  const [isCapturing, setIsCapturing] = useState(false);
  const [captureProgress, setCaptureProgress] = useState(0);
  // live -> snapshot (staticMJPEG com refresh) -> error (com status HTTP real)
  const [previewStage, setPreviewStage] = useState<PreviewStage>('live');
  const [previewRetry, setPreviewRetry] = useState(0);
  const [probeStatus, setProbeStatus] = useState('');
  const [albumState, setAlbumState] = useState<'pending' | 'ok' | 'fail'>('pending');

  // Sonda registro + álbum (com código cru) + endpoints e mostra o resultado
  const probePreview = async () => {
    const out: string[] = [];
    // Teste de ordem: register com álbum DESLIGADO (pode ser pré-requisito)
    try {
      const off = await camera.setAlbumMode?.(false).catch(() => false);
      out.push(`álbum-off: ${off ? 'ok' : 'falha'}`);
    } catch { out.push('álbum-off: falha'); }
    if (camera.debugRegister) {
      try {
        const r = await camera.debugRegister();
        out.push(`register (álbum off): HTTP ${r.http} code ${r.code} ${r.body.slice(0, 100)}`);
      } catch (e: any) {
        out.push(`register (álbum off): ${String(e?.message ?? e).slice(0, 80)}`);
      }
    }
    // MJPEG sem álbum e sem auth (isola cada variável)
    try {
      if (Capacitor.isNativePlatform()) {
        const r = await CapacitorHttp.get({ url: LIVE_URL, connectTimeout: 5000, readTimeout: 8000 });
        const body = typeof r.data === 'string' ? r.data.slice(0, 60) : '[binário]';
        out.push(`live sem-álbum: HTTP ${r.status} ${body}`);
      } else {
        const c = new AbortController();
        const t = setTimeout(() => c.abort(), 6000);
        const r = await fetch(LIVE_URL, { signal: c.signal, cache: 'no-store' });
        clearTimeout(t);
        out.push(`live sem-álbum: HTTP ${r.status}`);
      }
    } catch (e: any) {
      out.push(`live sem-álbum: ${String(e?.message ?? e).slice(0, 80)}`);
    }
    try {
      const on = await camera.setAlbumMode?.(true).catch(() => false);
      out.push(`álbum-on: ${on ? 'ok' : 'falha'}`);
    } catch { out.push('álbum-on: falha'); }
    if (camera.debugCommand) {
      for (const [name, cmd, params] of [
        ['álbum', 'setaccessalbum.cgi', { enable: 1 }],
      ] as const) {
        try {
          const r = await camera.debugCommand(cmd, params as Record<string, string | number>);
          out.push(`${name}: HTTP ${r.http} code ${r.code} ${r.body.slice(0, 80)}`);
        } catch (e: any) {
          out.push(`${name}: ${String(e?.message ?? e).slice(0, 80)}`);
        }
      }
    } else {
      try {
        const reg = await camera.registerClient?.().catch(() => false);
        out.push(`register: ${reg ? 'ok' : 'falha'}`);
      } catch { out.push('register: falha'); }
      try {
        const alb = await camera.setAlbumMode?.(true).catch(() => false);
        out.push(`álbum: ${alb ? 'ok' : 'falha'}`);
      } catch { out.push('álbum: falha'); }
    }
    for (const u of [LIVE_URL, LIVE_CGI_URL, STATIC_URL, STATIC_CGI_URL]) {
      const name = u.split('/').pop();
      try {
        if (Capacitor.isNativePlatform()) {
          const r = await CapacitorHttp.get({ url: u, connectTimeout: 5000, readTimeout: 8000 });
          const body = typeof r.data === 'string' ? r.data.slice(0, 60) : '[binário]';
          out.push(`${name}: HTTP ${r.status} ${body}`);
        } else {
          const c = new AbortController();
          const t = setTimeout(() => c.abort(), 6000);
          const r = await fetch(u, { signal: c.signal, cache: 'no-store' });
          clearTimeout(t);
          out.push(`${name}: HTTP ${r.status}`);
        }
      } catch (e: any) {
        out.push(`${name}: ${String(e?.message ?? e).slice(0, 80)}`);
      }
    }
    setProbeStatus(out.join(' | '));
  };

  const startPreview = async () => {
    setProbeStatus('');
    setAlbumState('pending');
    setPreviewStage('live');
    // Ordem: garante álbum DESLIGADO, registra (com o IP certo), depois liga o álbum
    try { await camera.setAlbumMode?.(false).catch(() => false); } catch { /* best-effort */ }
    try { await camera.registerClient?.(); } catch { /* best-effort */ }
    const ok = await camera.setAlbumMode?.(true).catch(() => false);
    setAlbumState(ok ? 'ok' : 'fail');
    if (!ok) {
      setPreviewStage('error');
      await probePreview();
    }
  };

  // Quando conectar: registra o app, liga o modo álbum e SÓ DEPOIS libera
  // o preview (antes o <img> carregava antes do comando chegar à câmera).
  useEffect(() => {
    if (!isConnected) return;
    startPreview();
  }, [isConnected, camera]);

  useEffect(() => () => {
    camera.setAlbumMode?.(false).catch(() => {});
  }, [camera]);

  // Snapshot com refresh a cada 3s enquanto estiver num estágio static
  useEffect(() => {
    if (previewStage !== 'static' && previewStage !== 'staticCgi') return;
    const id = setInterval(() => setPreviewRetry(n => n + 1), 3000);
    return () => clearInterval(id);
  }, [previewStage]);

  const retryPreview = () => {
    setPreviewRetry(n => n + 1);
    startPreview();
  };

  const handleCapture = async () => {
    setIsCapturing(true);
    setCaptureProgress(10);
    
    const interval = setInterval(() => {
      setCaptureProgress(p => p < 90 ? p + 10 : p);
    }, 500);

    try {
      // Pega infos do arquivo mais recente na camera
      const mediaFile = await camera.getLatestVideo();
      if (!mediaFile) throw new Error("Nenhum vídeo encontrado");
      
      setCaptureProgress(60);
      
      // Faz download para blob
      const blob = await camera.downloadVideo(mediaFile);
      setCaptureProgress(90);

      // Salva localmente via IndexedDB
      const localVideo: LocalVideo = {
        id: crypto.randomUUID(),
        fileName: mediaFile.name,
        blob: blob,
        size: blob.size,
        date: new Date(),
        duration: mediaFile.duration
      };
      await videoStorageService.saveVideo(localVideo);
      const localId = localVideo.id;
      
      clearInterval(interval);
      setCaptureProgress(100);
      
      setTimeout(() => {
        setIsCapturing(false);
        setCaptureProgress(0);
        navigate(`/video/${localId}`);
      }, 500);
    } catch (error) {
      clearInterval(interval);
      setIsCapturing(false);
      setCaptureProgress(0);
      alert('Erro ao capturar vídeo. Verifique se a câmera tem arquivos.');
    }
  };

  // URLs de preview assinadas (nova assinatura a cada render/retry/refresh)
  const withSalt = (base: string) => `${base}${base.includes('?') ? '&' : '?'}t=${previewRetry}`;
  const liveSrc = camera.previewUrl?.('live') ?? LIVE_URL;
  const liveCgiSrc = camera.previewUrl?.('live-cgi') ?? LIVE_CGI_URL;
  const staticSrc = withSalt(camera.previewUrl?.('static') ?? STATIC_URL);
  const staticCgiSrc = withSalt(camera.previewUrl?.('static-cgi') ?? STATIC_CGI_URL);
  const stageSrc =
    previewStage === 'live' ? liveSrc
    : previewStage === 'liveCgi' ? liveCgiSrc
    : previewStage === 'static' ? staticSrc
    : staticCgiSrc;

  // Avança live -> liveCgi -> static -> staticCgi -> error (com diagnóstico)
  const advanceStage = () => {
    const next = STAGE_ORDER[Math.min(STAGE_ORDER.indexOf(previewStage) + 1, STAGE_ORDER.length - 1)];
    if (next === 'error') probePreview();
    setPreviewStage(next);
  };

  return (
    <div className="min-h-screen bg-brand-bg flex flex-col relative">
      <div 
        className="absolute inset-0 z-0 opacity-20 pointer-events-none"
        style={{ background: 'radial-gradient(circle at 50% 30%, rgba(34, 197, 94, 0.4) 0%, transparent 70%)' }}
      />

      <header className="pt-12 pb-4 px-6 z-10 flex justify-between items-center bg-gradient-to-b from-brand-bg to-transparent">
        <div className="flex items-center gap-3">
          <img src="/logo.png" alt="MCM" className="w-10 h-10 object-contain" />
          <h1 className="text-xl font-bold text-white tracking-tight">MCM Esportes</h1>
        </div>
        {role === 'admin' && (
          <button onClick={() => navigate('/settings')} className="p-2 bg-brand-card rounded-full text-brand-muted hover:text-white transition-colors">
            <Settings size={22} />
          </button>
        )}
      </header>

      <main className="flex-1 flex flex-col px-6 z-10">
        
        <div className="flex justify-center mb-6">
          <div className={`px-4 py-1.5 rounded-full text-sm font-medium flex items-center gap-2 border ${isConnected ? 'bg-green-500/10 border-green-500/20 text-green-400' : 'bg-red-500/10 border-red-500/20 text-red-400'}`}>
            <div className={`w-2 h-2 rounded-full ${isConnected ? 'bg-green-500' : 'bg-red-500'}`} />
            {isConnected ? 'Câmera conectada' : 'Câmera desconectada'}
          </div>
        </div>

        <ConnectionGuide />

        <div className="w-full aspect-video bg-brand-card rounded-2xl border border-white/5 overflow-hidden relative shadow-lg mb-10 flex flex-col items-center justify-center">
          {isConnected && (
            <div className="absolute top-3 left-3 z-10 bg-black/60 backdrop-blur-md px-3 py-1 rounded-lg flex items-center gap-2 text-xs font-medium border border-white/10">
              <div className="w-1.5 h-1.5 rounded-full bg-red-500 animate-pulse" />
              AO VIVO
            </div>
          )}

          {isConnected && albumState === 'ok' && previewStage !== 'error' ? (
            <img
              key={`${previewStage}-${previewRetry}`}
              src={stageSrc}
              alt="Transmissão da câmera"
              className="absolute inset-0 w-full h-full object-cover"
              onError={advanceStage}
            />
          ) : isConnected && albumState === 'pending' ? (
            <>
              <Loader2 size={40} className="text-brand-muted/30 mb-2 animate-spin" />
              <p className="text-brand-muted text-sm">Ativando modo álbum...</p>
            </>
          ) : isConnected ? (
            <>
              <Camera size={40} className="text-brand-muted/30 mb-2" />
              <p className="text-brand-muted text-sm mb-3">Preview indisponível no momento</p>
              {probeStatus && (
                <p className="text-[11px] font-mono text-brand-muted/80 mb-3 px-4 text-center break-words">{probeStatus}</p>
              )}
              <button
                onClick={retryPreview}
                className="flex items-center gap-2 px-4 py-2 bg-brand-primary text-brand-bg text-xs font-bold rounded-xl"
              >
                <RefreshCw size={14} /> Tentar novamente
              </button>
            </>
          ) : (
            <>
              <Camera size={40} className="text-brand-muted/30 mb-2" />
              <p className="text-brand-muted text-sm">Conecte-se à câmera para visualizar</p>
            </>
          )}
        </div>

        <div className="flex-1 flex flex-col items-center justify-center mb-10">
          <button
            onClick={handleCapture}
            disabled={!isConnected || isCapturing}
            className="group relative flex flex-col items-center justify-center w-64 h-64 rounded-full bg-brand-primary glow-primary border-[6px] border-brand-bg transition-transform transform active:scale-95 disabled:opacity-50 disabled:active:scale-100"
          >
            <div className="absolute inset-0 rounded-full border-2 border-brand-primary animate-ping opacity-20" />
            <img src="/logo.png" alt="Bola" className="w-16 h-16 object-contain mb-2 brightness-0 opacity-80" />
            <span className="text-brand-bg font-black text-2xl tracking-tighter">CAPTURAR</span>
            <span className="text-brand-bg font-black text-2xl tracking-tighter leading-none mb-2">JOGADA</span>
            <span className="text-brand-bg/70 text-xs font-medium max-w-[120px] text-center leading-tight">Salva o minuto anterior da jogada</span>
          </button>
        </div>

        <button 
          onClick={() => navigate('/gallery')}
          className="w-full bg-brand-card hover:bg-brand-card-hover border border-white/5 rounded-2xl p-4 flex items-center justify-between transition-colors mb-6"
        >
          <div className="flex items-center gap-3 text-left">
            <div className="p-2 bg-brand-bg rounded-full text-brand-muted">
              <Clock size={20} />
            </div>
            <div>
              <p className="text-xs text-brand-muted font-medium uppercase tracking-wider mb-0.5">Último vídeo salvo</p>
              <p className="text-sm font-semibold text-white">Ver Galeria Completa</p>
            </div>
          </div>
          <ChevronRight size={20} className="text-brand-muted" />
        </button>
      </main>

      {isCapturing && (
        <div className="fixed inset-0 z-50 bg-brand-bg/90 backdrop-blur-xl flex items-center justify-center p-6 animate-in fade-in duration-200">
          <div className="bg-brand-card border border-white/10 rounded-3xl p-8 max-w-sm w-full flex flex-col items-center shadow-2xl">
            <div className="relative w-24 h-24 mb-6">
              <svg className="w-full h-full rotate-[-90deg]" viewBox="0 0 100 100">
                <circle cx="50" cy="50" r="45" fill="none" stroke="rgba(255,255,255,0.05)" strokeWidth="8" />
                <circle cx="50" cy="50" r="45" fill="none" stroke="var(--color-brand-primary)" strokeWidth="8" strokeLinecap="round" 
                  strokeDasharray={`${2 * Math.PI * 45}`} 
                  strokeDashoffset={`${2 * Math.PI * 45 * (1 - captureProgress / 100)}`} 
                  className="transition-all duration-300 ease-out" 
                />
              </svg>
              <div className="absolute inset-0 flex items-center justify-center">
                <img src="/logo.png" alt="Bola" className="w-10 h-10 object-contain animate-pulse" />
              </div>
            </div>
            <h3 className="text-xl font-bold text-white mb-2 text-center">Capturando jogada...</h3>
            <p className="text-sm text-brand-muted text-center mb-6">Solicitando o último minuto do vídeo da câmera</p>
            
            <div className="w-full h-2 bg-brand-bg rounded-full overflow-hidden">
              <div className="h-full bg-brand-primary rounded-full transition-all duration-300" style={{ width: `${captureProgress}%` }} />
            </div>
            <p className="text-xs text-brand-muted mt-4 font-medium uppercase tracking-wider">Aguarde alguns segundos</p>
          </div>
        </div>
      )}
    </div>
  );
}
