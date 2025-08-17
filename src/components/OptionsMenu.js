import React from 'react';
import { Modal, View, Text, Pressable, StyleSheet } from 'react-native';

export default function OptionsMenu({
  visible,
  onRequestClose,
  onToggleTheme,
  onCopyAll,
  onClearAll,
  theme,
  currentTheme
}) {
  return (
    <Modal transparent animationType="fade" visible={visible} onRequestClose={onRequestClose}>
      <Pressable style={styles.backdrop} onPress={onRequestClose}>
        <View />
      </Pressable>
      <View style={[styles.menu, { backgroundColor: theme.colors.surface, borderColor: theme.colors.border }]}>
        <Pressable style={styles.item} onPress={() => { onToggleTheme && onToggleTheme(); onRequestClose(); }}>
          <Text style={[styles.text, { color: theme.colors.text }]}>
            {currentTheme === 'dark' ? '🌞 Light theme' : '🌙 Dark theme'}
          </Text>
        </Pressable>
        <Pressable style={styles.item} onPress={() => { onCopyAll && onCopyAll(); onRequestClose(); }}>
          <Text style={[styles.text, { color: theme.colors.text }]}>📋 Copy all notes</Text>
        </Pressable>
        <Pressable style={styles.item} onPress={() => { onClearAll && onClearAll(); onRequestClose(); }}>
          <Text style={[styles.text, { color: theme.colors.danger }]}>🗑 Clear all notes</Text>
        </Pressable>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.25)'
  },
  menu: {
    position: 'absolute',
    top: 56,
    right: 12,
    borderWidth: 1,
    borderRadius: 12,
    paddingVertical: 6,
    minWidth: 200,
    elevation: 6,
    shadowColor: '#000',
    shadowOpacity: 0.2,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 2 }
  },
  item: {
    paddingHorizontal: 12,
    paddingVertical: 12
  },
  text: {
    fontSize: 14
  }
});
