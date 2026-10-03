import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, Trash2, Download, Link as LinkIcon, Edit3, Share2, MessageCircle } from 'lucide-react';
import { videoStorageService } from '../../services/VideoStorageService';
import { shareService } from '../../services/ShareService';
import { LocalVideo } from '../../types/camera';

export default function VideoDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [video, setVideo] = useState<LocalVideo | null>(null);
  const [blobUrl, setBlobUrl] = useState<string>('');

  useEffect(() => {
    async function load() {
      if (!id) return;
      const v = await videoStorageService.getVideo(id);
      if (v) {
        setVideo(v);
        setBlobUrl(URL.createObjectURL(v.blob));
      }
    }
    load();
    return () => {
      if (blobUrl) URL.revokeObjectURL(blobUrl);
    };
  }, [id]);

  const handleDelete = async () => {
    if (window.confirm('Tem certeza que deseja excluir?')) {
      if (id) await videoStorageService.deleteVideo(id);
      navigate('/gallery');
    }
  };

  const formatDuration = (seconds: number) => {
    const m = Math.floor(seconds / 60);
    const s = Math.floor(seconds % 60);
    return m > 0 ? `${m}m ${s}s` : `${s} segundos`;
  };

  if (!video) return <div className="min-h-screen bg-brand-bg flex items-center justify-center text-brand-muted">Carregando...</div>;

  const durationStr = formatDuration(video.duration || 0);

  return (
    <div className="min-h-screen bg-brand-bg flex flex-col">
      {/* HEADER */}
      <header className="pt-12 pb-4 px-6 flex items-center justify-between">
        <button onClick={() => navigate(-1)} className="p-2 -ml-2 text-white hover:bg-white/5 rounded-full transition-colors">
          <ArrowLeft size={24} />
        </button>
        <h1 className="text-white font-medium">Jogada capturada</h1>
        <button onClick={handleDelete} className="p-2 -mr-2 text-brand-muted hover:text-red-400 hover:bg-white/5 rounded-full transition-colors">
          <Trash2 size={24} />
        </button>
      </header>

      <main className="flex-1 px-6 pb-8 flex flex-col">
        {/* PLAYER */}
        <div className="w-full aspect-video bg-black rounded-2xl overflow-hidden mb-6 relative shadow-2xl">
          <video 
            src={blobUrl} 
            controls 
            className="w-full h-full object-contain"
            controlsList="nodownload"
          />
          <div className="absolute bottom-3 right-3 bg-black/60 backdrop-blur-md px-2 py-1 rounded text-xs font-medium text-white pointer-events-none">
            {durationStr}
          </div>
        </div>

        {/* INFO */}
        <div className="mb-8">
          <div className="flex justify-between items-start mb-2">
            <h2 className="text-2xl font-bold text-white leading-tight">Gol do time preto</h2>
            <button className="p-2 text-brand-muted hover:text-white transition-colors">
              <Edit3 size={20} />
            </button>
          </div>
          <p className="text-brand-muted text-sm flex items-center gap-2">
            Hoje • {new Date(video.date).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})} • {durationStr}
          </p>
        </div>

        {/* ACTIONS */}
        <div className="grid grid-cols-2 gap-4 mt-auto">
          <button 
            onClick={() => shareService.shareVideo(video)}
            className="col-span-1 bg-[#25D366] hover:bg-[#128C7E] rounded-2xl p-4 flex flex-col items-center justify-center gap-3 transition-colors text-white shadow-lg shadow-green-500/20"
          >
            <MessageCircle size={28} />
            <span className="font-semibold text-sm">Enviar no<br/>WhatsApp</span>
          </button>

          <button 
            onClick={() => shareService.downloadVideo(video)}
            className="col-span-1 bg-brand-card hover:bg-brand-card-hover border border-white/5 rounded-2xl p-4 flex flex-col items-center justify-center gap-3 transition-colors text-white"
          >
            <Download size={28} className="text-brand-muted" />
            <span className="font-medium text-sm">Salvar na<br/>galeria</span>
          </button>

          <button 
            className="col-span-1 bg-brand-card hover:bg-brand-card-hover border border-white/5 rounded-2xl p-4 flex flex-col items-center justify-center gap-3 transition-colors text-white"
          >
            <LinkIcon size={24} className="text-brand-muted" />
            <span className="font-medium text-sm">Compartilhar<br/>link</span>
          </button>

          <button 
            onClick={handleDelete}
            className="col-span-1 bg-brand-card hover:bg-red-500/10 border border-white/5 hover:border-red-500/20 rounded-2xl p-4 flex flex-col items-center justify-center gap-3 transition-colors text-red-400 group"
          >
            <Trash2 size={24} className="group-hover:scale-110 transition-transform" />
            <span className="font-medium text-sm">Excluir<br/>vídeo</span>
          </button>
        </div>
      </main>
    </div>
  );
}
