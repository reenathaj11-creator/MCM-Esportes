import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { CameraService } from '../types/camera';
import { Xiaomi70maiCameraService } from '../services/camera/70maiCameraService';

interface CameraContextType {
  camera: CameraService;
  isConnected: boolean;
  /** true quando a câmera esta alcançavel na rede mas o app ainda nao foi pareado */
  needsPairing: boolean;
  connect: () => Promise<void>;
}

const CameraContext = createContext<CameraContextType | undefined>(undefined);

export const CameraProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [camera] = useState<CameraService>(new Xiaomi70maiCameraService());
  const [isConnected, setIsConnected] = useState(false);
  const [needsPairing, setNeedsPairing] = useState(false);

  const connect = async () => {
    const success = await camera.connect();
    setIsConnected(success);
  };

  // Monitoramento automático (a cada 5s):
  // 1) câmera alcançável na rede?  2) pareada?  3) respondendo autenticado?
  // O servidor web da 70mai é instável (responde 503 sob carga), então só
  // consideramos DESCONECTADA após 3 falhas consecutivas. Conexão é imediata.
  useEffect(() => {
    let cancelled = false;
    let failures = 0;

    const check = async () => {
      try {
        const reachable = camera.isReachable
          ? await camera.isReachable()
          : await camera.connect();

        if (cancelled) return;

        if (!reachable) {
          failures++;
          if (failures >= 3) {
            setIsConnected(false);
            setNeedsPairing(false);
          }
          return;
        }

        failures = 0;

        if (camera.isPaired && !camera.isPaired()) {
          setNeedsPairing(true);
          setIsConnected(false);
          return;
        }

        setNeedsPairing(false);
        const ok = await camera.connect();
        if (!cancelled) setIsConnected(ok);
      } catch {
        failures++;
        if (!cancelled && failures >= 3) {
          setIsConnected(false);
          setNeedsPairing(false);
        }
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
    <CameraContext.Provider value={{ camera, isConnected, needsPairing, connect }}>
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
