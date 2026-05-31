import { Platform } from 'react-native';
import * as SecureStore from 'expo-secure-store';

export async function getItemSecurely(key: string): Promise<string | null> {
  if (Platform.OS === 'web') {
    try {
      return localStorage.getItem(key);
    } catch {
      return null;
    }
  }
  return SecureStore.getItemAsync(key);
}

export async function setItemSecurely(key: string, value: string): Promise<void> {
  if (Platform.OS === 'web') {
    try {
      localStorage.setItem(key, value);
    } catch (e) {
      console.error('localStorage is unavailable:', e);
    }
    return;
  }
  await SecureStore.setItemAsync(key, value);
}

export async function deleteItemSecurely(key: string): Promise<void> {
  if (Platform.OS === 'web') {
    try {
      localStorage.removeItem(key);
    } catch (e) {
      console.error('localStorage is unavailable:', e);
    }
    return;
  }
  await SecureStore.deleteItemAsync(key);
}
