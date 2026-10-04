import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { CameraService } from '../types/camera';
import { Xiaomi70maiCameraService } from '../services/camera/70maiCameraService';

interface CameraContextType {
  camera: CameraService;
  isConnected: boolean;
  connect: () => Promise<void>;
}

const CameraContext = createContext<CameraContextType | undefined>(undefined);

export const CameraProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [camera] = useState<CameraService>(new Xiaomi70maiCameraService());
  const [isConnected, setIsConnected] = useState(false);

  const connect = async () => {
    const success = await camera.connect();
    setIsConnected(success);
  };

  // Monitoramento automático: verifica a câmera a cada 5s (bolinha verde/vermelha).
  // Assim que o usuário conecta no WiFi da câmera, o app detecta sozinho.
  useEffect(() => {
    let cancelled = false;

    const check = async () => {
      try {
        const ok = await camera.connect();
        if (!cancelled) setIsConnected(ok);
      } catch {
        if (!cancelled) setIsConnected(false);
      }
    };

    check();
    const interval = setInterval(check, 5000);
    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, [camera]);

  return (
    <CameraContext.Provider value={{ camera, isConnected, connect }}>
      {children}
    </CameraContext.Provider>
  );
};

export const useCamera = () => {
  const context = useContext(CameraContext);
  if (context === undefined) {
    throw new Error('useCamera must be used within a CameraProvider');
  }
  return context;
};
