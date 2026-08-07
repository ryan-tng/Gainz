import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { RestTimerBar } from '@/components/RestTimerBar';
import { AuthProvider } from '@/store/auth';
import { MachinesProvider } from '@/store/machines';
import { NutritionProvider } from '@/store/nutrition';
import { ProfileProvider } from '@/store/profile';
import { RestTimerProvider } from '@/store/restTimer';
import { ThemeProvider, useTheme } from '@/store/theme';
import { WorkoutProvider } from '@/store/workouts';

function ThemedApp() {
  const { palette, isDark } = useTheme();
  return (
    <>
      <StatusBar style={isDark ? 'light' : 'dark'} />
      <Stack
        screenOptions={{
          headerShown: false,
          contentStyle: { backgroundColor: palette.bg },
        }}>
        <Stack.Screen name="(tabs)" />
        <Stack.Screen name="auth" options={{ presentation: 'card' }} />
        <Stack.Screen name="profile" options={{ presentation: 'card' }} />
        <Stack.Screen name="settings" options={{ presentation: 'card' }} />
        <Stack.Screen name="records" options={{ presentation: 'card' }} />
        <Stack.Screen name="exercise/[id]" options={{ presentation: 'card' }} />
        <Stack.Screen name="session/[id]" />
        <Stack.Screen name="machine/[id]" />
        <Stack.Screen name="machine/edit" options={{ presentation: 'card' }} />
        <Stack.Screen name="template/edit" options={{ presentation: 'card' }} />
        <Stack.Screen name="nutrition/goal" options={{ presentation: 'card' }} />
        <Stack.Screen name="nutrition/scan" options={{ presentation: 'card' }} />
        <Stack.Screen name="nutrition/add" options={{ presentation: 'card' }} />
        <Stack.Screen name="nutrition/search" options={{ presentation: 'card' }} />
        <Stack.Screen name="nutrition/barcode" options={{ presentation: 'card' }} />
        <Stack.Screen name="nutrition/coach" options={{ presentation: 'card' }} />
      </Stack>
      <RestTimerBar />
    </>
  );
}

export default function RootLayout() {
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <ThemeProvider>
          <AuthProvider>
            <ProfileProvider>
              <WorkoutProvider>
                <MachinesProvider>
                  <NutritionProvider>
                    <RestTimerProvider>
                      <ThemedApp />
                    </RestTimerProvider>
                  </NutritionProvider>
                </MachinesProvider>
              </WorkoutProvider>
            </ProfileProvider>
          </AuthProvider>
        </ThemeProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}
