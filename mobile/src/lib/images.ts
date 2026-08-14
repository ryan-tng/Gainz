import * as ImagePicker from 'expo-image-picker';
import { Alert, Platform } from 'react-native';

export interface CapturedPhoto {
  uri: string;
  base64: string;
  mimeType: string;
}

function toMime(asset: ImagePicker.ImagePickerAsset): string {
  if (asset.mimeType) return asset.mimeType;
  const ext = asset.uri.split('.').pop()?.toLowerCase();
  if (ext === 'png') return 'image/png';
  if (ext === 'webp') return 'image/webp';
  return 'image/jpeg';
}

/**
 * Convert a picked asset to a portable data: URI so the same image works on
 * native AND web (and syncs cleanly across devices). Falls back to the raw uri.
 */
function assetToDataUri(asset: ImagePicker.ImagePickerAsset): string {
  if (asset.base64) return `data:${toMime(asset)};base64,${asset.base64}`;
  return asset.uri;
}

/**
 * Returns a uri only if the current platform can actually render it. `blob:`
 * URLs (from web) can't load on native, and `file:` URLs (from native) can't
 * load on web — so we skip those instead of crashing.
 */
export function usableImageUri(uri?: string | null): string | undefined {
  if (!uri) return undefined;
  if (uri.startsWith('data:') || uri.startsWith('http:') || uri.startsWith('https:')) return uri;
  if (Platform.OS === 'web') return uri.startsWith('blob:') ? uri : undefined;
  return uri.startsWith('blob:') ? undefined : uri; // native can't load blob:
}

/** Pick a food photo (library or camera) and return it with base64 for the AI scan. */
export async function captureFoodPhoto(from: 'library' | 'camera'): Promise<CapturedPhoto | null> {
  const perm =
    from === 'camera'
      ? await ImagePicker.requestCameraPermissionsAsync()
      : await ImagePicker.requestMediaLibraryPermissionsAsync();
  if (!perm.granted) {
    Alert.alert('Permission needed', `Allow ${from} access to scan your food.`);
    return null;
  }

  const opts: ImagePicker.ImagePickerOptions = {
    mediaTypes: ['images'],
    quality: 0.5,
    base64: true,
    allowsEditing: true,
  };
  const result =
    from === 'camera'
      ? await ImagePicker.launchCameraAsync(opts)
      : await ImagePicker.launchImageLibraryAsync(opts);

  if (result.canceled) return null;
  const asset = result.assets[0];
  if (!asset?.base64) return null;
  return { uri: asset.uri, base64: asset.base64, mimeType: toMime(asset) };
}

/** Launch the photo library and return the picked image URI, or null if cancelled. */
export async function pickFromLibrary(): Promise<string | null> {
  const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
  if (!perm.granted) {
    Alert.alert('Permission needed', 'Allow photo access to add machine pictures.');
    return null;
  }
  const result = await ImagePicker.launchImageLibraryAsync({
    mediaTypes: ['images'],
    quality: 0.6,
    allowsEditing: true,
    base64: true,
  });
  if (result.canceled) return null;
  const asset = result.assets[0];
  return asset ? assetToDataUri(asset) : null;
}

/** Launch the camera and return the captured image URI, or null if cancelled. */
export async function takePhoto(): Promise<string | null> {
  const perm = await ImagePicker.requestCameraPermissionsAsync();
  if (!perm.granted) {
    Alert.alert('Permission needed', 'Allow camera access to photograph machines.');
    return null;
  }
  const result = await ImagePicker.launchCameraAsync({
    quality: 0.6,
    allowsEditing: true,
    base64: true,
  });
  if (result.canceled) return null;
  const asset = result.assets[0];
  return asset ? assetToDataUri(asset) : null;
}
