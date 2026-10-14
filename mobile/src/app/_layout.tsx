import { Stack, useRouter } from 'expo-router';
import * as Linking from 'expo-linking';
import { StatusBar } from 'expo-status-bar';
import { useEffect, useRef } from 'react';
import { ActivityIndicator, View } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { RestTimerBar } from '@/components/RestTimerBar';
import { darkPalette } from '@/constants/theme';
import { parseAuthParams } from '@/lib/authLinks';
import { storage } from '@/lib/storage';
import { supabase } from '@/lib/supabase';
import { backupToCloud } from '@/lib/sync';
import { AuthProvider, useAuth } from '@/store/auth';
import { MachinesProvider } from '@/store/machines';
import { NutritionProvider } from '@/store/nutrition';
import { ProfileProvider } from '@/store/profile';
import { RestTimerProvider } from '@/store/restTimer';
import { ThemeProvider, useTheme } from '@/store/theme';
import { WorkoutProvider } from '@/store/workouts';

/** Auto-pushes local changes to the cloud (debounced) while signed in. */
function CloudSync() {
  const { user } = useAuth();
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => {
    if (!user) return;
    const unsub = storage.onChange(() => {
      if (timer.current) clearTimeout(timer.current);
      timer.current = setTimeout(() => {
        backupToCloud().catch(() => {});
      }, 2500);
    });
    return () => {
      unsub();
      if (timer.current) clearTimeout(timer.current);
    };
  }, [user]);
  return null;
}

/**
 * Handles Supabase email links that deep-link back into the app. Recovery links
 * go to the reset-password screen; confirmation/magic links just set the session
 * (which signs the user in via onAuthStateChange).
 */
function useAuthDeepLinks() {
  const url = Linking.useURL();
  const router = useRouter();
  const lastHandled = useRef<string | null>(null);
  useEffect(() => {
    if (!url || !supabase || lastHandled.current === url) return;
    const parsed = parseAuthParams(url);
    if (!parsed) return;
    lastHandled.current = url;
    if (parsed.type === 'recovery') {
      router.push({
        pathname: '/reset-password',
        params: { at: parsed.access_token, rt: parsed.refresh_token },
      });
    } else {
      void supabase.auth
        .setSession({ access_token: parsed.access_token, refresh_token: parsed.refresh_token })
        .catch(() => {});
    }
  }, [url, router]);
}

function ThemedApp() {
  const { palette, isDark } = useTheme();
  useAuthDeepLinks();
  return (
    <>
      <StatusBar style={isDark ? 'light' : 'dark'} />
      <CloudSync />
      <Stack
        screenOptions={{
          headerShown: false,
          contentStyle: { backgroundColor: palette.bg },
        }}>
        <Stack.Screen name="(tabs)" />
        <Stack.Screen name="auth" options={{ presentation: 'card' }} />
        <Stack.Screen name="reset-password" options={{ presentation: 'card' }} />
        <Stack.Screen name="profile" options={{ presentation: 'card' }} />
        <Stack.Screen name="settings" options={{ presentation: 'card' }} />
        <Stack.Screen name="records" options={{ presentation: 'card' }} />
        <Stack.Screen name="exercise/[id]" options={{ presentation: 'card' }} />
        <Stack.Screen name="session/[id]" />
        <Stack.Screen name="machine/[id]" />
        <Stack.Screen name="machine/edit" options={{ presentation: 'card' }} />
        <Stack.Screen name="template/edit" options={{ presentation: 'card' }} />
        <Stack.Screen name="template/import" options={{ presentation: 'card' }} />
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

/**
 * All data/personalization providers, keyed by the auth reset counter so that
 * signing out remounts them — clearing in-memory state and re-reading the
 * (now-wiped) storage from scratch.
 */
function AppTree() {
  const { loading, resetKey } = useAuth();

  // Hold the app on a splash until the initial session check + cloud pull is
  // done, so stores mount with the account's data already in local storage.
  if (loading) {
    return (
      <View style={{ flex: 1, backgroundColor: darkPalette.bg, alignItems: 'center', justifyContent: 'center' }}>
        <ActivityIndicator color={darkPalette.accent} />
      </View>
    );
  }

  return (
    <ThemeProvider key={resetKey}>
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
    </ThemeProvider>
  );
}

export default function RootLayout() {
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <AuthProvider>
          <AppTree />
        </AuthProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}
