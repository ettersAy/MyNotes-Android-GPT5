import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { SafeAreaView, View, Text, TextInput, Pressable, StyleSheet, Alert } from 'react-native';
import { StatusBar } from 'expo-status-bar';

import { SAVE_DEBOUNCE_MS, STORAGE_KEY, CLIENT_ID } from './src/constants';
import { debounce } from './src/utils/debounce';
import { getTheme } from './src/theme';
import Editor from './src/components/Editor';
import OptionsMenu from './src/components/OptionsMenu';
import StatusText from './src/components/StatusText';

import Clock from './src/services/Clock';
import IdGenerator from './src/services/IdGenerator';
import ClipboardService from './src/services/ClipboardService';
import StorageRepository from './src/services/StorageRepository';
import NotesService from './src/state/NotesService';

export default function App() {
  // Services (Dependency Inversion: UI depends on abstractions)
  const clockRef = useRef(new Clock());
  const idRef = useRef(new IdGenerator());
  const clipRef = useRef(new ClipboardService());
  const storeRef = useRef(new StorageRepository(STORAGE_KEY));
  const notesRef = useRef(new NotesService(clockRef.current, idRef.current));

  // App state
  const [state, setState] = useState(notesRef.current.getState());
  const [status, setStatus] = useState({ type: null, msg: '' });
  const [menuOpen, setMenuOpen] = useState(false);

  // Theme
  const theme = useMemo(() => getTheme(state.theme), [state.theme]);

  // Debouncers
  const titleSaversRef = useRef(new Map());
  const contentSaverRef = useRef(null);

  const persist = useCallback(async () => {
    const payload = {
      notes: notesRef.current.state.notes,
      selectedId: notesRef.current.state.selectedId,
      theme: notesRef.current.state.theme,
      lastWriteBy: CLIENT_ID
    };
    await storeRef.current.save(payload);
  }, []);

  const refresh = useCallback(() => {
    setState(notesRef.current.getState());
  }, []);

  // Init
  useEffect(() => {
    (async () => {
      try {
        const data = await storeRef.current.load();
        notesRef.current.hydrate(data);
        const created = notesRef.current.ensureAtLeastOneNote();
        if (created) await persist();
        refresh();
        setStatus({ type: 'saved', msg: 'Saved' });
      } catch (e) {
        setStatus({ type: null, msg: 'Failed to load' });
      }
    })();
  }, [persist, refresh]);

  // Actions
  const addNote = useCallback(() => {
    notesRef.current.addNote();
    refresh();
    persist();
  }, [persist, refresh]);

  const selectNote = useCallback((id) => {
    const changed = notesRef.current.selectNote(id);
    if (changed) {
      refresh();
      persist();
    }
  }, [persist, refresh]);

  const debouncedTitleSaverFor = useCallback((noteId) => {
    if (!titleSaversRef.current.has(noteId)) {
      const saver = debounce((val) => {
        notesRef.current.updateTitle(noteId, val);
        setStatus({ type: 'saved', msg: 'Saved' });
        persist();
      }, SAVE_DEBOUNCE_MS);
      titleSaversRef.current.set(noteId, saver);
    }
    return titleSaversRef.current.get(noteId);
  }, [persist]);

  const onTitleInput = useCallback((id, value) => {
    setStatus({ type: 'saving', msg: 'Saving...' });
    debouncedTitleSaverFor(id)(value);
  }, [debouncedTitleSaverFor]);

  const onContentChange = useCallback((text) => {
    setStatus({ type: 'saving', msg: 'Saving...' });
    if (!contentSaverRef.current) {
      contentSaverRef.current = debounce((val) => {
        const sel = notesRef.current.getSelected();
        if (!sel) return;
        notesRef.current.updateContent(sel.id, val);
        setStatus({ type: 'saved', msg: 'Saved' });
        // Update tabs UI (timestamps/short titles)
        refresh();
        persist();
      }, SAVE_DEBOUNCE_MS);
    }
    contentSaverRef.current(text);
  }, [persist, refresh]);

  const onCopyNote = useCallback(async (id) => {
    const note = notesRef.current.state.notes.find(n => n.id === id);
    if (!note) return;
    const text = `${note.title || 'Untitled'}\n${note.content || ''}`;
    try {
      await clipRef.current.writeText(text);
      setStatus({ type: 'saved', msg: 'Copied note' });
    } catch {
      setStatus({ type: null, msg: 'Copy failed' });
    }
  }, []);

  const onDeleteNote = useCallback((id) => {
    const note = notesRef.current.state.notes.find(n => n.id === id);
    if (!note) return;
    Alert.alert(
      'Delete note',
      `Delete note "${note.title || 'Untitled'}"?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: () => {
            notesRef.current.deleteNote(id);
            if (notesRef.current.state.notes.length === 0) {
              notesRef.current.ensureAtLeastOneNote();
            }
            refresh();
            persist();
          }
        }
      ]
    );
  }, [persist, refresh]);

  const toggleTheme = useCallback(() => {
    const next = state.theme === 'dark' ? 'light' : 'dark';
    notesRef.current.setTheme(next);
    refresh();
    persist();
  }, [persist, refresh, state.theme]);

  const copyAll = useCallback(async () => {
    const allText = notesRef.current.state.notes
      .map(n => `${n.title || 'Untitled'}\n${n.content || ''}`)
      .join('\n\n---\n\n');
    try {
      await clipRef.current.writeText(allText);
      setStatus({ type: 'saved', msg: 'Copied all notes' });
    } catch {
      setStatus({ type: null, msg: 'Copy failed' });
    }
  }, []);

  const clearAll = useCallback(() => {
    Alert.alert(
      'Clear all notes',
      'Delete all notes? This cannot be undone.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete all',
          style: 'destructive',
          onPress: async () => {
            notesRef.current.clearAll();
            notesRef.current.ensureAtLeastOneNote();
            refresh();
            await persist();
          }
        }
      ]
    );
  }, [persist, refresh]);

  const selected = notesRef.current.getSelected();

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: theme.colors.background }]}>
      <StatusBar style={theme.mode === 'dark' ? 'light' : 'dark'} />

      {/* Header */}
      <View style={[styles.header, { borderBottomColor: theme.colors.border }]}>
        <Pressable
          onPress={() => setMenuOpen(true)}
          style={({ pressed }) => [styles.headerIconBtn, pressed && { opacity: 0.6 }]}
        >
          <Text style={[styles.headerBtnText, { color: theme.colors.text }]}>≡</Text>
        </Pressable>

        <TextInput
          style={[
            styles.headerTitleInput,
            { color: theme.colors.text, backgroundColor: theme.colors.inputBg, borderColor: theme.colors.border }
          ]}
          value={(selected && selected.title) || ''}
          onChangeText={(txt) => selected && onTitleInput(selected.id, txt)}
          placeholder="Untitled note"
          placeholderTextColor={theme.colors.subtext}
        />

        <View style={styles.headerRight}>
          <Pressable
            onPress={() => selected && onCopyNote(selected.id)}
            style={({ pressed }) => [styles.headerBtn, pressed && { opacity: 0.6 }]}
          >
            <Text style={[styles.headerBtnText, { color: theme.colors.text }]}>📋</Text>
          </Pressable>
          <Pressable
            onPress={() => selected && onDeleteNote(selected.id)}
            style={({ pressed }) => [styles.headerBtn, pressed && { opacity: 0.6 }]}
          >
            <Text style={[styles.headerBtnText, { color: theme.colors.danger }]}>🗑</Text>
          </Pressable>
        </View>
      </View>


      {/* Editor */}
      <Editor
        value={(selected && selected.content) || ''}
        onChangeText={onContentChange}
        theme={theme}
      />

      {/* Status */}
      <StatusText statusType={status.type} message={status.msg} theme={theme} />

      {/* Options Menu */}
      <OptionsMenu
        visible={menuOpen}
        onRequestClose={() => setMenuOpen(false)}
        onAdd={addNote}
        notes={state.notes}
        selectedId={state.selectedId}
        onSelect={(id) => { selectNote(id); setMenuOpen(false); }}
        onToggleTheme={toggleTheme}
        onCopyAll={copyAll}
        theme={theme}
        currentTheme={state.theme}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1
  },
  header: {
    height: 56,
    paddingHorizontal: 12,
    flexDirection: 'row',
    alignItems: 'center',
    borderBottomWidth: 1
  },
  headerIconBtn: {
    paddingHorizontal: 8,
    paddingVertical: 6,
    marginRight: 8,
    borderRadius: 6
  },
  headerTitleInput: {
    flex: 1,
    height: 36,
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 6,
    fontSize: 16
  },
  headerRight: {
    flexDirection: 'row',
    alignItems: 'center',
    marginLeft: 8
  },
  headerBtn: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    marginLeft: 4,
    borderRadius: 6
  },
  headerBtnText: {
    fontSize: 20
  }
});
