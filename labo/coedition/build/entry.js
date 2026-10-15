// Bibliothèques du prototype de co-écriture, regroupées en un seul fichier (window.CoEditionLib).
// Compo n'a pas d'étape de construction : on fabrique ce fichier une fois (voir README.md) et on le charge tel quel.
export { Editor, Extension, InputRule } from '@tiptap/core';
export { default as StarterKit } from '@tiptap/starter-kit';
export { default as Collaboration } from '@tiptap/extension-collaboration';
export { default as CollaborationCaret } from '@tiptap/extension-collaboration-caret';
export { Plugin, PluginKey } from '@tiptap/pm/state';
export { Decoration, DecorationSet } from '@tiptap/pm/view';
export * as Y from 'yjs';
export * as awarenessProtocol from 'y-protocols/awareness';
export { RealtimeClient } from '@supabase/realtime-js';
