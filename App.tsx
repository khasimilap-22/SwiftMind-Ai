import React, { useState, useEffect, useRef } from 'react';
import Sidebar from './components/Sidebar';
import ChatMessage from './components/ChatMessage';
import LoginScreen from './components/LoginScreen';
import { Message, Role, TaskModule, Session, UserProfile } from './types';
import { MODULES, Icons, ILOVEPDF_SECRET_KEY } from './constants';
import { sendMessageStream, initializeChat, resetSession, generateImage, generateVideo, generateSpeech, generateChatTitle } from './services/geminiService';
import { convertWithILovePDF } from './services/ilovepdfService';
import { getCurrentUser, getUserSessions, saveUserSessions, logout } from './services/userService';
import { v4 as uuidv4 } from 'uuid';

// --- SUB-COMPONENTS ---

// 1. Toast Notification
const Toast: React.FC<{ message: string | null; onClose: () => void }> = ({ message, onClose }) => {
  useEffect(() => {
    if (message) {
      const timer = setTimeout(onClose, 3000);
      return () => clearTimeout(timer);
    }
  }, [message, onClose]);

  if (!message) return null;

  return (
    <div className="fixed bottom-6 left-1/2 transform -translate-x-1/2 bg-gray-900 text-white px-6 py-3 rounded-full shadow-lg z-50 animate-in slide-in-from-bottom-5 fade-in duration-300 flex items-center gap-2">
      <span className="text-sm font-medium">{message}</span>
    </div>
  );
};

// 2. Feedback Modal
interface FeedbackModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (rating: number, text: string) => void;
}

const FeedbackModal: React.FC<FeedbackModalProps> = ({ isOpen, onClose, onSubmit }) => {
  const [rating, setRating] = useState(0);
  const [text, setText] = useState('');

  if (!isOpen) return null;

  const handleSubmit = () => {
    onSubmit(rating, text);
    // Reset
    setRating(0);
    setText('');
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-gray-900/30 backdrop-blur-sm" onClick={onClose}></div>
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-md p-6 relative z-10 animate-in zoom-in-95 duration-200">
        <div className="flex justify-between items-center mb-4">
            <h3 className="text-lg font-semibold text-gray-800">Give us Feedback</h3>
            <button onClick={onClose} className="text-gray-400 hover:text-gray-600">{Icons.X}</button>
        </div>
        
        <div className="flex gap-2 mb-6 justify-center">
            {[1, 2, 3, 4, 5].map((star) => (
                <button 
                  key={star} 
                  onClick={() => setRating(star)}
                  className={`transition-transform hover:scale-110 ${rating >= star ? 'text-amber-400 fill-amber-400' : 'text-gray-300'}`}
                >
                    {React.cloneElement(Icons.Star as React.ReactElement, { fill: rating >= star ? "currentColor" : "none" })}
                </button>
            ))}
        </div>

        <textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder="Tell us what went wrong or how we can improve..."
            className="w-full h-32 p-3 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-sky-200 focus:outline-none resize-none mb-6 text-sm"
        />

        <div className="flex justify-end gap-3">
            <button onClick={onClose} className="px-4 py-2 text-gray-500 font-medium hover:bg-gray-100 rounded-lg transition-colors">
                Cancel
            </button>
            <button 
                onClick={handleSubmit}
                disabled={rating === 0}
                className="px-6 py-2 bg-sky-500 text-white font-medium rounded-lg hover:bg-sky-600 shadow-sm disabled:opacity-50 disabled:cursor-not-allowed transition-all"
            >
                Give Feedback
            </button>
        </div>
      </div>
    </div>
  );
};

// 3. Connection Modal (for Keys)
interface ConnectionModalProps {
    isOpen: boolean;
    onClose: () => void;
    ilovePdfKeys: { public: string; secret: string };
    onSave: (keys: { public: string; secret: string }) => void;
}

const ConnectionModal: React.FC<ConnectionModalProps> = ({ isOpen, onClose, ilovePdfKeys, onSave }) => {
    const [pub, setPub] = useState(ilovePdfKeys.public);
    const [sec, setSec] = useState(ilovePdfKeys.secret);

    useEffect(() => {
        if(isOpen) {
            setPub(ilovePdfKeys.public);
            setSec(ilovePdfKeys.secret);
        }
    }, [isOpen, ilovePdfKeys]);

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <div className="absolute inset-0 bg-gray-900/30 backdrop-blur-sm" onClick={onClose}></div>
            <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg p-8 relative z-10 animate-in zoom-in-95 duration-200">
                <h3 className="text-xl font-semibold text-gray-900 mb-2">Connect Apps</h3>
                <p className="text-sm text-gray-500 mb-6">Integrate third-party tools for enhanced capabilities.</p>
                
                <div className="mb-6 p-4 bg-gray-50 rounded-xl border border-gray-100">
                    <div className="flex items-center gap-2 mb-4">
                        <span className="text-red-500 font-bold">iLovePDF Integration</span>
                        <span className="text-xs bg-sky-100 text-sky-600 px-2 py-0.5 rounded-full">Pro Converter</span>
                    </div>
                    
                    <div className="space-y-4">
                        <div>
                            <label className="block text-xs font-medium text-gray-700 mb-1">Public Key (Project Key)</label>
                            <input 
                                type="text" 
                                value={pub}
                                onChange={(e) => setPub(e.target.value)}
                                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-sky-500 outline-none"
                                placeholder="project_public_..."
                            />
                            <p className="text-[10px] text-gray-400 mt-1">Required for API authentication.</p>
                        </div>
                        <div>
                            <label className="block text-xs font-medium text-gray-700 mb-1">Secret Key</label>
                            <input 
                                type="text" 
                                value={sec}
                                onChange={(e) => setSec(e.target.value)}
                                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm bg-gray-100 text-gray-500 cursor-not-allowed"
                                readOnly
                            />
                        </div>
                    </div>
                </div>

                <div className="flex justify-end gap-3">
                    <button onClick={onClose} className="px-4 py-2 text-gray-600 font-medium hover:bg-gray-50 rounded-lg transition-colors">
                        Cancel
                    </button>
                    <button 
                        onClick={() => { onSave({ public: pub, secret: sec }); onClose(); }}
                        className="px-6 py-2 bg-sky-500 text-white font-medium rounded-lg hover:bg-sky-600 shadow-sm"
                    >
                        Save Connections
                    </button>
                </div>
            </div>
        </div>
    );
};


