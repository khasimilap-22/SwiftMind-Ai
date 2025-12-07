import React, { useState } from 'react';
import { Icons } from '../constants';
import { UserProfile } from '../types';
import { login, switchAccount, getAvailableAccounts } from '../services/userService';

interface LoginScreenProps {
  onLoginSuccess: (user: UserProfile) => void;
}

const LoginScreen: React.FC<LoginScreenProps> = ({ onLoginSuccess }) => {
  const [view, setView] = useState<'welcome' | 'form' | 'accounts'>('welcome');
  const [email, setEmail] = useState('');
  const [name, setName] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const accounts = getAvailableAccounts();

  const handleCreateAccount = (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !name) return;
    setIsLoading(true);
    
    // Simulate network delay
    setTimeout(() => {
      const user = login(email, name);
      onLoginSuccess(user);
      setIsLoading(false);
    }, 1000);
  };

  const handleAccountSelect = (userId: string) => {
    setIsLoading(true);
    setTimeout(() => {
        const user = switchAccount(userId);
        if (user) onLoginSuccess(user);
        setIsLoading(false);
    }, 500);
  };

  // View: Welcome / Landing
  if (view === 'welcome') {
      return (
        <div className="flex min-h-screen items-center justify-center bg-gray-50 p-4 font-sans">
          <div className="w-full max-w-md bg-white rounded-2xl shadow-xl p-8 border border-gray-100 text-center animate-in fade-in zoom-in-95 duration-300">
            <div className="mx-auto w-16 h-16 bg-sky-50 text-sky-500 rounded-2xl flex items-center justify-center mb-6">
              {React.cloneElement(Icons.Robot as React.ReactElement, { width: 32, height: 32 })}
            </div>
            
            <h1 className="text-2xl font-semibold text-gray-900 mb-2">Welcome to SwiftMind</h1>
            <p className="text-gray-500 mb-8 text-sm">The hyper-fast AI execution engine for professionals.</p>
    
            <div className="space-y-3">
              <button 
                onClick={() => accounts.length > 0 ? setView('accounts') : setView('form')}
                className="w-full flex items-center justify-center gap-3 bg-white border border-gray-300 hover:bg-gray-50 text-gray-700 font-medium py-3 px-4 rounded-lg transition-all shadow-sm group"
              >
                {Icons.Google}
                <span>Sign in with Google</span>
              </button>
            </div>
            
            <p className="mt-8 text-xs text-gray-400">
                This is a demo application. Authentication is simulated locally.
            </p>
          </div>
        </div>
      );
  }

  // View: Account Selector (Simulates "Choose an account")
  if (view === 'accounts') {
      return (
        <div className="flex min-h-screen items-center justify-center bg-gray-50 p-4 font-sans">
          <div className="w-full max-w-md bg-white rounded-2xl shadow-xl overflow-hidden border border-gray-100 animate-in slide-in-from-right-8 duration-300">
             <div className="p-6 border-b border-gray-100">
                 <h2 className="text-xl font-semibold text-gray-800">Choose an account</h2>
                 <p className="text-sm text-gray-500">to continue to SwiftMind</p>
             </div>
             
             <div className="max-h-[300px] overflow-y-auto">
                 {accounts.map(acc => (
                     <button 
                        key={acc.id}
                        onClick={() => handleAccountSelect(acc.id)}
                        className="w-full flex items-center gap-4 p-4 hover:bg-gray-50 transition-colors text-left border-b border-gray-50 last:border-0"
                     >
                         <img src={acc.avatar} alt={acc.name} className="w-10 h-10 rounded-full" />
                         <div>
                             <div className="font-medium text-gray-800">{acc.name}</div>
                             <div className="text-sm text-gray-500">{acc.email}</div>
                         </div>
                     </button>
                 ))}
                 
                 <button 
                    onClick={() => setView('form')}
                    className="w-full flex items-center gap-4 p-4 hover:bg-gray-50 transition-colors text-left text-gray-600"
                 >
                     <div className="w-10 h-10 rounded-full bg-gray-100 flex items-center justify-center text-gray-500">
                        {Icons.Plus}
                     </div>
                     <span className="font-medium">Use another account</span>
                 </button>
             </div>
          </div>
        </div>
      );
  }

  // View: Login Form (Simulates "Sign in with Google" popup)
  return (
    <div className="flex min-h-screen items-center justify-center bg-gray-50 p-4 font-sans">
      <div className="w-full max-w-md bg-white rounded-2xl shadow-xl p-8 border border-gray-100 animate-in slide-in-from-right-8 duration-300 relative">
        <button 
            onClick={() => accounts.length > 0 ? setView('accounts') : setView('welcome')}
            className="absolute top-4 left-4 p-2 text-gray-400 hover:text-gray-600"
        >
            ← Back
        </button>

        <div className="text-center mb-8 mt-4">
            <div className="mx-auto w-12 h-12 mb-4 flex items-center justify-center">
                {Icons.Google}
            </div>
            <h2 className="text-xl font-semibold text-gray-900">Sign in</h2>
            <p className="text-sm text-gray-500">Use your Google Account</p>
        </div>

        <form onSubmit={handleCreateAccount} className="space-y-4">
          <div>
            <input
              type="text"
              required
              placeholder="Name (e.g., John Doe)"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full px-4 py-3 rounded-lg border border-gray-300 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all placeholder:text-gray-400"
            />
          </div>
          <div>
            <input
              type="email"
              required
              placeholder="Email or phone"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full px-4 py-3 rounded-lg border border-gray-300 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all placeholder:text-gray-400"
            />
          </div>

          <div className="text-sm text-blue-600 hover:underline cursor-pointer">
            Forgot email?
          </div>

          <div className="pt-4 flex justify-end gap-3">
             <button
               type="button"
               onClick={() => setView('welcome')}
               className="px-6 py-2 text-blue-600 font-medium hover:bg-blue-50 rounded-full transition-colors"
             >
               Cancel
             </button>
             <button
               type="submit"
               disabled={isLoading}
               className="px-6 py-2 bg-blue-600 text-white font-medium rounded-full hover:bg-blue-700 transition-colors shadow-sm disabled:opacity-70"
             >
               {isLoading ? 'Signing in...' : 'Next'}
             </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default LoginScreen;
