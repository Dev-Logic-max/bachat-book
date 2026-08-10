import React from 'react';
import { View, StyleSheet } from 'react-native';
import { Slot } from 'expo-router';
import { BottomNav } from '../../src/components/BottomNav';
import { colors } from '../../src/theme/tokens';

export default function TabsLayout() {
  return (
    <View style={styles.container}>
      <View style={styles.content}>
        <Slot />
      </View>
      <BottomNav />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.light.canvas,
  },
  content: {
    flex: 1,
    paddingBottom: 90, // Leave room for floating bottom nav (SPEC §2.4)
  },
});
