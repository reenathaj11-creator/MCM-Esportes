import React, { useEffect, useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import { useCamera } from '../../context/CameraContext';
import { supabase } from '../../lib/supabase';
import { videoStorageService } from '../../services/VideoStorageService';
import { Settings, Users, Video, Activity, ArrowLeft, KeyRound, Copy, Check, Eye, EyeOff } from 'lucide-react';
import { Link } from 'react-router-dom';

interface Stats {
  totalUsers: number | null;
  newThisWeek: number | null;
  videosSaved: number | null;
  videosSizeMb: number | null;
  storagePercent: number | null;
  apiLatencyMs: number | null;
}

export const AdminSettings: React.FC = () => {
  const { user, logout } = useAuth();
  const { isConnected, camera } = useCamera();
  const [showGrid, setShowGrid] = useState(true);
  const [showToken, setShowToken] = useState(false);
  const [tokenCopied, setTokenCopied] = useState(false);
  const [tokenInput, setTokenInput] = useState('');
  const [tokenMsg, setTokenMsg] = useState('');

  const pairedToken = camera.exportToken?.() ?? null;

  const copyToken = async () => {
    if (!pairedToken) return;
    try {
      await navigator.clipboard.writeText(pairedToken);
      setTokenCopied(true);
      setTimeout(() => setTokenCopied(false), 2000);
    } catch { /* clipboard indisponível */ }
  };

  const importToken = () => {
    if (!camera.importToken) return;
    if (camera.importToken(tokenInput)) {
      setTokenMsg('✅ Token importado! Conecte no Wi-Fi da câmera para usar.');
      setTokenInput('');
    } else {
      setTokenMsg('❌ Token inválido. Deve ter 32 caracteres hexadecimais (0-9, a-f).');
    }
  };
  const [stats, setStats] = useState<Stats>({
    totalUsers: null,
    newThisWeek: null,
    videosSaved: null,
    videosSizeMb: null,
    storagePercent: null,
    apiLatencyMs: null,
  });

  useEffect(() => {
    loadStats();
  }, []);

  const loadStats = async () => {
    // Latência real da API (medida na consulta de usuários)
    const startedAt = performance.now();

    const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();

    const [{ count: totalUsers }, { count: newThisWeek }] = await Promise.all([
      supabase.from('profiles').select('id', { count: 'exact', head: true }),
      supabase.from('profiles').select('id', { count: 'exact', head: true }).gte('created_at', weekAgo),
    ]);

    const apiLatencyMs = Math.round(performance.now() - startedAt);

    // Estatísticas reais dos vídeos salvos localmente (IndexedDB)
    const videos = await videoStorageService.getAllVideos();
    const videosSizeMb = videos.reduce((acc, v) => acc + v.size, 0) / (1024 * 1024);

    // Uso real de armazenamento do dispositivo
    let storagePercent: number | null = null;
    if (navigator.storage?.estimate) {
      const { usage, quota } = await navigator.storage.estimate();
      if (usage !== undefined && quota) {
        storagePercent = Math.round((usage / quota) * 100);
      }
    }

    setStats({
      totalUsers: totalUsers ?? null,
      newThisWeek: newThisWeek ?? null,
      videosSaved: videos.length,
      videosSizeMb: Math.round(videosSizeMb * 10) / 10,
      storagePercent,
      apiLatencyMs,
    });
  };

  const fmt = (value: number | null, suffix = '') =>
    value === null ? '—' : `${value}${suffix}`;

  return (
    <div className="min-h-screen bg-neutral-950 text-neutral-100 p-4 sm:p-8">
      <div className="max-w-4xl mx-auto space-y-6">

        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div className="flex items-center space-x-4">
            <Link to="/" className="p-2 bg-neutral-800 rounded-full hover:bg-neutral-700 transition">
              <ArrowLeft className="w-5 h-5 text-neutral-300" />
            </Link>
            <h1 className="text-2xl font-bold flex items-center gap-2">
              <Settings className="w-6 h-6 text-emerald-500" />
              Painel do Administrador
            </h1>
          </div>
          <div className="flex items-center gap-4">
            <span className="text-sm text-neutral-400">Conectado como {user?.email}</span>
            <button
              onClick={logout}
              className="px-4 py-2 bg-neutral-800 text-sm font-medium rounded-lg hover:bg-neutral-700 transition"
            >
              Sair
            </button>
          </div>
        </div>

        {/* Pré-visualização da câmera */}
        <div className="bg-neutral-900 border border-neutral-800 rounded-2xl overflow-hidden shadow-lg">
          <div className="p-4 border-b border-neutral-800 flex items-center justify-between">
            <h2 className="text-lg font-semibold flex items-center gap-2">
              <Video className="w-5 h-5 text-emerald-500" />
              Pré-visualização da câmera
            </h2>
            <span className={`px-2.5 py-0.5 rounded-full text-xs font-medium flex items-center gap-1.5 ${isConnected ? 'bg-emerald-500/10 text-emerald-500' : 'bg-neutral-700/50 text-neutral-400'}`}>
              <span className={`w-1.5 h-1.5 rounded-full ${isConnected ? 'bg-emerald-500 animate-pulse' : 'bg-neutral-500'}`}></span>
              {isConnected ? 'AO VIVO' : 'Offline'}
            </span>
          </div>
          <div className="aspect-video bg-neutral-950 relative flex items-center justify-center">
            {!isConnected && (
              <div className="absolute inset-0 bg-neutral-800 animate-pulse opacity-50"></div>
            )}
            <div className="z-10 flex flex-col items-center text-neutral-500">
              <Video className="w-12 h-12 mb-2 opacity-50" />
              <p>{isConnected ? 'Transmissão da câmera' : 'Câmera desconectada'}</p>
              <p className="text-sm mt-1">Ajuste a posição manualmente</p>
            </div>

            {/* Guias de ajuste sobre a imagem */}
            {showGrid && (
              <>
                <div className="absolute inset-0 border border-dashed border-emerald-500/30 m-8 pointer-events-none rounded"></div>
                <div className="absolute top-1/2 left-0 right-0 h-px bg-emerald-500/20 pointer-events-none"></div>
                <div className="absolute left-1/2 top-0 bottom-0 w-px bg-emerald-500/20 pointer-events-none"></div>
              </>
            )}
          </div>
          <div className="p-4 bg-neutral-900">
            <div className="flex gap-2">
              <button className="flex-1 bg-neutral-800 py-2 rounded-lg text-sm font-medium hover:bg-neutral-700 transition">
                Recalibrar
              </button>
              <button
                onClick={() => setShowGrid(g => !g)}
                className="flex-1 bg-neutral-800 py-2 rounded-lg text-sm font-medium hover:bg-neutral-700 transition"
              >
                {showGrid ? 'Ocultar grade' : 'Mostrar grade'}
              </button>
            </div>
          </div>
        </div>

        {/* Estatísticas */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="bg-neutral-900 border border-neutral-800 rounded-2xl p-6 shadow-lg">
            <div className="flex items-center gap-3 mb-4">
              <div className="p-2 bg-emerald-500/10 rounded-lg">
                <Users className="w-6 h-6 text-emerald-500" />
              </div>
              <h3 className="text-lg font-semibold">Estatísticas de usuários</h3>
            </div>
            <div className="space-y-4">
              <div className="flex justify-between items-center py-2 border-b border-neutral-800">
                <span className="text-neutral-400">Total cadastrados</span>
                <span className="font-medium text-xl">{fmt(stats.totalUsers)}</span>
              </div>
              <div className="flex justify-between items-center py-2 border-b border-neutral-800">
                <span className="text-neutral-400">Vídeos salvos (neste dispositivo)</span>
                <span className="font-medium text-xl">{fmt(stats.videosSaved)}</span>
              </div>
              <div className="flex justify-between items-center py-2">
                <span className="text-neutral-400">Novos usuários (esta semana)</span>
                <span className="font-medium text-xl text-emerald-500">
                  {stats.newThisWeek === null ? '—' : `+${stats.newThisWeek}`}
                </span>
              </div>
            </div>
          </div>

          <div className="bg-neutral-900 border border-neutral-800 rounded-2xl p-6 shadow-lg">
            <div className="flex items-center gap-3 mb-4">
              <div className="p-2 bg-blue-500/10 rounded-lg">
                <Activity className="w-6 h-6 text-blue-500" />
              </div>
              <h3 className="text-lg font-semibold">Saúde do sistema</h3>
            </div>
            <div className="space-y-4">
              <div className="flex justify-between items-center py-2 border-b border-neutral-800">
                <span className="text-neutral-400">Espaço dos vídeos salvos</span>
                <span className="font-medium">{fmt(stats.videosSizeMb, ' MB')}</span>
              </div>
              <div className="flex justify-between items-center py-2 border-b border-neutral-800">
                <span className="text-neutral-400">Armazenamento do dispositivo</span>
                <span className="font-medium">{fmt(stats.storagePercent, '%')}</span>
              </div>
              <div className="flex justify-between items-center py-2 border-b border-neutral-800">
                <span className="text-neutral-400">Status da câmera</span>
                <span className={`font-medium ${isConnected ? 'text-emerald-500' : 'text-red-400'}`}>
                  {isConnected ? 'Online' : 'Offline'}
                </span>
              </div>
              <div className="flex justify-between items-center py-2">
                <span className="text-neutral-400">Latência da API</span>
                <span className="font-medium">{fmt(stats.apiLatencyMs, 'ms')}</span>
              </div>
            </div>
          </div>
        </div>

        {/* Pareamento da câmera (multi-aparelho) */}
        <div className="bg-neutral-900 border border-neutral-800 rounded-2xl p-6 shadow-lg">
          <div className="flex items-center gap-3 mb-4">
            <div className="p-2 bg-amber-500/10 rounded-lg">
              <KeyRound className="w-6 h-6 text-amber-500" />
            </div>
            <h3 className="text-lg font-semibold">Pareamento da câmera</h3>
          </div>

          <p className="text-xs text-neutral-400 mb-4 leading-relaxed">
            A câmera mantém apenas <strong>um token</strong>. Para usar outro aparelho
            <strong> sem apertar o botão da câmera</strong> e sem derrubar este, copie o token
            aqui e importe no outro app. Quem tem o token acessa a câmera — compartilhe só
            com aparelhos autorizados.
          </p>

          {/* Exportar */}
          <div className="mb-5">
            <p className="text-sm text-neutral-300 font-medium mb-2">
              Token deste aparelho: {pairedToken ? '' : <span className="text-neutral-500">(não pareado)</span>}
            </p>
            {pairedToken && (
              <div className="flex items-center gap-2">
                <code className="flex-1 bg-neutral-950 border border-neutral-800 rounded-lg px-3 py-2 font-mono text-xs break-all">
                  {showToken ? pairedToken : '•'.repeat(32)}
                </code>
                <button
                  onClick={() => setShowToken(s => !s)}
                  className="p-2 bg-neutral-800 rounded-lg hover:bg-neutral-700 transition"
                  title={showToken ? 'Ocultar' : 'Mostrar'}
                >
                  {showToken ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
                <button
                  onClick={copyToken}
                  className="p-2 bg-neutral-800 rounded-lg hover:bg-neutral-700 transition"
                  title="Copiar token"
                >
                  {tokenCopied ? <Check size={16} className="text-green-500" /> : <Copy size={16} />}
                </button>
              </div>
            )}
          </div>

          {/* Importar */}
          <div className="pt-4 border-t border-neutral-800">
            <p className="text-sm text-neutral-300 font-medium mb-2">Importar token de outro aparelho:</p>
            <div className="flex gap-2">
              <input
                type="text"
                value={tokenInput}
                onChange={e => { setTokenInput(e.target.value); setTokenMsg(''); }}
                placeholder="Cole o token (32 caracteres)"
                className="flex-1 bg-neutral-950 border border-neutral-800 rounded-lg px-3 py-2 font-mono text-xs placeholder-neutral-600 focus:ring-2 focus:ring-amber-500/50 outline-none"
              />
              <button
                onClick={importToken}
                className="px-4 py-2 bg-amber-500 hover:bg-amber-400 text-neutral-900 text-sm font-bold rounded-lg transition"
              >
                Salvar
              </button>
            </div>
            {tokenMsg && <p className="text-xs mt-2 text-neutral-300">{tokenMsg}</p>}
          </div>

          {/* Desparear */}
          {pairedToken && (
            <div className="pt-4 mt-4 border-t border-neutral-800">
              <button
                onClick={() => { camera.unpair?.(); window.location.reload(); }}
                className="w-full py-2 bg-red-500/10 hover:bg-red-500/20 border border-red-500/30 text-red-400 text-sm font-bold rounded-lg transition"
              >
                Desparear deste aparelho (permite parear de novo)
              </button>
            </div>
          )}
        </div>

      </div>
    </div>
  );
};
