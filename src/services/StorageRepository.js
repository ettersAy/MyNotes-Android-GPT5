import AsyncStorage from '@react-native-async-storage/async-storage';
import { STORAGE_KEY } from '../constants';

export default class StorageRepository {
  constructor(key = STORAGE_KEY) {
    this.key = key;
  }

  async load() {
    try {
      const raw = await AsyncStorage.getItem(this.key);
      const data = raw ? JSON.parse(raw) : {};
      return {
        notes: Array.isArray(data.notes) ? data.notes : [],
        selectedId: data.selectedId || null,
        theme: data.theme === 'light' ? 'light' : 'dark',
        lastWriteBy: data.lastWriteBy || null
      };
    } catch {
      return {
        notes: [],
        selectedId: null,
        theme: 'dark',
        lastWriteBy: null
      };
    }
  }

  async save(payload) {
    await AsyncStorage.setItem(this.key, JSON.stringify(payload));
  }
}
