import React, { useEffect, useState, useCallback } from 'react';
import {
  StyleSheet, ScrollView, View, Text, TouchableOpacity, Alert, Modal,
  Pressable, TextInput, KeyboardAvoidingView, Platform,
} from 'react-native';
import { useDatabase } from '@/src/db/provider';
import { getAllCategories } from '@/src/db/repository/budgets';
import { createCategory, createSubcategory, updateCategory, deleteCategory, getCategoryUsage } from '@/src/db/repository/categories';
import { useColorScheme } from '@/components/useColorScheme';
import Colors from '@/constants/Colors';
import { fonts, sectionLabel } from '@/constants/Type';

// Swatches in the ledger palette family (Cashew-style picker). Every category
// must own a UNIQUE color — taken swatches are shown dimmed and disabled.
const CATEGORY_COLORS = [
  '#D4B96A', '#D24545', '#8FB573', '#5E9BC9', '#8D6CAB', '#C97B67',
  '#C99667', '#7FAEA3', '#B08EA2', '#6577A0', '#A6803A', '#5C8A72',
  '#C25B72', '#4E8FB0', '#9A7BC9', '#D08A3E', '#4F9B8F', '#8A9B4F',
  '#B76E4A', '#7B87C9', '#D98AA6', '#A9C46C', '#5C6B7A', '#98917F',
];

interface EditorState {
  id?: string;
  name: string;
  icon: string;
  color: string;
  type: 'expense' | 'income';
  /** Set → editing a subcategory of that main category. */
  parentId?: string | null;
}

