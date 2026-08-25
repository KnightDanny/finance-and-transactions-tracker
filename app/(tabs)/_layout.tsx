import React from 'react';
import { Tabs } from 'expo-router';
import { SymbolView } from 'expo-symbols';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import Colors from '@/constants/Colors';
import { fonts } from '@/constants/Type';
import { useColorScheme } from '@/components/useColorScheme';

export default function TabLayout() {
  const colorScheme = useColorScheme();
  const colors = Colors[colorScheme];
  // Edge-to-edge: keep the tab row above the system gesture pill
  const insets = useSafeAreaInsets();

  return (
    <Tabs
      screenOptions={{
        tabBarActiveTintColor: colors.tint,
        tabBarInactiveTintColor: colors.tabIconDefault,
        tabBarStyle: {
          backgroundColor: colors.background,
          borderTopColor: colors.hairline,
          borderTopWidth: 1,
          elevation: 0,
          height: 58 + insets.bottom,
          paddingBottom: 8 + insets.bottom,
          paddingTop: 7,
        },
        tabBarLabelStyle: {
          fontFamily: fonts.sansBold,
          fontSize: 9,
          letterSpacing: 1.2,
          textTransform: 'uppercase',
        },
        headerStyle: {
          backgroundColor: colors.background,
          elevation: 0,
          shadowOpacity: 0,
          borderBottomWidth: 0,
        },
        headerTitleStyle: {
          fontFamily: fonts.sansExtraBold,
          fontSize: 21,
          letterSpacing: -0.3,
        },
        headerTintColor: colors.text,
        headerShown: true,
      }}>
      <Tabs.Screen
        name="index"
        options={{
          title: 'Home',
          tabBarIcon: ({ color }) => (
            <SymbolView
              name={{ ios: 'house.fill', android: 'home', web: 'home' }}
              tintColor={color}
              size={23}
            />
          ),
        }}
      />
      <Tabs.Screen
        name="transactions"
        options={{
          title: 'Ledger',
          tabBarIcon: ({ color }) => (
            <SymbolView
              name={{ ios: 'list.bullet', android: 'receipt_long', web: 'list' }}
              tintColor={color}
              size={23}
            />
          ),
        }}
      />
      <Tabs.Screen
        name="budgets"
        options={{
          title: 'Budgets',
          tabBarIcon: ({ color }) => (
            <SymbolView
              name={{ ios: 'chart.pie.fill', android: 'pie_chart', web: 'pie_chart' }}
              tintColor={color}
              size={23}
            />
          ),
        }}
      />
      <Tabs.Screen
        name="settings"
        options={{
          title: 'More',
          tabBarIcon: ({ color }) => (
            <SymbolView
              name={{ ios: 'ellipsis.circle.fill', android: 'more_horiz', web: 'more_horiz' }}
              tintColor={color}
              size={23}
            />
          ),
        }}
      />
    </Tabs>
  );
}
