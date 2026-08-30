import React from 'react';
import { View, StyleSheet } from 'react-native';
import Svg, { Circle } from 'react-native-svg';

export interface DonutSlice {
  value: number;
  color: string;
  key?: string;
}

interface Props {
  slices: DonutSlice[];
  size?: number;
  strokeWidth?: number;
  /** Rendered in the donut hole, centered. */
  children?: React.ReactNode;
}

/**
 * Donut chart from stroked circle arcs (strokeDasharray + rotation), Cashew's
 * -45° start offset. Small angular gap keeps adjacent slices distinguishable.
 */
export function PieDonut({ slices, size = 180, strokeWidth = 22, children }: Props) {
  const r = (size - strokeWidth) / 2;
  const c = 2 * Math.PI * r;
  const total = slices.reduce((s, x) => s + x.value, 0);
  const GAP = slices.length > 1 ? 0.012 : 0; // fraction of circumference per gap

  let cursor = 0; // running fraction
  const arcs = slices
    .filter((s) => s.value > 0)
    .map((s, i) => {
      const frac = total > 0 ? s.value / total : 0;
      const drawn = Math.max(0, frac - GAP);
      const arc = { ...s, frac, offset: cursor, drawn, idx: i };
      cursor += frac;
      return arc;
    });

  return (
    <View style={{ width: size, height: size, alignItems: 'center', justifyContent: 'center' }}>
      <Svg width={size} height={size} style={StyleSheet.absoluteFill}>
        {arcs.map((a) => (
          <Circle
            key={a.key ?? a.idx}
            cx={size / 2}
            cy={size / 2}
            r={r}
            fill="none"
            stroke={a.color}
            strokeWidth={strokeWidth}
            strokeLinecap="butt"
            strokeDasharray={`${a.drawn * c} ${c}`}
            strokeDashoffset={-(a.offset + GAP / 2) * c}
            transform={`rotate(-135 ${size / 2} ${size / 2})`}
          />
        ))}
      </Svg>
      <View style={{ alignItems: 'center', justifyContent: 'center' }}>{children}</View>
    </View>
  );
}
