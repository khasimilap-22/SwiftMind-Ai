import React from 'react';

export enum Role {
  USER = 'user',
  MODEL = 'model',
  SYSTEM = 'system'
}

export interface UserProfile {
  id: string;
  name: string;
  email: string;
  avatar: string; // URL or base64
}

export interface Message {
  id: string;
  role: Role;
  content: string;
  timestamp: number;
  isStreaming?: boolean;
  mediaUrl?: string; // For generated images/videos
  audioUrl?: string; // For generated speech
  mediaType?: 'image' | 'video' | 'audio';
  attachments?: { // For user uploads (Updated to array)
    name: string;
    type: string;
    data: string; // base64
  }[];
  reaction?: 'like' | 'dislike';
  feedback?: string;
  downloadData?: { // For generated files (converter)
    fileName: string;
    data: string;
    mimeType: string;
  };
}

export interface Session {
  id: string;
  title: string;
  messages: Message[];
  activeModule: TaskModule;
  lastModified: number;
  isDeleted?: boolean; // Soft delete flag
}

export enum TaskModule {
  GENERAL = 'General',
  SUMMARIZER = 'Summarizer',
  WRITER = 'Writer',
  INVOICE = 'Invoice',
  CONVERTER = 'Converter',
  TRANSLATOR = 'Translator',
  LISTS = 'Lists',
  BUSINESS_CALC = 'Business Calc',
  IMAGE_GEN = 'Image Generator',
  VIDEO_GEN = 'Video Generator',
  TEXT_TO_SPEECH = 'Text to Speech',
  IMAGE_ANALYSIS = 'Image Analysis'
}

export interface ModuleConfig {
  id: TaskModule;
  icon: React.ReactNode;
  label: string;
  description: string;
  contextParams: string;
  modelPreference?: string; // Optional override for specific model
}