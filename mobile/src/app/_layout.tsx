import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { palette } from '@/constants/theme';
import { WorkoutProvider } from '@/store/workouts';

export default function RootLayout() {
  return (
    <GestureHandlerRootView style={{ flex: 1, backgroundColor: palette.bg }}>
      <SafeAreaProvider>
        <WorkoutProvider>
          <StatusBar style="light" />
          <Stack
            screenOptions={{
              headerShown: false,
              contentStyle: { backgroundColor: palette.bg },
            }}>
            <Stack.Screen name="(tabs)" />
            <Stack.Screen name="workout/active" options={{ presentation: 'card' }} />
            <Stack.Screen name="session/[id]" />
          </Stack>
        </WorkoutProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}
