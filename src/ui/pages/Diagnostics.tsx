import React, { useState } from 'react';
import { useCamera } from '../../context/CameraContext';
import { ConnectionDiagnosticsResult } from '../../types/camera';
import { CheckCircle2, XCircle, Loader2, ArrowLeft } from 'lucide-react';
import { Link } from 'react-router-dom';

export const Diagnostics = () => {
  const { camera } = useCamera();
  const [running, setRunning] = useState(false);
  const [results, setResults] = useState<ConnectionDiagnosticsResult | null>(null);

  const runDiagnostics = async () => {
    setRunning(true);
    setResults(null);
    
    // In a real app, this would perform actual network tests.
    // For now, we simulate the diagnostic process.
    
    const diag: ConnectionDiagnosticsResult = {
      wifiConnected: false,
      cameraReachable: false,
      httpServerReachable: false,
      statusEndpointReachable: false,
      modelIdentified: false,
      firmwareIdentified: false,
      listFilesSupported: false,
      recordingControlSupported: false,
      downloadSupported: false,
      errors: {},
    };

    try {
      // Step 1: Check basic connection
      diag.wifiConnected = true; // Assume true if we are running this in a browser
      
      const connected = await camera.connect();
      diag.cameraReachable = connected;
      diag.httpServerReachable = connected;
      
      if (connected) {
        // Step 2: Info
        try {
          const info = await camera.getCameraInfo();
          diag.modelIdentified = !!info.model;
          diag.firmwareIdentified = !!info.firmware;
        } catch (e: any) {
          diag.errors['info'] = e.message;
        }

        // Step 3: Status
        try {
          await camera.getStatus();
          diag.statusEndpointReachable = true;
        } catch (e: any) {
          diag.errors['status'] = e.message;
        }

        // Step 4: Capabilities
        try {
          const caps = await camera.getCapabilities();
          diag.listFilesSupported = caps.listFiles;
          diag.recordingControlSupported = caps.remoteRecording;
          diag.downloadSupported = caps.downloadFiles;
        } catch (e: any) {
          diag.errors['capabilities'] = e.message;
        }
      } else {
        diag.errors['connection'] = 'Não foi possível conectar à câmera';
      }
    } catch (e: any) {
      diag.errors['general'] = e.message;
    }

    setResults(diag);
    setRunning(false);
  };

  const ResultItem = ({ label, status }: { label: string, status: boolean | undefined }) => (
    <div className="flex items-center justify-between p-3 bg-gray-900 rounded-lg mb-2">
      <span className="text-sm font-medium">{label}</span>
      {status === undefined ? (
        <span className="text-gray-500 text-sm">Pendente</span>
      ) : status ? (
        <CheckCircle2 className="w-5 h-5 text-green-500" />
      ) : (
        <XCircle className="w-5 h-5 text-red-500" />
      )}
    </div>
  );

  return (
    <div className="min-h-screen bg-gray-950 text-white p-6">
      <div className="flex items-center mb-8">
        <Link to="/test" className="mr-4 p-2 rounded-full hover:bg-gray-800 transition-colors">
          <ArrowLeft className="w-6 h-6" />
        </Link>
        <h1 className="text-2xl font-bold tracking-tight">Diagnóstico Avançado</h1>
      </div>

      <button
        onClick={runDiagnostics}
        disabled={running}
        className="w-full py-4 bg-blue-600 hover:bg-blue-500 rounded-xl font-bold flex items-center justify-center transition-colors mb-8 disabled:opacity-50"
      >
        {running ? (
          <>
            <Loader2 className="w-5 h-5 mr-2 animate-spin" />
            Executando Testes...
          </>
        ) : (
          'Iniciar Diagnóstico'
        )}
      </button>

      {results && (
        <div className="space-y-1">
          <h2 className="text-lg font-semibold mb-4 text-gray-400">Resultados</h2>
          <ResultItem label="Conexão Wi-Fi (Assumido)" status={results.wifiConnected} />
          <ResultItem label="Câmera Alcançável (Ping)" status={results.cameraReachable} />
          <ResultItem label="Servidor HTTP (Porta 80)" status={results.httpServerReachable} />
          <ResultItem label="Endpoint de Status (2001)" status={results.statusEndpointReachable} />
          <ResultItem label="Modelo Identificado" status={results.modelIdentified} />
          <ResultItem label="Firmware Identificado" status={results.firmwareIdentified} />
          <ResultItem label="Suporte a Listar Arquivos" status={results.listFilesSupported} />
          <ResultItem label="Suporte a Gravação" status={results.recordingControlSupported} />
          <ResultItem label="Suporte a Download" status={results.downloadSupported} />
          
          {Object.keys(results.errors).length > 0 && (
            <div className="mt-6 p-4 bg-red-950/30 border border-red-900 rounded-lg text-red-400 text-sm">
              <h3 className="font-bold mb-2">Erros encontrados:</h3>
              <ul className="list-disc pl-5">
                {Object.entries(results.errors).map(([key, msg]) => (
                  <li key={key}>{key}: {msg}</li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
