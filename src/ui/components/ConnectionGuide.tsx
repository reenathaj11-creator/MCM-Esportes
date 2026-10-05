import React, { useEffect, useState } from 'react';
import { useCamera } from '../../context/CameraContext';
import { Capacitor } from '@capacitor/core';
import { NativeSettings, AndroidSettings, IOSSettings } from 'capacitor-native-settings';
import { Wifi, CheckCircle2, Copy, Check, ChevronDown, HelpCircle, Link2, Loader2 } from 'lucide-react';

// Dados do WiFi da câmera (ajuste conforme a etiqueta da sua unidade)
const CAMERA_WIFI_SSID = '70mai_M310_Plus_XXXX';
const CAMERA_WIFI_PASSWORD = '12345678';

const isNativeApp = Capacitor.isNativePlatform();

// Abre as configurações de Wi-Fi do sistema (dentro do APK)
const openWifiSettings = () =>
  NativeSettings.open({ optionAndroid: AndroidSettings.Wifi, optionIOS: IOSSettings.WiFi });

const StepRow: React.FC<{
  number: number;
  done: boolean;
  children: React.ReactNode;
}> = ({ number, done, children }) => (
  <div className="flex gap-3 items-start">
    <div className="mt-0.5 shrink-0">
      {done ? (
        <CheckCircle2 size={20} className="text-green-400" />
      ) : (
        <div className="w-5 h-5 rounded-full border-2 border-brand-muted flex items-center justify-center">
          <span className="text-[10px] font-bold text-brand-muted">{number}</span>
        </div>
      )}
    </div>
    <div className={`text-sm leading-relaxed ${done ? 'text-brand-muted line-through' : 'text-white'}`}>
      {children}
    </div>
  </div>
);

export const ConnectionGuide: React.FC = () => {
  const { isConnected, needsPairing, camera } = useCamera();
  const [open, setOpen] = useState(!isConnected);
  const [copied, setCopied] = useState(false);
  const [pairing, setPairing] = useState(false);
  const [pairMessage, setPairMessage] = useState('');

  // Expande quando não está conectado (inclui estado de pareamento pendente)
  useEffect(() => {
    setOpen(!isConnected);
  }, [isConnected]);

  const copyPassword = async () => {
    try {
      await navigator.clipboard.writeText(CAMERA_WIFI_PASSWORD);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // clipboard indisponível — ignora
    }
  };

  const handlePair = async () => {
    if (!camera.pair) return;
    setPairing(true);
    setPairMessage('Iniciando...');
    const ok = await camera.pair(setPairMessage);
    if (!ok) setPairing(false);
    // sucesso: o polling automático detecta e conecta
    setPairing(false);
  };

  const statusLabel = isConnected
    ? 'Câmera conectada'
    : needsPairing
      ? 'Pareamento necessário'
      : 'Câmera desconectada';

  const dotColor = isConnected ? 'bg-green-500' : needsPairing ? 'bg-amber-400' : 'bg-red-500';
  const textColor = isConnected ? 'text-green-400' : needsPairing ? 'text-amber-400' : 'text-red-400';

  return (
    <div className="w-full bg-brand-card border border-white/5 rounded-2xl overflow-hidden mb-6">
      <button
        onClick={() => setOpen(o => !o)}
        className="w-full flex items-center justify-between p-4 text-left"
      >
        <div className="flex items-center gap-2">
          <HelpCircle size={18} className="text-brand-primary" />
          <span className="text-sm font-semibold text-white">Guia de conexão</span>
        </div>
        <div className="flex items-center gap-3">
          <span className="flex items-center gap-1.5">
            <span className="relative flex w-3 h-3">
              {!isConnected && (
                <span className={`animate-ping absolute inline-flex h-full w-full rounded-full opacity-60 ${dotColor}`} />
              )}
              <span className={`relative inline-flex rounded-full w-3 h-3 ${dotColor}`} />
            </span>
            <span className={`text-xs font-medium ${textColor}`}>{statusLabel}</span>
          </span>
          <ChevronDown size={18} className={`text-brand-muted transition-transform ${open ? 'rotate-180' : ''}`} />
        </div>
      </button>

      {open && (
        <div className="px-4 pb-4 pt-1 space-y-4 border-t border-white/5">
          <StepRow number={1} done={isConnected || needsPairing}>
            <span className="flex items-center gap-1.5 font-medium">
              <Wifi size={14} /> Conecte no Wi-Fi da câmera:
            </span>
            <span className="block mt-1 font-mono text-brand-primary">{CAMERA_WIFI_SSID}</span>
            {isNativeApp && !isConnected && !needsPairing && (
              <button
                onClick={openWifiSettings}
                className="mt-2 inline-flex items-center gap-1.5 px-3 py-2 bg-brand-primary text-brand-bg text-xs font-bold rounded-xl"
              >
                <Wifi size={14} /> Abrir Wi-Fi
              </button>
            )}
          </StepRow>

          <StepRow number={2} done={isConnected || needsPairing}>
            Use a senha:{' '}
            <button
              onClick={copyPassword}
              className="inline-flex items-center gap-1 font-mono text-brand-primary bg-brand-bg/60 px-2 py-0.5 rounded-lg align-middle"
            >
              {CAMERA_WIFI_PASSWORD}
              {copied ? <Check size={12} className="text-green-400" /> : <Copy size={12} />}
            </button>
          </StepRow>

          {/* Pareamento: só na primeira vez em cada app/câmera */}
          {needsPairing && (
            <div className="p-3 bg-amber-500/10 border border-amber-500/30 rounded-xl space-y-2">
              <p className="text-xs text-amber-300 leading-relaxed">
                <strong>Primeiro acesso:</strong> a câmera precisa autorizar este app.
                Toque em Parear e em seguida <strong>aperte o botão de confirmação da câmera</strong>
                (ela pisca/apita pedindo confirmação).
              </p>
              <button
                onClick={handlePair}
                disabled={pairing}
                className="w-full flex items-center justify-center gap-2 py-2.5 bg-amber-500 hover:bg-amber-400 disabled:opacity-60 text-neutral-900 text-sm font-bold rounded-xl transition-colors"
              >
                {pairing ? <Loader2 size={16} className="animate-spin" /> : <Link2 size={16} />}
                {pairing ? 'Pareando...' : 'Parear câmera'}
              </button>
              {pairMessage && (
                <p className="text-[11px] font-mono text-amber-200/80 break-words">{pairMessage}</p>
              )}
            </div>
          )}

          <StepRow number={3} done={isConnected}>
            {isConnected
              ? 'Câmera detectada! Você já pode capturar jogadas.'
              : needsPairing
                ? 'Após confirmar na câmera, a bolinha fica verde automaticamente.'
                : 'Aguarde a bolinha ficar verde — o app detecta a câmera sozinho.'}
          </StepRow>
        </div>
      )}
    </div>
  );
};
