import React, { useState, useEffect } from 'react';
import { Shield, X, Download, Upload, Eye, Search, Trash2, Key, CheckCircle, FileText, Lock } from 'lucide-react';
import { AuditLog, User } from '../types';

interface BackupLogsModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentUser: User;
  onRefreshStats: () => void;
}

export default function BackupLogsModal({
  isOpen,
  onClose,
  currentUser,
  onRefreshStats
}: BackupLogsModalProps) {
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [searchLog, setSearchLog] = useState('');
  const [activeTab, setActiveTab] = useState<'logs' | 'backup'>('logs');

  // Backup states
  const [exportPassword, setExportPassword] = useState('');
  const [importPassword, setImportPassword] = useState('');
  const [backupFileContent, setBackupFileContent] = useState<any | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [statusMsg, setStatusMsg] = useState({ text: '', type: 'info' });

  const fetchLogs = async () => {
    try {
      const response = await fetch(`/api/audit-logs?email=${currentUser.email}&role=${currentUser.role}`);
      if (response.ok) {
        const data = await response.json();
        setLogs(data);
      }
    } catch (err) {
      console.error(err);
    }
  };

  useEffect(() => {
    if (isOpen && activeTab === 'logs') {
      fetchLogs();
    }
  }, [isOpen, activeTab, currentUser]);

  if (!isOpen) return null;

  const handleClearLogs = async () => {
    if (currentUser.role !== 'Admin') {
      alert('Viewer role is restricted. Admin required to delete logs.');
      return;
    }
    const confirm = window.confirm('Are you sure you want to permanently clear all system audit logs?');
    if (!confirm) return;

    try {
      const response = await fetch('/api/audit-logs/clear', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: currentUser.email, role: currentUser.role, name: currentUser.name })
      });
      if (response.ok) {
        setLogs([]);
        alert('Logs cleared successfully.');
      }
    } catch (err) {
      console.error(err);
    }
  };

  // Export DB
  const handleExportBackup = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!exportPassword || exportPassword.length < 4) {
      setStatusMsg({ text: 'Please set a secure passphrase of at least 4 characters.', type: 'error' });
      return;
    }

    setIsProcessing(true);
    setStatusMsg({ text: 'Encrypting database using AES-256-CBC...', type: 'info' });

    try {
      const response = await fetch('/api/backup/export', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          passphrase: exportPassword,
          userEmail: currentUser.email,
          userName: currentUser.name
        })
      });

      if (!response.ok) {
        throw new Error('Encryption failed');
      }

      const payload = await response.json();

      // Download file
      const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(payload, null, 2));
      const downloadAnchor = document.createElement('a');
      downloadAnchor.setAttribute("href", dataStr);
      downloadAnchor.setAttribute("download", `mediafind-db-backup-${new Date().toISOString().slice(0,10)}.enc`);
      document.body.appendChild(downloadAnchor);
      downloadAnchor.click();
      downloadAnchor.remove();

      setStatusMsg({ text: 'Backup encrypted & downloaded successfully!', type: 'success' });
      setExportPassword('');
    } catch (err: any) {
      setStatusMsg({ text: err.message || 'Failed to export', type: 'error' });
    } finally {
      setIsProcessing(false);
    }
  };

  // Import / Upload File Picker
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (evt) => {
      try {
        const json = JSON.parse(evt.target?.result as string);
        if (!json.salt || !json.iv || !json.ciphertext) {
          throw new Error('Invalid file structure. Make sure you selected a .enc file.');
        }
        setBackupFileContent(json);
        setStatusMsg({ text: 'Backup file loaded. Enter password below to decrypt and restore.', type: 'info' });
      } catch (err: any) {
        setStatusMsg({ text: err.message || 'Failed to read file', type: 'error' });
        setBackupFileContent(null);
      }
    };
    reader.readAsText(file);
  };

  // Decrypt and Restore DB
  const handleImportBackup = async (e: React.FormEvent) => {
    e.preventDefault();
    if (currentUser.role !== 'Admin') {
      setStatusMsg({ text: 'Viewer accounts are restricted. Admin required to restore database backups.', type: 'error' });
      return;
    }
    if (!backupFileContent) {
      setStatusMsg({ text: 'Please load an encrypted backup file first.', type: 'error' });
      return;
    }
    if (!importPassword) {
      setStatusMsg({ text: 'Passphrase is required for decryption.', type: 'error' });
      return;
    }

    setIsProcessing(true);
    setStatusMsg({ text: 'Verifying keys & decrypting database...', type: 'info' });

    try {
      const response = await fetch('/api/backup/import', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          passphrase: importPassword,
          backupData: backupFileContent,
          userEmail: currentUser.email,
          userName: currentUser.name,
          role: currentUser.role
        })
      });

      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || 'Decryption failed');
      }

      setStatusMsg({ text: 'Database successfully decrypted and restored!', type: 'success' });
      setImportPassword('');
      setBackupFileContent(null);
      onRefreshStats();
    } catch (err: any) {
      setStatusMsg({ text: err.message || 'Restoration failed. Password incorrect.', type: 'error' });
    } finally {
      setIsProcessing(false);
    }
  };

  const filteredLogs = logs.filter(l =>
    l.user_name.toLowerCase().includes(searchLog.toLowerCase()) ||
    l.action.toLowerCase().includes(searchLog.toLowerCase()) ||
    l.details.toLowerCase().includes(searchLog.toLowerCase())
  );

  return (
    <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-[#1A1A1A] border border-[#2A2A2A] rounded-2xl shadow-2xl w-full max-w-4xl overflow-hidden flex flex-col h-[85vh]">
        
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-[#2A2A2A] bg-slate-950/40">
          <div className="flex items-center space-x-2.5">
            <Shield className="h-5 w-5 text-[#C4B5FD]" />
            <h3 className="text-base font-serif font-semibold text-[#F5F5F5] italic">Security & Database Operations</h3>
          </div>
          <button 
            onClick={onClose}
            className="text-slate-500 hover:text-white p-1.5 rounded-full hover:bg-[#2A2A2A] transition-colors"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Tab Selector */}
        <div className="flex border-b border-[#2A2A2A] bg-slate-950/20 px-6">
          <button
            onClick={() => { setActiveTab('logs'); setStatusMsg({ text: '', type: 'info' }); }}
            className={`px-4 py-3 text-xs font-semibold uppercase tracking-wider border-b-2 transition-all ${
              activeTab === 'logs'
                ? 'border-[#C4B5FD] text-[#C4B5FD]'
                : 'border-transparent text-slate-500 hover:text-slate-300'
            }`}
          >
            Staff Audit Logs
          </button>
          <button
            onClick={() => { setActiveTab('backup'); setStatusMsg({ text: '', type: 'info' }); }}
            className={`px-4 py-3 text-xs font-semibold uppercase tracking-wider border-b-2 transition-all ${
              activeTab === 'backup'
                ? 'border-[#C4B5FD] text-[#C4B5FD]'
                : 'border-transparent text-slate-500 hover:text-slate-300'
            }`}
          >
            Encrypted Metadata Backup
          </button>
        </div>

        {/* Body content */}
        <div className="p-6 flex-1 overflow-y-auto">
          {activeTab === 'logs' ? (
            <div className="space-y-4 flex flex-col h-full">
              
              {/* Search Log / Action bar */}
              <div className="flex flex-col sm:flex-row gap-3 items-center justify-between">
                <div className="relative w-full sm:max-w-xs">
                  <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-500" />
                  <input
                    type="text"
                    placeholder="Search logs..."
                    value={searchLog}
                    onChange={(e) => setSearchLog(e.target.value)}
                    className="w-full bg-[#0A0A0A] border border-[#333] text-slate-200 rounded-full pl-9 pr-3 py-2 text-xs uppercase tracking-wider focus:outline-none focus:border-[#C4B5FD]"
                  />
                </div>

                {currentUser.role === 'Admin' && (
                  <button
                    onClick={handleClearLogs}
                    className="text-[10px] text-[#FB7185] hover:text-[#fb7185]/80 font-bold uppercase tracking-wider border border-[#FB7185]/20 hover:border-[#FB7185]/40 px-4 py-2 rounded-full bg-[#FB7185]/5 transition-colors"
                  >
                    Clear All Logs
                  </button>
                )}
              </div>

              {/* Logs Table / List */}
              <div className="border border-[#2A2A2A] bg-[#0A0A0A]/30 rounded-2xl overflow-hidden flex-1 max-h-[350px] overflow-y-auto">
                {currentUser.role !== 'Admin' ? (
                  <div className="text-center py-16 text-slate-500 text-xs flex flex-col items-center">
                    <Lock className="h-8 w-8 text-[#2A2A2A] mb-3" />
                    <span className="font-serif italic text-sm">Compliance Restriction</span>
                    <span className="mt-1 uppercase tracking-wider text-[10px] text-slate-600">Staff logs are visible to <strong>Admin role</strong> only.</span>
                  </div>
                ) : (
                  <table className="w-full text-left text-xs divide-y divide-[#2A2A2A]">
                    <thead className="bg-[#1A1A1A]/50 text-slate-400 uppercase tracking-widest font-mono text-[9px]">
                      <tr>
                        <th className="px-5 py-3">Timestamp</th>
                        <th className="px-5 py-3">Staff Member</th>
                        <th className="px-5 py-3">Action</th>
                        <th className="px-5 py-3">Details</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[#2A2A2A] text-slate-300">
                      {filteredLogs.map((log) => (
                        <tr key={log.id} className="hover:bg-[#222]/20">
                          <td className="px-5 py-3 font-mono text-[10px] whitespace-nowrap">
                            {new Date(log.timestamp).toLocaleString()}
                          </td>
                          <td className="px-5 py-3 font-semibold text-[#F5F5F5] whitespace-nowrap">
                            {log.user_name}
                            <span className="block text-[9px] text-slate-500 font-mono mt-0.5">{log.user_email}</span>
                          </td>
                          <td className="px-5 py-3 whitespace-nowrap">
                            <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[9px] font-bold uppercase border ${
                              log.action === 'Search' 
                                ? 'bg-[#C4B5FD]/10 text-[#C4B5FD] border-[#C4B5FD]/20' 
                                : log.action === 'Bulk Import'
                                  ? 'bg-[#FB7185]/10 text-[#FB7185] border-[#FB7185]/20'
                                  : 'bg-green-500/10 text-green-400 border-green-500/20'
                            }`}>
                              {log.action}
                            </span>
                          </td>
                          <td className="px-5 py-3 break-all max-w-xs font-sans text-slate-400 leading-normal">
                            {log.details}
                          </td>
                        </tr>
                      ))}
                      {filteredLogs.length === 0 && (
                        <tr>
                          <td colSpan={4} className="text-center py-8 text-slate-500 italic font-serif">
                            No audit logs available.
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                )}
              </div>

            </div>
          ) : (
            <div className="space-y-6 max-w-xl mx-auto">
              
              {/* Backups Intro */}
              <div className="bg-[#0A0A0A]/40 p-4 border border-[#2A2A2A] rounded-2xl space-y-2 leading-relaxed">
                <div className="flex items-center space-x-2">
                  <Lock className="h-4 w-4 text-[#C4B5FD]" />
                  <h4 className="text-[10px] font-bold text-[#C4B5FD] uppercase tracking-wider">Secure On-Premises Backups</h4>
                </div>
                <p className="text-xs text-slate-400">
                  In compliance with media department regulations, all face metadata, vector indices, and custom tagging can be exported as highly secure, password-encrypted file backups using robust **AES-256-CBC encryption**. 
                </p>
              </div>
 
              {/* Status Message */}
              {statusMsg.text && (
                <div className={`p-4 rounded-2xl border text-xs flex items-center space-x-2.5 ${
                  statusMsg.type === 'success'
                    ? 'bg-green-950/40 border-green-850 text-green-300'
                    : statusMsg.type === 'error'
                      ? 'bg-red-950/40 border-red-850 text-red-300'
                      : 'bg-[#C4B5FD]/10 border-[#C4B5FD]/20 text-[#C4B5FD]'
                }`}>
                  {statusMsg.type === 'success' ? <CheckCircle className="h-4 w-4 shrink-0" /> : <Lock className="h-4 w-4 shrink-0" />}
                  <span className="font-semibold">{statusMsg.text}</span>
                </div>
              )}
 
              {/* Export Panel */}
              <form onSubmit={handleExportBackup} className="space-y-4 bg-[#0A0A0A]/20 p-5 rounded-2xl border border-[#2A2A2A]">
                <h5 className="text-[10px] font-bold text-white uppercase tracking-wider">Export Encrypted Backup</h5>
                <div className="flex flex-col sm:flex-row gap-3 items-end">
                  <div className="flex-1 space-y-1">
                    <label className="text-[9px] font-bold text-slate-500 uppercase tracking-widest block">Backup Passphrase</label>
                    <input
                      type="password"
                      placeholder="Secure passphrase (min 4 chars)"
                      value={exportPassword}
                      onChange={(e) => setExportPassword(e.target.value)}
                      className="w-full bg-[#0A0A0A] border border-[#333] text-slate-200 rounded-full px-4 py-2 text-xs focus:outline-none focus:border-[#C4B5FD]"
                      disabled={isProcessing}
                    />
                  </div>
                  <button
                    type="submit"
                    disabled={isProcessing || !exportPassword}
                    className="bg-gradient-to-r from-[#C4B5FD] to-[#FB7185] hover:opacity-90 disabled:opacity-40 disabled:bg-[#1A1A1A] text-slate-950 font-bold text-xs uppercase tracking-wider px-5 py-2.5 rounded-full flex items-center space-x-1.5 shrink-0 transition-colors shadow-md"
                  >
                    <Download className="h-3.5 w-3.5 stroke-[2.5]" />
                    <span>Download Backup</span>
                  </button>
                </div>
              </form>
 
              {/* Import Panel */}
              <form onSubmit={handleImportBackup} className="space-y-4 bg-[#0A0A0A]/20 p-5 rounded-2xl border border-[#2A2A2A]">
                <h5 className="text-[10px] font-bold text-white uppercase tracking-wider">Restore Database from Backup</h5>
                
                <div className="space-y-3">
                  <div className="space-y-1">
                    <label className="text-[9px] font-bold text-slate-500 uppercase tracking-widest block">Select encrypted backup (.enc)</label>
                    <input
                      type="file"
                      accept=".enc"
                      onChange={handleFileChange}
                      className="w-full bg-[#0A0A0A] border border-[#333] text-slate-400 rounded-full p-2 text-xs focus:outline-none file:mr-4 file:py-1 file:px-3 file:rounded-full file:border-0 file:text-[10px] file:font-bold file:uppercase file:tracking-wider file:bg-[#C4B5FD] file:text-slate-950 hover:file:opacity-90 file:cursor-pointer"
                      disabled={isProcessing || currentUser.role !== 'Admin'}
                    />
                  </div>
 
                  {backupFileContent && (
                    <div className="flex flex-col sm:flex-row gap-3 items-end animate-fadeIn">
                      <div className="flex-1 space-y-1">
                        <label className="text-[9px] font-bold text-slate-500 uppercase tracking-widest block">Decryption Password</label>
                        <input
                          type="password"
                          placeholder="Password used to encrypt"
                          value={importPassword}
                          onChange={(e) => setImportPassword(e.target.value)}
                          className="w-full bg-[#0A0A0A] border border-[#333] text-slate-200 rounded-full px-4 py-2 text-xs focus:outline-none focus:border-[#C4B5FD]"
                          disabled={isProcessing}
                        />
                      </div>
                      <button
                        type="submit"
                        disabled={isProcessing || !importPassword || currentUser.role !== 'Admin'}
                        className="bg-green-900/60 border border-green-850 hover:bg-green-800 text-green-300 font-bold text-xs uppercase tracking-wider px-5 py-2.5 rounded-full flex items-center space-x-1.5 shrink-0 transition-all shadow-md"
                      >
                        <Upload className="h-3.5 w-3.5 stroke-[2.5]" />
                        <span>Decrypt & Restore</span>
                      </button>
                    </div>
                  )}
 
                  {currentUser.role !== 'Admin' && (
                    <div className="text-[10px] text-[#FB7185]/80 font-semibold italic block uppercase tracking-wider">
                      Restoring backups is restricted to Administrative accounts.
                    </div>
                  )}
                </div>
              </form>
 
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-[#2A2A2A] bg-slate-950/40 flex justify-end">
          <button
            onClick={onClose}
            className="px-5 py-2.5 border border-[#333] rounded-full text-slate-300 text-xs font-bold uppercase tracking-wider hover:bg-[#222] transition-colors"
          >
            Close Board
          </button>
        </div>

      </div>
    </div>
  );
}
