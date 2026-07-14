import React from 'react';
import { Image, User, Shield, Key, RefreshCw, LogIn, Database, FileText } from 'lucide-react';
import { User as UserType } from '../types';

interface HeaderProps {
  currentUser: UserType;
  availableUsers: UserType[];
  onUserChange: (user: UserType) => void;
  stats: {
    photoCount: number;
    faceCount: number;
    peopleCount: number;
    albumCount: number;
    demoMode: boolean;
  };
  onRefreshStats: () => void;
  onOpenBackupLogs: () => void;
  onOpenUpload: () => void;
  activeTab: 'search' | 'people' | 'albums';
  setActiveTab: (tab: 'search' | 'people' | 'albums') => void;
}

export default function Header({
  currentUser,
  availableUsers,
  onUserChange,
  stats,
  onRefreshStats,
  onOpenBackupLogs,
  onOpenUpload,
  activeTab,
  setActiveTab
}: HeaderProps) {
  return (
    <header className="bg-[#0A0A0A] text-white border-b border-[#2A2A2A] shadow-md sticky top-0 z-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-20">
          {/* Logo */}
          <div className="flex items-center space-x-4 cursor-pointer" onClick={() => setActiveTab('search')}>
            <div className="w-10 h-10 rounded-full bg-gradient-to-tr from-[#C4B5FD] to-[#FB7185] flex items-center justify-center text-slate-950 shadow-md">
              <Image className="h-5 w-5 stroke-[2]" />
            </div>
            <div>
              <span className="font-serif italic font-bold text-2xl tracking-tighter text-[#E0E0E0]">
                MediaFind
              </span>
              <span className="block text-[10px] font-mono text-[#888] tracking-widest uppercase mt-0.5">
                Press Unit
              </span>
            </div>
          </div>

          {/* Navigation Tabs */}
          <nav className="hidden md:flex space-x-2">
            <button
              onClick={() => setActiveTab('search')}
              className={`px-4 py-2 rounded-full text-xs font-semibold uppercase tracking-wider transition-all border ${
                activeTab === 'search'
                  ? 'bg-[#1A1A1A] border-[#333] text-[#C4B5FD]'
                  : 'border-transparent text-slate-400 hover:text-slate-200'
              }`}
            >
              Search & Library
            </button>
            <button
              onClick={() => setActiveTab('people')}
              className={`px-4 py-2 rounded-full text-xs font-semibold uppercase tracking-wider transition-all border ${
                activeTab === 'people'
                  ? 'bg-[#1A1A1A] border-[#333] text-[#C4B5FD]'
                  : 'border-transparent text-slate-400 hover:text-slate-200'
              }`}
            >
              Identified People
            </button>
            <button
              onClick={() => setActiveTab('albums')}
              className={`px-4 py-2 rounded-full text-xs font-semibold uppercase tracking-wider transition-all border ${
                activeTab === 'albums'
                  ? 'bg-[#1A1A1A] border-[#333] text-[#C4B5FD]'
                  : 'border-transparent text-slate-400 hover:text-slate-200'
              }`}
            >
              Albums & Saved Sets
            </button>
          </nav>

          {/* Right Controls */}
          <div className="flex items-center space-x-4">
            {/* Index Stats */}
            <div className="hidden lg:flex items-center space-x-4 px-4 py-1.5 bg-[#1A1A1A] border border-[#333] rounded-full text-[11px] text-slate-300">
              <div className="text-center">
                <span className="font-mono font-bold text-[#C4B5FD]">{stats.photoCount}</span>
                <span className="block text-[8px] text-slate-500 uppercase tracking-widest">Photos</span>
              </div>
              <div className="w-px h-6 bg-[#2A2A2A]" />
              <div className="text-center">
                <span className="font-mono font-bold text-[#FB7185]">{stats.faceCount}</span>
                <span className="block text-[8px] text-slate-500 uppercase tracking-widest">Faces</span>
              </div>
              <div className="w-px h-6 bg-[#2A2A2A]" />
              <div className="text-center">
                <span className="font-mono font-bold text-[#E0E0E0]">{stats.peopleCount}</span>
                <span className="block text-[8px] text-slate-500 uppercase tracking-widest">Clusters</span>
              </div>
              <button 
                onClick={onRefreshStats}
                title="Refresh stats"
                className="text-slate-500 hover:text-[#C4B5FD] p-1 rounded-full hover:bg-[#2A2A2A] transition-colors"
              >
                <RefreshCw className="h-3.5 w-3.5" />
              </button>
            </div>

            {/* Upload Button */}
            <button
              onClick={onOpenUpload}
              className="bg-gradient-to-r from-[#C4B5FD] to-[#FB7185] hover:opacity-90 text-slate-950 font-bold px-4 py-2 rounded-full text-xs uppercase tracking-wider transition-all flex items-center space-x-2 shadow-lg"
            >
              <Database className="h-3.5 w-3.5 stroke-[2.5]" />
              <span>Import Photos</span>
            </button>

            {/* Security/Backup Logs */}
            <button
              onClick={onOpenBackupLogs}
              className="p-2.5 bg-[#1A1A1A] text-slate-400 hover:text-[#C4B5FD] rounded-full border border-[#333] hover:border-[#444] transition-colors"
              title="Audit Logs & Backups"
            >
              <Shield className="h-4 w-4" />
            </button>

            {/* Login / Role Swapper */}
            <div className="flex items-center space-x-2 bg-[#1A1A1A] p-1.5 rounded-full border border-[#333]">
              <div className="w-8 h-8 rounded-full bg-gradient-to-tr from-[#C4B5FD] to-[#FB7185] flex items-center justify-center text-xs font-bold text-slate-950 shrink-0">
                {currentUser.name.charAt(0)}
              </div>
              <div className="text-left hidden sm:block pr-1 leading-tight">
                <span className="block text-[11px] font-bold text-[#F5F5F5]">{currentUser.name.split(' ')[0]}</span>
                <span className="block text-[9px] text-slate-500 font-mono tracking-tighter uppercase">{currentUser.role}</span>
              </div>
              
              <select
                value={currentUser.id}
                onChange={(e) => {
                  const selected = availableUsers.find(u => u.id === e.target.value);
                  if (selected) onUserChange(selected);
                }}
                className="bg-[#0A0A0A] border border-[#333] text-[10px] text-slate-300 rounded-full py-0.5 px-2 focus:outline-none cursor-pointer hover:border-[#444]"
                title="Change Active Staff Role"
              >
                {availableUsers.map(u => (
                  <option key={u.id} value={u.id}>
                    {u.role}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </div>
      </div>

      {/* Demo Mode Notice */}
      {stats.demoMode && (
        <div className="bg-amber-500/10 border-b border-amber-500/20 px-4 py-1.5 text-center text-amber-300 text-xs flex items-center justify-center space-x-2 animate-pulse">
          <Key className="h-3.5 w-3.5" />
          <span>
            Running in <strong>Demo Mode</strong>. No GEMINI_API_KEY detected in secrets. Using ultra-realistic mock vision auto-indexing.
          </span>
        </div>
      )}
    </header>
  );
}
