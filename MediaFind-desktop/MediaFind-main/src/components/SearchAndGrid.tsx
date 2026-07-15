import React, { useState, useEffect } from 'react';
import { Search, Filter, Calendar, Camera, MapPin, Tag, Grid, LayoutList, Download, Trash2, FolderPlus, HelpCircle, Check, X, FileJson, Bookmark, Users } from 'lucide-react';
import { Photo, Person, Album, SearchFilters, User } from '../types';

interface SearchAndGridProps {
  currentUser: User;
  people: Person[];
  albums: Album[];
  onOpenPhotoDetail: (photoId: string) => void;
  onRefreshStats: () => void;
  triggerSearchRef: React.MutableRefObject<() => void>;
}

export default function SearchAndGrid({
  currentUser,
  people,
  albums,
  onOpenPhotoDetail,
  onRefreshStats,
  triggerSearchRef
}: SearchAndGridProps) {
  const [query, setQuery] = useState('');
  const [photos, setPhotos] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [showFilters, setShowFilters] = useState(false);

  // Filters state
  const [filters, setFilters] = useState<SearchFilters>({
    dateStart: '',
    dateEnd: '',
    personIds: [],
    orientation: 'all',
    albumId: ''
  });

  // Selection states
  const [selectedPhotoIds, setSelectedPhotoIds] = useState<string[]>([]);
  const [showBulkAlbumModal, setShowBulkAlbumModal] = useState(false);
  const [newAlbumName, setNewAlbumName] = useState('');
  const [bulkTargetAlbumId, setBulkTargetAlbumId] = useState('');

  // Fetch photos from Search API
  const performSearch = async () => {
    setIsLoading(true);
    try {
      const response = await fetch('/api/photos/search', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          query,
          filters,
          userEmail: currentUser.email,
          userName: currentUser.name
        })
      });
      if (response.ok) {
        const data = await response.json();
        setPhotos(data);
      }
    } catch (err) {
      console.error('Search error:', err);
    } finally {
      setIsLoading(false);
    }
  };

  // Expose search trigger to parent components
  useEffect(() => {
    triggerSearchRef.current = performSearch;
    performSearch();
  }, [filters]);

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    performSearch();
  };

  const togglePhotoSelection = (photoId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setSelectedPhotoIds(prev =>
      prev.includes(photoId) ? prev.filter(id => id !== photoId) : [...prev, photoId]
    );
  };

  const selectAllVisible = () => {
    if (selectedPhotoIds.length === photos.length) {
      setSelectedPhotoIds([]);
    } else {
      setSelectedPhotoIds(photos.map(p => p.id));
    }
  };

  // Bulk Actions
  const handleBulkDelete = async () => {
    if (currentUser.role !== 'Admin') {
      alert('Viewer accounts are restricted to view-only. Admin role required.');
      return;
    }
    const confirmDelete = window.confirm(`Are you sure you want to delete ${selectedPhotoIds.length} photos? This cannot be undone.`);
    if (!confirmDelete) return;

    setIsLoading(true);
    try {
      for (const id of selectedPhotoIds) {
        await fetch(`/api/photos/${id}`, {
          method: 'DELETE',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email: currentUser.email, role: currentUser.role, name: currentUser.name })
        });
      }
      setSelectedPhotoIds([]);
      onRefreshStats();
      performSearch();
    } catch (err) {
      console.error('Delete error:', err);
    } finally {
      setIsLoading(false);
    }
  };

  const handleBulkAddToAlbum = async () => {
    let albumId = bulkTargetAlbumId;
    if (!albumId && newAlbumName) {
      // Create new album first
      try {
        const res = await fetch('/api/albums', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ name: newAlbumName, userEmail: currentUser.email, userName: currentUser.name })
        });
        if (res.ok) {
          const newAlb = await res.json();
          albumId = newAlb.id;
        }
      } catch (err) {
        console.error('Failed to create album', err);
        return;
      }
    }

    if (!albumId) {
      alert('Please select or create an album.');
      return;
    }

    try {
      const res = await fetch(`/api/albums/${albumId}/photos`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          photoIds: selectedPhotoIds,
          userEmail: currentUser.email,
          userName: currentUser.name
        })
      });
      if (res.ok) {
        alert('Photos added to album successfully.');
        setSelectedPhotoIds([]);
        setShowBulkAlbumModal(false);
        setNewAlbumName('');
        setBulkTargetAlbumId('');
        onRefreshStats();
        performSearch();
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handleExportMetadata = () => {
    const selectedPhotos = photos.filter(p => selectedPhotoIds.includes(p.id));
    const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(selectedPhotos, null, 2));
    const downloadAnchor = document.createElement('a');
    downloadAnchor.setAttribute("href", dataStr);
    downloadAnchor.setAttribute("download", `mediafind-metadata-export-${new Date().toISOString().slice(0,10)}.json`);
    document.body.appendChild(downloadAnchor);
    downloadAnchor.click();
    downloadAnchor.remove();
  };

  const resetFilters = () => {
    setFilters({
      dateStart: '',
      dateEnd: '',
      personIds: [],
      orientation: 'all',
      albumId: ''
    });
    setQuery('');
  };

  const handlePersonFilterToggle = (personId: string) => {
    setFilters(prev => {
      const isSelected = prev.personIds?.includes(personId);
      const updated = isSelected 
        ? prev.personIds?.filter(id => id !== personId) 
        : [...(prev.personIds || []), personId];
      return { ...prev, personIds: updated };
    });
  };

  return (
    <div className="space-y-6">
      
      {/* Search Input Box */}
      <div className="bg-[#1A1A1A] border border-[#2A2A2A] rounded-2xl p-5 shadow-lg">
        <form onSubmit={handleSearchSubmit} className="flex flex-col md:flex-row gap-3">
          <div className="relative flex-1">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-5 w-5 text-slate-400" />
            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search press library (e.g. 'Sarah Ahmed at the press conference' or 'red banner outdoor')..."
              className="w-full bg-[#0A0A0A] border border-[#333] text-slate-100 rounded-full pl-11 pr-4 py-3 text-xs uppercase tracking-wider focus:outline-none focus:border-[#C4B5FD] transition-colors"
            />
          </div>

          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => setShowFilters(!showFilters)}
              className={`px-5 py-3 rounded-full text-xs font-semibold uppercase tracking-wider border transition-all flex items-center space-x-1.5 ${
                showFilters || filters.personIds?.length || filters.dateStart || filters.dateEnd || filters.albumId || filters.orientation !== 'all'
                  ? 'bg-[#C4B5FD]/10 border-[#C4B5FD]/40 text-[#C4B5FD]'
                  : 'bg-[#0A0A0A] border-[#333] hover:bg-[#222] text-slate-300'
              }`}
            >
              <Filter className="h-4 w-4" />
              <span>Filters</span>
              {(filters.personIds?.length || 0) + (filters.albumId ? 1 : 0) + (filters.dateStart ? 1 : 0) + (filters.orientation !== 'all' ? 1 : 0) > 0 && (
                <span className="bg-gradient-to-tr from-[#C4B5FD] to-[#FB7185] text-slate-950 rounded-full w-5 h-5 flex items-center justify-center text-[10px] font-bold">
                  {(filters.personIds?.length || 0) + (filters.albumId ? 1 : 0) + (filters.dateStart ? 1 : 0) + (filters.orientation !== 'all' ? 1 : 0)}
                </span>
              )}
            </button>

            <button
              type="submit"
              disabled={isLoading}
              className="bg-gradient-to-r from-[#C4B5FD] to-[#FB7185] hover:opacity-90 disabled:bg-[#121212] disabled:opacity-50 text-slate-950 px-6 py-3 rounded-full text-xs font-bold uppercase tracking-wider shadow-md transition-all shrink-0 flex items-center space-x-1"
            >
              {isLoading ? 'Searching...' : 'Search'}
            </button>
          </div>
        </form>

        {/* Suggestion tags */}
        <div className="flex flex-wrap items-center gap-1.5 mt-4 text-xs text-slate-400">
          <HelpCircle className="h-3.5 w-3.5 text-slate-500" />
          <span>Try:</span>
          {['the press conference', 'outdoor night event', 'group on stage', 'Sarah Ahmed'].map((tag) => (
            <button
              key={tag}
              type="button"
              onClick={() => { setQuery(tag); setTimeout(performSearch, 50); }}
              className="bg-[#0A0A0A] border border-[#333] hover:bg-[#222] text-slate-300 px-3 py-1 rounded-full transition-colors text-[10px] uppercase tracking-wider"
            >
              "{tag}"
            </button>
          ))}
        </div>
      </div>

      {/* Advanced Filters Panel */}
      {showFilters && (
        <div className="bg-[#1A1A1A] border border-[#2A2A2A] rounded-2xl p-6 shadow-lg grid grid-cols-1 md:grid-cols-4 gap-6 animate-fadeIn">
          
          {/* Date range filter */}
          <div className="space-y-2">
            <label className="text-[10px] font-semibold text-slate-400 uppercase tracking-widest block">
              Exif Date Taken
            </label>
            <div className="space-y-1.5">
              <input
                type="date"
                value={filters.dateStart || ''}
                onChange={(e) => setFilters(prev => ({ ...prev, dateStart: e.target.value }))}
                className="w-full bg-[#0A0A0A] border border-[#333] text-slate-200 rounded-xl p-2.5 text-xs focus:outline-none focus:border-[#C4B5FD]"
              />
              <span className="text-[10px] text-slate-500 text-center block uppercase tracking-widest">to</span>
              <input
                type="date"
                value={filters.dateEnd || ''}
                onChange={(e) => setFilters(prev => ({ ...prev, dateEnd: e.target.value }))}
                className="w-full bg-[#0A0A0A] border border-[#333] text-slate-200 rounded-xl p-2.5 text-xs focus:outline-none focus:border-[#C4B5FD]"
              />
            </div>
          </div>

          {/* People multi-select filter */}
          <div className="space-y-2 md:col-span-2">
            <label className="text-[10px] font-semibold text-slate-400 uppercase tracking-widest block">
              Filter by Identified People
            </label>
            <div className="border border-[#333] bg-[#0A0A0A]/60 rounded-2xl p-3 max-h-32 overflow-y-auto flex flex-wrap gap-1.5">
              {people.filter(p => !p.name.startsWith('Unidentified')).map((p) => {
                const isSelected = filters.personIds?.includes(p.id);
                return (
                  <button
                    key={p.id}
                    type="button"
                    onClick={() => handlePersonFilterToggle(p.id)}
                    className={`inline-flex items-center px-3 py-1.5 rounded-full text-[10px] font-semibold uppercase tracking-wider transition-all border ${
                      isSelected 
                        ? 'bg-[#C4B5FD]/20 border-[#C4B5FD]/40 text-[#C4B5FD]' 
                        : 'bg-[#0A0A0A] border-[#333] text-slate-400 hover:text-slate-200'
                    }`}
                  >
                    <Users className="h-3 w-3 mr-1.5 text-slate-500" />
                    <span>{p.name}</span>
                    {isSelected && <Check className="h-3 w-3 ml-1.5 text-[#C4B5FD]" />}
                  </button>
                );
              })}
              {people.filter(p => !p.name.startsWith('Unidentified')).length === 0 && (
                <div className="text-slate-500 text-xs text-center w-full py-4">
                  No named people registered yet. Type a name in identified clusters first!
                </div>
              )}
            </div>
          </div>

          {/* Album & Orientation filters */}
          <div className="space-y-3">
            <div>
              <label className="text-[10px] font-semibold text-slate-400 uppercase tracking-widest block mb-1">
                Inside Album
              </label>
              <select
                value={filters.albumId || ''}
                onChange={(e) => setFilters(prev => ({ ...prev, albumId: e.target.value }))}
                className="w-full bg-[#0A0A0A] border border-[#333] text-slate-200 rounded-xl p-2.5 text-xs focus:outline-none focus:border-[#C4B5FD] cursor-pointer"
              >
                <option value="">-- All Media --</option>
                {albums.map(a => (
                  <option key={a.id} value={a.id}>{a.name}</option>
                ))}
              </select>
            </div>

            <div className="flex justify-between items-center pt-2 border-t border-[#2A2A2A]">
              <button
                type="button"
                onClick={resetFilters}
                className="text-xs text-red-400 hover:text-red-300 font-semibold uppercase tracking-wider"
              >
                Clear Filters
              </button>
            </div>
          </div>

        </div>
      )}

      {/* Bulk Operations Sticky Floating Bar */}
      {selectedPhotoIds.length > 0 && (
        <div className="bg-[#1A1A1A] border border-[#2A2A2A] text-white rounded-2xl px-6 py-4 shadow-xl flex flex-col md:flex-row items-center justify-between gap-4 animate-slideUp">
          <div className="flex items-center space-x-3 text-xs uppercase tracking-wider font-bold text-slate-300">
            <input
              type="checkbox"
              checked={selectedPhotoIds.length === photos.length}
              onChange={selectAllVisible}
              className="h-4 w-4 bg-[#0A0A0A] border-[#333] rounded text-[#C4B5FD] focus:ring-0 cursor-pointer"
            />
            <span>{selectedPhotoIds.length} photo(s) selected</span>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={handleExportMetadata}
              className="inline-flex items-center space-x-1.5 bg-[#0A0A0A] hover:bg-[#222] border border-[#333] px-4 py-2 rounded-full text-[10px] uppercase tracking-wider font-bold transition-colors"
              title="Export semantic descriptions & faces metadata"
            >
              <FileJson className="h-3.5 w-3.5 text-[#C4B5FD]" />
              <span>Export Metadata</span>
            </button>

            <button
              onClick={() => setShowBulkAlbumModal(true)}
              className="inline-flex items-center space-x-1.5 bg-[#0A0A0A] hover:bg-[#222] border border-[#333] px-4 py-2 rounded-full text-[10px] uppercase tracking-wider font-bold transition-colors"
            >
              <FolderPlus className="h-3.5 w-3.5 text-[#FB7185]" />
              <span>Add to Album</span>
            </button>

            {currentUser.role === 'Admin' && (
              <button
                onClick={handleBulkDelete}
                className="inline-flex items-center space-x-1.5 bg-red-950/40 hover:bg-red-900/40 border border-red-900/60 text-red-300 px-4 py-2 rounded-full text-[10px] uppercase tracking-wider font-bold transition-colors"
              >
                <Trash2 className="h-3.5 w-3.5" />
                <span>Delete Media</span>
              </button>
            )}

            <button
              onClick={() => setSelectedPhotoIds([])}
              className="p-1.5 text-slate-500 hover:text-white rounded-full hover:bg-[#222]"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>
      )}

      {/* Grid of Results */}
      {isLoading ? (
        <div className="text-center py-24">
          <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-[#C4B5FD] mx-auto mb-4" />
          <p className="text-slate-400 text-sm italic font-serif">Querying vector database index and sorting results...</p>
        </div>
      ) : (
        <div className="space-y-4">
          <div className="flex items-center justify-between text-xs text-slate-500 px-1 uppercase tracking-wider font-medium">
            <span>
              Showing {photos.length} photos matched {query ? `for "${query}"` : ''}
            </span>
            <button
              onClick={selectAllVisible}
              className="text-[#C4B5FD] hover:text-[#B4A0FC] font-semibold"
            >
              {selectedPhotoIds.length === photos.length && photos.length > 0 ? 'Deselect All' : 'Select All On Screen'}
            </button>
          </div>

          {photos.length === 0 ? (
            <div className="text-center py-24 bg-[#1A1A1A]/30 border border-[#2A2A2A] rounded-2xl">
              <p className="text-slate-400 text-sm font-medium italic font-serif">No photos found matching your query or active filters.</p>
              <p className="text-xs text-slate-500 mt-2 uppercase tracking-wider">Try resetting the filters or importing new photos to the press library.</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
              {photos.map((p) => {
                const isSelected = selectedPhotoIds.includes(p.id);
                return (
                  <div
                    key={p.id}
                    onClick={() => onOpenPhotoDetail(p.id)}
                    className={`bg-[#1A1A1A] border rounded-2xl overflow-hidden shadow-lg group cursor-pointer hover:shadow-2xl transition-all duration-300 relative ${
                      isSelected 
                        ? 'border-[#C4B5FD] ring-2 ring-[#C4B5FD]/20' 
                        : 'border-[#2A2A2A] hover:border-[#444]'
                    }`}
                  >
                    {/* Checkbox Overlay */}
                    <div className="absolute top-3 left-3 z-10 opacity-0 group-hover:opacity-100 transition-opacity">
                      <button
                        onClick={(e) => togglePhotoSelection(p.id, e)}
                        className={`p-1.5 rounded-full border shadow-md transition-all ${
                          isSelected ? 'bg-[#C4B5FD] border-[#C4B5FD] text-slate-950' : 'bg-slate-950/80 border-[#333] text-transparent hover:text-slate-400'
                        }`}
                      >
                        <Check className="h-3 w-3 stroke-[3]" />
                      </button>
                    </div>

                    {/* Image Area */}
                    <div className="aspect-[4/3] bg-slate-950 relative overflow-hidden">
                      <img
                        src={p.filepath}
                        alt={p.caption}
                        referrerPolicy="no-referrer"
                        className="w-full h-full object-cover group-hover:scale-102 transition-transform duration-500"
                        loading="lazy"
                      />
                      
                      {/* Match confidence overlay */}
                      {p.matchScore && p.matchScore !== 1.0 && (
                        <div className="absolute top-3 right-3 bg-slate-950/85 backdrop-blur-sm px-2.5 py-1 rounded-full text-[9px] font-mono font-bold text-[#C4B5FD] border border-[#C4B5FD]/20 tracking-wider">
                          {Math.round(p.matchScore * 100)}% Match
                        </div>
                      )}
                    </div>

                    {/* Metadata Details Area */}
                    <div className="p-4 space-y-3">
                      <p className="text-xs text-slate-300 font-medium line-clamp-2 leading-relaxed" title={p.caption}>
                        {p.caption}
                      </p>

                      <div className="flex flex-wrap gap-1">
                        {p.peopleNames && p.peopleNames.map((name: string, i: number) => (
                          <span 
                            key={i} 
                            className={`inline-flex items-center px-2 py-0.5 rounded-full text-[9px] font-bold uppercase tracking-wider border ${
                              name.startsWith('Unidentified')
                                ? 'bg-[#0A0A0A] text-slate-500 border-[#2A2A2A]'
                                : 'bg-[#C4B5FD]/10 text-[#C4B5FD] border-[#C4B5FD]/20'
                            }`}
                          >
                            {name}
                          </span>
                        ))}
                      </div>

                      <div className="flex items-center justify-between text-[9px] text-slate-500 border-t border-[#2A2A2A]/60 pt-2.5 font-mono uppercase tracking-wider">
                        <div className="flex items-center space-x-1">
                          <Calendar className="h-3 w-3 text-slate-600" />
                          <span>{new Date(p.exif_date_taken).toLocaleDateString()}</span>
                        </div>
                        {p.gps_lat && (
                          <div className="flex items-center space-x-1 text-[#FB7185]">
                            <MapPin className="h-3 w-3" />
                            <span>GPS</span>
                          </div>
                        )}
                        <span className="truncate max-w-[80px] text-right" title={p.camera}>
                          {p.camera?.split(' ')[0] || 'Camera'}
                        </span>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* Bulk Add To Album Modal Dialog */}
      {showBulkAlbumModal && (
        <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-[#1A1A1A] border border-[#2A2A2A] rounded-2xl shadow-2xl p-6 w-full max-w-md animate-fadeIn">
            <h3 className="text-sm font-bold uppercase tracking-wider text-[#F5F5F5] mb-4">Add {selectedPhotoIds.length} Selected Photos to Album</h3>
            
            <div className="space-y-4">
              <div>
                <label className="text-[10px] font-bold uppercase tracking-widest text-slate-400 block mb-1.5">Select Existing Album</label>
                <select
                  value={bulkTargetAlbumId}
                  onChange={(e) => {
                    setBulkTargetAlbumId(e.target.value);
                    setNewAlbumName('');
                  }}
                  className="w-full bg-[#0A0A0A] border border-[#333] text-slate-200 rounded-xl p-3 text-xs focus:outline-none focus:border-[#C4B5FD] cursor-pointer"
                >
                  <option value="">-- Or Create New Album Below --</option>
                  {albums.map(a => (
                    <option key={a.id} value={a.id}>{a.name}</option>
                  ))}
                </select>
              </div>

              <div className="text-center text-[9px] text-slate-500 font-bold uppercase tracking-widest">— OR —</div>

              <div>
                <label className="text-[10px] font-bold uppercase tracking-widest text-slate-400 block mb-1.5">Create Brand New Album</label>
                <input
                  type="text"
                  placeholder="Type new album name (e.g. Press Conference July)"
                  value={newAlbumName}
                  onChange={(e) => {
                    setNewAlbumName(e.target.value);
                    setBulkTargetAlbumId('');
                  }}
                  className="w-full bg-[#0A0A0A] border border-[#333] text-slate-200 rounded-xl p-3 text-xs focus:outline-none focus:border-[#C4B5FD]"
                />
              </div>

              <div className="flex justify-end space-x-3 pt-4 border-t border-[#2A2A2A]">
                <button
                  type="button"
                  onClick={() => setShowBulkAlbumModal(false)}
                  className="px-4 py-2 border border-[#333] hover:bg-[#222] rounded-full text-slate-300 text-[10px] font-bold uppercase tracking-wider transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleBulkAddToAlbum}
                  className="bg-gradient-to-r from-[#C4B5FD] to-[#FB7185] text-slate-950 font-bold px-5 py-2 rounded-full text-[10px] uppercase tracking-wider transition-colors shadow-lg"
                >
                  Confirm Addition
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
