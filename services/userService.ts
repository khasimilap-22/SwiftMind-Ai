import { UserProfile, Session } from '../types';
import { v4 as uuidv4 } from 'uuid';

const USERS_KEY = 'swiftmind_users';
const CURRENT_USER_KEY = 'swiftmind_current_user_id';
const SESSIONS_PREFIX = 'swiftmind_sessions_';

// Retrieve all registered users
const getUsers = (): UserProfile[] => {
  const usersJson = localStorage.getItem(USERS_KEY);
  return usersJson ? JSON.parse(usersJson) : [];
};

// Save users list
const saveUsers = (users: UserProfile[]) => {
  localStorage.setItem(USERS_KEY, JSON.stringify(users));
};

// --- AUTHENTICATION METHODS ---

export const login = (email: string, name: string): UserProfile => {
  const users = getUsers();
  let user = users.find(u => u.email.toLowerCase() === email.toLowerCase());

  if (!user) {
    // Register new user (simulate Google Account Creation)
    user = {
      id: uuidv4(),
      name: name,
      email: email,
      avatar: `https://ui-avatars.com/api/?name=${encodeURIComponent(name)}&background=0ea5e9&color=fff&rounded=true&bold=true`
    };
    users.push(user);
    saveUsers(users);
  }

  // Set as current user
  localStorage.setItem(CURRENT_USER_KEY, user.id);
  return user;
};

export const logout = () => {
  localStorage.removeItem(CURRENT_USER_KEY);
};

export const getCurrentUser = (): UserProfile | null => {
  const currentId = localStorage.getItem(CURRENT_USER_KEY);
  if (!currentId) return null;

  const users = getUsers();
  return users.find(u => u.id === currentId) || null;
};

export const getAvailableAccounts = (): UserProfile[] => {
  return getUsers();
};

export const switchAccount = (userId: string): UserProfile | null => {
  const users = getUsers();
  const user = users.find(u => u.id === userId);
  if (user) {
    localStorage.setItem(CURRENT_USER_KEY, user.id);
    return user;
  }
  return null;
};

// --- SESSION MANAGEMENT METHODS ---

export const getUserSessions = (userId: string): Session[] => {
  const sessionsJson = localStorage.getItem(`${SESSIONS_PREFIX}${userId}`);
  return sessionsJson ? JSON.parse(sessionsJson) : [];
};

export const saveUserSessions = (userId: string, sessions: Session[]) => {
  localStorage.setItem(`${SESSIONS_PREFIX}${userId}`, JSON.stringify(sessions));
};
