import React, { useState } from 'react';
import { CheckCircle2, XCircle, Loader2, ArrowLeft, AlertTriangle } from 'lucide-react';
import { Link } from 'react-router-dom';

type ProbeStatus = 'ok' | 'partial' | 'fail' | 'pending';

interface ProbeResult {
  key: string;
  label: string;
  status: ProbeStatus;
  detail: string;
}

const CAMERA = 'http://192.168.0.1';

export const Diagnostics = () => {
  const [running, setRunning] = useState(false);
  const [results, setResults] = useState<ProbeResult[]>([]);

  const update = (key: string, patch: Partial<ProbeResult>) =>
    setResults(prev => prev.map(r => (r.key === key ? { ...r, ...patch } : r)));

  const runDiagnostics = async () => {
    setRunning(true);

    const probes: ProbeResult[] = [
      { key: 'internet', label: 'Internet disponível (5G/Wi-Fi)', status: 'pending', detail: '' },
      { key: 'ip_nocors', label: '192.168.0.1 responde algo (no-cors)', status: 'pending', detail: '' },
      { key: 'ip_cors', label: '192.168.0.1 leitura completa (CORS permitido)', status: 'pending', detail: '' },
      { key: 'mnt', label: 'GET /mnt/ (raiz do SD)', status: 'pending', detail: '' },
      { key: 'sdcard', label: 'GET /sdcard/Normal/', status: 'pending', detail: '' },
      { key: 'mjpeg', label: 'Preview MJPEG (/cgi-bin/liveMJPEG)', status: 'pending', detail: '' },
      { key: 'imagem', label: 'Câmera responde como <img> (bypass CORS)', status: 'pending', detail: '' },
    ];
    setResults(probes);

    // 0) Internet
    update('internet', {
      status: navigator.onLine ? 'ok' : 'fail',
      detail: navigator.onLine ? 'navigator.onLine = true' : 'navigator.onLine = false',
    });

    // 1) no-cors: prova só que ALGO responde em 192.168.0.1 (não lê conteúdo)
    try {
      const controller = new AbortController();
      const t = setTimeout(() => controller.abort(), 3000);
      await fetch(`${CAMERA}/`, { mode: 'no-cors', signal: controller.signal, cache: 'no-store' });
      clearTimeout(t);
      update('ip_nocors', { status: 'partial', detail: 'Algo respondeu (não dá para confirmar se é a câmera)' });
    } catch (e: any) {
      update('ip_nocors', { status: 'fail', detail: `${e.name}: ${e.message}` });
    }

    // 2) CORS na raiz: se legível, o servidor permite leitura pelo navegador
    try {
      const controller = new AbortController();
      const t = setTimeout(() => controller.abort(), 3000);
      const resp = await fetch(`${CAMERA}/`, { signal: controller.signal, cache: 'no-store' });
      clearTimeout(t);
      const text = (await resp.text()).slice(0, 120).replace(/\s+/g, ' ');
      update('ip_cors', {
        status: 'ok',
        detail: `HTTP ${resp.status} — conteúdo legível: "${text || '(vazio)'}"`,
      });
    } catch (e: any) {
      update('ip_cors', { status: 'fail', detail: `${e.name}: ${e.message}` });
    }

    // 3) /mnt/ com CORS
    try {
      const controller = new AbortController();
      const t = setTimeout(() => controller.abort(), 3000);
      const resp = await fetch(`${CAMERA}/mnt/`, { signal: controller.signal, cache: 'no-store' });
      clearTimeout(t);
      const text = (await resp.text()).slice(0, 120).replace(/\s+/g, ' ');
      update('mnt', {
        status: 'ok',
        detail: `HTTP ${resp.status} — "${text || '(vazio)'}"`,
      });
    } catch (e: any) {
      update('mnt', { status: 'fail', detail: `${e.name}: ${e.message}` });
    }

    // 4) /sdcard/Normal/ com CORS
    try {
      const controller = new AbortController();
      const t = setTimeout(() => controller.abort(), 3000);
      const resp = await fetch(`${CAMERA}/sdcard/Normal/`, { signal: controller.signal, cache: 'no-store' });
      clearTimeout(t);
      const text = (await resp.text()).slice(0, 120).replace(/\s+/g, ' ');
      update('sdcard', {
        status: 'ok',
        detail: `HTTP ${resp.status} — "${text || '(vazio)'}"`,
      });
    } catch (e: any) {
      update('sdcard', { status: 'fail', detail: `${e.name}: ${e.message}` });
    }

    // 5) MJPEG via fetch no-cors (só prova resposta)
    try {
      const controller = new AbortController();
      const t = setTimeout(() => controller.abort(), 3000);
      await fetch(`${CAMERA}/cgi-bin/liveMJPEG`, { mode: 'no-cors', signal: controller.signal, cache: 'no-store' });
      clearTimeout(t);
      update('mjpeg', { status: 'partial', detail: 'Endpoint respondeu (stream no-cors)' });
    } catch (e: any) {
      update('mjpeg', { status: 'fail', detail: `${e.name}: ${e.message}` });
    }

    // 6) <img> (não usa CORS; mixed content ainda pode bloquear no HTTPS)
    await new Promise<void>(resolve => {
      const img = new Image();
      const done = (status: ProbeStatus, detail: string) => {
        update('imagem', { status, detail });
        resolve();
      };
      const t = window.setTimeout(() => done('fail', 'timeout 4s (imagem não carregou)'), 4000);
      img.onload = () => { window.clearTimeout(t); done('ok', 'Imagem da câmera carregada!'); };
      img.onerror = () => { window.clearTimeout(t); done('fail', 'onerror (mixed content bloqueado ou sem imagem)'); };
      img.src = `${CAMERA}/cgi-bin/staticMJPEG`;
    });

    setRunning(false);
  };

  const Icon = ({ status }: { status: ProbeStatus }) =>
    status === 'pending' ? (
      <Loader2 className="w-5 h-5 text-gray-500 animate-spin" />
    ) : status === 'ok' ? (
      <CheckCircle2 className="w-5 h-5 text-green-500" />
    ) : status === 'partial' ? (
      <AlertTriangle className="w-5 h-5 text-yellow-500" />
    ) : (
      <XCircle className="w-5 h-5 text-red-500" />
    );

  return (
    <div className="min-h-screen bg-gray-950 text-white p-6">
      <div className="flex items-center mb-8">
        <Link to="/camera-test" className="mr-4 p-2 rounded-full hover:bg-gray-800 transition-colors">
          <ArrowLeft className="w-6 h-6" />
        </Link>
        <h1 className="text-2xl font-bold tracking-tight">Diagnóstico Avançado</h1>
      </div>

      <div className="mb-6 p-4 bg-blue-900/20 border border-blue-700/50 rounded-lg text-sm text-blue-200/80">
        <strong className="font-semibold">Como testar (iPhone):</strong> abra esta página pelo link do Vercel
        usando o 4G/5G, conecte o celular ao Wi-Fi da câmera 70mai <em>sem recarregar</em> e rode o diagnóstico.
        Tire print do resultado — ele nos diz exatamente o que o Safari permite.
      </div>

      <button
        onClick={runDiagnostics}
        disabled={running}
        className="w-full py-4 bg-blue-600 hover:bg-blue-500 rounded-xl font-bold flex items-center justify-center transition-colors mb-8 disabled:opacity-50"
      >
        {running ? (
          <>
            <Loader2 className="w-5 h-5 mr-2 animate-spin" />
            Sondando a câmera...
          </>
        ) : (
          'Iniciar Diagnóstico'
        )}
      </button>

      {results.length > 0 && (
        <div className="space-y-2">
          {results.map(r => (
            <div key={r.key} className="p-3 bg-gray-900 rounded-lg">
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium">{r.label}</span>
                <Icon status={r.status} />
              </div>
              {r.detail && (
                <p className="text-xs text-gray-400 mt-1 font-mono break-all">{r.detail}</p>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
