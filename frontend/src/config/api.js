import Constants from 'expo-constants';

const FALLBACK_API_BASE = 'http://10.10.70.134:6969';
const API_PORT = '6969';

/** Set in frontend/.env as EXPO_PUBLIC_API_BASE=http://YOUR_LAN_IP:6969 if auto-detection fails. */
const envApiBase =
  typeof process !== 'undefined' && process.env?.EXPO_PUBLIC_API_BASE
    ? String(process.env.EXPO_PUBLIC_API_BASE).trim().replace(/\/$/, '')
    : '';

const getDevApiBase = () => {
  const hostUri =
    Constants.expoConfig?.hostUri ||
    Constants.expoGoConfig?.debuggerHost ||
    '';

  const host = hostUri.split(':')[0];
  if (!host || host === 'localhost' || host === '127.0.0.1') {
    return FALLBACK_API_BASE;
  }

  return `http://${host}:${API_PORT}`;
};

export const API_BASE = envApiBase || (__DEV__ ? getDevApiBase() : FALLBACK_API_BASE);
