import { Alert, Platform } from 'react-native';

/**
 * Cross-platform confirm dialog. React Native's `Alert.alert` button callbacks
 * don't work on react-native-web, so on web we fall back to window.confirm.
 * Returns true if the user confirmed.
 */
export function confirmAsync(opts: {
  title: string;
  message?: string;
  confirmText?: string;
  cancelText?: string;
  destructive?: boolean;
}): Promise<boolean> {
  const { title, message, confirmText = 'OK', cancelText = 'Cancel', destructive } = opts;

  if (Platform.OS === 'web') {
    if (typeof window === 'undefined' || !window.confirm) return Promise.resolve(true);
    return Promise.resolve(window.confirm(message ? `${title}\n\n${message}` : title));
  }

  return new Promise((resolve) => {
    Alert.alert(title, message, [
      { text: cancelText, style: 'cancel', onPress: () => resolve(false) },
      {
        text: confirmText,
        style: destructive ? 'destructive' : 'default',
        onPress: () => resolve(true),
      },
    ]);
  });
}

/** Cross-platform info alert (title + message, single OK). */
export function notify(title: string, message?: string) {
  if (Platform.OS === 'web') {
    if (typeof window !== 'undefined' && window.alert) window.alert(message ? `${title}\n\n${message}` : title);
    return;
  }
  Alert.alert(title, message);
}
