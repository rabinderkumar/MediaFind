import React, { useState, useEffect, useRef } from 'react';
import { X, Calendar, Camera, MapPin, Tag, RefreshCw, Trash2, ShieldAlert, Check, HelpCircle, UserCheck } from 'lucide-react';
import { Photo, Face, Person, User } from '../types';

interface PhotoDetailModalProps {
  photoId: string;
  isOpen: boolean;
  onClose: () => void;
  currentUser: User;
  people: Person[];
  onRefreshData: () => void;
}

export default function PhotoDetailModal({
  photoId,
  isOpen,
  onClose,
  currentUser,
  people,
  onRefreshData
}: PhotoDetailModalProps) {
  const [photo, setPhoto] = useState<Photo | null>(null);
  const [faces, setFaces] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isUpdating, setIsUpdating] = useState(false);
  const [activeFaceId, setActiveFaceId] = useState<string | null>(null);
  const [taggingPersonId, setTaggingPersonId] = useState('');
  const [newPersonName, setNewPersonName] = useState('');
  
  const containerRef = useRef<HTMLDivElement>(null);

  const fetchDetail = async () => {
    setIsLoading(true);
    try {
      const response = await fetch(`/api/photos/${photoId}`);
      if (response.ok) {
        const data = await response.json();
        setPhoto(data.photo);
        setFaces(data.faces);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (photoId && isOpen) {
      fetchDetail();
    }
  }, [photoId, isOpen]);

  if (!isOpen || !photo) return null;

  // Re-index Photo
  const handleReindex = async () => {
    setIsUpdating(true);
    try {
      const response = await fetch(`/api/photos/${photo.id}/reindex`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userEmail: currentUser.email, userName: currentUser.name })
      });
      if (response.ok) {
        await fetchDetail();
        onRefreshData();
      }
    } catch (err) {
      console.error(err);
    } finally {
      setIsUpdating(false);
    }
  };

  // Delete Photo
  const handleDelete = async () => {
    if (currentUser.role !== 'Admin') {
      alert('Viewer role is read-only. Admin required to delete files.');
      return;
    }
    const confirm = window.confirm('Are you sure you want to delete this photo from the media library? This deletes original files.');
    if (!confirm) return;

    setIsUpdating(true);
    try {
      const response = await fetch(`/api/photos/${photo.id}`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: currentUser.email, role: currentUser.role, name: currentUser.name })
      });
      if (response.ok) {
        onClose();
        onRefreshData();
      }
    } catch (err) {
      console.error(err);
    } finally {
      setIsUpdating(false);
    }
  };

  // Assign Name to Face
  const handleAssignName = async (faceId: string) => {
    let personId = taggingPersonId;
    
    setIsUpdating(true);
    try {
      if (!personId && newPersonName.trim()) {
        // Create new person cluster
        const res = await fetch('/api/albums', { // reuse same system, actually we have a direct name update endpoint or a merge
          // Let's create the person record by directly renaming the existing Unidentified person cluster,
          // or we can assign the face to a newly named person
        });
        
        // Let's do it clean: call renaming endpoint for the active face's person cluster!
        const targetFace = faces.find(f => f.id === faceId);
        if (targetFace && targetFace.person_id) {
          const renameRes = await fetch(`/api/people/${targetFace.person_id}`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              name: newPersonName.trim(),
              userEmail: currentUser.email,
              userName: currentUser.name
            })
          });
          if (renameRes.ok) {
            setNewPersonName('');
            setActiveFaceId(null);
            await fetchDetail();
            onRefreshData();
            return;
          }
        }
      }

      if (personId) {
        // Link face to existing person cluster
        const res = await fetch('/api/faces/bulk-tag', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            faceIds: [faceId],
            personId,
            userEmail: currentUser.email,
            userName: currentUser.name
          })
        });
        if (res.ok) {
          setTaggingPersonId('');
          setActiveFaceId(null);
          await fetchDetail();
          onRefreshData();
        }
      }
    } catch (err) {
      console.error(err);
    } finally {
      setIsUpdating(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-slate-950/85 backdrop-blur-md flex items-center justify-center z-50 p-4">
      <div className="bg-[#1A1A1A] border border-[#2A2A2A] rounded-2xl shadow-2xl w-full max-w-5xl overflow-hidden flex flex-col md:flex-row h-[90vh]">
        
        {/* Main interactive vision board */}
        <div className="flex-1 bg-slate-950 flex items-center justify-center relative p-4 group">
          
          {isLoading ? (
            <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-[#C4B5FD]" />
          ) : (
            <div ref={containerRef} className="relative max-w-full max-h-full aspect-[4/3] shadow-2xl">
              <img
                src={photo.filepath}
                alt={photo.caption}
                referrerPolicy="no-referrer"
                className="w-full h-full object-contain rounded-lg"
              />

              {/* Bounding Box Overlays */}
              {faces.map((f) => {
                const box = f.bounding_box;
                // Coordinates are normalized 0-1000
                const top = `${box.ymin / 10}%`;
                const left = `${box.xmin / 10}%`;
                const width = `${(box.xmax - box.xmin) / 10}%`;
                const height = `${(box.ymax - box.ymin) / 10}%`;

                const isNamed = f.personName && !f.personName.startsWith('Unidentified');
                const isActive = activeFaceId === f.id;

                return (
                  <div
                    key={f.id}
                    style={{ top, left, width, height }}
                    onClick={(e) => {
                      e.stopPropagation();
                      setActiveFaceId(isActive ? null : f.id);
                      setTaggingPersonId(f.person_id || '');
                    }}
                    className={`absolute border-2 cursor-pointer transition-all rounded-lg ${
                      isActive
                        ? 'border-[#C4B5FD] bg-[#C4B5FD]/10 ring-4 ring-[#C4B5FD]/20 z-20'
                        : isNamed 
                          ? 'border-[#C4B5FD]/80 hover:border-[#C4B5FD] bg-[#C4B5FD]/5' 
                          : 'border-yellow-500 hover:border-yellow-400 bg-yellow-500/5'
                    }`}
                  >
                    {/* Tiny hover name badge */}
                    <div className={`absolute -top-6 left-0 px-2 py-0.5 rounded-full text-[9px] font-bold uppercase tracking-wider whitespace-nowrap shadow-md text-slate-950 ${
                      isActive 
                        ? 'bg-[#C4B5FD]' 
                        : isNamed 
                          ? 'bg-[#C4B5FD]/90' 
                          : 'bg-yellow-500'
                    }`}>
                      {f.personName}
                    </div>

                    {/* Tagging Dropdown on Coordinate Box */}
                    {isActive && (
                      <div 
                        onClick={(e) => e.stopPropagation()}
                        className="absolute top-full mt-2 left-1/2 -translate-x-1/2 bg-[#0A0A0A] border border-[#333] rounded-2xl p-4 shadow-2xl w-56 text-xs text-slate-200 z-30 space-y-3"
                      >
                        <p className="font-bold text-white font-serif italic">Identify Face</p>
                        <p className="text-[10px] text-slate-500 line-clamp-2 leading-normal">{f.description}</p>
                        
                        <div className="space-y-2">
                          <select
                            value={taggingPersonId}
                            onChange={(e) => {
                              setTaggingPersonId(e.target.value);
                              setNewPersonName('');
                            }}
                            className="w-full bg-[#0A0A0A] border border-[#333] text-slate-300 rounded-full px-3 py-1.5 text-[10px] uppercase tracking-wider focus:outline-none focus:border-[#C4B5FD]"
                          >
                            <option value="">Rename Cluster</option>
                            {people.filter(p => !p.name.startsWith('Unidentified')).map(p => (
                              <option key={p.id} value={p.id}>{p.name}</option>
                            ))}
                          </select>

                          <input
                            type="text"
                            placeholder="Type Name..."
                            value={newPersonName}
                            onChange={(e) => {
                              setNewPersonName(e.target.value);
                              setTaggingPersonId('');
                            }}
                            className="w-full bg-[#0A0A0A] border border-[#333] text-slate-200 rounded-full px-3 py-1.5 text-xs focus:outline-none focus:border-[#C4B5FD]"
                          />

                          <button
                            type="button"
                            onClick={() => handleAssignName(f.id)}
                            className="w-full bg-gradient-to-r from-[#C4B5FD] to-[#FB7185] text-slate-950 font-bold py-2 rounded-full text-[10px] uppercase tracking-wider shadow-md"
                          >
                            Save Tag
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}

          {/* Top Info Bar */}
          <div className="absolute top-4 left-4 bg-[#0A0A0A]/85 backdrop-blur-sm px-4 py-2 rounded-full border border-[#333] text-[9px] text-slate-400 font-mono uppercase tracking-widest">
            Click boxes to tag press subjects
          </div>

          {/* Close button for entire modal */}
          <button
            onClick={onClose}
            className="absolute top-4 right-4 bg-[#0A0A0A] hover:bg-[#222] p-2 rounded-full border border-[#333] text-slate-400 hover:text-white transition-all shadow-md"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Info Sidebar panel */}
        <div className="w-full md:w-85 bg-[#1A1A1A] border-t md:border-t-0 md:border-l border-[#2A2A2A] p-6 overflow-y-auto space-y-6 flex flex-col justify-between">
          <div className="space-y-6">
            
            {/* Title / Album list */}
            <div>
              <span className="text-[10px] font-mono font-bold tracking-widest uppercase text-[#C4B5FD] bg-[#C4B5FD]/10 border border-[#C4B5FD]/20 px-3 py-1 rounded-full">
                MEDIA ANALYSIS
              </span>
              <h2 className="text-base font-bold text-white mt-4 font-serif italic leading-snug">
                {photo.original_name}
              </h2>
              <span className="block text-[10px] text-slate-500 font-mono mt-1 uppercase tracking-wider">
                ID: {photo.id} • {Math.round(photo.size_bytes / 1024)} KB
              </span>
            </div>

            {/* AI Auto-Generated Caption */}
            <div className="space-y-2 bg-[#0A0A0A]/40 p-4 rounded-2xl border border-[#2A2A2A]">
              <span className="text-[9px] font-bold text-slate-500 uppercase tracking-widest block">
                AI Semantic Description
              </span>
              <p className="text-xs text-slate-300 leading-relaxed">
                {photo.caption}
              </p>
            </div>

            {/* Identified People in Photo */}
            <div className="space-y-2.5">
              <span className="text-[9px] font-bold text-slate-500 uppercase tracking-widest block">
                Identified Subjects ({faces.length})
              </span>
              <div className="space-y-2">
                {faces.map((f) => {
                  const isNamed = f.personName && !f.personName.startsWith('Unidentified');
                  return (
                    <div 
                      key={f.id} 
                      onClick={() => {
                        setActiveFaceId(f.id);
                        setTaggingPersonId(f.person_id || '');
                      }}
                      className={`flex items-center justify-between p-2.5 rounded-xl border text-xs cursor-pointer transition-colors ${
                        activeFaceId === f.id
                          ? 'bg-[#C4B5FD]/10 border-[#C4B5FD]/30 text-[#C4B5FD]'
                          : isNamed
                            ? 'bg-[#0A0A0A]/40 border-[#2A2A2A] text-slate-300 hover:border-[#444]'
                            : 'bg-[#0A0A0A]/40 border-[#2A2A2A] text-slate-400 hover:border-[#444]'
                      }`}
                    >
                      <div className="min-w-0 flex-1 pr-2">
                        <span className="block font-semibold truncate text-[#F5F5F5]">{f.personName}</span>
                        <span className="block text-[10px] text-slate-500 truncate leading-normal">{f.description}</span>
                      </div>
                      <span className={`px-2 py-0.5 rounded-full text-[8px] font-bold font-mono uppercase border shrink-0 ${
                        isNamed ? 'bg-[#C4B5FD]/10 text-[#C4B5FD] border-[#C4B5FD]/20' : 'bg-yellow-500/10 text-yellow-500 border border-yellow-500/20'
                      }`}>
                        {isNamed ? 'Named' : 'Cluster'}
                      </span>
                    </div>
                  );
                })}
                {faces.length === 0 && (
                  <p className="text-xs text-slate-500 italic font-serif">No human faces detected in this image.</p>
                )}
              </div>
            </div>

            {/* EXIF Metadata */}
            <div className="space-y-3 pt-4 border-t border-[#2A2A2A]">
              <span className="text-[9px] font-bold text-slate-500 uppercase tracking-widest block">
                Physical Metadata
              </span>
              <div className="grid grid-cols-2 gap-4 text-xs font-mono">
                <div className="space-y-0.5">
                  <span className="text-[9px] text-slate-500 block uppercase tracking-wider">Taken On</span>
                  <div className="flex items-center space-x-1.5 text-slate-300">
                    <Calendar className="h-3.5 w-3.5 text-slate-500" />
                    <span className="truncate">{new Date(photo.exif_date_taken).toLocaleDateString()}</span>
                  </div>
                </div>

                <div className="space-y-0.5">
                  <span className="text-[9px] text-slate-500 block uppercase tracking-wider">Camera Gear</span>
                  <div className="flex items-center space-x-1.5 text-slate-300" title={photo.camera || 'Unknown'}>
                    <Camera className="h-3.5 w-3.5 text-slate-500" />
                    <span className="truncate">{photo.camera || 'Unknown'}</span>
                  </div>
                </div>

                <div className="space-y-0.5 col-span-2">
                  <span className="text-[9px] text-slate-500 block uppercase tracking-wider">GPS Coordinates</span>
                  <div className="flex items-center space-x-1.5 text-slate-300">
                    <MapPin className="h-3.5 w-3.5 text-slate-500" />
                    <span>
                      {photo.gps_lat !== null && photo.gps_lng !== null
                        ? `${photo.gps_lat.toFixed(4)}, ${photo.gps_lng.toFixed(4)}`
                        : 'No GPS data attached'}
                    </span>
                  </div>
                </div>
              </div>
            </div>

          </div>

          {/* Actions panel */}
          <div className="space-y-2 pt-4 border-t border-[#2A2A2A]">
            <button
              onClick={handleReindex}
              disabled={isUpdating}
              className="w-full bg-[#0A0A0A] hover:bg-[#222] border border-[#333] text-slate-300 font-bold py-2.5 rounded-full text-xs uppercase tracking-wider flex items-center justify-center space-x-1.5 transition-colors disabled:opacity-35"
            >
              <RefreshCw className={`h-3.5 w-3.5 ${isUpdating ? 'animate-spin' : ''}`} />
              <span>Force Re-index AI Tags</span>
            </button>

            {currentUser.role === 'Admin' ? (
              <button
                onClick={handleDelete}
                disabled={isUpdating}
                className="w-full bg-red-950/20 hover:bg-red-900 border border-red-900/30 text-[#FB7185] hover:text-white font-bold py-2.5 rounded-full text-xs uppercase tracking-wider flex items-center justify-center space-x-1.5 transition-colors disabled:opacity-35 shadow-md"
              >
                <Trash2 className="h-3.5 w-3.5" />
                <span>Delete Photo</span>
              </button>
            ) : (
              <div className="flex items-center justify-center space-x-1.5 text-[9px] text-[#FB7185]/80 font-bold uppercase tracking-wider bg-[#0A0A0A] p-2.5 rounded-xl border border-[#2A2A2A]">
                <ShieldAlert className="h-3.5 w-3.5" />
                <span>Deletion Restricted</span>
              </div>
            )}
          </div>

        </div>

      </div>
    </div>
  );
}
