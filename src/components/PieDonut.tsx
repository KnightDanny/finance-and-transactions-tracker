import React from 'react';
import { View, StyleSheet } from 'react-native';
import Svg, { Path, Circle } from 'react-native-svg';

export interface DonutSlice {
  value: number;
  color: string;
  key?: string;
}

interface Props {
  slices: DonutSlice[];
  size?: number;
  strokeWidth?: number;
  /** Index of the highlighted slice — it pops outward, fl_chart style. */
  selected?: number | null;
  /** Tap handler; called with the slice index, or null when deselecting. */
  onPressSlice?: (index: number | null) => void;
  /** Rendered in the donut hole, centered. */
  children?: React.ReactNode;
}

/** Donut-wedge path between two angles (radians). */
function wedgePath(cx: number, cy: number, rOuter: number, rInner: number, a0: number, a1: number): string {
  const px = (r: number, a: number) => `${cx + r * Math.cos(a)} ${cy + r * Math.sin(a)}`;
  const large = a1 - a0 > Math.PI ? 1 : 0;
  return (
    `M${px(rOuter, a0)} A${rOuter} ${rOuter} 0 ${large} 1 ${px(rOuter, a1)} ` +
    `L${px(rInner, a1)} A${rInner} ${rInner} 0 ${large} 0 ${px(rInner, a0)} Z`
  );
}

/**
 * fl_chart-style donut (the look Cashew gets from Flutter's fl_chart, which
 * has no React Native build): flat vibrant wedges drawn as real SVG paths
 * with angular spacing, -45° start. Wedge paths give precise per-slice hit
 * testing; the selected slice pops outward.
 */
export function PieDonut({ slices, size = 180, strokeWidth = 30, selected = null, onPressSlice, children }: Props) {
  const cx = size / 2;
  const cy = size / 2;
  const POP = 5;
  const rOuter = size / 2 - POP - 1;
  const rInner = rOuter - strokeWidth;
  const total = slices.reduce((s, x) => s + x.value, 0);

  const visible = slices.filter((s) => s.value > 0);
  const GAP_RAD = visible.length > 1 ? 0.05 : 0; // angular gap between wedges

  // Single slice → full ring (a 2π arc path degenerates)
  if (visible.length === 1 || total <= 0) {
    return (
      <View style={{ width: size, height: size, alignItems: 'center', justifyContent: 'center' }}>
        <Svg width={size} height={size} style={StyleSheet.absoluteFill}>
          <Circle
            cx={cx}
            cy={cy}
            r={(rOuter + rInner) / 2}
            fill="none"
            stroke={visible[0]?.color ?? '#98917F'}
            strokeWidth={strokeWidth}
          />
        </Svg>
        <View style={{ alignItems: 'center', justifyContent: 'center' }}>{children}</View>
      </View>
    );
  }

  const START = (-135 * Math.PI) / 180;
  let cursor = START;
  const wedges = visible.map((s) => {
    const sweep = (s.value / total) * 2 * Math.PI;
    const a0 = cursor + GAP_RAD / 2;
    const a1 = cursor + Math.max(GAP_RAD / 2 + 0.015, sweep - GAP_RAD / 2);
    cursor += sweep;
    const idx = slices.indexOf(s);
    return { ...s, a0, a1, idx };
  });

  return (
    <View style={{ width: size, height: size, alignItems: 'center', justifyContent: 'center' }}>
      <Svg width={size} height={size} style={StyleSheet.absoluteFill}>
        {wedges.map((w) => {
          const pop = selected === w.idx ? POP : 0;
          return (
            <Path
              key={w.key ?? w.idx}
              d={wedgePath(cx, cy, rOuter + pop, rInner - (pop > 0 ? 1 : 0), w.a0, w.a1)}
              fill={w.color}
              onPress={onPressSlice ? () => onPressSlice(selected === w.idx ? null : w.idx) : undefined}
            />
          );
        })}
      </Svg>
      <View style={{ alignItems: 'center', justifyContent: 'center' }} pointerEvents="box-none">
        {children}
      </View>
    </View>
  );
}