export default function ManageCategoriesScreen() {
  const db = useDatabase();
  const colorScheme = useColorScheme();
  const colors = Colors[colorScheme];
  const isDark = colorScheme === 'dark';
  const [cats, setCats] = useState<any[]>([]);
  const [editor, setEditor] = useState<EditorState | null>(null);

  const load = useCallback(() => getAllCategories(db).then(setCats), [db]);
  useEffect(() => { load(); }, [load]);

  /** Colors already owned by OTHER categories — not selectable again. */
  const takenColors = (excludeId?: string) =>
    new Set(
      cats
        .filter((c) => c.id !== excludeId && c.color)
        .map((c) => String(c.color).toLowerCase())
    );

  const firstFreeColor = () => {
    const taken = takenColors();
    return CATEGORY_COLORS.find((c) => !taken.has(c.toLowerCase())) ?? CATEGORY_COLORS[0];
  };

  const openAdd = () => setEditor({ name: '', icon: '', color: firstFreeColor(), type: 'expense' });
  const openEdit = (c: any) =>
    setEditor({
      id: c.id, name: c.name, icon: c.icon ?? '',
      color: c.color ?? firstFreeColor(), type: c.type, parentId: c.parentId ?? null,
    });

  const childrenOf = (id?: string) => (id ? cats.filter((c) => c.parentId === id) : []);

  // Subcategory add-row inside the editor
  const [subName, setSubName] = useState('');
  const [subIcon, setSubIcon] = useState('');
  const addSub = async () => {
    if (!editor?.id || !subName.trim()) return;
    try {
      await createSubcategory(db, editor.id, { name: subName.trim(), icon: subIcon || undefined });
      setSubName('');
      setSubIcon('');
      load();
    } catch (e: any) {
      Alert.alert('Could not add', e.message?.includes('UNIQUE') ? 'A category with that name already exists.' : e.message);
    }
  };

  const save = async () => {
    if (!editor || !editor.name.trim()) return;
    const isSub = !!editor.parentId;
    if (!isSub && takenColors(editor.id).has(editor.color.toLowerCase())) {
      Alert.alert('Color taken', 'Another category already uses this color — pick a free one.');
      return;
    }
    try {
      if (editor.id) {
        await updateCategory(db, editor.id, isSub
          ? { name: editor.name.trim(), icon: editor.icon || undefined }
          : { name: editor.name.trim(), icon: editor.icon || undefined, color: editor.color, type: editor.type });
      } else {
        await createCategory(db, {
          name: editor.name.trim(), icon: editor.icon || undefined,
          color: editor.color, type: editor.type,
        });
      }
      setEditor(null);
      load();
    } catch (e: any) {
      Alert.alert('Could not save', e.message?.includes('UNIQUE') ? 'A category with that name already exists.' : e.message);
    }
  };

  const confirmDelete = async (c: any) => {
    const usage = await getCategoryUsage(db, c.id);
    const details = [
      usage.transactions > 0 ? `${usage.transactions} transactions become uncategorized` : null,
      usage.rules > 0 ? `${usage.rules} keyword rules deleted` : null,
      usage.budgets > 0 ? `${usage.budgets} budgets deleted` : null,
    ].filter(Boolean).join('\n');
    Alert.alert(
      `Delete "${c.name}"?`,
      details || 'This category is not in use.',
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Delete', style: 'destructive', onPress: async () => { await deleteCategory(db, c.id); load(); } },
      ]
    );
  };

  const expense = cats.filter((c) => c.type === 'expense' && !c.parentId);
  const income = cats.filter((c) => c.type === 'income' && !c.parentId);

  const renderGroup = (title: string, list: any[]) => (
    <>
      <Text style={[styles.sectionHeader, { color: colors.textSecondary }]}>{title}</Text>
      <View style={[styles.group, { backgroundColor: colors.surface, borderColor: colors.hairline }]}>
        {list.map((c, i) => (
          <View key={c.id}>
            <TouchableOpacity
              style={[styles.row, (i < list.length - 1 || childrenOf(c.id).length > 0) && { borderBottomWidth: 1, borderBottomColor: colors.hairline }]}
              onPress={() => openEdit(c)}
              onLongPress={() => confirmDelete(c)}
            >
              <View style={[styles.iconChip, { backgroundColor: colors.surfaceVariant, borderColor: c.color ?? colors.hairline }]}>
                <Text style={styles.iconText}>{c.icon || '▪'}</Text>
              </View>
              <Text style={[styles.name, { color: colors.text }]}>{c.name}</Text>
              {c.isDefault ? <Text style={[styles.defaultTag, { color: colors.textTertiary }]}>default</Text> : null}
            </TouchableOpacity>
            {childrenOf(c.id).map((s, j, arr) => (
              <TouchableOpacity
                key={s.id}
                style={[styles.subRow, (i < list.length - 1 || j < arr.length - 1) && { borderBottomWidth: 1, borderBottomColor: colors.hairline }]}
                onPress={() => openEdit(s)}
                onLongPress={() => confirmDelete(s)}
              >
                <Text style={[styles.subBranch, { color: colors.textTertiary }]}>└</Text>
                <Text style={styles.subIcon}>{s.icon || '▪'}</Text>
                <Text style={[styles.subName, { color: colors.textSecondary }]}>{s.name}</Text>
              </TouchableOpacity>
            ))}
          </View>
        ))}
        {list.length === 0 && (
          <Text style={[styles.empty, { color: colors.textTertiary }]}>None yet.</Text>
        )}
      </View>
    </>
  );

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <ScrollView>
        <Text style={[styles.hint, { color: colors.textTertiary }]}>
          Tap to edit · long-press to delete
        </Text>
        {renderGroup('Expense', expense)}
        {renderGroup('Income', income)}
        <View style={{ height: 90 }} />
      </ScrollView>

      <TouchableOpacity
        style={[styles.fab, { backgroundColor: colors.gold }]}
        activeOpacity={0.8}
        onPress={openAdd}
      >
        <Text style={[styles.fabText, { color: isDark ? '#0C0B09' : '#FFFDF8' }]}>+</Text>
      </TouchableOpacity>

      {/* Add/Edit modal */}
      <Modal visible={!!editor} transparent animationType="fade" onRequestClose={() => setEditor(null)}>
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1 }}>
        <Pressable style={styles.overlay} onPress={() => setEditor(null)}>
          <View
            style={[styles.modal, { backgroundColor: colors.surface, borderColor: colors.hairlineStrong }]}
            onStartShouldSetResponder={() => true}
          >
            <ScrollView keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
            {editor && (
              <>
                <Text style={[styles.modalTitle, { color: colors.text }]}>
                  {editor.parentId
                    ? `Edit Subcategory · ${cats.find((c) => c.id === editor.parentId)?.name ?? ''}`
                    : editor.id ? 'Edit Category' : 'New Category'}
                </Text>

                {/* Emoji + name row (Cashew-style: big icon preview + inline name) */}
                <View style={styles.nameRow}>
                  <View style={[styles.bigIcon, { backgroundColor: colors.surfaceVariant, borderColor: editor.color }]}>
                    <TextInput
                      style={styles.bigIconInput}
                      value={editor.icon}
                      onChangeText={(t) => {
                        // keep only the last grapheme-ish chunk — one emoji
                        const chars = Array.from(t);
                        setEditor({ ...editor, icon: chars.slice(-2).join('').trim() });
                      }}
                      placeholder="🙂"
                      placeholderTextColor={colors.textTertiary}
                      maxLength={8}
                    />
                  </View>
                  <TextInput
                    style={[styles.nameInput, { color: colors.text, borderBottomColor: colors.hairline }]}
                    value={editor.name}
                    onChangeText={(t) => setEditor({ ...editor, name: t })}
                    placeholder="Category name"
                    placeholderTextColor={colors.textTertiary}
                    maxLength={40}
                  />
                </View>
                <Text style={[styles.emojiHint, { color: colors.textTertiary }]}>
                  Tap the square and type any emoji from your keyboard
                </Text>

                {/* Type selector — a subcategory inherits its parent's type */}
                {!editor.parentId && (
                <View style={styles.typeRow}>
                  {(['expense', 'income'] as const).map((t) => (
                    <TouchableOpacity
                      key={t}
                      style={[styles.typeChip, {
                        backgroundColor: editor.type === t ? colors.goldDim : colors.surfaceVariant,
                        borderColor: editor.type === t ? colors.hairlineStrong : 'transparent',
                      }]}
                      onPress={() => setEditor({ ...editor, type: t })}
                    >
                      <Text style={[styles.typeText, { color: editor.type === t ? colors.gold : colors.textSecondary }]}>
                        {t === 'expense' ? 'Expense' : 'Income'}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
                )}

                {/* Colour grid — one unique color per category; taken swatches
                    are dimmed and disabled. Subcategories use the parent's
                    color family. */}
                {!editor.parentId && (
                <View style={styles.colorGrid}>
                  {CATEGORY_COLORS.map((c) => {
                    const taken = takenColors(editor.id).has(c.toLowerCase());
                    const active = editor.color === c;
                    return (
                      <TouchableOpacity
                        key={c}
                        disabled={taken}
                        style={[styles.swatch, {
                          borderColor: active ? c : 'transparent',
                          backgroundColor: colors.surfaceVariant,
                          opacity: taken ? 0.25 : 1,
                        }]}
                        onPress={() => setEditor({ ...editor, color: c })}
                      >
                        <View style={[styles.swatchDot, { backgroundColor: c }]}>
                          <Text style={styles.swatchEmoji}>{active ? (editor.icon || '✓') : taken ? '✕' : ' '}</Text>
                        </View>
                      </TouchableOpacity>
                    );
                  })}
                </View>
                )}

                {/* Subcategories — Cashew-style, managed inline on a saved
                    main category */}
                {!editor.parentId && (
                  <>
                    <Text style={[styles.subsHeader, { color: colors.textSecondary }]}>Subcategories</Text>
                    {editor.id ? (
                      <>
                        {childrenOf(editor.id).map((s) => (
                          <View key={s.id} style={[styles.subEditRow, { borderColor: colors.hairline }]}>
                            <Text style={styles.subIcon}>{s.icon || '▪'}</Text>
                            <Text style={[styles.subName, { color: colors.text, flex: 1 }]}>{s.name}</Text>
                            <TouchableOpacity onPress={() => confirmDelete(s)} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                              <Text style={{ color: colors.expense, fontFamily: fonts.sansBold, fontSize: 12 }}>✕</Text>
                            </TouchableOpacity>
                          </View>
                        ))}
                        <View style={styles.subAddRow}>
                          <TextInput
                            style={[styles.subAddIcon, { backgroundColor: colors.surfaceVariant, color: colors.text, borderColor: colors.hairline }]}
                            value={subIcon}
                            onChangeText={(t) => setSubIcon(Array.from(t).slice(-2).join('').trim())}
                            placeholder="🙂"
                            placeholderTextColor={colors.textTertiary}
                            maxLength={8}
                          />
                          <TextInput
                            style={[styles.subAddName, { backgroundColor: colors.surfaceVariant, color: colors.text, borderColor: colors.hairline }]}
                            value={subName}
                            onChangeText={setSubName}
                            placeholder="New subcategory"
                            placeholderTextColor={colors.textTertiary}
                            maxLength={40}
                          />
                          <TouchableOpacity
                            style={[styles.subAddBtn, { backgroundColor: colors.goldDim, borderColor: colors.hairlineStrong, opacity: subName.trim() ? 1 : 0.5 }]}
                            disabled={!subName.trim()}
                            onPress={addSub}
                          >
                            <Text style={{ color: colors.gold, fontFamily: fonts.sansBold, fontSize: 16 }}>+</Text>
                          </TouchableOpacity>
                        </View>
                      </>
                    ) : (
                      <Text style={[styles.emojiHint, { color: colors.textTertiary }]}>
                        Save the category first, then reopen it to add subcategories.
                      </Text>
                    )}
                  </>
                )}

                <View style={styles.actions}>
                  <TouchableOpacity onPress={() => setEditor(null)}>
                    <Text style={[styles.cancelText, { color: colors.textSecondary }]}>Cancel</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[styles.saveBtn, { backgroundColor: colors.gold, opacity: editor.name.trim() ? 1 : 0.5 }]}
                    disabled={!editor.name.trim()}
                    onPress={save}
                  >
                    <Text style={[styles.saveText, { color: isDark ? '#0C0B09' : '#FFFDF8' }]}>
                      {editor.id ? 'Save' : 'Add'}
                    </Text>
                  </TouchableOpacity>
                </View>
              </>
            )}
            </ScrollView>
          </View>
        </Pressable>
        </KeyboardAvoidingView>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  hint: { fontFamily: fonts.sans, fontSize: 11.5, marginHorizontal: 16, marginTop: 14 },
  sectionHeader: { ...sectionLabel, paddingHorizontal: 16, paddingTop: 18 },
  group: { marginHorizontal: 13, marginTop: 9, borderRadius: 16, borderWidth: 1, overflow: 'hidden' },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 14, paddingVertical: 11 },
  iconChip: {
    width: 34, height: 34, borderRadius: 10, borderWidth: 1.5,
    alignItems: 'center', justifyContent: 'center',
  },
  iconText: { fontSize: 16 },
  name: { fontFamily: fonts.sansSemiBold, fontSize: 13.5, flex: 1 },
  defaultTag: { fontFamily: fonts.mono, fontSize: 9.5 },
  empty: { fontFamily: fonts.sans, fontSize: 12.5, padding: 16, textAlign: 'center' },
  fab: {
    position: 'absolute', right: 20, bottom: 20, width: 56, height: 56,
    borderRadius: 16, alignItems: 'center', justifyContent: 'center', elevation: 4,
  },
  fabText: { fontFamily: fonts.sans, fontSize: 28, lineHeight: 30 },
  overlay: {
    flex: 1, backgroundColor: 'rgba(0,0,0,0.55)',
    justifyContent: 'center', alignItems: 'center', padding: 24,
  },
  modal: { width: '100%', maxHeight: '100%', borderRadius: 20, borderWidth: 1, padding: 22 },
  modalTitle: { fontFamily: fonts.sansBold, fontSize: 17, marginBottom: 18 },
  nameRow: { flexDirection: 'row', alignItems: 'center', gap: 14 },
  bigIcon: {
    width: 56, height: 56, borderRadius: 16, borderWidth: 2,
    alignItems: 'center', justifyContent: 'center',
  },
  bigIconInput: { fontSize: 26, textAlign: 'center', width: 56, height: 56, padding: 0 },
  nameInput: {
    flex: 1, fontFamily: fonts.sansBold, fontSize: 19,
    borderBottomWidth: 1, paddingVertical: 6,
  },
  emojiHint: { fontFamily: fonts.sans, fontSize: 10.5, marginTop: 8 },
  typeRow: { flexDirection: 'row', gap: 8, marginTop: 16 },
  typeChip: { paddingHorizontal: 16, paddingVertical: 8, borderRadius: 99, borderWidth: 1 },
  typeText: { fontFamily: fonts.sansSemiBold, fontSize: 12.5 },
  colorGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 14 },
  subRow: { flexDirection: 'row', alignItems: 'center', gap: 9, paddingLeft: 34, paddingRight: 14, paddingVertical: 9 },
  subBranch: { fontFamily: fonts.mono, fontSize: 12 },
  subIcon: { fontSize: 13 },
  subName: { fontFamily: fonts.sansMedium, fontSize: 12.5 },
  subsHeader: { ...sectionLabel, fontSize: 9.5, marginTop: 16, marginBottom: 8 },
  subEditRow: {
    flexDirection: 'row', alignItems: 'center', gap: 9,
    borderWidth: 1, borderRadius: 10, paddingHorizontal: 11, paddingVertical: 8, marginBottom: 6,
  },
  subAddRow: { flexDirection: 'row', alignItems: 'center', gap: 7, marginTop: 2 },
  subAddIcon: {
    width: 40, height: 40, borderRadius: 10, borderWidth: 1,
    textAlign: 'center', fontSize: 16, padding: 0,
  },
  subAddName: { flex: 1, height: 40, borderRadius: 10, borderWidth: 1, paddingHorizontal: 11, fontFamily: fonts.sans, fontSize: 13 },
  subAddBtn: {
    width: 40, height: 40, borderRadius: 10, borderWidth: 1,
    alignItems: 'center', justifyContent: 'center',
  },
  swatch: { borderRadius: 12, borderWidth: 2, padding: 2.5 },
  swatchDot: {
    width: 32, height: 32, borderRadius: 8,
    alignItems: 'center', justifyContent: 'center',
  },
  swatchEmoji: { fontSize: 14 },
  actions: {
    flexDirection: 'row', justifyContent: 'flex-end',
    alignItems: 'center', gap: 18, marginTop: 22,
  },
  cancelText: { fontFamily: fonts.sansMedium, fontSize: 13 },
  saveBtn: { paddingHorizontal: 24, paddingVertical: 10, borderRadius: 12 },
  saveText: { fontFamily: fonts.sansBold, fontSize: 13 },
});
