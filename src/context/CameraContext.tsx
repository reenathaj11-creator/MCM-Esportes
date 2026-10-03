import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { CameraService } from '../types/camera';
import { MockCameraService } from '../services/camera/MockCameraService';
import { Xiaomi70maiCameraService } from '../services/camera/70maiCameraService';

interface CameraContextType {
  camera: CameraService;
  useMock: boolean;
  setUseMock: (useMock: boolean) => void;
  isConnected: boolean;
  connect: () => Promise<void>;
}

const CameraContext = createContext<CameraContextType | undefined>(undefined);

export const CameraProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [useMock, setUseMock] = useState(true);
  const [camera, setCamera] = useState<CameraService>(new MockCameraService());
  const [isConnected, setIsConnected] = useState(false);

  useEffect(() => {
    const newCamera = useMock ? new MockCameraService() : new Xiaomi70maiCameraService();
    setCamera(newCamera);
    setIsConnected(false); // Reset connection state when switching
  }, [useMock]);

  const connect = async () => {
    const success = await camera.connect();
    setIsConnected(success);
  };

  return (
    <CameraContext.Provider value={{ camera, useMock, setUseMock, isConnected, connect }}>
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
