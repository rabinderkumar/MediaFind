import React, { useState, useRef } from 'react';
import { Upload, X, CheckCircle, AlertCircle, Loader2, FileImage, Layers } from 'lucide-react';
import { User } from '../types';

interface UploadModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentUser: User;
  onUploadSuccess: () => void;
}

interface QueuedFile {
  file: File;
  name: string;
  size: number;
  type: string;
  status: 'queued' | 'processing' | 'completed' | 'error';
  progressText?: string;
  error?: string;
}

export default function UploadModal({ isOpen, onClose, currentUser, onUploadSuccess }: UploadModalProps) {
  const [filesQueue, setFilesQueue] = useState<QueuedFile[]>([]);
  const [isUploading, setIsUploading] = useState(false);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isDragOver, setIsDragOver] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const folderInputRef = useRef<HTMLInputElement>(null);

  if (!isOpen) return null;

  // Read files and convert to Base64 helper
  const fileToBase64 = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.readAsDataURL(file);
      reader.onload = () => resolve(reader.result as string);
      reader.onerror = (error) => reject(error);
    });
  };

  const addFilesToQueue = (fileList: FileList | null) => {
    if (!fileList) return;
    const array = Array.from(fileList);
    // Filter out non-images
    const validImages = array.filter(f => f.type.startsWith('image/'));
    
    if (validImages.length === 0) {
      alert('Please select valid image files (JPEG, PNG, HEIC etc.)');
      return;
    }

    const newQueued: QueuedFile[] = validImages.map(file => ({
      file,
      name: file.name,
      size: file.size,
      type: file.type,
      status: 'queued'
    }));

    setFilesQueue(prev => [...prev, ...newQueued]);
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(true);
  };

  const handleDragLeave = () => {
    setIsDragOver(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
    addFilesToQueue(e.dataTransfer.files);
  };

  const handleRemoveItem = (index: number) => {
    if (isUploading) return;
    setFilesQueue(prev => prev.filter((_, i) => i !== index));
  };

  const clearQueue = () => {
    if (isUploading) return;
    setFilesQueue([]);
    setCurrentIndex(0);
  };

  const formatSize = (bytes: number) => {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
  };

  // Start sequential background upload & indexing process
  const startIndexing = async () => {
    if (filesQueue.length === 0 || isUploading) return;
    setIsUploading(true);
    let errorCount = 0;

    for (let i = 0; i < filesQueue.length; i++) {
      if (filesQueue[i].status === 'completed') continue;

      setCurrentIndex(i);
      setFilesQueue(prev => {
        const copy = [...prev];
        copy[i].status = 'processing';
        copy[i].progressText = 'Converting and reading photo...';
        return copy;
      });

      try {
        const base64String = await fileToBase64(filesQueue[i].file);
        
        setFilesQueue(prev => {
          const copy = [...prev];
          copy[i].progressText = 'Analyzing layout & faces with Gemini...';
          return copy;
        });

        const response = await fetch('/api/photos/upload', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            files: [
              {
                name: filesQueue[i].name,
                size: filesQueue[i].size,
                type: filesQueue[i].type,
                base64: base64String
              }
            ],
            userEmail: currentUser.email,
            userName: currentUser.name
          })
        });

        if (!response.ok) {
          throw new Error('Server indexing failed');
        }

        const data = await response.json();
        const firstProcessed = data.processed?.[0];

        setFilesQueue(prev => {
          const copy = [...prev];
          copy[i].status = 'completed';
          copy[i].progressText = `Indexed! Caption: "${firstProcessed?.caption.substring(0, 35)}..." with ${firstProcessed?.facesCount || 0} face(s)`;
          return copy;
        });
      } catch (err: any) {
        errorCount++;
        setFilesQueue(prev => {
          const copy = [...prev];
          copy[i].status = 'error';
          copy[i].error = err.message || 'Failed to index';
          return copy;
        });
      }
    }

    setIsUploading(false);
    onUploadSuccess();
    if (errorCount === 0) {
      // Completed perfectly
    }
  };

  const completedCount = filesQueue.filter(f => f.status === 'completed').length;
  const progressPercent = filesQueue.length > 0 ? (completedCount / filesQueue.length) * 100 : 0;

  return (
    <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div id="upload-modal-container" className="bg-[#1A1A1A] border border-[#2A2A2A] rounded-2xl shadow-2xl w-full max-w-3xl overflow-hidden flex flex-col max-h-[85vh]">
        
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-[#2A2A2A] bg-slate-950/40">
          <div className="flex items-center space-x-2.5">
            <Upload className="h-5 w-5 text-[#C4B5FD]" />
            <h3 className="text-base font-serif font-semibold text-[#F5F5F5] italic">Import Photos to Media Library</h3>
          </div>
          <button 
            disabled={isUploading}
            onClick={onClose}
            className="text-slate-500 hover:text-white p-1.5 rounded-full hover:bg-[#2A2A2A] transition-colors disabled:opacity-30"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Drag over overlay / inputs */}
        <div className="p-6 flex-1 overflow-y-auto space-y-6">
          
          {/* Dropzone Area */}
          {!isUploading && (
            <div
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
              onDrop={handleDrop}
              className={`border-2 border-dashed rounded-2xl p-8 text-center transition-all ${
                isDragOver 
                  ? 'border-[#C4B5FD] bg-[#C4B5FD]/10' 
                  : 'border-[#333] hover:border-[#444] bg-[#0A0A0A]/40'
              }`}
            >
              <Upload className="h-10 w-10 text-slate-500 mx-auto mb-4" />
              <p className="text-sm font-medium text-slate-200">
                Drag and drop your press photos or folders here
              </p>
              <p className="text-xs text-slate-500 mt-1 mb-4">
                Supports JPEG, PNG, HEIC up to 20MB per photo
              </p>
              <div className="flex justify-center space-x-3">
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="bg-[#0A0A0A] hover:bg-[#222] text-white font-semibold px-4 py-2 rounded-full text-xs border border-[#333] uppercase tracking-wider transition-all"
                >
                  Choose Files
                </button>
                <button
                  type="button"
                  onClick={() => folderInputRef.current?.click()}
                  className="bg-[#0A0A0A] hover:bg-[#222] text-white font-semibold px-4 py-2 rounded-full text-xs border border-[#333] uppercase tracking-wider transition-all flex items-center space-x-1.5"
                >
                  <Layers className="h-3.5 w-3.5 text-[#C4B5FD]" />
                  <span>Choose Folders</span>
                </button>
              </div>

              {/* Hidden Inputs */}
              <input
                ref={fileInputRef}
                type="file"
                multiple
                accept="image/*"
                onChange={(e) => addFilesToQueue(e.target.files)}
                className="hidden"
              />
              <input
                ref={folderInputRef}
                type="file"
                multiple
                // @ts-ignore
                webkitdirectory=""
                directory=""
                onChange={(e) => addFilesToQueue(e.target.files)}
                className="hidden"
              />
            </div>
          )}

          {/* Progress Section */}
          {filesQueue.length > 0 && (
            <div className="space-y-3">
              <div className="flex items-center justify-between text-xs text-slate-300">
                <span className="font-semibold text-white">
                  Indexing Progress: {completedCount} / {filesQueue.length} photos
                </span>
                <span className="font-mono">{Math.round(progressPercent)}%</span>
              </div>
              <div className="w-full bg-[#0A0A0A] rounded-full h-2.5 overflow-hidden border border-[#2A2A2A]">
                <div 
                  className="bg-gradient-to-r from-[#C4B5FD] to-[#FB7185] h-full transition-all duration-300"
                  style={{ width: `${progressPercent}%` }}
                />
              </div>
            </div>
          )}

          {/* Queue List */}
          {filesQueue.length > 0 && (
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-slate-400 uppercase tracking-widest">
                  Files to Index ({filesQueue.length})
                </span>
                {!isUploading && (
                  <button 
                    onClick={clearQueue}
                    className="text-xs text-[#FB7185] hover:text-[#fb7185]/80 font-semibold uppercase tracking-wider"
                  >
                    Clear All
                  </button>
                )}
              </div>

              <div className="border border-[#2A2A2A] bg-[#0A0A0A]/30 rounded-2xl overflow-hidden max-h-[250px] overflow-y-auto divide-y divide-[#2A2A2A]">
                {filesQueue.map((item, index) => (
                  <div 
                    key={index} 
                    className={`flex items-center justify-between p-3 transition-colors text-sm ${
                      index === currentIndex && isUploading ? 'bg-[#C4B5FD]/5' : ''
                    }`}
                  >
                    <div className="flex items-center space-x-3 min-w-0 flex-1">
                      <FileImage className="h-5 w-5 text-slate-400 shrink-0" />
                      <div className="min-w-0 flex-1">
                        <span className="block font-semibold text-slate-200 truncate" title={item.name}>
                          {item.name}
                        </span>
                        <div className="flex items-center space-x-2 text-xs text-slate-500 mt-0.5">
                          <span>{formatSize(item.size)}</span>
                          {item.progressText && (
                            <>
                              <span>•</span>
                              <span className="text-[#C4B5FD] truncate max-w-[350px]">{item.progressText}</span>
                            </>
                          )}
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center space-x-3 ml-4">
                      {item.status === 'queued' && (
                        <span className="text-[10px] uppercase tracking-wider font-semibold text-slate-400 bg-slate-800 px-2.5 py-1 rounded-full">
                          Queued
                        </span>
                      )}
                      {item.status === 'processing' && (
                        <div className="flex items-center space-x-1.5 text-[10px] uppercase tracking-wider text-[#C4B5FD] font-semibold">
                          <Loader2 className="h-3.5 w-3.5 animate-spin" />
                          <span>AI Indexing...</span>
                        </div>
                      )}
                      {item.status === 'completed' && (
                        <div className="flex items-center space-x-1 text-[10px] uppercase tracking-wider text-green-400 font-semibold">
                          <CheckCircle className="h-4 w-4" />
                          <span className="hidden sm:inline">Success</span>
                        </div>
                      )}
                      {item.status === 'error' && (
                        <div className="flex items-center space-x-1 text-[10px] uppercase tracking-wider text-[#FB7185] font-semibold" title={item.error}>
                          <AlertCircle className="h-4 w-4" />
                          <span className="hidden sm:inline">Failed</span>
                        </div>
                      )}

                      {!isUploading && (
                        <button
                          type="button"
                          onClick={() => handleRemoveItem(index)}
                          className="text-slate-500 hover:text-[#FB7185] p-1.5 hover:bg-[#222] rounded-full transition-colors"
                        >
                          <X className="h-4 w-4" />
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {filesQueue.length === 0 && (
            <div className="py-8 text-center text-slate-600 text-sm italic font-serif">
              No files currently selected. Choose files or a folder to get started.
            </div>
          )}

        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-[#2A2A2A] bg-slate-950/40 flex items-center justify-between">
          <div className="text-[10px] text-slate-500 max-w-sm uppercase tracking-wider leading-relaxed">
            Indexing runs fully on the server using modern multi-stage pipeline: Captioning, CLIP Semantic Vector generation, and face recognition clustering.
          </div>
          <div className="flex space-x-3">
            <button
              type="button"
              disabled={isUploading}
              onClick={onClose}
              className="px-5 py-2.5 border border-[#333] rounded-full text-slate-300 hover:bg-[#222] text-xs font-bold uppercase tracking-wider transition-colors disabled:opacity-35"
            >
              Cancel
            </button>
            <button
              type="button"
              disabled={isUploading || filesQueue.length === 0 || completedCount === filesQueue.length}
              onClick={startIndexing}
              className="bg-gradient-to-r from-[#C4B5FD] to-[#FB7185] hover:opacity-90 disabled:opacity-40 disabled:bg-[#1A1A1A] text-slate-950 font-bold px-6 py-2.5 rounded-full text-xs uppercase tracking-wider transition-all shadow-md flex items-center space-x-2 disabled:text-slate-500"
            >
              {isUploading ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  <span>Processing...</span>
                </>
              ) : (
                <span>Start Indexing ({filesQueue.filter(f => f.status !== 'completed').length} Photos)</span>
              )}
            </button>
          </div>
        </div>

      </div>
    </div>
  );
}
