import React, { useState, useEffect } from 'react';
import { Bookmark, FolderPlus, Trash2, Image, Calendar, User, Eye, X, RefreshCw } from 'lucide-react';
import { Album, Photo, User as UserType } from '../types';

interface AlbumsViewProps {
  currentUser: UserType;
  albums: Album[];
  onRefreshData: () => void;
  onOpenPhotoDetail: (photoId: string) => void;
}

export default function AlbumsView({
  currentUser,
  albums,
  onRefreshData,
  onOpenPhotoDetail
}: AlbumsViewProps) {
  const [activeAlbum, setActiveAlbum] = useState<Album | null>(null);
  const [albumPhotos, setAlbumPhotos] = useState<Photo[]>([]);
  const [newAlbumName, setNewAlbumName] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const fetchAlbumPhotos = async (albumId: string) => {
    setIsLoading(true);
    try {
      // Find photos that contain this albumId
      const res = await fetch('/api/photos/search', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          query: '',
          filters: { albumId },
          userEmail: currentUser.email,
          userName: currentUser.name
        })
      });
      if (res.ok) {
        const data = await res.json();
        setAlbumPhotos(data);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setIsLoading(false);
    }
  };

  const handleCreateAlbum = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newAlbumName.trim()) return;

    try {
      const res = await fetch('/api/albums', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: newAlbumName.trim(),
          userEmail: currentUser.email,
          userName: currentUser.name
        })
      });
      if (res.ok) {
        setNewAlbumName('');
        onRefreshData();
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handleRemoveFromAlbum = async (photoId: string) => {
    if (!activeAlbum) return;
    try {
      const res = await fetch(`/api/albums/${activeAlbum.id}/remove-photos`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          photoIds: [photoId],
          userEmail: currentUser.email,
          userName: currentUser.name
        })
      });
      if (res.ok) {
        fetchAlbumPhotos(activeAlbum.id);
        onRefreshData();
      }
    } catch (err) {
      console.error(err);
    }
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
      
      {/* Albums Sidebar list */}
      <div className="bg-[#1A1A1A] border border-[#2A2A2A] rounded-2xl p-5 space-y-4 lg:col-span-1 flex flex-col max-h-[80vh] overflow-y-auto">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <Bookmark className="h-5 w-5 text-[#C4B5FD]" />
            <h3 className="text-sm font-semibold uppercase tracking-wider text-white">Press Albums</h3>
          </div>
          <button 
            onClick={onRefreshData}
            className="text-slate-500 hover:text-white p-1.5 rounded-full hover:bg-[#2A2A2A] transition-colors"
            title="Refresh albums"
          >
            <RefreshCw className="h-4 w-4" />
          </button>
        </div>

        {/* Create Album Form */}
        <form onSubmit={handleCreateAlbum} className="flex gap-2">
          <input
            type="text"
            placeholder="New Album Name (e.g. Summit Gala)..."
            value={newAlbumName}
            onChange={(e) => setNewAlbumName(e.target.value)}
            className="flex-1 bg-[#0A0A0A] border border-[#333] text-slate-200 rounded-full px-4 py-2 text-xs focus:outline-none focus:border-[#C4B5FD]"
          />
          <button
            type="submit"
            disabled={!newAlbumName.trim()}
            className="bg-gradient-to-r from-[#C4B5FD] to-[#FB7185] hover:opacity-90 disabled:opacity-40 disabled:bg-[#0A0A0A] text-slate-950 font-bold text-xs uppercase tracking-wider px-4 py-2 rounded-full transition-colors flex items-center space-x-1 shadow-md"
          >
            <FolderPlus className="h-3.5 w-3.5 stroke-[2.5]" />
            <span>Create</span>
          </button>
        </form>

        {/* Albums List */}
        <div className="space-y-2 overflow-y-auto flex-1 pr-1 divide-y divide-[#2A2A2A]">
          {albums.map((album: any) => {
            const isActive = activeAlbum && activeAlbum.id === album.id;
            return (
              <div
                key={album.id}
                onClick={() => {
                  setActiveAlbum(album);
                  fetchAlbumPhotos(album.id);
                }}
                className={`flex items-center space-x-3 p-3 rounded-xl cursor-pointer transition-colors ${
                  isActive 
                    ? 'bg-[#C4B5FD]/10 border border-[#C4B5FD]/20 text-[#C4B5FD]' 
                    : 'hover:bg-[#2A2A2A] text-slate-300'
                }`}
              >
                <div className="h-10 w-10 bg-slate-950 border border-[#2A2A2A] rounded-lg overflow-hidden shrink-0 flex items-center justify-center relative">
                  {album.thumbnailPath ? (
                    <img
                      src={album.thumbnailPath}
                      alt={album.name}
                      referrerPolicy="no-referrer"
                      className="h-full w-full object-cover"
                    />
                  ) : (
                    <Image className="h-4 w-4 text-slate-600" />
                  )}
                </div>

                <div className="min-w-0 flex-1">
                  <span className={`block text-xs font-semibold truncate ${isActive ? 'text-[#C4B5FD]' : 'text-slate-200'}`}>
                    {album.name}
                  </span>
                  <span className="block text-[10px] text-slate-500 font-mono mt-0.5">
                    {album.photoCount} photo(s) • By {album.created_by.split('@')[0]}
                  </span>
                </div>
              </div>
            );
          })}
          {albums.length === 0 && (
            <div className="text-center py-8 text-xs text-slate-500">
              No albums created yet. Use the input form above to organize files!
            </div>
          )}
        </div>
      </div>

      {/* Album Photos Grid */}
      <div className="bg-[#1A1A1A] border border-[#2A2A2A] rounded-2xl p-5 lg:col-span-2 flex flex-col max-h-[80vh] overflow-y-auto">
        {activeAlbum ? (
          <div className="space-y-4 flex flex-col flex-1">
            <div className="flex items-center justify-between border-b border-[#2A2A2A] pb-3">
              <div>
                <h4 className="text-sm font-bold uppercase tracking-wider text-[#F5F5F5] font-serif italic">{activeAlbum.name}</h4>
                <span className="block text-[10px] text-slate-500 mt-1 font-mono uppercase tracking-wider">
                  Created at {new Date(activeAlbum.created_at).toLocaleDateString()} • contains {albumPhotos.length} photos
                </span>
              </div>
              <button
                onClick={() => { setActiveAlbum(null); setAlbumPhotos([]); }}
                className="text-slate-500 hover:text-white p-1.5 rounded-full hover:bg-[#2A2A2A]"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            {isLoading ? (
              <div className="text-center py-12">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#C4B5FD] mx-auto" />
              </div>
            ) : (
              <div className="flex-1">
                {albumPhotos.length === 0 ? (
                  <div className="text-center py-12 text-slate-500 text-xs">
                    No photos inside this album. Search your library, select photos, and click "Add to Album" to organize them!
                  </div>
                ) : (
                  <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
                    {albumPhotos.map((photo) => (
                      <div
                        key={photo.id}
                        className="group border border-[#2A2A2A] rounded-xl overflow-hidden bg-[#0A0A0A] relative hover:border-[#444] transition-all cursor-pointer"
                        onClick={() => onOpenPhotoDetail(photo.id)}
                      >
                        {/* Remove Action Anchor */}
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleRemoveFromAlbum(photo.id);
                          }}
                          className="absolute top-2.5 right-2.5 p-1.5 bg-red-950/80 hover:bg-red-900/80 text-red-300 rounded-full opacity-0 group-hover:opacity-100 transition-opacity z-10"
                          title="Remove from album"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>

                        <div className="aspect-[4/3] bg-slate-900 overflow-hidden">
                          <img
                            src={photo.filepath}
                            alt={photo.caption}
                            referrerPolicy="no-referrer"
                            className="w-full h-full object-cover group-hover:scale-102 transition-transform duration-500"
                            loading="lazy"
                          />
                        </div>

                        <div className="p-2.5 text-[10px] text-slate-300 line-clamp-1 leading-normal">
                          {photo.caption}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        ) : (
          <div className="text-center py-24 flex flex-col items-center justify-center text-slate-500">
            <Bookmark className="h-10 w-10 mb-4 text-[#2A2A2A]" />
            <p className="text-sm font-medium italic font-serif">No album selected.</p>
            <p className="text-xs mt-2 uppercase tracking-widest text-slate-500">Select an album from the left sidebar to view its photos or remove items.</p>
          </div>
        )}
      </div>

    </div>
  );
}