const App: React.FC = () => {
  // Auth State
  const [user, setUser] = useState<UserProfile | null>(null);
  const [isProfileOpen, setIsProfileOpen] = useState(false);

  // App State
  const [sessions, setSessions] = useState<Session[]>([]);
  const [currentSessionId, setCurrentSessionId] = useState<string | null>(null);
  
  const [activeModule, setActiveModule] = useState<TaskModule>(TaskModule.GENERAL);
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputValue, setInputValue] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [isModuleMenuOpen, setIsModuleMenuOpen] = useState(false);
  
  // Specific Module States
  const [imageSize, setImageSize] = useState<'1K' | '2K' | '4K'>('1K');
  const [videoAspectRatio, setVideoAspectRatio] = useState<'16:9' | '9:16'>('16:9');
  
  // Updated to support multiple files
  const [selectedFiles, setSelectedFiles] = useState<{name: string, data: string, type: string}[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  // Interaction States
  const [toastMsg, setToastMsg] = useState<string | null>(null);
  const [feedbackModal, setFeedbackModal] = useState<{isOpen: boolean, messageId: string | null}>({ isOpen: false, messageId: null });
  const [connectionModalOpen, setConnectionModalOpen] = useState(false);
  const [playingMessageId, setPlayingMessageId] = useState<string | null>(null);
  const [voices, setVoices] = useState<SpeechSynthesisVoice[]>([]);

  // API Keys
  const [ilovePdfKeys, setIlovePdfKeys] = useState({ public: '', secret: ILOVEPDF_SECRET_KEY });


  // --- AUTH CHECK ON MOUNT ---
  useEffect(() => {
    const currentUser = getCurrentUser();
    if (currentUser) {
        setUser(currentUser);
    }
  }, []);

  // --- SESSION LOADING PER USER ---
  useEffect(() => {
    if (user) {
        const userSessions = getUserSessions(user.id);
        if (userSessions.length === 0) {
            // Create default session for new user
            const newId = uuidv4();
            const newSession: Session = {
                id: newId,
                title: 'New Chat',
                messages: [],
                activeModule: TaskModule.GENERAL,
                lastModified: Date.now()
            };
            setSessions([newSession]);
            setCurrentSessionId(newId);
            setMessages([]);
            saveUserSessions(user.id, [newSession]);
        } else {
            setSessions(userSessions);
            // Select most recent or first
            const activeSessions = userSessions.filter(s => !s.isDeleted);
            if (activeSessions.length > 0) {
                 setCurrentSessionId(activeSessions[0].id);
                 setMessages(activeSessions[0].messages);
                 setActiveModule(activeSessions[0].activeModule);
            } else {
                 // All deleted? Create new.
                 const newId = uuidv4();
                 const newSession = {
                    id: newId,
                    title: 'New Chat',
                    messages: [],
                    activeModule: TaskModule.GENERAL,
                    lastModified: Date.now()
                 };
                 setSessions([...userSessions, newSession]);
                 setCurrentSessionId(newId);
                 setMessages([]);
            }
        }
    }
  }, [user]);

  // --- SESSION SAVING ---
  useEffect(() => {
    if (user && sessions.length > 0) {
        saveUserSessions(user.id, sessions);
    }
  }, [sessions, user]);


  // Sync current messages to the active session object
  useEffect(() => {
    if (currentSessionId && messages.length > 0 && user) {
        setSessions(prev => prev.map(s => {
            if (s.id === currentSessionId) {
                return {
                    ...s,
                    messages: messages,
                    activeModule: activeModule,
                    lastModified: Date.now()
                };
            }
            return s;
        }));
    }
  }, [messages, activeModule, currentSessionId, user]);

  // Re-initialize chat when active module changes
  useEffect(() => {
    if (messages.length > 0) {
         const config = MODULES.find(m => m.id === activeModule);
         initializeChat(messages, config?.modelPreference || 'gemini-2.5-flash');
    }
  }, [activeModule]);

  // --- VOICE / TTS MANAGEMENT ---
  useEffect(() => {
    const loadVoices = () => {
      const availableVoices = window.speechSynthesis.getVoices();
      setVoices(availableVoices);
    };

    window.speechSynthesis.onvoiceschanged = loadVoices;
    loadVoices();
    
    return () => {
        window.speechSynthesis.cancel();
        window.speechSynthesis.onvoiceschanged = null;
    };
  }, []);

  const handlePlayVoice = (id: string, text: string) => {
    if (playingMessageId === id) {
        window.speechSynthesis.cancel();
        setPlayingMessageId(null);
        return;
    } 

    window.speechSynthesis.cancel();

    // Strip markdown formatting AND EMOJIS for cleaner speech
    const cleanText = text
        .replace(/[#*`_]/g, '') 
        .replace(/\[([^\]]+)\]\(([^)]+)\)/g, '$1') 
        .replace(/{{[^}]+}}/g, '') 
        .replace(/[\uD800-\uDBFF][\uDC00-\uDFFF]/g, '') 
        .replace(/[\u2700-\u27BF]/g, '') 
        .replace(/[\u2600-\u26FF]/g, '')
        .replace(/\uFE0F/g, '') 
        .trim();

    const utterance = new SpeechSynthesisUtterance(cleanText);
    
    const maleVoice = voices.find(v => 
        v.name.toLowerCase().includes('male') || 
        v.name.toLowerCase().includes('david') ||
        v.name.toLowerCase().includes('daniel')
    );

    if (maleVoice) {
        utterance.voice = maleVoice;
    }

    utterance.onend = () => setPlayingMessageId(null);
    utterance.onerror = () => setPlayingMessageId(null);
    
    window.speechSynthesis.speak(utterance);
    setPlayingMessageId(id);
  };

  const createNewSession = () => {
    const newId = uuidv4();
    const newSession: Session = {
        id: newId,
        title: 'New Chat',
        messages: [],
        activeModule: TaskModule.GENERAL,
        lastModified: Date.now()
    };
    
    setSessions(prev => [newSession, ...prev]);
    setCurrentSessionId(newId);
    setMessages([]);
    setActiveModule(TaskModule.GENERAL);
    initializeChat([], 'gemini-2.5-flash'); 
    setIsMobileMenuOpen(false);
    setSelectedFiles([]);
    window.speechSynthesis.cancel(); 
    setPlayingMessageId(null);
  };

  const switchSession = (sessionId: string) => {
    const session = sessions.find(s => s.id === sessionId);
    if (session) {
        setCurrentSessionId(session.id);
        setMessages(session.messages);
        setActiveModule(session.activeModule);
        
        const config = MODULES.find(m => m.id === session.activeModule);
        initializeChat(session.messages, config?.modelPreference || 'gemini-2.5-flash');
        setSelectedFiles([]);
        window.speechSynthesis.cancel(); 
        setPlayingMessageId(null);
    }
  };

  const handleRenameSession = (id: string, newTitle: string) => {
      setSessions(prev => prev.map(s => s.id === id ? { ...s, title: newTitle } : s));
  };

  const handleDeleteSession = (id: string) => {
      setSessions(prev => prev.map(s => s.id === id ? { ...s, isDeleted: true } : s));
      if (currentSessionId === id) {
          const remaining = sessions.filter(s => s.id !== id && !s.isDeleted);
          if (remaining.length > 0) {
              switchSession(remaining[0].id);
          } else {
              createNewSession();
          }
      }
  };

  const handleClearAll = () => {
      setSessions(prev => prev.map(s => ({...s, isDeleted: true})));
      resetSession();
      if (user) {
         const newId = uuidv4();
         const newSession = {
            id: newId,
            title: 'New Chat',
            messages: [],
            activeModule: TaskModule.GENERAL,
            lastModified: Date.now()
         };
         setSessions(prev => [newSession, ...prev]);
         setCurrentSessionId(newId);
         setMessages([]);
      }
  };
  
  const handleLogout = () => {
      logout();
      setUser(null);
      setSessions([]);
      setMessages([]);
      setIsProfileOpen(false);
  };

  // --- REACTION HANDLERS ---
  const handleLike = (messageId: string) => {
     setMessages(prev => prev.map(msg => 
         msg.id === messageId ? { ...msg, reaction: 'like' } : msg
     ));
     setToastMsg("Thank you, We glad you like it!");
  };

  const handleDislike = (messageId: string) => {
     setMessages(prev => prev.map(msg => 
         msg.id === messageId ? { ...msg, reaction: 'dislike' } : msg
     ));
     setFeedbackModal({ isOpen: true, messageId });
  };

  const handleFeedbackSubmit = (rating: number, text: string) => {
      if (feedbackModal.messageId) {
          setMessages(prev => prev.map(msg => 
              msg.id === feedbackModal.messageId ? { ...msg, feedback: `Rating: ${rating}, Comment: ${text}` } : msg
          ));
      }
      setToastMsg("Thanks for your Feedback, we'll try improving our tool for you!");
  };

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  useEffect(() => {
    inputRef.current?.focus();
  }, [activeModule]);

  // Updated to handle multiple files
  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (files && files.length > 0) {
      const filePromises = Array.from(files).map((item) => {
        const file = item as File;
        return new Promise<{name: string, data: string, type: string}>((resolve) => {
          const reader = new FileReader();
          reader.onloadend = () => {
              resolve({
                  name: file.name,
                  type: file.type, 
                  data: reader.result as string
              });
          };
          reader.readAsDataURL(file);
        });
      });

      Promise.all(filePromises).then(newFiles => {
          setSelectedFiles(prev => [...prev, ...newFiles]);
      });
    }
    // Reset to allow selecting same file again
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const removeFile = (index: number) => {
      setSelectedFiles(prev => prev.filter((_, i) => i !== index));
  };

  // --- CONVERTER BUTTON ACTIONS ---
  const handleConvertAction = async (targetFormat: 'PDF' | 'EXCEL' | 'WORD' | 'PPT') => {
      if (selectedFiles.length === 0 && targetFormat !== 'PDF') {
          if (!inputValue.trim()) {
              setToastMsg("Please upload files to convert.");
              return;
          }
      }

      setIsLoading(true);
      
      // User Message
      const userMsgId = uuidv4();
      const userMsg: Message = { 
          id: userMsgId, 
          role: Role.USER, 
          content: `Convert ${selectedFiles.length > 0 ? `${selectedFiles.length} files` : 'content'} to ${targetFormat}`, 
          timestamp: Date.now(), 
          attachments: selectedFiles 
      };
      setMessages(prev => [...prev, userMsg]);

      // If no files, process text content
      if (selectedFiles.length === 0) {
          const aiMsgId = uuidv4();
          setMessages(prev => [...prev, { id: aiMsgId, role: Role.MODEL, content: 'Initializing text conversion...', timestamp: Date.now(), isStreaming: true }]);
          // Simple single-flow for text
          try {
             let prompt = "";
             if (targetFormat === 'EXCEL') prompt = "Convert this text data strictly to CSV.";
             else if (targetFormat === 'WORD') prompt = "Convert this text to Markdown.";
             else if (targetFormat === 'PDF') prompt = "Convert this text to HTML.";
             else prompt = "Create presentation outline.";

             await sendMessageStream(
                prompt + "\n\n" + inputValue,
                MODULES.find(m => m.id === TaskModule.CONVERTER)?.contextParams,
                (chunk) => {
                    setMessages(prev => prev.map(msg => msg.id === aiMsgId ? { ...msg, content: msg.content + chunk } : msg));
                }
             );
             setMessages(prev => prev.map(msg => msg.id === aiMsgId ? { ...msg, isStreaming: false } : msg));
          } catch(e) {
              setMessages(prev => prev.map(msg => msg.id === aiMsgId ? { ...msg, content: "Conversion failed.", isStreaming: false } : msg));
          }
          setIsLoading(false);
          setInputValue('');
          return;
      }

      // Clear selection
      setSelectedFiles([]);
      setInputValue('');

      // Process each file
      for (const file of selectedFiles) {
          const aiMsgId = uuidv4();
          setMessages(prev => [...prev, { id: aiMsgId, role: Role.MODEL, content: `Processing ${file.name}...`, timestamp: Date.now(), isStreaming: true }]);

          let conversionSuccessful = false;
          
          // Map to iLovePDF tools
          const toolMap: Record<string, string> = {
            'EXCEL': 'pdfexcel',
            'WORD': 'pdfword',
            'PDF': 'officepdf',
            'PPT': 'pdfpowerpoint'
          };

          // 1. ATTEMPT ILOVEPDF
          if (ilovePdfKeys.public) {
              const tool = toolMap[targetFormat];
              if (tool) {
                  try {
                      setMessages(prev => prev.map(msg => msg.id === aiMsgId ? { ...msg, content: `Converting ${file.name} with iLovePDF...` } : msg));
                      const result = await convertWithILovePDF(file.data, file.name, tool, ilovePdfKeys.public, ilovePdfKeys.secret);
                      setMessages(prev => prev.map(msg => 
                          msg.id === aiMsgId ? {
                              ...msg,
                              content: `Successfully converted ${file.name} to ${result.filename}.`,
                              isStreaming: false,
                              downloadData: { fileName: result.filename, data: result.data, mimeType: result.mimeType }
                          } : msg
                      ));
                      conversionSuccessful = true;
                  } catch (e) {
                      console.warn(`iLovePDF failed for ${file.name}`, e);
                  }
              }
          }

          if (conversionSuccessful) continue;

          // 2. FALLBACK TO GEMINI
          setMessages(prev => prev.map(msg => msg.id === aiMsgId ? { ...msg, content: `Converting ${file.name} with AI...` } : msg));

          let prompt = "";
          if (targetFormat === 'EXCEL') {
              prompt = "Extract all tabular data from the attached file. Output strictly as CSV.";
          } else if (targetFormat === 'WORD') {
              prompt = "Extract content from the attached file into Markdown.";
          } else if (targetFormat === 'PDF') {
              prompt = "Analyze file and recreate as semantic HTML for printing.";
          } else {
              prompt = "Create presentation outline.";
          }

          try {
              let gatheredText = '';
              const serviceAttachments = [{ data: file.data, mimeType: file.type }];
              
              await sendMessageStream(
                  prompt,
                  MODULES.find(m => m.id === TaskModule.CONVERTER)?.contextParams,
                  (chunk) => { gatheredText += chunk; },
                  serviceAttachments
              );

              let downloadData = undefined;
              let responseContent = `Converted ${file.name}.`;

              if (targetFormat === 'EXCEL') {
                  const cleanCsv = gatheredText.replace(/```csv/g, '').replace(/```/g, '').trim();
                  downloadData = { fileName: file.name.replace(/\.[^/.]+$/, "") + ".csv", data: cleanCsv, mimeType: "text/csv" };
              } else if (targetFormat === 'WORD') {
                  const cleanMd = gatheredText.replace(/```markdown/g, '').replace(/```/g, '').trim();
                  downloadData = { fileName: file.name.replace(/\.[^/.]+$/, "") + ".md", data: cleanMd, mimeType: "text/markdown" };
              } else if (targetFormat === 'PDF') {
                  const cleanHtml = gatheredText.replace(/```html/g, '').replace(/```/g, '').trim();
                  downloadData = { fileName: file.name.replace(/\.[^/.]+$/, "") + ".pdf", data: cleanHtml, mimeType: "text/html" };
              }

              setMessages(prev => prev.map(msg => 
                  msg.id === aiMsgId ? { ...msg, content: responseContent, isStreaming: false, downloadData: downloadData } : msg
              ));

          } catch (e) {
              setMessages(prev => prev.map(msg => msg.id === aiMsgId ? { ...msg, content: `Failed to convert ${file.name}.`, isStreaming: false } : msg));
          }
      }

      setIsLoading(false);
  };


  const parseMediaTags = (text: string) => {
    const imgMatch = text.match(/{{IMAGE:\s*(.*?)}}/);
    const videoMatch = text.match(/{{VIDEO:\s*(.*?)}}/);
    const audioMatch = text.match(/{{AUDIO:\s*(.*?)}}/);

    if (imgMatch) return { type: 'IMAGE', prompt: imgMatch[1], cleanText: text.replace(imgMatch[0], '') };
    if (videoMatch) return { type: 'VIDEO', prompt: videoMatch[1], cleanText: text.replace(videoMatch[0], '') };
    if (audioMatch) return { type: 'AUDIO', prompt: audioMatch[1], cleanText: text.replace(audioMatch[0], '') };
    
    return { type: 'TEXT', prompt: '', cleanText: text };
  };

  const handleSendMessage = async (forceExecution = false) => {
    // Allow sending if file is selected OR input is not empty
    const hasContent = inputValue.trim().length > 0 || selectedFiles.length > 0;
    if ((!hasContent && !forceExecution) || isLoading) return;

    const userMsgText = inputValue.trim();
    if (!forceExecution) setInputValue('');
    setIsLoading(true);
    
    // Add user message
    if (!forceExecution) {
        const userMsgId = uuidv4();
        const newUserMsg: Message = {
          id: userMsgId,
          role: Role.USER,
          content: userMsgText,
          timestamp: Date.now(),
          attachments: selectedFiles // Attach array
        };
        setMessages(prev => [...prev, newUserMsg]);
    }
    
    // --- Auto-Title Generation ---
    const currentSession = sessions.find(s => s.id === currentSessionId);
    if (currentSession && (currentSession.title === 'New Chat' || currentSession.messages.length === 0)) {
       if (userMsgText) {
          generateChatTitle(userMsgText).then(newTitle => {
             setSessions(prev => prev.map(s => s.id === currentSessionId ? { ...s, title: newTitle } : s));
          });
       }
    }

    // --- Image Generation ---
    if (activeModule === TaskModule.IMAGE_GEN) {
      const aiMsgId = uuidv4();
      const initialAiMsg: Message = { id: aiMsgId, role: Role.MODEL, content: 'Generating image...', timestamp: Date.now(), isStreaming: true };
      setMessages(prev => [...prev, initialAiMsg]);
      try {
        const result = await generateImage(userMsgText, imageSize);
        setMessages(prev => prev.map(msg => msg.id === aiMsgId ? { ...msg, content: `Here is your ${imageSize} generated image for: "${userMsgText}"`, mediaUrl: result.imageUrl, mediaType: 'image', isStreaming: false } : msg));
      } catch (e) {
        setMessages(prev => prev.map(msg => msg.id === aiMsgId ? { ...msg, content: "Failed to generate image.", isStreaming: false } : msg));
      }
      setIsLoading(false);
      return;
    }

    // --- Video Generation ---
    if (activeModule === TaskModule.VIDEO_GEN) {
        const aiMsgId = uuidv4();
        const initialAiMsg: Message = { id: aiMsgId, role: Role.MODEL, content: 'Generating video with Veo...', timestamp: Date.now(), isStreaming: true };
        setMessages(prev => [...prev, initialAiMsg]);
        try {
          // Use first image if multiple
          const imgData = selectedFiles.length > 0 ? selectedFiles[0].data : undefined;
          const result = await generateVideo(userMsgText, videoAspectRatio, imgData);
          setMessages(prev => prev.map(msg => msg.id === aiMsgId ? { ...msg, content: `Video generated successfully!`, mediaUrl: result.videoUrl, mediaType: 'video', isStreaming: false } : msg));
        } catch (e) {
          setMessages(prev => prev.map(msg => msg.id === aiMsgId ? { ...msg, content: "Failed to generate video.", isStreaming: false } : msg));
        }
        setSelectedFiles([]);
        setIsLoading(false);
        return;
    }

    // --- Text to Speech ---
    if (activeModule === TaskModule.TEXT_TO_SPEECH) {
        const aiMsgId = uuidv4();
        const initialAiMsg: Message = { id: aiMsgId, role: Role.MODEL, content: 'Generating speech...', timestamp: Date.now(), isStreaming: true };
        setMessages(prev => [...prev, initialAiMsg]);
        try {
            const result = await generateSpeech(userMsgText);
            setMessages(prev => prev.map(msg => msg.id === aiMsgId ? { ...msg, content: `Audio generated for: "${userMsgText}"`, audioUrl: result.audioUrl, mediaType: 'audio', isStreaming: false } : msg));
        } catch (e) {
            setMessages(prev => prev.map(msg => msg.id === aiMsgId ? { ...msg, content: "Failed to generate speech.", isStreaming: false } : msg));
        }
        setIsLoading(false);
        return;
    }

    // --- Default / Converter / Text / Image Analysis ---
    const aiMsgId = uuidv4();
    const initialAiMsg: Message = {
      id: aiMsgId,
      role: Role.MODEL,
      content: '', 
      timestamp: Date.now(),
      isStreaming: true
    };
    setMessages(prev => [...prev, initialAiMsg]);

    try {
      const currentModuleConfig = MODULES.find(m => m.id === activeModule);
      
      let gatheredText = '';
      
      // Map to service attachments format
      const serviceAttachments = selectedFiles.map(f => ({ data: f.data, mimeType: f.type }));

      await sendMessageStream(
        userMsgText, 
        currentModuleConfig?.contextParams,
        (chunk) => {
            gatheredText += chunk;
            setMessages(prev => prev.map(msg => 
                msg.id === aiMsgId 
                ? { ...msg, content: gatheredText } 
                : msg
            ));
        },
        serviceAttachments
      );

      // Check for media tags in standard response
      const mediaCheck = parseMediaTags(gatheredText);
      if (mediaCheck.type !== 'TEXT') {
          setMessages(prev => prev.map(msg => msg.id === aiMsgId ? { ...msg, content: mediaCheck.cleanText } : msg));
          if (mediaCheck.type === 'IMAGE') {
              const imgResult = await generateImage(mediaCheck.prompt);
              setMessages(prev => prev.map(msg => msg.id === aiMsgId ? { ...msg, mediaUrl: imgResult.imageUrl, mediaType: 'image' } : msg));
          } else if (mediaCheck.type === 'VIDEO') {
              const vidResult = await generateVideo(mediaCheck.prompt, '16:9');
              setMessages(prev => prev.map(msg => msg.id === aiMsgId ? { ...msg, mediaUrl: vidResult.videoUrl, mediaType: 'video' } : msg));
          } else if (mediaCheck.type === 'AUDIO') {
              const audResult = await generateSpeech(mediaCheck.prompt);
              setMessages(prev => prev.map(msg => msg.id === aiMsgId ? { ...msg, audioUrl: audResult.audioUrl, mediaType: 'audio' } : msg));
          }
      }

      setMessages(prev => prev.map(msg => 
        msg.id === aiMsgId 
        ? { ...msg, isStreaming: false } 
        : msg
      ));

    } catch (error) {
      console.error(error);
      setMessages(prev => prev.map(msg => 
        msg.id === aiMsgId 
        ? { ...msg, content: "Execution failed. Please check your connection or API key.", isStreaming: false } 
        : msg
      ));
    } finally {
      setSelectedFiles([]); 
      setIsLoading(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      if (inputValue.trim() || selectedFiles.length > 0) {
        handleSendMessage();
      }
    }
  };

  const isWelcomeScreen = messages.length === 0;

  if (!user) {
      return <LoginScreen onLoginSuccess={setUser} />;
  }

  // --- RENDER: MAIN APP ---
  return (
    <div className="flex h-screen bg-gray-50 text-gray-900 font-sans overflow-hidden relative">
      <Sidebar 
        sessions={sessions.filter(s => !s.isDeleted)}
        currentSessionId={currentSessionId}
        onSelectSession={switchSession}
        onNewSession={createNewSession}
        onClearAll={handleClearAll}
        isMobileOpen={isMobileMenuOpen}
        setIsMobileOpen={setIsMobileMenuOpen}
        onRenameSession={handleRenameSession}
        onDeleteSession={handleDeleteSession}
        onOpenConnections={() => setConnectionModalOpen(true)}
      />

      {/* Main Content */}
      <main className="flex-1 flex flex-col h-full relative w-full bg-white md:shadow-none overflow-hidden">
        
        {/* Header */}
        <header className="flex items-center justify-between px-6 py-4 bg-white z-10 sticky top-0">
            {/* Mobile Menu */}
            <div className="md:hidden">
              <button onClick={() => setIsMobileMenuOpen(true)}>
                 {Icons.List}
              </button>
            </div>

            {/* Center Pill */}
            <div className="flex-1 flex justify-center">
                <div className="relative">
                    <button 
                        onClick={() => setIsModuleMenuOpen(!isModuleMenuOpen)}
                        className="flex items-center gap-2 px-4 py-2 bg-gray-50 hover:bg-gray-100 rounded-full transition-colors text-sm font-medium text-gray-700 border border-gray-100"
                    >
                         <span className="text-sky-500">
                            {React.cloneElement(MODULES.find(m => m.id === activeModule)?.icon as React.ReactElement, { size: 16 } as any)}
                         </span>
                         {MODULES.find(m => m.id === activeModule)?.label || "New Session"}
                         <svg className={`w-3 h-3 text-gray-400 transition-transform ${isModuleMenuOpen ? 'rotate-180' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                         </svg>
                    </button>

                    {/* Dropdown */}
                    {isModuleMenuOpen && (
                        <>
                            <div className="fixed inset-0 z-10" onClick={() => setIsModuleMenuOpen(false)}></div>
                            <div className="absolute top-full left-1/2 -translate-x-1/2 mt-2 w-56 bg-white rounded-xl shadow-xl border border-gray-100 z-20 py-2 animate-in fade-in zoom-in-95 duration-100 max-h-[60vh] overflow-y-auto">
                                <div className="px-3 py-2 text-xs font-semibold text-gray-400 uppercase tracking-wider">Select Mode</div>
                                {MODULES.map(module => (
                                    <button
                                        key={module.id}
                                        onClick={() => {
                                            setActiveModule(module.id);
                                            setIsModuleMenuOpen(false);
                                        }}
                                        className={`w-full text-left px-4 py-2.5 text-sm flex items-center gap-3 hover:bg-gray-50 transition-colors
                                            ${activeModule === module.id ? 'text-sky-500 font-medium bg-sky-50/50' : 'text-gray-700'}
                                        `}
                                    >
                                        <span className={activeModule === module.id ? 'text-sky-500' : 'text-gray-400'}>
                                            {React.cloneElement(module.icon as React.ReactElement, { width: 16, height: 16 } as any)}
                                        </span>
                                        {module.label}
                                    </button>
                                ))}
                            </div>
                        </>
                    )}
                </div>
            </div>

            {/* Right Icons */}
            <div className="flex items-center gap-4 text-gray-400">
                <button className="hidden md:block hover:text-amber-400 transition-colors">{Icons.Star}</button>
                <div className="relative">
                    <button 
                        onClick={() => setIsProfileOpen(!isProfileOpen)}
                        className="hover:text-gray-600 transition-colors flex items-center"
                    >
                        {user.avatar ? (
                            <img src={user.avatar} alt="Profile" className="w-8 h-8 rounded-full border border-gray-200" />
                        ) : (
                            Icons.User
                        )}
                    </button>
                    {isProfileOpen && (
                        <>
                        <div className="fixed inset-0 z-10" onClick={() => setIsProfileOpen(false)}></div>
                        <div className="absolute top-full right-0 mt-2 w-48 bg-white rounded-xl shadow-xl border border-gray-100 z-20 py-1 animate-in fade-in zoom-in-95 duration-100">
                            <div className="px-4 py-3 border-b border-gray-50">
                                <div className="text-sm font-medium text-gray-900 truncate">{user.name}</div>
                                <div className="text-xs text-gray-500 truncate">{user.email}</div>
                            </div>
                            <button onClick={handleLogout} className="w-full text-left px-4 py-2 text-sm text-red-500 hover:bg-gray-50 flex items-center gap-2">
                                {Icons.LogOut} Sign Out
                            </button>
                        </div>
                        </>
                    )}
                </div>
            </div>
        </header>

        {/* Dynamic Content Area */}
        {isWelcomeScreen ? (
          /* Welcome State (Centered) */
          <div className="flex-1 flex flex-col items-center justify-center p-6 -mt-20">
             <div className="mb-6 text-sky-400 bg-sky-50 p-4 rounded-full border border-sky-100">
               {Icons.Robot}
             </div>
             
             <h2 className="text-2xl font-light text-gray-800 mb-8 tracking-tight">
               Hello <span className="text-sky-500 font-medium">{user.name.split(' ')[0]}</span>, How can I help you today?
             </h2>

             <div className="w-full max-w-2xl relative group">
                <textarea
                  ref={inputRef}
                  value={inputValue}
                  onChange={(e) => setInputValue(e.target.value)}
                  onKeyDown={handleKeyDown}
                  placeholder="Ask SwiftMind"
                  className="w-full bg-white text-gray-800 rounded-2xl pl-16 pr-14 py-5 focus:outline-none focus:ring-1 focus:ring-sky-200 border border-gray-200 resize-none h-[72px] shadow-sm transition-all placeholder:text-gray-300 text-lg"
                  rows={1}
                />
                
                {/* Plus Attachment Button */}
                <button
                    onClick={() => fileInputRef.current?.click()}
                    className="absolute left-4 top-1/2 -translate-y-1/2 w-8 h-8 flex items-center justify-center bg-gray-100 hover:bg-gray-200 text-gray-500 rounded-full transition-colors"
                    title="Attach Anything"
                >
                    {Icons.Plus}
                </button>
                <input 
                   type="file" 
                   ref={fileInputRef} 
                   className="hidden" 
                   accept="*"
                   multiple
                   onChange={handleFileUpload}
                />

                <button
                  onClick={() => handleSendMessage()}
                  disabled={isLoading || (!inputValue.trim() && selectedFiles.length === 0)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 p-2.5 text-sky-400 hover:text-sky-600 disabled:opacity-30 disabled:cursor-not-allowed transition-all"
                >
                  {Icons.Send}
                </button>
             </div>

             {/* Selected File Pills (Welcome Screen) */}
             {selectedFiles.length > 0 && (
                 <div className="mt-3 flex flex-wrap gap-2 justify-center max-w-2xl">
                     {selectedFiles.map((file, idx) => (
                        <div key={idx} className="flex items-center gap-2 bg-white border border-gray-200 px-3 py-1.5 rounded-lg shadow-sm">
                            <span className="text-xs font-medium text-gray-700 max-w-[150px] truncate">{file.name}</span>
                            <button onClick={() => removeFile(idx)} className="text-gray-400 hover:text-red-500 transition-colors">
                                {Icons.X}
                            </button>
                        </div>
                     ))}
                 </div>
             )}
             
             <div className="mt-8 flex gap-3 overflow-x-auto max-w-full pb-2 px-2 scrollbar-hide">
                <button 
                  onClick={() => { setActiveModule(TaskModule.CONVERTER); }}
                  className="px-4 py-2 bg-white border border-gray-100 rounded-xl text-sm text-gray-500 hover:border-sky-200 hover:text-sky-500 hover:shadow-sm transition-all whitespace-nowrap flex items-center gap-2"
                >
                  {Icons.RefreshCw} Convert Files
                </button>
                <button 
                  onClick={() => { setActiveModule(TaskModule.IMAGE_GEN); setInputValue("Generate an image of "); inputRef.current?.focus(); }}
                  className="px-4 py-2 bg-white border border-gray-100 rounded-xl text-sm text-gray-500 hover:border-sky-200 hover:text-sky-500 hover:shadow-sm transition-all whitespace-nowrap"
                >
                  🎨 Create Image
                </button>
                <button 
                   onClick={() => { setActiveModule(TaskModule.VIDEO_GEN); setInputValue("Generate a video of "); inputRef.current?.focus(); }}
                   className="px-4 py-2 bg-white border border-gray-100 rounded-xl text-sm text-gray-500 hover:border-sky-200 hover:text-sky-500 hover:shadow-sm transition-all whitespace-nowrap"
                >
                  🎬 Create Video
                </button>
             </div>
          </div>
        ) : (
          /* Chat State (Standard) */
          <>
            <div className="flex-1 overflow-y-auto p-4 md:px-20 md:py-8 scroll-smooth bg-white">
              <div className="max-w-4xl mx-auto space-y-6 pb-4">
                {messages.map((msg) => (
                  <ChatMessage 
                    key={msg.id} 
                    message={msg} 
                    onLike={handleLike}
                    onDislike={handleDislike}
                    onPlayVoice={handlePlayVoice}
                    isVoicePlaying={playingMessageId === msg.id}
                  />
                ))}
                <div ref={messagesEndRef} />
              </div>
            </div>

            {/* Input Area (Bottom) */}
            <div className="p-4 bg-white border-t border-gray-50">
              <div className="max-w-4xl mx-auto">
                {/* Converter Bar - Shows when Converter Module is Active */}
                {activeModule === TaskModule.CONVERTER && (
                    <div className="mb-3 p-2 bg-sky-50 border border-sky-100 rounded-xl flex items-center justify-between flex-wrap gap-2 animate-in slide-in-from-bottom-2">
                        <div className="flex items-center gap-2 text-sky-700 text-sm font-medium px-2">
                            {Icons.RefreshCw}
                            <span>Convert {selectedFiles.length > 0 ? `${selectedFiles.length} files` : 'Files'} to:</span>
                        </div>
                        <div className="flex items-center gap-2">
                            <button onClick={() => handleConvertAction('PDF')} className="px-3 py-1.5 bg-white border border-sky-200 text-sky-600 rounded-lg text-xs font-semibold hover:bg-sky-500 hover:text-white transition-all shadow-sm flex items-center gap-1">
                                {Icons.FileTypePdf} PDF
                            </button>
                            <button onClick={() => handleConvertAction('EXCEL')} className="px-3 py-1.5 bg-white border border-sky-200 text-sky-600 rounded-lg text-xs font-semibold hover:bg-sky-500 hover:text-white transition-all shadow-sm flex items-center gap-1">
                                {Icons.FileSpreadsheet} Excel
                            </button>
                            <button onClick={() => handleConvertAction('WORD')} className="px-3 py-1.5 bg-white border border-sky-200 text-sky-600 rounded-lg text-xs font-semibold hover:bg-sky-500 hover:text-white transition-all shadow-sm flex items-center gap-1">
                                {Icons.FileTypeDoc} Word
                            </button>
                            <button onClick={() => handleConvertAction('PPT')} className="px-3 py-1.5 bg-white border border-sky-200 text-sky-600 rounded-lg text-xs font-semibold hover:bg-sky-500 hover:text-white transition-all shadow-sm flex items-center gap-1">
                                {Icons.Presentation} PPT
                            </button>
                        </div>
                    </div>
                )}

                <div className="flex flex-col gap-2 mb-2 px-1">
                  {/* Selected Files List */}
                  {selectedFiles.length > 0 && (
                    <div className="flex flex-wrap gap-2 max-h-[100px] overflow-y-auto scrollbar-hide animate-in fade-in slide-in-from-bottom-2">
                        {selectedFiles.map((file, idx) => (
                            <div key={idx} className="flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-medium border bg-sky-50 border-sky-200 text-sky-600 transition-colors">
                                <span className="max-w-[150px] truncate">{file.name}</span>
                                <button 
                                    onClick={(e) => { e.stopPropagation(); removeFile(idx); }}
                                    className="ml-1 hover:text-red-500"
                                >
                                    {Icons.X}
                                </button>
                            </div>
                        ))}
                    </div>
                  )}

                  <div className="flex items-center gap-3">
                    {activeModule === TaskModule.IMAGE_GEN && (
                        <div className="flex bg-gray-50 p-1 rounded-lg">
                        {(['1K', '2K', '4K'] as const).map(size => (
                            <button key={size} onClick={() => setImageSize(size)} className={`px-2 py-0.5 rounded text-[10px] font-medium transition-all ${imageSize === size ? 'bg-white shadow text-sky-500' : 'text-gray-400'}`}>{size}</button>
                        ))}
                        </div>
                    )}
                    {activeModule === TaskModule.VIDEO_GEN && (
                        <div className="flex bg-gray-50 p-1 rounded-lg">
                        {(['16:9', '9:16'] as const).map(ratio => (
                            <button key={ratio} onClick={() => setVideoAspectRatio(ratio)} className={`px-2 py-0.5 rounded text-[10px] font-medium transition-all ${videoAspectRatio === ratio ? 'bg-white shadow text-sky-500' : 'text-gray-400'}`}>{ratio}</button>
                        ))}
                        </div>
                    )}
                  </div>
                </div>

                <div className="relative group">
                  <textarea
                    ref={inputRef}
                    value={inputValue}
                    onChange={(e) => setInputValue(e.target.value)}
                    onKeyDown={handleKeyDown}
                    placeholder={activeModule === TaskModule.CONVERTER ? "Upload files or paste text to convert..." : "Type a command..."}
                    className="w-full bg-gray-50 text-gray-800 rounded-2xl pl-14 pr-14 py-4 focus:outline-none focus:bg-white focus:ring-1 focus:ring-sky-200 border border-transparent focus:border-gray-200 resize-none h-[60px] max-h-[150px] overflow-y-auto scrollbar-hide transition-all placeholder:text-gray-400"
                    rows={1}
                  />

                  {/* Plus Attachment Button - Chat Mode */}
                  <button
                    onClick={() => fileInputRef.current?.click()}
                    className="absolute left-3 top-1/2 -translate-y-1/2 w-8 h-8 flex items-center justify-center text-gray-400 hover:text-sky-500 hover:bg-gray-100 rounded-full transition-all"
                    title="Attach Anything"
                  >
                    {Icons.Plus}
                  </button>
                  <input 
                    type="file" 
                    ref={fileInputRef} 
                    className="hidden" 
                    accept="*" 
                    multiple
                    onChange={handleFileUpload} 
                  />

                  <button
                    onClick={() => handleSendMessage()}
                    disabled={isLoading || (!inputValue.trim() && selectedFiles.length === 0)}
                    className="absolute right-2 top-1/2 -translate-y-1/2 p-2.5 text-sky-400 hover:text-sky-600 disabled:opacity-30 disabled:cursor-not-allowed transition-all"
                  >
                    {Icons.Send}
                  </button>
                </div>
                <div className="text-center mt-2">
                     <p className="text-[10px] text-gray-300">SwiftMind AI can make mistakes. Verify important information.</p>
                </div>
              </div>
            </div>
          </>
        )}
      </main>

      {/* Global Overlays */}
      <Toast message={toastMsg} onClose={() => setToastMsg(null)} />
      
      <FeedbackModal 
        isOpen={feedbackModal.isOpen} 
        onClose={() => setFeedbackModal({ ...feedbackModal, isOpen: false })}
        onSubmit={handleFeedbackSubmit}
      />

      <ConnectionModal
        isOpen={connectionModalOpen}
        onClose={() => setConnectionModalOpen(false)}
        ilovePdfKeys={ilovePdfKeys}
        onSave={setIlovePdfKeys}
      />
    </div>
  );
};

export default App;