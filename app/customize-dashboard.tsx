import React, { useRef, useState } from 'react';
import {
  StyleSheet,
  ScrollView,
  View,
  Text,
  Switch,
  Animated,
  PanResponder,
  PanResponderInstance,
} from 'react-native';
import { Feather } from '@expo/vector-icons';
import { useColorScheme } from '@/components/useColorScheme';
import Colors from '@/constants/Colors';
import { fonts } from '@/constants/Type';
import { useDashboardPrefs, SECTION_META, DashboardSectionKey } from '@/src/state/dashboardPrefs';

const ROW_HEIGHT = 60;

function clamp(n: number, min: number, max: number) {
  return Math.min(max, Math.max(min, n));
}

export default function CustomizeDashboardScreen() {
  const colorScheme = useColorScheme();
  const colors = Colors[colorScheme];
  const prefs = useDashboardPrefs();
  const order = prefs.order;

  // Drag state lives in refs so responder callbacks never go stale mid-gesture;
  // dragKey state exists only to restyle the lifted row and freeze scrolling.
  const [dragKey, setDragKey] = useState<DashboardSectionKey | null>(null);
  const dragY = useRef(new Animated.Value(0)).current;
  const drag = useRef<{ key: DashboardSectionKey; start: number; target: number } | null>(null);
  const offsetsRef = useRef<Partial<Record<DashboardSectionKey, Animated.Value>>>({});
  const respondersRef = useRef<Partial<Record<DashboardSectionKey, PanResponderInstance>>>({});

  const offsetFor = (key: DashboardSectionKey) => {
    if (!offsetsRef.current[key]) offsetsRef.current[key] = new Animated.Value(0);
    return offsetsRef.current[key]!;
  };

  const startDrag = (key: DashboardSectionKey) => {
    const index = useDashboardPrefs.getState().order.indexOf(key);
    drag.current = { key, start: index, target: index };
    dragY.setValue(0);
    setDragKey(key);
  };

  const moveDrag = (dy: number) => {
    const d = drag.current;
    if (!d) return;
    const orderNow = useDashboardPrefs.getState().order;
    const maxIndex = orderNow.length - 1;
    // Keep the lifted row inside the list bounds
    dragY.setValue(clamp(dy, -d.start * ROW_HEIGHT, (maxIndex - d.start) * ROW_HEIGHT));
    const target = clamp(d.start + Math.round(dy / ROW_HEIGHT), 0, maxIndex);
    if (target === d.target) return;
    d.target = target;
    orderNow.forEach((k, i) => {
      if (k === d.key) return;
      let off = 0;
      if (d.start < target && i > d.start && i <= target) off = -ROW_HEIGHT;
      else if (d.start > target && i >= target && i < d.start) off = ROW_HEIGHT;
      Animated.spring(offsetFor(k), {
        toValue: off,
        useNativeDriver: true,
        speed: 30,
        bounciness: 4,
      }).start();
    });
  };

  const endDrag = () => {
    const d = drag.current;
    drag.current = null;
    if (d && d.target !== d.start) {
      const state = useDashboardPrefs.getState();
      const next = [...state.order];
      const [moved] = next.splice(d.start, 1);
      next.splice(d.target, 0, moved);
      state.setOrder(next);
    }
    // Order change re-lays-out the rows, so all transforms snap back to zero
    Object.values(offsetsRef.current).forEach((v) => v?.setValue(0));
    dragY.setValue(0);
    setDragKey(null);
  };

  const responderFor = (key: DashboardSectionKey) => {
    if (!respondersRef.current[key]) {
      respondersRef.current[key] = PanResponder.create({
        onStartShouldSetPanResponder: () => true,
        onMoveShouldSetPanResponder: () => true,
        onPanResponderTerminationRequest: () => false,
        onPanResponderGrant: () => startDrag(key),
        onPanResponderMove: (_, gesture) => moveDrag(gesture.dy),
        onPanResponderRelease: () => endDrag(),
        onPanResponderTerminate: () => endDrag(),
      });
    }
    return respondersRef.current[key]!;
  };

  return (
    <ScrollView
      style={[styles.container, { backgroundColor: colors.background }]}
      scrollEnabled={dragKey === null}
    >
      <Text style={[styles.hint, { color: colors.textTertiary }]}>
        Toggle sections on or off, and drag ☰ to reorder Home. Total balance always shows first.
      </Text>
      <View style={[styles.group, { backgroundColor: colors.surface, borderColor: colors.hairline }]}>
        {order.map((key, i) => {
          const meta = SECTION_META[key];
          const isDragging = dragKey === key;
          return (
            <Animated.View
              key={key}
              style={[
                styles.row,
                i < order.length - 1 && { borderBottomWidth: 1, borderBottomColor: colors.hairline },
                isDragging && {
                  backgroundColor: colors.surfaceVariant,
                  borderBottomWidth: 0,
                  zIndex: 10,
                  elevation: 6,
                },
                { transform: [{ translateY: isDragging ? dragY : offsetFor(key) }] },
              ]}
            >
              <View
                {...responderFor(key).panHandlers}
                style={styles.handle}
                hitSlop={{ top: 12, bottom: 12, left: 14, right: 8 }}
              >
                <Feather name="menu" size={16} color={isDragging ? colors.gold : colors.textTertiary} />
              </View>
              <View style={styles.textGroup}>
                <Text style={[styles.label, { color: colors.text }]}>{meta.label}</Text>
                <Text style={[styles.description, { color: colors.textTertiary }]}>{meta.description}</Text>
              </View>
              <Switch
                value={prefs[key]}
                onValueChange={() => prefs.toggle(key)}
                trackColor={{ false: colors.surfaceVariant, true: colors.gold }}
                thumbColor={'#FFFDF8'}
              />
            </Animated.View>
          );
        })}
      </View>
      <View style={{ height: 32 }} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  hint: { fontFamily: fonts.sans, fontSize: 12, marginHorizontal: 16, marginTop: 16, lineHeight: 17 },
  group: {
    marginHorizontal: 13,
    marginTop: 14,
    borderRadius: 16,
    borderWidth: 1,
    overflow: 'hidden',
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    height: ROW_HEIGHT,
    paddingRight: 15,
  },
  handle: {
    width: 40,
    height: ROW_HEIGHT,
    alignItems: 'center',
    justifyContent: 'center',
  },
  textGroup: { flex: 1, marginRight: 8 },
  label: { fontFamily: fonts.sansSemiBold, fontSize: 13.5 },
  description: { fontFamily: fonts.sans, fontSize: 11, marginTop: 2.5 },
});
