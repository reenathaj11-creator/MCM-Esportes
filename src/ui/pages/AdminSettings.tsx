import React from 'react';
import { useAuth } from '../../context/AuthContext';
import { Settings, Users, Video, Activity, ArrowLeft } from 'lucide-react';
import { Link } from 'react-router-dom';

export const AdminSettings: React.FC = () => {
  const { user, logout } = useAuth();

  return (
    <div className="min-h-screen bg-neutral-950 text-neutral-100 p-4 sm:p-8">
      <div className="max-w-4xl mx-auto space-y-6">
        
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div className="flex items-center space-x-4">
            <Link to="/" className="p-2 bg-neutral-800 rounded-full hover:bg-neutral-700 transition">
              <ArrowLeft className="w-5 h-5 text-neutral-300" />
            </Link>
            <h1 className="text-2xl font-bold flex items-center gap-2">
              <Settings className="w-6 h-6 text-emerald-500" />
              Admin Settings
            </h1>
          </div>
          <div className="flex items-center gap-4">
            <span className="text-sm text-neutral-400">Logged in as {user?.email}</span>
            <button
              onClick={logout}
              className="px-4 py-2 bg-neutral-800 text-sm font-medium rounded-lg hover:bg-neutral-700 transition"
            >
              Logout
            </button>
          </div>
        </div>

        {/* Live Preview Section */}
        <div className="bg-neutral-900 border border-neutral-800 rounded-2xl overflow-hidden shadow-lg">
          <div className="p-4 border-b border-neutral-800 flex items-center justify-between">
            <h2 className="text-lg font-semibold flex items-center gap-2">
              <Video className="w-5 h-5 text-emerald-500" />
              Live Camera Preview
            </h2>
            <span className="px-2.5 py-0.5 rounded-full text-xs font-medium bg-emerald-500/10 text-emerald-500 flex items-center gap-1.5">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
              Live
            </span>
          </div>
          <div className="aspect-video bg-neutral-950 relative flex items-center justify-center">
            {/* Mock Live Stream */}
            <div className="absolute inset-0 bg-neutral-800 animate-pulse opacity-50"></div>
            <div className="z-10 flex flex-col items-center text-neutral-500">
              <Video className="w-12 h-12 mb-2 opacity-50" />
              <p>Camera feed starting...</p>
              <p className="text-sm mt-1">Adjust position manually</p>
            </div>
            
            {/* Overlay guidelines for adjustment */}
            <div className="absolute inset-0 border border-dashed border-emerald-500/30 m-8 pointer-events-none rounded"></div>
            <div className="absolute top-1/2 left-0 right-0 h-px bg-emerald-500/20 pointer-events-none"></div>
            <div className="absolute left-1/2 top-0 bottom-0 w-px bg-emerald-500/20 pointer-events-none"></div>
          </div>
          <div className="p-4 bg-neutral-900">
            <div className="flex gap-2">
              <button className="flex-1 bg-neutral-800 py-2 rounded-lg text-sm font-medium hover:bg-neutral-700 transition">
                Recalibrate
              </button>
              <button className="flex-1 bg-neutral-800 py-2 rounded-lg text-sm font-medium hover:bg-neutral-700 transition">
                Toggle Grid
              </button>
            </div>
          </div>
        </div>

        {/* Future Reports Section */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="bg-neutral-900 border border-neutral-800 rounded-2xl p-6 shadow-lg">
            <div className="flex items-center gap-3 mb-4">
              <div className="p-2 bg-emerald-500/10 rounded-lg">
                <Users className="w-6 h-6 text-emerald-500" />
              </div>
              <h3 className="text-lg font-semibold">User Statistics</h3>
            </div>
            <div className="space-y-4">
              <div className="flex justify-between items-center py-2 border-b border-neutral-800">
                <span className="text-neutral-400">Total Registered</span>
                <span className="font-medium text-xl">1,248</span>
              </div>
              <div className="flex justify-between items-center py-2 border-b border-neutral-800">
                <span className="text-neutral-400">Active Today</span>
                <span className="font-medium text-xl">142</span>
              </div>
              <div className="flex justify-between items-center py-2">
                <span className="text-neutral-400">New (This Week)</span>
                <span className="font-medium text-xl text-emerald-500">+34</span>
              </div>
            </div>
          </div>

          <div className="bg-neutral-900 border border-neutral-800 rounded-2xl p-6 shadow-lg">
            <div className="flex items-center gap-3 mb-4">
              <div className="p-2 bg-blue-500/10 rounded-lg">
                <Activity className="w-6 h-6 text-blue-500" />
              </div>
              <h3 className="text-lg font-semibold">System Health</h3>
            </div>
            <div className="space-y-4">
              <div className="flex justify-between items-center py-2 border-b border-neutral-800">
                <span className="text-neutral-400">Storage Used</span>
                <span className="font-medium">45% (1.2TB)</span>
              </div>
              <div className="flex justify-between items-center py-2 border-b border-neutral-800">
                <span className="text-neutral-400">Camera Status</span>
                <span className="font-medium text-emerald-500">Online</span>
              </div>
              <div className="flex justify-between items-center py-2">
                <span className="text-neutral-400">API Latency</span>
                <span className="font-medium">45ms</span>
              </div>
            </div>
          </div>
        </div>

      </div>
    </div>
  );
};
