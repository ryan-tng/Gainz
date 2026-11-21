import { Stack, useRootNavigationState, useRouter } from 'expo-router';
import * as Linking from 'expo-linking';
import * as Notifications from 'expo-notifications';
import { StatusBar } from 'expo-status-bar';
import { useEffect, useRef } from 'react';
import { ActivityIndicator, AppState, View } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { RestTimerBar } from '@/components/RestTimerBar';
import { darkPalette } from '@/constants/theme';
import { notify } from '@/lib/confirm';
import { parseAuthParams } from '@/lib/authLinks';
import { clearStreakReminders, initNotifications, streakIdFrom } from '@/lib/notifications';
import { getMyProfile, refreshStreakReminders } from '@/lib/social';
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

// Set the foreground-display handler + Android channels before anything schedules.
initNotifications();

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
  // Only navigate once the root navigation tree is mounted. On a cold start (the
  // email link launches the app), the effect can otherwise fire before the
  // router is ready and the push is silently dropped.
  const navReady = useRootNavigationState()?.key;
  const lastHandled = useRef<string | null>(null);
  useEffect(() => {
    if (!navReady || !url || !supabase || lastHandled.current === url) return;
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
        .then(({ error }) => {
          if (!error && parsed.type === 'signup') {
            notify('Email verified', "You're all set — welcome to Gainz! 💪");
          }
        })
        .catch(() => {});
    }
  }, [url, router, navReady]);
}

/**
 * Local notifications: keep streak reminders current whenever the app comes to
 * the foreground, clear them on sign-out, and open the streak when a reminder
 * is tapped.
 */
function useNotificationSync() {
  const { user } = useAuth();
  const router = useRouter();
  const navReady = useRootNavigationState()?.key;
  const lastResponse = Notifications.useLastNotificationResponse();
  const handled = useRef<string | null>(null);

  useEffect(() => {
    if (!user) {
      void clearStreakReminders();
      return;
    }
    void refreshStreakReminders();
    const sub = AppState.addEventListener('change', (s) => {
      if (s === 'active') void refreshStreakReminders();
    });
    return () => sub.remove();
  }, [user]);

  useEffect(() => {
    if (!navReady || !user || !lastResponse) return;
    const key = lastResponse.notification.request.identifier;
    if (handled.current === key) return;
    handled.current = key;
    const streakId = streakIdFrom(lastResponse);
    if (streakId) router.push(`/streak/${streakId}`);
  }, [lastResponse, navReady, user, router]);
}

/**
 * Every signed-in account needs a @username. Right after sign-up (once the
 * email link signs them in) — or for older accounts that never picked one —
 * send them to the username screen. Only redirects when the lookup succeeds
 * and finds no profile, so being offline never traps anyone.
 */
function useUsernameGate() {
  const { user } = useAuth();
  const router = useRouter();
  const navReady = useRootNavigationState()?.key;
  const checked = useRef<string | null>(null);

  useEffect(() => {
    if (!navReady || !user || checked.current === user.id) return;
    let cancelled = false;
    getMyProfile()
      .then((p) => {
        if (cancelled) return;
        checked.current = user.id;
        if (!p) router.replace('/username');
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [navReady, user, router]);
}

function ThemedApp() {
  const { palette, isDark } = useTheme();
  useAuthDeepLinks();
  useNotificationSync();
  useUsernameGate();
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
        <Stack.Screen name="username" options={{ presentation: 'card', gestureEnabled: false }} />
        <Stack.Screen name="social" options={{ presentation: 'card' }} />
        <Stack.Screen name="streak/new" options={{ presentation: 'card' }} />
        <Stack.Screen name="streak/[id]" options={{ presentation: 'card' }} />
        <Stack.Screen name="streak/photo" options={{ presentation: 'fullScreenModal' }} />
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
