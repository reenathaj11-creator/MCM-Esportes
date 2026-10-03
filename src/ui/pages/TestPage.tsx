import React, { useState } from 'react';
import { useCamera } from '../../context/CameraContext';
import { ArrowLeft, Wifi, AlertTriangle } from 'lucide-react';
import { Link } from 'react-router-dom';

export const TestPage = () => {
  const { useMock, setUseMock, isConnected, connect } = useCamera();
  const [connecting, setConnecting] = useState(false);

  const handleConnect = async () => {
    setConnecting(true);
    await connect();
    setConnecting(false);
  };

  return (
    <div className="min-h-screen bg-gray-950 text-white p-6">
      <div className="flex items-center mb-8">
        <Link to="/" className="mr-4 p-2 rounded-full hover:bg-gray-800 transition-colors">
          <ArrowLeft className="w-6 h-6" />
        </Link>
        <h1 className="text-2xl font-bold tracking-tight">Conexão & Testes</h1>
      </div>

      <div className="bg-gray-900 rounded-2xl p-6 border border-gray-800 mb-6">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-lg font-semibold">Modo de Operação</h2>
          <div className="flex items-center space-x-2">
            <span className={`text-sm ${useMock ? 'text-blue-400' : 'text-gray-500'}`}>Simulador</span>
            <button 
              onClick={() => setUseMock(!useMock)}
              className={`w-12 h-6 rounded-full p-1 transition-colors ${useMock ? 'bg-blue-600' : 'bg-green-600'}`}
            >
              <div className={`w-4 h-4 rounded-full bg-white transition-transform ${useMock ? 'translate-x-0' : 'translate-x-6'}`} />
            </button>
            <span className={`text-sm ${!useMock ? 'text-green-400' : 'text-gray-500'}`}>Real</span>
          </div>
        </div>

        {!useMock && (
          <div className="mb-6 p-4 bg-yellow-900/20 border border-yellow-700/50 rounded-lg flex items-start">
            <AlertTriangle className="w-5 h-5 text-yellow-500 mr-3 shrink-0 mt-0.5" />
            <p className="text-sm text-yellow-200/80">
              Para usar o modo real, conecte o Wi-Fi do seu dispositivo à rede da câmera AKASO antes de tentar conectar.
            </p>
          </div>
        )}

        <div className="flex items-center justify-between p-4 bg-gray-950 rounded-xl mb-6 border border-gray-800">
          <div className="flex items-center">
            <Wifi className={`w-6 h-6 mr-3 ${isConnected ? 'text-green-500' : 'text-gray-600'}`} />
            <div>
              <div className="font-medium">{isConnected ? 'Conectado' : 'Desconectado'}</div>
              <div className="text-xs text-gray-500">
                {useMock ? 'Mocking Service (Simulado)' : 'AKASO EK7000 (192.168.1.254)'}
              </div>
            </div>
          </div>
          
          <button
            onClick={handleConnect}
            disabled={connecting}
            className={`px-4 py-2 rounded-lg font-medium text-sm transition-colors ${
              isConnected 
                ? 'bg-gray-800 text-gray-300 hover:bg-gray-700' 
                : 'bg-green-600 text-white hover:bg-green-500'
            }`}
          >
            {connecting ? 'Conectando...' : (isConnected ? 'Reconectar' : 'Conectar')}
          </button>
        </div>

        <Link 
          to="/diagnostics"
          className="block w-full py-3 text-center bg-gray-800 hover:bg-gray-700 text-gray-300 rounded-xl font-medium transition-colors"
        >
          Diagnóstico de Conexão (Físico)
        </Link>
      </div>
    </div>
  );
};
