import React, { useEffect, useState } from 'react';
import { useCamera } from '../../context/CameraContext';
import { Capacitor } from '@capacitor/core';
import { NativeSettings, AndroidSettings, IOSSettings } from 'capacitor-native-settings';
import { Wifi, CheckCircle2, Copy, Check, ChevronDown, HelpCircle } from 'lucide-react';

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
  const { isConnected } = useCamera();
  const [open, setOpen] = useState(!isConnected);
  const [copied, setCopied] = useState(false);

  // Expande quando desconectado e recolhe automaticamente quando conectar
  useEffect(() => {
    setOpen(!isConnected);
  }, [isConnected]);

  const copyPassword = async () => {
    try {
      await navigator.clipboard.writeText(CAMERA_WIFI_PASSWORD);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // clipboard indisponível (ex: contexto não seguro) — ignora
    }
  };

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
          {/* Bolinha de status */}
          <span className="flex items-center gap-1.5">
            <span className={`relative flex w-3 h-3`}>
              {!isConnected && (
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-60" />
              )}
              <span className={`relative inline-flex rounded-full w-3 h-3 ${isConnected ? 'bg-green-500' : 'bg-red-500'}`} />
            </span>
            <span className={`text-xs font-medium ${isConnected ? 'text-green-400' : 'text-red-400'}`}>
              {isConnected ? 'Câmera conectada' : 'Câmera desconectada'}
            </span>
          </span>
          <ChevronDown size={18} className={`text-brand-muted transition-transform ${open ? 'rotate-180' : ''}`} />
        </div>
      </button>

      {open && (
        <div className="px-4 pb-4 pt-1 space-y-4 border-t border-white/5">
          <StepRow number={1} done={isConnected}>
            <span className="flex items-center gap-1.5 font-medium">
              <Wifi size={14} /> Conecte no Wi-Fi da câmera:
            </span>
            <span className="block mt-1 font-mono text-brand-primary">{CAMERA_WIFI_SSID}</span>
            {isNativeApp && (
              <button
                onClick={openWifiSettings}
                className="mt-2 inline-flex items-center gap-1.5 px-3 py-2 bg-brand-primary text-brand-bg text-xs font-bold rounded-xl not-italic"
              >
                <Wifi size={14} /> Abrir Wi-Fi
              </button>
            )}
          </StepRow>

          <StepRow number={2} done={isConnected}>
            Use a senha:{' '}
            <button
              onClick={copyPassword}
              className="inline-flex items-center gap-1 font-mono text-brand-primary bg-brand-bg/60 px-2 py-0.5 rounded-lg align-middle"
            >
              {CAMERA_WIFI_PASSWORD}
              {copied ? <Check size={12} className="text-green-400" /> : <Copy size={12} />}
            </button>
          </StepRow>

          <StepRow number={3} done={isConnected}>
            {isConnected
              ? 'Câmera detectada! Você já pode capturar jogadas.'
              : 'Aguarde a bolinha ficar verde — o app detecta a câmera sozinho.'}
          </StepRow>
        </div>
      )}
    </div>
  );
};
