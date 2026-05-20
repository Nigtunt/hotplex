'use client';

import { useState, useEffect, useCallback } from 'react';
import { getApiKey, setApiKey, getWsUrl, setWsUrl } from '@/lib/config';

export interface ChatConfig {
  apiKey: string;
  wsUrl: string;
}

export function useChatConfig(): {
  apiKey: string;
  wsUrl: string;
  setApiKey: (key: string) => void;
  setWsUrl: (url: string) => void;
  isConfigured: boolean;
} {
  const [apiKey, setStateApiKey] = useState('');
  const [wsUrl, setStateWsUrl] = useState('');

  // Hydrate from localStorage on mount
  useEffect(() => {
    setStateApiKey(getApiKey());
    setStateWsUrl(getWsUrl());
  }, []);

  const handleSetApiKey = useCallback((key: string) => {
    setApiKey(key);
    setStateApiKey(key);
  }, []);

  const handleSetWsUrl = useCallback((url: string) => {
    setWsUrl(url);
    setStateWsUrl(url);
  }, []);

  const isConfigured = apiKey.length > 0 && apiKey !== 'dev';

  return {
    apiKey,
    wsUrl,
    setApiKey: handleSetApiKey,
    setWsUrl: handleSetWsUrl,
    isConfigured,
  };
}
