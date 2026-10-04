import React, { useEffect, useState } from 'react';
import { videoStorageService } from '../../services/VideoStorageService';
import { shareService } from '../../services/ShareService';
import { LocalVideo } from '../../types/camera';
import { Share2, Download, Trash2, ArrowLeft, MessageCircle } from 'lucide-react';
import { Link } from 'react-router-dom';

export const Gallery = () => {
  const [videos, setVideos] = useState<LocalVideo[]>([]);
  const [loading, setLoading] = useState(true);
  const [pendingCount, setPendingCount] = useState(0);
  const [online, setOnline] = useState(navigator.onLine);

  useEffect(() => {
    loadVideos();
    refreshPending();

    const update = () => {
      setOnline(navigator.onLine);
      refreshPending();
    };
    window.addEventListener('online', update);
    window.addEventListener('offline', update);
    return () => {
      window.removeEventListener('online', update);
      window.removeEventListener('offline', update);
    };
  }, []);

  const refreshPending = () => {
    setPendingCount(shareService.getPendingShares().length);
  };

  const loadVideos = async () => {
    setLoading(true);
    const vids = await videoStorageService.getAllVideos();
    setVideos(vids);
    setLoading(false);
  };

  const handleShare = async (video: LocalVideo) => {
    const result = await shareService.shareVideo(video);
    if (result === 'queued') {
      alert('Sem internet: o envio ficou pendente. Envie quando voltar ao 4G/5G.');
    }
    refreshPending();
  };

  const handleSendPending = async () => {
    // Envia os vídeos pendentes agora que a internet voltou (requer toque do usuário)
    for (const id of shareService.getPendingShares()) {
      const video = await videoStorageService.getVideo(id);
      if (video) {
        await shareService.shareVideo(video);
      } else {
        shareService.removePending(id); // vídeo não existe mais localmente
      }
    }
    refreshPending();
  };

  const handleDownload = (video: LocalVideo) => {
    shareService.downloadVideo(video);
  };

  const handleDelete = async (id: string) => {
    if (confirm('Tem certeza que deseja excluir este vídeo?')) {
      await videoStorageService.deleteVideo(id);
      loadVideos();
    }
  };

  return (
    <div className="min-h-screen bg-gray-950 text-white p-6">
      <div className="flex items-center mb-8">
        <Link to="/" className="mr-4 p-2 rounded-full hover:bg-gray-800 transition-colors">
          <ArrowLeft className="w-6 h-6" />
        </Link>
        <h1 className="text-2xl font-bold tracking-tight">Galeria Local</h1>
      </div>

      {pendingCount > 0 && (
        <div className="mb-6 p-4 bg-green-500/10 border border-green-500/30 rounded-2xl flex items-center justify-between">
          <p className="text-sm text-green-300">
            {pendingCount} envio(s) pendente(s) para o WhatsApp.
          </p>
          <button
            onClick={handleSendPending}
            disabled={!online}
            className="px-4 py-2 bg-[#25D366] hover:bg-[#128C7E] disabled:opacity-40 text-white text-sm font-semibold rounded-xl flex items-center gap-2 transition-colors"
          >
            <MessageCircle size={16} />
            {online ? 'Enviar agora' : 'Aguardando internet'}
          </button>
        </div>
      )}

      {loading ? (
        <div className="text-center text-gray-400 mt-20">Carregando vídeos...</div>
      ) : videos.length === 0 ? (
        <div className="text-center text-gray-500 mt-20 flex flex-col items-center">
          <p>Nenhum vídeo salvo ainda.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {videos.map(video => {
            const url = URL.createObjectURL(video.blob);
            return (
              <div key={video.id} className="bg-gray-900 rounded-2xl overflow-hidden border border-gray-800">
                <div className="aspect-video bg-black relative">
                  <video 
                    src={url} 
                    controls 
                    className="w-full h-full object-contain"
                  />
                </div>
                <div className="p-4">
                  <h3 className="font-medium text-sm truncate mb-1">{video.fileName}</h3>
                  <p className="text-xs text-gray-500 mb-4">
                    {new Date(video.date).toLocaleString()} • {(video.size / (1024 * 1024)).toFixed(1)} MB
                  </p>
                  <div className="flex justify-between">
                    <button 
                      onClick={() => handleShare(video)}
                      className="p-2 bg-gray-800 hover:bg-gray-700 rounded-lg transition-colors flex items-center justify-center flex-1 mr-2"
                      title="Compartilhar"
                    >
                      <Share2 className="w-4 h-4" />
                    </button>
                    <button 
                      onClick={() => handleDownload(video)}
                      className="p-2 bg-gray-800 hover:bg-gray-700 rounded-lg transition-colors flex items-center justify-center flex-1 mr-2"
                      title="Baixar"
                    >
                      <Download className="w-4 h-4" />
                    </button>
                    <button 
                      onClick={() => handleDelete(video.id)}
                      className="p-2 bg-red-900/30 text-red-500 hover:bg-red-900/50 rounded-lg transition-colors flex items-center justify-center flex-1"
                      title="Excluir"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
