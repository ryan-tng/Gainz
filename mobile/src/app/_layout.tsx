import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { palette } from '@/constants/theme';
import { MachinesProvider } from '@/store/machines';
import { NutritionProvider } from '@/store/nutrition';
import { WorkoutProvider } from '@/store/workouts';

export default function RootLayout() {
  return (
    <GestureHandlerRootView style={{ flex: 1, backgroundColor: palette.bg }}>
      <SafeAreaProvider>
        <WorkoutProvider>
          <MachinesProvider>
            <NutritionProvider>
              <StatusBar style="light" />
              <Stack
                screenOptions={{
                  headerShown: false,
                  contentStyle: { backgroundColor: palette.bg },
                }}>
                <Stack.Screen name="(tabs)" />
                <Stack.Screen name="session/[id]" />
                <Stack.Screen name="machine/[id]" />
                <Stack.Screen name="machine/edit" options={{ presentation: 'card' }} />
                <Stack.Screen name="template/edit" options={{ presentation: 'card' }} />
                <Stack.Screen name="nutrition/goal" options={{ presentation: 'card' }} />
                <Stack.Screen name="nutrition/scan" options={{ presentation: 'card' }} />
              </Stack>
            </NutritionProvider>
          </MachinesProvider>
        </WorkoutProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}
