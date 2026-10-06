import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft, Copy, Check, Loader2, FlaskConical, Camera, Radio } from 'lucide-react';
import { Capacitor, registerPlugin } from '@capacitor/core';
import { useCamera } from '../../context/CameraContext';

interface RtspProbe {
  describe(opts: { url: string }): Promise<{ ok: boolean; status: number; detail: string }>;
}

const RtspProbePlugin = registerPlugin<RtspProbe>('RtspProbe');

const RTSP_PATHS = [
  'livestream/12',
  'livestream/13',
  'livestream/11',
  'livestream/10',
  'livestream/14',
  '',
  'liveRTSP/av1',
  'liveRTSP/av2',
  'liveRTSP/av4',
  'liveRTSP/av5',
  'liveRTSP/v1',
];

interface Trial {
  key: string;
  label: string;
  cmd: string;
  params: Record<string, string | number>;
}

const TRIALS: Trial[] = [
  { key: 'cap', label: 'Capacidade', cmd: 'getcapability.cgi', params: {} },
  { key: 'menu', label: 'Menu completo', cmd: 'getAllMenu.cgi', params: {} },
  { key: 'dev', label: 'Dispositivo', cmd: 'getdeviceattr.cgi', params: {} },
  { key: 'ws', label: 'WiFiStream (sem params)', cmd: 'setwifistream.cgi', params: {} },
  { key: 'ws1', label: 'WiFiStream enable=1', cmd: 'setwifistream.cgi', params: { enable: 1 } },
  { key: 'lic', label: 'Stream licensed', cmd: 'getstreamlicensed.cgi', params: {} },
  { key: 'dvr', label: 'Estado DVR', cmd: 'getdvrstate.cgi', params: {} },
  { key: 'par', label: 'Parâmetros', cmd: 'getparameter.cgi', params: {} },
  { key: 'photoraw', label: 'Foto (código cru)', cmd: 'photo.cgi', params: {} },
  { key: 'skc', label: 'SecretKeyConfirm', cmd: 'SecretKeyConfirm.cgi', params: {} },
];

