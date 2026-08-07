import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useState } from 'react';
import {
  Alert,
  Image,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { AppBackground } from '@/components/AppBackground';
import { Radius, Spacing, type Palette } from '@/constants/theme';
import { pickFromLibrary, takePhoto } from '@/lib/images';
import { useProfile } from '@/store/profile';
import { useTheme, useThemedStyles } from '@/store/theme';

export default function ProfileScreen() {
  const router = useRouter();
  const { profile, setProfile } = useProfile();
  const { palette } = useTheme();
  const styles = useThemedStyles(makeStyles);

  const [name, setName] = useState(profile?.name ?? '');
  const [avatarUri, setAvatarUri] = useState<string | undefined>(profile?.avatarUri);

  const canSave = name.trim().length > 0;

  const save = () => {
    if (!canSave) return;
    setProfile({ name: name.trim(), avatarUri });
    router.back();
  };

  const changePhoto = () => {
    const options: { text: string; style?: 'cancel' | 'destructive'; onPress?: () => void }[] = [
      {
        text: 'Take photo',
        onPress: async () => {
          const uri = await takePhoto();
          if (uri) setAvatarUri(uri);
        },
      },
      {
        text: 'Choose from library',
        onPress: async () => {
          const uri = await pickFromLibrary();
          if (uri) setAvatarUri(uri);
        },
      },
    ];
    if (avatarUri) {
      options.push({ text: 'Remove photo', style: 'destructive', onPress: () => setAvatarUri(undefined) });
    }
    options.push({ text: 'Cancel', style: 'cancel' });
    Alert.alert('Profile photo', undefined, options);
  };

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: 'transparent' }]} edges={['top', 'bottom']}>
      <AppBackground />
      <View style={styles.topBar}>
        <Pressable onPress={() => router.back()} hitSlop={16} style={styles.side}>
          <Ionicons name="chevron-back" size={26} color={palette.fg} />
        </Pressable>
        <Text style={styles.topTitle}>Profile</Text>
        <Pressable onPress={save} hitSlop={16} disabled={!canSave} style={styles.side}>
          <Text style={[styles.save, !canSave && styles.saveDisabled]}>Save</Text>
        </Pressable>
      </View>

      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        keyboardVerticalOffset={8}>
        <ScrollView
          contentContainerStyle={styles.content}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}>
          <View style={styles.avatarWrap}>
            <Pressable onPress={changePhoto} style={styles.avatar}>
              {avatarUri ? (
                <Image source={{ uri: avatarUri }} style={styles.avatarImg} />
              ) : (
                <Ionicons name="person" size={44} color={palette.muted} />
              )}
              <View style={styles.avatarEdit}>
                <Ionicons name="camera" size={15} color={palette.onAccent} />
              </View>
            </Pressable>
            <Pressable onPress={changePhoto} hitSlop={8}>
              <Text style={styles.changePhoto}>{avatarUri ? 'Change photo' : 'Add photo'}</Text>
            </Pressable>
          </View>

          <Text style={styles.label}>Name</Text>
          <TextInput
            style={styles.input}
            value={name}
            onChangeText={setName}
            placeholder="Your name"
            placeholderTextColor={palette.muted}
          />
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const makeStyles = (palette: Palette) =>
  StyleSheet.create({
    safe: { flex: 1, backgroundColor: palette.bg },
    topBar: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingHorizontal: Spacing.four,
      paddingVertical: Spacing.three,
      borderBottomColor: palette.border,
      borderBottomWidth: 1,
    },
    side: { minWidth: 60 },
    topTitle: { color: palette.fg, fontSize: 17, fontWeight: '700' },
    save: { color: palette.accent, fontSize: 16, fontWeight: '800', textAlign: 'right' },
    saveDisabled: { color: palette.muted },

    content: { padding: Spacing.four, paddingBottom: Spacing.eight },
    avatarWrap: { alignItems: 'center', gap: Spacing.two, paddingVertical: Spacing.four },
    avatar: {
      width: 96,
      height: 96,
      borderRadius: Radius.full,
      backgroundColor: palette.surface,
      borderColor: palette.border,
      borderWidth: 1,
      alignItems: 'center',
      justifyContent: 'center',
    },
    avatarImg: { width: 96, height: 96, borderRadius: Radius.full },
    avatarEdit: {
      position: 'absolute',
      right: 0,
      bottom: 0,
      width: 30,
      height: 30,
      borderRadius: Radius.full,
      backgroundColor: palette.accent,
      borderColor: palette.bg,
      borderWidth: 2,
      alignItems: 'center',
      justifyContent: 'center',
    },
    changePhoto: { color: palette.accent, fontSize: 14, fontWeight: '700' },

    label: {
      color: palette.muted,
      fontSize: 13,
      fontWeight: '700',
      marginTop: Spacing.two,
      marginBottom: Spacing.two,
    },
    input: {
      color: palette.fg,
      fontSize: 16,
      backgroundColor: palette.surface,
      borderColor: palette.border,
      borderWidth: 1,
      borderRadius: Radius.md,
      paddingHorizontal: Spacing.three,
      paddingVertical: Spacing.three,
    },
  });
