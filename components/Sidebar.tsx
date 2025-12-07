import React, { useState, useRef, useEffect } from 'react';
import { Icons } from '../constants';
import { Session } from '../types';

interface SidebarProps {
  sessions: Session[];
  currentSessionId: string | null;
  onSelectSession: (sessionId: string) => void;
  onNewSession: () => void;
  isMobileOpen: boolean;
  setIsMobileOpen: (isOpen: boolean) => void;
  onClearAll: () => void;
  onRenameSession: (id: string, newTitle: string) => void;
  onDeleteSession: (id: string) => void;
  onOpenConnections: () => void; // New prop for modal
}

const Sidebar: React.FC<SidebarProps> = ({ 
  sessions,
  currentSessionId,
  onSelectSession,
  onNewSession,
  isMobileOpen,
  setIsMobileOpen,
  onClearAll,
  onRenameSession,
  onDeleteSession,
  onOpenConnections
}) => {
  const [menuOpenId, setMenuOpenId] = useState<string | null>(null);
  const [renameModalSession, setRenameModalSession] = useState<Session | null>(null);
  const [deleteModalSession, setDeleteModalSession] = useState<Session | null>(null);
  const [renameValue, setRenameValue] = useState('');
  
  const menuRef = useRef<HTMLDivElement>(null);

  // Close menu when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setMenuOpenId(null);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleOpenRename = (session: Session) => {
    setRenameModalSession(session);
    setRenameValue(session.title);
    setMenuOpenId(null);
  };

  const handleRenameSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (renameModalSession && renameValue.trim()) {
      onRenameSession(renameModalSession.id, renameValue.trim());
      setRenameModalSession(null);
    }
  };

  const handleOpenDelete = (session: Session) => {
    setDeleteModalSession(session);
    setMenuOpenId(null);
  };

  const handleDeleteConfirm = () => {
    if (deleteModalSession) {
      onDeleteSession(deleteModalSession.id);
      setDeleteModalSession(null);
    }
  };

  return (
    <>
      {/* Mobile Overlay */}
      {isMobileOpen && (
        <div 
          className="fixed inset-0 bg-gray-900/20 backdrop-blur-sm z-20 md:hidden"
          onClick={() => setIsMobileOpen(false)}
        />
      )}

      {/* Sidebar Content */}
      <aside 
        className={`
          fixed md:static inset-y-0 left-0 z-30
          w-72 bg-white border-r border-gray-100 md:shadow-none
          transform transition-transform duration-300 ease-in-out
          ${isMobileOpen ? 'translate-x-0' : '-translate-x-full md:translate-x-0'}
          flex flex-col h-full
        `}
      >
        {/* Logo */}
        <div className="px-6 py-6 pb-8">
          <h1 className="text-xl text-gray-800 tracking-tight font-normal">
            SwiftMind <span className="text-sm text-gray-400">1.0</span>
          </h1>
        </div>

        {/* Action Buttons */}
        <div className="px-5 space-y-3">
          <button
            onClick={() => {
              onNewSession();
              setIsMobileOpen(false);
            }}
            className="w-full flex items-center gap-3 bg-sky-400 hover:bg-sky-500 text-white px-4 py-3 rounded-md shadow-sm transition-all duration-200 font-medium text-sm"
          >
            {Icons.Plus}
            New Session
          </button>

          <button
            onClick={onOpenConnections}
            className="w-full flex items-center gap-3 bg-white border border-sky-200 text-gray-600 hover:bg-sky-50 px-4 py-3 rounded-md transition-all duration-200 font-medium text-sm"
          >
            {Icons.Link}
            Connect Apps
          </button>
        </div>

        <div className="px-6 mt-8 mb-2">
          <p className="text-sm font-medium text-gray-500">Your Sessions</p>
        </div>

        {/* Session List */}
        <nav className="flex-1 overflow-y-auto px-4 space-y-1">
          {sessions.length === 0 ? (
            <div className="text-center py-4 px-2">
              <p className="text-xs text-gray-300">No recent sessions</p>
            </div>
          ) : (
            sessions.map((session) => (
              <div key={session.id} className="relative group">
                <button
                  onClick={() => {
                    onSelectSession(session.id);
                    setIsMobileOpen(false);
                  }}
                  className={`
                    w-full flex items-center gap-3 px-3 py-2.5 rounded-md text-sm transition-all duration-200 text-left pr-8
                    ${currentSessionId === session.id 
                      ? 'bg-sky-50 text-sky-500 font-medium' 
                      : 'text-gray-500 hover:bg-gray-50 hover:text-gray-700'}
                  `}
                >
                  <span className={`shrink-0 ${currentSessionId === session.id ? 'text-sky-500' : 'text-gray-300 group-hover:text-gray-400'}`}>
                    {Icons.MessageSquare}
                  </span>
                  <span className="truncate w-full block">
                    {session.title || 'Untitled Session'}
                  </span>
                </button>

                {/* More Options Button */}
                <button
                    onClick={(e) => {
                        e.stopPropagation();
                        setMenuOpenId(menuOpenId === session.id ? null : session.id);
                    }}
                    className={`absolute right-2 top-1/2 -translate-y-1/2 p-1 rounded-full text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-opacity
                        ${menuOpenId === session.id ? 'opacity-100 bg-gray-100' : 'opacity-0 group-hover:opacity-100'}
                    `}
                >
                    {Icons.MoreHorizontal}
                </button>

                {/* Dropdown Menu */}
                {menuOpenId === session.id && (
                    <div ref={menuRef} className="absolute right-0 top-full mt-1 w-36 bg-white rounded-lg shadow-lg border border-gray-100 z-50 animate-in fade-in zoom-in-95 duration-100 overflow-hidden">
                        <button 
                            onClick={(e) => { e.stopPropagation(); handleOpenRename(session); }}
                            className="w-full text-left px-4 py-2 text-xs text-gray-700 hover:bg-gray-50 flex items-center gap-2"
                        >
                            {Icons.Edit2} Rename
                        </button>
                        <button 
                            onClick={(e) => { e.stopPropagation(); handleOpenDelete(session); }}
                            className="w-full text-left px-4 py-2 text-xs text-red-500 hover:bg-red-50 flex items-center gap-2"
                        >
                            {Icons.Trash2} Delete
                        </button>
                    </div>
                )}
              </div>
            ))
          )}
        </nav>

        {/* Footer Actions */}
        <div className="p-4 border-t border-gray-100">
           <button
            onClick={onClearAll}
            className="w-full flex items-center justify-center gap-2 px-4 py-2 text-xs font-medium text-gray-400 hover:text-red-500 hover:bg-red-50 rounded transition-colors"
          >
             {Icons.Trash2}
             Clear History
          </button>
        </div>
      </aside>

      {/* Rename Modal */}
      {renameModalSession && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <div className="absolute inset-0 bg-gray-900/30 backdrop-blur-sm" onClick={() => setRenameModalSession(null)}></div>
            <div className="bg-white rounded-xl shadow-xl w-full max-w-sm p-6 relative z-10 animate-in fade-in zoom-in-95">
                <h3 className="text-lg font-medium text-gray-900 mb-4">Rename Session</h3>
                <form onSubmit={handleRenameSubmit}>
                    <input 
                        type="text" 
                        value={renameValue}
                        onChange={(e) => setRenameValue(e.target.value)}
                        className="w-full px-4 py-2 rounded-lg border border-gray-300 focus:ring-2 focus:ring-sky-500 focus:border-sky-500 outline-none mb-4"
                        placeholder="Session Name"
                        autoFocus
                    />
                    <div className="flex justify-end gap-2">
                        <button 
                            type="button" 
                            onClick={() => setRenameModalSession(null)}
                            className="px-4 py-2 text-gray-600 hover:bg-gray-100 rounded-lg text-sm font-medium"
                        >
                            Cancel
                        </button>
                        <button 
                            type="submit"
                            className="px-4 py-2 bg-sky-500 text-white hover:bg-sky-600 rounded-lg text-sm font-medium shadow-sm"
                        >
                            Rename
                        </button>
                    </div>
                </form>
            </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {deleteModalSession && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <div className="absolute inset-0 bg-gray-900/30 backdrop-blur-sm" onClick={() => setDeleteModalSession(null)}></div>
            <div className="bg-white rounded-xl shadow-xl w-full max-w-sm p-6 relative z-10 animate-in fade-in zoom-in-95">
                <h3 className="text-lg font-medium text-gray-900 mb-2">Delete Session?</h3>
                <p className="text-sm text-gray-500 mb-6">
                    "{deleteModalSession.title}" will be moved to trash. You can restore it later from settings.
                </p>
                <div className="flex justify-end gap-2">
                    <button 
                        onClick={() => setDeleteModalSession(null)}
                        className="px-4 py-2 text-gray-600 hover:bg-gray-100 rounded-lg text-sm font-medium"
                    >
                        Cancel
                    </button>
                    <button 
                        onClick={handleDeleteConfirm}
                        className="px-4 py-2 bg-red-500 text-white hover:bg-red-600 rounded-lg text-sm font-medium shadow-sm"
                    >
                        Delete
                    </button>
                </div>
            </div>
        </div>
      )}
    </>
  );
};

export default Sidebar;