export const PreviewLab = () => {
  const { camera, isConnected } = useCamera();
  const [running, setRunning] = useState<string | null>(null);
  const [result, setResult] = useState<{ label: string; http: number; text: string } | null>(null);
  const [copied, setCopied] = useState(false);
  const [photoSrc, setPhotoSrc] = useState('');
  const [photoMsg, setPhotoMsg] = useState('');
  const [freePath, setFreePath] = useState('/');

  const runTrial = async (t: Trial) => {
    if (!camera.debugRaw) return;
    setRunning(t.key);
    setResult(null);
    try {
      const r = await camera.debugRaw(t.cmd, t.params);
      setResult({ label: t.label, http: r.http, text: r.text });
    } catch (e: any) {
      setResult({ label: t.label, http: 0, text: String(e?.message ?? e) });
    } finally {
      setRunning(null);
    }
  };

  const tryPhoto = () => {
    if (!camera.signedCommandUrl) return;
    setPhotoMsg('Carregando foto...');
    setPhotoSrc(camera.signedCommandUrl('photo.cgi'));
  };

  const runFreeGet = async () => {
    if (!camera.debugGet) return;
    setRunning('freeget');
    setResult(null);
    try {
      const r = await camera.debugGet(freePath.trim() || '/');
      setResult({ label: `GET ${freePath}`, http: r.http, text: r.text });
    } catch (e: any) {
      setResult({ label: `GET ${freePath}`, http: 0, text: String(e?.message ?? e) });
    } finally {
      setRunning(null);
    }
  };

  const runRtspSweep = async () => {
    if (!Capacitor.isNativePlatform()) {
      setResult({ label: 'RTSP sweep', http: 0, text: 'Só funciona no APK (plugin nativo).' });
      return;
    }
    setRunning('rtsp');
    setResult(null);
    const lines: string[] = [];
    for (const p of RTSP_PATHS) {
      try {
        const r = await RtspProbePlugin.describe({ url: `rtsp://192.168.0.1:554/${p}` });
        const first = r.detail.split('\n')[0] ?? '';
        lines.push(`${p}: ${r.status} ${first} ${r.ok ? '✅' : ''}`);
      } catch (e: any) {
        lines.push(`${p}: erro ${String(e?.message ?? e).slice(0, 80)}`);
      }
    }
    setResult({ label: 'RTSP sweep', http: 200, text: lines.join('\n') });
    setRunning(null);
  };

  const copyResult = async () => {
    if (!result) return;
    try {
      await navigator.clipboard.writeText(`${result.label} — HTTP ${result.http}\n${result.text}`);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch { /* clipboard indisponível */ }
  };

  return (
    <div className="min-h-screen bg-gray-950 text-white p-6">
      <div className="flex items-center mb-4">
        <Link to="/" className="mr-4 p-2 rounded-full hover:bg-gray-800 transition-colors">
          <ArrowLeft className="w-6 h-6" />
        </Link>
        <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
          <FlaskConical className="w-6 h-6" /> Laboratório de preview
        </h1>
      </div>

      <p className="text-sm text-gray-400 mb-6">
        {isConnected ? 'Câmera conectada. Rode cada sonda e me mande o resultado.' : 'Conecte no Wi-Fi da câmera primeiro.'}
      </p>

      <div className="grid grid-cols-2 gap-2 mb-4">
        {TRIALS.map(t => (
          <button
            key={t.key}
            onClick={() => runTrial(t)}
            disabled={running !== null}
            className="py-3 px-2 bg-gray-800 hover:bg-gray-700 rounded-xl text-sm font-semibold flex items-center justify-center gap-2 disabled:opacity-50"
          >
            {running === t.key && <Loader2 className="w-4 h-4 animate-spin" />}
            {t.label}
          </button>
        ))}
        <button
          onClick={tryPhoto}
          className="py-3 px-2 bg-amber-600 hover:bg-amber-500 rounded-xl text-sm font-bold flex items-center justify-center gap-2 col-span-2"
        >
          <Camera className="w-4 h-4" /> Testar foto (photo.cgi como imagem)
        </button>
        <button
          onClick={runRtspSweep}
          disabled={running !== null}
          className="py-3 px-2 bg-emerald-700 hover:bg-emerald-600 rounded-xl text-sm font-bold flex items-center justify-center gap-2 col-span-2 disabled:opacity-50"
        >
          {running === 'rtsp' ? <Loader2 className="w-4 h-4 animate-spin" /> : <Radio className="w-4 h-4" />}
          Varredura RTSP (11 paths)
        </button>
        <div className="col-span-2 flex gap-2">
          <input
            value={freePath}
            onChange={e => setFreePath(e.target.value)}
            placeholder="/ (raiz do servidor da câmera)"
            autoCapitalize="none"
            autoCorrect="off"
            className="flex-1 px-3 py-3 bg-gray-800 rounded-xl text-sm font-mono outline-none focus:ring-2 focus:ring-gray-600"
          />
          <button
            onClick={runFreeGet}
            disabled={running !== null}
            className="py-3 px-4 bg-gray-700 hover:bg-gray-600 rounded-xl text-sm font-bold disabled:opacity-50"
          >
            {running === 'freeget' ? <Loader2 className="w-4 h-4 animate-spin" /> : 'GET'}
          </button>
        </div>
      </div>

      {photoSrc !== '' && (
        <div className="mb-4 p-3 bg-gray-900 rounded-lg">
          <img
            src={photoSrc}
            alt="Teste photo.cgi"
            className="w-full rounded-lg"
            onLoad={() => setPhotoMsg('✅ Imagem carregou! Snapshot funciona.')}
            onError={() => setPhotoMsg('❌ Falhou como imagem (ver sonda acima se precisar).')}
          />
          {photoMsg !== '' && <p className="text-xs mt-2 font-mono">{photoMsg}</p>}
        </div>
      )}

      {result && (
        <div className="p-3 bg-gray-900 rounded-lg">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-semibold">{result.label} — HTTP {result.http}</span>
            <button onClick={copyResult} className="p-2 bg-gray-800 rounded-lg hover:bg-gray-700">
              {copied ? <Check size={16} className="text-green-400" /> : <Copy size={16} />}
            </button>
          </div>
          <pre className="text-[11px] font-mono text-gray-300 whitespace-pre-wrap break-all max-h-96 overflow-auto">
            {result.text}
          </pre>
        </div>
      )}
    </div>
  );
};
