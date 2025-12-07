import React, { useState } from 'react';
import { Message, Role } from '../types';
import { Icons } from '../constants';

interface ChatMessageProps {
  message: Message;
  onLike?: (id: string) => void;
  onDislike?: (id: string) => void;
  onPlayVoice?: (id: string, text: string) => void;
  isVoicePlaying?: boolean;
}

const ChatMessage: React.FC<ChatMessageProps> = ({ 
  message, 
  onLike, 
  onDislike, 
  onPlayVoice,
  isVoicePlaying = false
}) => {
  const isUser = message.role === Role.USER;
  const [isCopied, setIsCopied] = useState(false);

  // Helper to render a table from a buffer of strings
  const renderTable = (tableLines: string[], keyPrefix: string) => {
    const rows = tableLines.map(row => 
        row.split('|')
           .filter((cell, i, arr) => {
               if (i === 0 && cell.trim() === '') return false;
               if (i === arr.length - 1 && cell.trim() === '') return false;
               return true;
           })
           .map(c => c.trim())
    );

    if (rows.length === 0) return null;
    const separatorIndex = rows.findIndex(row => row.some(cell => /^[-:]+$/.test(cell)));
    
    let headers: string[] | null = null;
    let bodyRows = rows;

    if (separatorIndex !== -1) {
        if (separatorIndex === 1) {
             headers = rows[0];
             bodyRows = rows.slice(2);
        } else {
             bodyRows = rows.filter((_, idx) => idx !== separatorIndex);
        }
    }

    return (
        <div key={keyPrefix} className="my-4 overflow-x-auto border border-gray-200 rounded-lg shadow-sm">
            <table className="min-w-full divide-y divide-gray-200">
                {headers && (
                    <thead className="bg-gray-50">
                        <tr>
                            {headers.map((h, i) => (
                                <th key={i} className="px-6 py-3 text-left text-xs font-bold text-gray-500 uppercase tracking-wider">
                                    {h}
                                </th>
                            ))}
                        </tr>
                    </thead>
                )}
                <tbody className="bg-white divide-y divide-gray-200">
                    {bodyRows.map((row, i) => (
                        <tr key={i} className={i % 2 === 0 ? 'bg-white' : 'bg-gray-50'}>
                            {row.map((cell, j) => (
                                <td key={j} className="px-6 py-4 text-sm text-gray-700 whitespace-nowrap">
                                    {cell}
                                </td>
                            ))}
                        </tr>
                    ))}
                </tbody>
            </table>
        </div>
    );
  };

  const renderInlineFormat = (text: string) => {
    const parts = text.split(/(\*\*.*?\*\*)/g);
    return parts.map((part, index) => {
        if (part.startsWith('**') && part.endsWith('**')) {
            return <strong key={index} className="text-gray-900 font-semibold">{part.slice(2, -2)}</strong>;
        }
        return part;
    });
  };

  const formatText = (text: string) => {
    const lines = text.split('\n');
    const elements: React.ReactNode[] = [];
    let tableBuffer: string[] = [];
    
    for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        const trimmed = line.trim();
        
        if (trimmed.startsWith('|')) {
            tableBuffer.push(trimmed);
            if (i === lines.length - 1) {
                 elements.push(renderTable(tableBuffer, `table-${i}`));
                 tableBuffer = [];
            }
            continue;
        } 
        
        if (tableBuffer.length > 0) {
            elements.push(renderTable(tableBuffer, `table-${i}`));
            tableBuffer = [];
        }

        if (trimmed === '') {
            elements.push(<div key={`spacer-${i}`} className="h-3" />);
        } else if (trimmed.startsWith('###')) {
            elements.push(<h3 key={`h3-${i}`} className="text-lg font-bold text-gray-800 mt-5 mb-2">{trimmed.replace(/^###\s+/, '')}</h3>);
        } else if (trimmed.startsWith('##')) {
            elements.push(<h2 key={`h2-${i}`} className="text-xl font-bold text-gray-800 mt-6 mb-3">{trimmed.replace(/^##\s+/, '')}</h2>);
        } else if (trimmed.startsWith('**') && trimmed.endsWith('**') && trimmed.length < 60 && !trimmed.includes(':')) {
             elements.push(<div key={`bold-${i}`} className="font-bold text-gray-800 mt-2 mb-1">{trimmed.replace(/\*\*/g, '')}</div>);
        } else if (trimmed.startsWith('---') || trimmed.startsWith('___')) {
             elements.push(<hr key={`hr-${i}`} className="my-4 border-gray-200" />);
        } else if (trimmed.startsWith('- ') || trimmed.startsWith('* ')) {
            const content = trimmed.substring(2);
            elements.push(
                <div key={`list-${i}`} className="flex gap-2.5 ml-1 my-1.5">
                    <span className="text-gray-400 mt-2 w-1.5 h-1.5 rounded-full bg-gray-500 shrink-0 block" />
                    <span className="text-gray-600 leading-relaxed">
                        {renderInlineFormat(content)}
                    </span>
                </div>
            );
        } else {
            elements.push(
                <p key={`p-${i}`} className="mb-2 leading-relaxed text-gray-600">
                    {renderInlineFormat(line)}
                </p>
            );
        }
    }
    return elements;
  };

  const handleShare = () => {
    navigator.clipboard.writeText(message.content).then(() => {
        setIsCopied(true);
        setTimeout(() => setIsCopied(false), 2000);
    });
  };

  const downloadFile = (data: string, fileName: string, mimeType: string) => {
    const blob = new Blob([data], { type: mimeType });
    const url = URL.createObjectURL(blob);
    
    if (mimeType === 'text/html') {
        const printWindow = window.open('', '_blank');
        if (printWindow) {
            printWindow.document.write(data);
            printWindow.document.close();
            setTimeout(() => {
                printWindow.print();
            }, 500);
        }
        URL.revokeObjectURL(url);
        return;
    }

    const a = document.createElement('a');
    a.href = url;
    a.download = fileName;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const renderAttachment = (attachment: { name: string, type: string, data: string }) => {
      if (attachment.type.startsWith('image/')) {
          return (
              <div className="mb-1">
                 <img src={attachment.data} alt={attachment.name} className="max-h-60 rounded-lg border border-gray-200/50 shadow-sm" />
              </div>
          );
      }
      if (attachment.type.startsWith('video/')) {
          return (
              <div className="mb-1">
                 <video src={attachment.data} controls className="max-h-60 rounded-lg border border-gray-200/50 shadow-sm bg-black" />
              </div>
          );
      }
      return (
          <div className="flex items-center gap-3 p-3 bg-gray-50/50 border border-gray-200 rounded-lg max-w-sm">
               <div className="p-2 bg-white rounded-md text-gray-500 shadow-sm">
                   {Icons.FileText}
               </div>
               <div className="overflow-hidden">
                   <div className="text-sm font-medium text-gray-700 truncate">{attachment.name}</div>
                   <div className="text-xs text-gray-400 uppercase">{attachment.type.split('/')[1] || 'FILE'}</div>
               </div>
          </div>
      );
  };

  return (
    <div className={`w-full flex ${isUser ? 'justify-end' : 'justify-start'} animate-in fade-in duration-300 slide-in-from-bottom-2 px-2`}>
      <div 
        className={`
          max-w-[95%] md:max-w-[85%] rounded-2xl p-5 shadow-sm
          ${isUser 
            ? 'bg-sky-400 text-white rounded-br-sm' 
            : 'bg-white text-gray-800 rounded-bl-sm border border-gray-100 shadow-gray-100'}
        `}
      >
        {!isUser && (
           <div className="flex items-center gap-2 mb-3 pb-2 border-b border-gray-100">
                <span className="text-xs font-semibold uppercase tracking-wider text-sky-500">SwiftMind</span>
           </div>
        )}
        
        {/* Render Attachments */}
        {message.attachments && message.attachments.length > 0 && (
          <div className="flex flex-wrap gap-2 mb-3">
             {message.attachments.map((att, idx) => (
                 <div key={idx} className="max-w-full">
                     {renderAttachment(att)}
                 </div>
             ))}
          </div>
        )}

        {message.mediaUrl && message.mediaType === 'image' && (
          <div className="my-3">
             <img src={message.mediaUrl} alt="Generated" className="rounded-lg shadow-sm border border-gray-100 max-w-full" />
          </div>
        )}

        {message.mediaUrl && message.mediaType === 'video' && (
          <div className="my-3">
             <video src={message.mediaUrl} controls className="rounded-lg shadow-sm border border-gray-100 max-w-full w-full bg-black" />
          </div>
        )}

        {message.audioUrl && (
          <div className="my-3 p-3 bg-gray-50 rounded-lg border border-gray-100">
            <audio src={message.audioUrl} controls className="w-full h-10" />
          </div>
        )}

        {message.downloadData && (
          <div className="my-4 p-4 bg-sky-50 border border-sky-100 rounded-xl flex items-center justify-between gap-4">
              <div className="flex items-center gap-3">
                  <div className="p-2 bg-white rounded-lg text-sky-500 shadow-sm">
                      {message.downloadData.mimeType === 'text/html' 
                        ? Icons.FileTypePdf 
                        : message.downloadData.fileName.endsWith('.csv') || message.downloadData.fileName.endsWith('.xlsx') 
                            ? Icons.FileSpreadsheet 
                            : Icons.FileTypeDoc
                      }
                  </div>
                  <div>
                      <div className="font-medium text-gray-800 text-sm">{message.downloadData.fileName}</div>
                      <div className="text-xs text-gray-500">
                          {message.downloadData.mimeType === 'text/html' ? 'Ready to Print/Save as PDF' : 'Ready for download'}
                      </div>
                  </div>
              </div>
              <button 
                onClick={() => message.downloadData && downloadFile(message.downloadData.data, message.downloadData.fileName, message.downloadData.mimeType)}
                className="px-4 py-2 bg-sky-500 hover:bg-sky-600 text-white text-sm font-medium rounded-lg transition-colors shadow-sm"
              >
                {message.downloadData.mimeType === 'text/html' ? 'Print / PDF' : 'Download'}
              </button>
          </div>
        )}

        <div className={`text-base overflow-x-auto ${isUser ? 'text-white font-normal' : 'text-gray-600'}`}>
           {isUser ? message.content : formatText(message.content)}
        </div>
        
        {message.isStreaming && (
             <div className="mt-3 flex items-center gap-1.5 h-4">
                <div className="w-1.5 h-1.5 bg-gray-300 rounded-full animate-bounce [animation-delay:-0.3s]"></div>
                <div className="w-1.5 h-1.5 bg-gray-300 rounded-full animate-bounce [animation-delay:-0.15s]"></div>
                <div className="w-1.5 h-1.5 bg-gray-300 rounded-full animate-bounce"></div>
            </div>
        )}

        {!isUser && !message.isStreaming && (
          <div className="flex items-center gap-4 mt-4 pt-3 border-t border-gray-50 text-gray-400">
             <button 
                onClick={() => onLike && onLike(message.id)}
                className={`flex items-center gap-1 hover:text-sky-500 transition-colors ${message.reaction === 'like' ? 'text-sky-500' : ''}`}
                title="Like"
             >
                {Icons.ThumbsUp}
             </button>
             <button 
                onClick={() => onDislike && onDislike(message.id)}
                className={`flex items-center gap-1 hover:text-red-500 transition-colors ${message.reaction === 'dislike' ? 'text-red-500' : ''}`}
                title="Dislike"
             >
                {Icons.ThumbsDown}
             </button>
             <div className="h-4 w-px bg-gray-100 mx-1"></div>
             <button 
                onClick={handleShare}
                className={`flex items-center gap-1 hover:text-gray-600 transition-colors ${isCopied ? 'text-green-500' : ''}`}
                title="Copy / Share"
             >
                {isCopied ? (
                    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"></polyline></svg>
                ) : Icons.Share2}
             </button>
             <button 
                onClick={() => onPlayVoice && onPlayVoice(message.id, message.content)}
                className={`flex items-center gap-1 hover:text-sky-500 transition-colors ${isVoicePlaying ? 'text-sky-500 animate-pulse' : ''}`}
                title="Read Aloud"
             >
                {isVoicePlaying ? Icons.StopCircle : Icons.Volume2}
             </button>
          </div>
        )}
      </div>
    </div>
  );
};

export default ChatMessage;