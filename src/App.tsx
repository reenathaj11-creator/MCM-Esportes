import React from 'react';
import { Routes, Route, Link, useLocation } from 'react-router-dom';
import Main from './ui/pages/Main';
import { Gallery } from './ui/pages/Gallery';
import { Diagnostics } from './ui/pages/Diagnostics';
import { PreviewLab } from './ui/pages/PreviewLab';
import { TestPage } from './ui/pages/TestPage';
import Login from './ui/pages/Login';
import Register from './ui/pages/Register';
import { AdminSettings } from './ui/pages/AdminSettings';
import VideoDetail from './ui/pages/VideoDetail';
import ProtectedRoute from './ui/components/ProtectedRoute';
import { AuthProvider, useAuth } from './context/AuthContext';
import { CameraProvider } from './context/CameraContext';
import { Home, Film, Settings } from 'lucide-react';

function BottomNav() {
  const location = useLocation();
  const { role } = useAuth();
  
  if (['/login', '/register', '/diagnostics', '/lab', '/camera-test'].includes(location.pathname) || location.pathname.includes('/video/')) {
    return null;
  }

  return (
    <nav className="fixed bottom-0 left-0 right-0 bg-brand-bg/80 backdrop-blur-xl border-t border-white/5 pb-safe z-50">
      <div className="flex justify-around items-center h-16">
        <Link to="/" className={`flex flex-col items-center justify-center w-full h-full gap-1 transition-colors ${location.pathname === '/' ? 'text-brand-primary' : 'text-brand-muted hover:text-white'}`}>
          <Home size={22} className={location.pathname === '/' ? 'drop-shadow-[0_0_8px_rgba(245,200,0,0.5)]' : ''} />
          <span className="text-[10px] font-medium">Início</span>
        </Link>
        <Link to="/gallery" className={`flex flex-col items-center justify-center w-full h-full gap-1 transition-colors ${location.pathname === '/gallery' ? 'text-brand-primary' : 'text-brand-muted hover:text-white'}`}>
          <Film size={22} className={location.pathname === '/gallery' ? 'drop-shadow-[0_0_8px_rgba(245,200,0,0.5)]' : ''} />
          <span className="text-[10px] font-medium">Galeria</span>
        </Link>
        {role === 'admin' && (
          <Link to="/settings" className={`flex flex-col items-center justify-center w-full h-full gap-1 transition-colors ${location.pathname === '/settings' ? 'text-brand-primary' : 'text-brand-muted hover:text-white'}`}>
            <Settings size={22} className={location.pathname === '/settings' ? 'drop-shadow-[0_0_8px_rgba(245,200,0,0.5)]' : ''} />
            <span className="text-[10px] font-medium">Admin</span>
          </Link>
        )}
      </div>
    </nav>
  );
}

function App() {
  return (
    <AuthProvider>
      <CameraProvider>
        <div className="min-h-screen bg-brand-bg text-brand-text font-sans selection:bg-brand-primary selection:text-brand-bg pb-16">
          <Routes>
            <Route path="/login" element={<Login />} />
            <Route path="/register" element={<Register />} />
            
            <Route path="/" element={<ProtectedRoute><Main /></ProtectedRoute>} />
            <Route path="/gallery" element={<ProtectedRoute><Gallery /></ProtectedRoute>} />
            <Route path="/video/:id" element={<ProtectedRoute><VideoDetail /></ProtectedRoute>} />
            <Route path="/settings" element={<ProtectedRoute requireAdmin><AdminSettings /></ProtectedRoute>} />
            
            <Route path="/diagnostics" element={<Diagnostics />} />
            <Route path="/lab" element={<PreviewLab />} />
            <Route path="/camera-test" element={<TestPage />} />
          </Routes>
          <BottomNav />
        </div>
      </CameraProvider>
    </AuthProvider>
  );
}

export default App;
