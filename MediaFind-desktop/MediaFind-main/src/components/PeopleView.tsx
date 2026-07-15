import React, { useState, useEffect } from 'react';
import { Users, User, RefreshCw, Edit2, Link, Split, Trash, Check, UserMinus, Search, Grid, Eye, Shuffle, X } from 'lucide-react';
import { Person, Face, User as UserType } from '../types';

interface PeopleViewProps {
  currentUser: UserType;
  people: Person[];
  onRefreshData: () => void;
  onOpenPhotoDetail: (photoId: string) => void;
}

export default function PeopleView({
  currentUser,
  people,
  onRefreshData,
  onOpenPhotoDetail
}: PeopleViewProps) {
  const [activePerson, setActivePerson] = useState<any | null>(null);
  const [personFaces, setPersonFaces] = useState<any[]>([]);
  const [isLoadingFaces, setIsLoadingFaces] = useState(false);
  const [editingName, setEditingName] = useState('');
  const [isEditing, setIsEditing] = useState(false);

  // Merge states
  const [sourceMergeId, setSourceMergeId] = useState('');
  const [targetMergeId, setTargetMergeId] = useState('');

  // Split / Multi-select face states
  const [selectedFaceIds, setSelectedFaceIds] = useState<string[]>([]);

  // Search local clusters
  const [searchQuery, setSearchQuery] = useState('');

  const fetchPersonFaces = async (personId: string) => {
    setIsLoadingFaces(true);
    try {
      const response = await fetch(`/api/people/${personId}/faces`);
      if (response.ok) {
        const data = await response.json();
        setActivePerson(data.person);
        setPersonFaces(data.faces);
        setEditingName(data.person.name);
        setSelectedFaceIds([]);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setIsLoadingFaces(false);
    }
  };

  const handleRenamePerson = async () => {
    if (!activePerson || !editingName.trim()) return;
    try {
      const response = await fetch(`/api/people/${activePerson.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: editingName.trim(),
          userEmail: currentUser.email,
          userName: currentUser.name
        })
      });
      if (response.ok) {
        setIsEditing(false);
        setActivePerson(prev => prev ? { ...prev, name: editingName.trim() } : null);
        onRefreshData();
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handleMergeClusters = async () => {
    if (!sourceMergeId || !targetMergeId) {
      alert('Please specify both source and target clusters to merge.');
      return;
    }
    if (sourceMergeId === targetMergeId) {
      alert('Source and target must be different clusters.');
      return;
    }
    try {
      const response = await fetch('/api/people/merge', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sourceId: sourceMergeId,
          targetId: targetMergeId,
          userEmail: currentUser.email,
          userName: currentUser.name
        })
      });
      if (response.ok) {
        alert('Face clusters successfully merged!');
        setSourceMergeId('');
        setTargetMergeId('');
        setActivePerson(null);
        setPersonFaces([]);
        onRefreshData();
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handleSplitFaces = async () => {
    if (selectedFaceIds.length === 0) return;
    const confirmSplit = window.confirm(`Are you sure you want to split these ${selectedFaceIds.length} faces out of ${activePerson.name} into a separate cluster?`);
    if (!confirmSplit) return;

    try {
      const response = await fetch('/api/people/split', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          faceIds: selectedFaceIds,
          userEmail: currentUser.email,
          userName: currentUser.name
        })
      });
      if (response.ok) {
        alert('Faces successfully split into a new cluster!');
        setSelectedFaceIds([]);
        if (activePerson) {
          fetchPersonFaces(activePerson.id);
        }
        onRefreshData();
      }
    } catch (err) {
      console.error(err);
    }
  };

  const toggleFaceSelection = (faceId: string) => {
    setSelectedFaceIds(prev =>
      prev.includes(faceId) ? prev.filter(id => id !== faceId) : [...prev, faceId]
    );
  };

  const filteredPeople = people.filter(p => {
    const isNamed = !p.name.startsWith('Unidentified');
    if (searchQuery === 'unidentified') {
      return !isNamed;
    } else if (searchQuery === 'identified') {
      return isNamed;
    }
    return p.name.toLowerCase().includes(searchQuery.toLowerCase());
  });

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
      
      {/* List of Face Clusters */}
      <div className="bg-[#1A1A1A] border border-[#2A2A2A] rounded-2xl p-5 space-y-4 lg:col-span-1 flex flex-col max-h-[80vh] overflow-y-auto">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <Users className="h-5 w-5 text-[#C4B5FD]" />
            <h3 className="text-sm font-semibold uppercase tracking-wider text-white">Face Clusters</h3>
          </div>
          <button 
            onClick={onRefreshData}
            className="text-slate-500 hover:text-white p-1.5 rounded-full hover:bg-[#2A2A2A] transition-colors"
            title="Refresh list"
          >
            <RefreshCw className="h-4 w-4" />
          </button>
        </div>

        {/* Filter local list */}
        <div className="relative">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-500" />
          <input
            type="text"
            placeholder="Filter names..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full bg-[#0A0A0A] border border-[#333] text-slate-200 rounded-full pl-9 pr-3 py-2 text-xs uppercase tracking-wider focus:outline-none focus:border-[#C4B5FD]"
          />
        </div>

        {/* List of clusters */}
        <div className="space-y-1.5 overflow-y-auto flex-1 divide-y divide-[#2A2A2A] pr-1">
          {filteredPeople.map((person: any) => {
            const isNamed = !person.name.startsWith('Unidentified');
            const isActive = activePerson && activePerson.id === person.id;
            return (
              <div
                key={person.id}
                onClick={() => fetchPersonFaces(person.id)}
                className={`flex items-center space-x-3 p-2.5 rounded-xl cursor-pointer transition-colors ${
                  isActive 
                    ? 'bg-[#C4B5FD]/10 border border-[#C4B5FD]/20 text-[#C4B5FD]' 
                    : 'hover:bg-[#2A2A2A] text-slate-300'
                }`}
              >
                <div className="h-9 w-9 rounded-full bg-slate-950 border border-[#2A2A2A] overflow-hidden shrink-0 relative">
                  <img
                    src={person.thumbnailPath}
                    alt={person.name}
                    referrerPolicy="no-referrer"
                    className="h-full w-full object-cover"
                    onError={(e) => {
                      (e.target as HTMLImageElement).src = '/placeholder-avatar.png';
                    }}
                  />
                </div>
                <div className="min-w-0 flex-1">
                  <span className={`block text-xs font-semibold truncate ${isActive ? 'text-[#C4B5FD]' : 'text-[#F5F5F5]'}`}>
                    {person.name}
                  </span>
                  <span className="block text-[10px] text-slate-500 font-mono">
                    {person.photoCount} photo(s) • {person.faceCount} samples
                  </span>
                </div>
                <span className={`px-2 py-0.5 rounded-full text-[8px] font-bold font-mono uppercase border ${
                  isNamed ? 'bg-[#C4B5FD]/10 text-[#C4B5FD] border-[#C4B5FD]/20' : 'bg-yellow-500/10 text-yellow-500 border border-yellow-500/20'
                }`}>
                  {isNamed ? 'Named' : 'Review'}
                </span>
              </div>
            );
          })}
          {filteredPeople.length === 0 && (
            <div className="text-center py-8 text-xs text-slate-500">
              No matching face clusters found.
            </div>
          )}
        </div>

        {/* Quick Merge Panel */}
        <div className="pt-4 border-t border-[#2A2A2A] space-y-2.5">
          <div className="flex items-center space-x-1">
            <Shuffle className="h-3.5 w-3.5 text-[#C4B5FD]" />
            <span className="text-[10px] font-semibold text-slate-400 uppercase tracking-widest block">
              Merge Clusters
            </span>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <select
              value={sourceMergeId}
              onChange={(e) => setSourceMergeId(e.target.value)}
              className="bg-[#0A0A0A] border border-[#333] text-slate-300 rounded-xl p-2 text-[10px] uppercase tracking-wider focus:outline-none focus:border-[#C4B5FD] cursor-pointer"
              title="Source cluster to absorb"
            >
              <option value="">Source Cluster</option>
              {people.map(p => (
                <option key={p.id} value={p.id}>{p.name}</option>
              ))}
            </select>
            <select
              value={targetMergeId}
              onChange={(e) => setTargetMergeId(e.target.value)}
              className="bg-[#0A0A0A] border border-[#333] text-slate-300 rounded-xl p-2 text-[10px] uppercase tracking-wider focus:outline-none focus:border-[#C4B5FD] cursor-pointer"
              title="Target cluster to keep"
            >
              <option value="">Merge into Target</option>
              {people.map(p => (
                <option key={p.id} value={p.id}>{p.name}</option>
              ))}
            </select>
          </div>
          <button
            type="button"
            onClick={handleMergeClusters}
            className="w-full bg-gradient-to-r from-[#C4B5FD] to-[#FB7185] hover:opacity-90 text-slate-950 font-bold py-2 rounded-full text-[10px] uppercase tracking-wider transition-colors shadow-md"
          >
            Confirm Merge Clusters
          </button>
        </div>
      </div>

      {/* Cluster Details and Split/Edit Interface */}
      <div className="bg-[#1A1A1A] border border-[#2A2A2A] rounded-2xl p-5 lg:col-span-2 flex flex-col max-h-[80vh] overflow-y-auto">
        {activePerson ? (
          <div className="space-y-6 flex flex-col flex-1">
            
            {/* Header / Rename section */}
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 border-b border-[#2A2A2A] pb-4">
              <div className="flex items-center space-x-4">
                <div className="h-12 w-12 rounded-full bg-slate-950 border-2 border-[#2A2A2A] overflow-hidden">
                  <img
                    src={personFaces[0]?.photoFilepath || '/placeholder-avatar.png'}
                    alt={activePerson.name}
                    referrerPolicy="no-referrer"
                    className="h-full w-full object-cover"
                  />
                </div>
                <div>
                  {isEditing ? (
                    <div className="flex items-center space-x-2">
                      <input
                        type="text"
                        value={editingName}
                        onChange={(e) => setEditingName(e.target.value)}
                        className="bg-[#0A0A0A] border border-[#333] text-xs text-slate-100 rounded-xl px-3 py-1.5 focus:outline-none focus:border-[#C4B5FD] font-sans font-semibold"
                        autoFocus
                      />
                      <button
                        onClick={handleRenamePerson}
                        className="p-1.5 bg-green-900/60 border border-green-800 text-green-300 rounded-full hover:bg-green-800"
                      >
                        <Check className="h-3.5 w-3.5" />
                      </button>
                      <button
                        onClick={() => { setIsEditing(false); setEditingName(activePerson.name); }}
                        className="p-1.5 bg-[#0A0A0A] border border-[#333] text-slate-400 rounded-full hover:bg-[#222]"
                      >
                        <X className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  ) : (
                    <div className="flex items-center space-x-2">
                      <h4 className="text-base font-semibold text-[#F5F5F5] font-serif italic">{activePerson.name}</h4>
                      <button
                        onClick={() => setIsEditing(true)}
                        className="p-1.5 text-slate-400 hover:text-[#C4B5FD] rounded-full hover:bg-[#222] transition-colors"
                        title="Rename cluster"
                      >
                        <Edit2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  )}
                  <span className="block text-[10px] text-slate-500 font-mono mt-0.5 uppercase tracking-wider">
                    Internal Cluster ID: {activePerson.id} • {personFaces.length} samples
                  </span>
                </div>
              </div>

              {/* Split Actions */}
              {selectedFaceIds.length > 0 && (
                <button
                  type="button"
                  onClick={handleSplitFaces}
                  className="bg-yellow-500 hover:bg-yellow-400 text-slate-950 font-bold px-4 py-2 rounded-full text-[10px] uppercase tracking-wider flex items-center space-x-1.5 transition-all shadow-lg animate-fadeIn"
                >
                  <Split className="h-3.5 w-3.5" />
                  <span>Split {selectedFaceIds.length} sample(s)</span>
                </button>
              )}
            </div>

            {/* Instruction / Crops grid */}
            <div className="flex-1 space-y-4">
              <div className="bg-[#0A0A0A]/40 p-4 rounded-xl border border-[#2A2A2A] text-xs text-slate-400 leading-relaxed">
                To fix sorting mistakes: select face crops that do not belong to <strong>{activePerson.name}</strong>, then click <strong>"Split"</strong> to group them into a new cluster.
              </div>

              {isLoadingFaces ? (
                <div className="text-center py-12">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#C4B5FD] mx-auto" />
                </div>
              ) : (
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
                  {personFaces.map((face) => {
                    const isSelected = selectedFaceIds.includes(face.id);
                    return (
                      <div
                        key={face.id}
                        onClick={() => toggleFaceSelection(face.id)}
                        className={`border rounded-xl overflow-hidden bg-[#0A0A0A] relative group cursor-pointer transition-all ${
                          isSelected 
                            ? 'border-yellow-500 ring-2 ring-yellow-500/20' 
                            : 'border-[#2A2A2A] hover:border-[#444]'
                        }`}
                      >
                        {/* Selector indicator */}
                        <div className="absolute top-2.5 left-2.5 z-10">
                          <div className={`h-4.5 w-4.5 rounded-full border flex items-center justify-center transition-colors ${
                            isSelected 
                              ? 'bg-yellow-500 border-yellow-500 text-slate-950' 
                              : 'bg-slate-950/80 border-slate-700 text-transparent'
                          }`}>
                            <Check className="h-3 w-3 stroke-[3]" />
                          </div>
                        </div>

                        {/* View Original Photo Anchor */}
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            onOpenPhotoDetail(face.photo_id);
                          }}
                          className="absolute bottom-2.5 right-2.5 p-1.5 bg-[#0A0A0A] hover:bg-[#222] text-slate-300 hover:text-white rounded-full border border-[#333] opacity-0 group-hover:opacity-100 transition-opacity z-10"
                          title="View entire photo"
                        >
                          <Eye className="h-3.5 w-3.5" />
                        </button>

                        {/* Face Crop Image */}
                        <div className="aspect-square bg-slate-900 overflow-hidden relative">
                          <img
                            src={face.photoFilepath}
                            alt="Face Crop"
                            referrerPolicy="no-referrer"
                            className="w-full h-full object-cover"
                            style={{
                              transform: 'scale(1.2)', 
                            }}
                          />
                        </div>

                        <div className="p-3 text-[10px] text-slate-500 border-t border-[#2A2A2A] line-clamp-2 leading-normal" title={face.description}>
                          {face.description}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

          </div>
        ) : (
          <div className="text-center py-24 flex flex-col items-center justify-center text-slate-600">
            <Shuffle className="h-10 w-10 mb-4 text-[#2A2A2A]" />
            <p className="text-sm font-medium italic font-serif">No cluster selected.</p>
            <p className="text-xs mt-2 uppercase tracking-widest text-slate-500">Select a face cluster from the left panel to rename, merge, or split faces.</p>
          </div>
        )}
      </div>

    </div>
  );
}
