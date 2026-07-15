/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useRef } from 'react';
import Header from './components/Header';
import SearchAndGrid from './components/SearchAndGrid';
import UploadModal from './components/UploadModal';
import PhotoDetailModal from './components/PhotoDetailModal';
import PeopleView from './components/PeopleView';
import BackupLogsModal from './components/BackupLogsModal';
import AlbumsView from './components/AlbumsView';
import { User, Person, Album } from './types';

const availableUsers: User[] = [
  { id: 'u1', name: 'Rabinder Gul', email: 'rabinder.gul@gmail.com', role: 'Admin' },
  { id: 'u2', name: 'Press Assistant', email: 'press.assistant@company.com', role: 'Viewer' }
];

export default function App() {
  const [currentUser, setCurrentUser] = useState<User>(availableUsers[0]);
  const [activeTab, setActiveTab] = useState<'search' | 'people' | 'albums'>('search');
  
  // Library global state
  const [people, setPeople] = useState<Person[]>([]);
  const [albums, setAlbums] = useState<Album[]>([]);
  const [stats, setStats] = useState({
    photoCount: 0,
    faceCount: 0,
    peopleCount: 0,
    albumCount: 0,
    demoMode: true
  });

  // Modal display controllers
  const [isUploadOpen, setIsUploadOpen] = useState(false);
  const [isBackupLogsOpen, setIsBackupLogsOpen] = useState(false);
  const [activePhotoId, setActivePhotoId] = useState<string | null>(null);

  // Trigger search handle across components
  const triggerSearchRef = useRef<() => void>(() => {});

  // Fetch stats and lists
  const refreshLibraryData = async () => {
    try {
      // 1. Database status
      const statsRes = await fetch('/api/db-status');
      if (statsRes.ok) {
        const statsData = await statsRes.json();
        setStats(statsData);
      }

      // 2. People clusters
      const peopleRes = await fetch('/api/people');
      if (peopleRes.ok) {
        const peopleData = await peopleRes.json();
        setPeople(peopleData);
      }

      // 3. Saved albums
      const albumsRes = await fetch('/api/albums');
      if (albumsRes.ok) {
        const albumsData = await albumsRes.json();
        setAlbums(albumsData);
      }
    } catch (err) {
      console.error('Failed to refresh data', err);
    }
  };

  useEffect(() => {
    refreshLibraryData();
  }, [currentUser]);

  // Handle successful file uploads
  const handleUploadFinished = () => {
    refreshLibraryData();
    // Refresh search results
    setTimeout(() => {
      triggerSearchRef.current();
    }, 100);
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col font-sans selection:bg-blue-600 selection:text-white">
      {/* Global Navigation Header */}
      <Header
        currentUser={currentUser}
        availableUsers={availableUsers}
        onUserChange={setCurrentUser}
        stats={stats}
        onRefreshStats={refreshLibraryData}
        onOpenBackupLogs={() => setIsBackupLogsOpen(true)}
        onOpenUpload={() => setIsUploadOpen(true)}
        activeTab={activeTab}
        setActiveTab={setActiveTab}
      />

      {/* Main App view stage */}
      <main className="flex-1 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 w-full">
        {activeTab === 'search' && (
          <SearchAndGrid
            currentUser={currentUser}
            people={people}
            albums={albums}
            onOpenPhotoDetail={setActivePhotoId}
            onRefreshStats={refreshLibraryData}
            triggerSearchRef={triggerSearchRef}
          />
        )}

        {activeTab === 'people' && (
          <PeopleView
            currentUser={currentUser}
            people={people}
            onRefreshData={refreshLibraryData}
            onOpenPhotoDetail={setActivePhotoId}
          />
        )}

        {activeTab === 'albums' && (
          <AlbumsView
            currentUser={currentUser}
            albums={albums}
            onRefreshData={refreshLibraryData}
            onOpenPhotoDetail={setActivePhotoId}
          />
        )}
      </main>

      {/* Footer copyright */}
      <footer className="border-t border-slate-900 bg-slate-950 py-4 text-center text-xs text-slate-500 font-mono">
        MediaFind Press Operations Hub © 2026. All Media Encrypted & Protected.
      </footer>

      {/* Slide-over upload batch wizard */}
      <UploadModal
        isOpen={isUploadOpen}
        onClose={() => setIsUploadOpen(false)}
        currentUser={currentUser}
        onUploadSuccess={handleUploadFinished}
      />

      {/* Full Photo Analysis & Coordinates Overlays modal */}
      <PhotoDetailModal
        photoId={activePhotoId || ''}
        isOpen={!!activePhotoId}
        onClose={() => setActivePhotoId(null)}
        currentUser={currentUser}
        people={people}
        onRefreshData={() => {
          refreshLibraryData();
          triggerSearchRef.current();
        }}
      />

      {/* Secure Backups & Audit logging Modal panel */}
      <BackupLogsModal
        isOpen={isBackupLogsOpen}
        onClose={() => setIsBackupLogsOpen(false)}
        currentUser={currentUser}
        onRefreshStats={refreshLibraryData}
      />
    </div>
  );
}
