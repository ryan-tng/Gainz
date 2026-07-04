import * as ImagePicker from 'expo-image-picker';
import { Alert } from 'react-native';

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
    quality: 0.7,
    allowsEditing: true,
  });
  if (result.canceled) return null;
  return result.assets[0]?.uri ?? null;
}

/** Launch the camera and return the captured image URI, or null if cancelled. */
export async function takePhoto(): Promise<string | null> {
  const perm = await ImagePicker.requestCameraPermissionsAsync();
  if (!perm.granted) {
    Alert.alert('Permission needed', 'Allow camera access to photograph machines.');
    return null;
  }
  const result = await ImagePicker.launchCameraAsync({
    quality: 0.7,
    allowsEditing: true,
  });
  if (result.canceled) return null;
  return result.assets[0]?.uri ?? null;
}
