import { SafeAreaView } from "react-native-safe-area-context";
import React, { useMemo, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  TextInput,
  ScrollView,
  Platform,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as DocumentPicker from 'expo-document-picker';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useRouter } from 'expo-router';
import { API_BASE } from '../config/api';
import { FONTS } from '../theme/typography';

const theme = {
  bg: '#16130c',
  surface: '#221f18',
  border: 'rgba(77,70,54,0.35)',
  text: '#e9e2d5',
  muted: '#99907d',
  primary: '#f5d060',
  danger: '#ef5350',
};

const formatSize = (bytes = 0) => {
  if (!bytes) return 'Unknown size';
  const units = ['B', 'KB', 'MB', 'GB'];
  let value = bytes;
  let i = 0;
  while (value >= 1024 && i < units.length - 1) {
    value /= 1024;
    i += 1;
  }
  return `${value.toFixed(i === 0 ? 0 : 1)} ${units[i]}`;
};

export default function UploadMaterialScreen() {
  const router = useRouter();
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [files, setFiles] = useState([]);
  const [uploading, setUploading] = useState(false);

  const disabled = useMemo(
    () => uploading || !title.trim() || files.length === 0,
    [uploading, title, files.length]
  );

  const pickFiles = async () => {
    try {
      const result = await DocumentPicker.getDocumentAsync({
        multiple: true,
        copyToCacheDirectory: true,
      });

      if (result.canceled) return;

      const selected = result.assets || [];
      setFiles((prev) => {
        const existingUris = new Set(prev.map((file) => file.uri));
        const merged = [...prev];
        selected.forEach((asset) => {
          if (!existingUris.has(asset.uri)) {
            merged.push(asset);
          }
        });
        return merged;
      });
    } catch {
      Alert.alert('Unable to select files', 'Please try again.');
    }
  };

  const removeFile = (uri) => {
    setFiles((prev) => prev.filter((file) => file.uri !== uri));
  };

  const uploadMaterials = async () => {
    if (disabled) return;

    try {
      setUploading(true);

      const token = await AsyncStorage.getItem('token');
      const formData = new FormData();
      formData.append('title', title.trim());
      formData.append('description', description.trim());

      files.forEach((file, index) => {
        formData.append('materials', {
          uri: file.uri,
          name: file.name || `material-${index + 1}`,
          type: file.mimeType || 'application/octet-stream',
        });
      });

      const res = await fetch(`${API_BASE}/materials/upload`, {
        method: 'POST',
        headers: token ? { Authorization: `Bearer ${token}` } : {},
        body: formData,
      });

      if (!res.ok) {
        let message = 'Unable to upload materials right now.';
        try {
          const payload = await res.json();
          message = payload?.message || message;
        } catch {
          const text = await res.text();
          if (text) message = text;
        }
        throw new Error(message);
      }

      Alert.alert('Upload complete', 'Materials uploaded successfully.');
      setTitle('');
      setDescription('');
      setFiles([]);
      router.back();
    } catch (error) {
      console.error('Material upload failed:', error);
      Alert.alert('Upload failed', error.message || 'Please try again later.');
    } finally {
      setUploading(false);
    }
  };

  return (
    <View style={styles.safeArea}>
      <View style={styles.header}>
        <TouchableOpacity
          onPress={() => router.back()}
          style={styles.backButton}
          hitSlop={{
            top: 10,
            bottom: 10,
            left: 10,
            right: 10
          }}>
          <Ionicons name="arrow-back" size={22} color={theme.primary} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Upload Material</Text>
      </View>
      <ScrollView
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled">
        <View style={styles.card}>
          <Text style={styles.label}>Title</Text>
          <TextInput
            style={styles.input}
            placeholder="e.g. Week 4 Lecture Slides"
            placeholderTextColor={theme.muted}
            value={title}
            onChangeText={setTitle}
          />

          <Text style={styles.label}>Description (optional)</Text>
          <TextInput
            style={[styles.input, styles.description]}
            placeholder="Add a short note for students"
            placeholderTextColor={theme.muted}
            multiline
            textAlignVertical="top"
            value={description}
            onChangeText={setDescription}
          />

          <TouchableOpacity
            style={styles.filePickerButton}
            onPress={pickFiles}
            activeOpacity={0.85}
            hitSlop={{
              top: 10,
              bottom: 10,
              left: 10,
              right: 10
            }}>
            <Ionicons name="attach" size={18} color={theme.primary} />
            <Text style={styles.filePickerText}>Choose Files</Text>
          </TouchableOpacity>

          {files.length === 0 ? (
            <Text style={styles.emptyText}>No files selected yet.</Text>
          ) : (
            <View style={styles.fileList}>
              {files.map((file) => (
                <View key={file.uri} style={styles.fileItem}>
                  <View style={styles.fileMeta}>
                    <Text numberOfLines={1} style={styles.fileName}>{file.name}</Text>
                    <Text style={styles.fileSize}>{formatSize(file.size)}</Text>
                  </View>
                  <TouchableOpacity
                    onPress={() => removeFile(file.uri)}
                    hitSlop={{
                      top: 10,
                      bottom: 10,
                      left: 10,
                      right: 10
                    }}>
                    <Ionicons name="close-circle" size={20} color={theme.danger} />
                  </TouchableOpacity>
                </View>
              ))}
            </View>
          )}

          <TouchableOpacity
            style={[styles.submitButton, disabled && styles.submitButtonDisabled]}
            disabled={disabled}
            onPress={uploadMaterials}
            activeOpacity={0.85}
            hitSlop={{
              top: 10,
              bottom: 10,
              left: 10,
              right: 10
            }}>
            {uploading ? (
              <ActivityIndicator size="small" color="#16130c" />
            ) : (
              <Text style={styles.submitButtonText}>Upload Materials</Text>
            )}
          </TouchableOpacity>
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: theme.bg,
    
  , paddingTop: Platform.OS === 'android' ? 64 : 88 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    marginBottom: 12,
  },
  backButton: {
    padding: 2,
    marginRight: 10,
  },
  headerTitle: {
    fontFamily: FONTS.bold,
    color: theme.primary,
    fontSize: 24,
  },
  content: {
    paddingHorizontal: 20,
    paddingBottom: 28,
  },
  card: {
    backgroundColor: theme.surface,
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: theme.border,
  },
  label: {
    fontFamily: FONTS.medium,
    color: theme.text,
    marginBottom: 8,
    fontSize: 14,
  },
  input: {
    backgroundColor: '#1a1710',
    borderWidth: 1,
    borderColor: theme.border,
    borderRadius: 10,
    color: theme.text,
    fontFamily: FONTS.regular,
    fontSize: 14,
    paddingHorizontal: 12,
    paddingVertical: 10,
    marginBottom: 14,
  },
  description: {
    minHeight: 90,
  },
  filePickerButton: {
    borderWidth: 1,
    borderColor: theme.primary,
    borderStyle: 'dashed',
    borderRadius: 10,
    paddingVertical: 12,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: 8,
  },
  filePickerText: {
    fontFamily: FONTS.semibold,
    color: theme.primary,
    fontSize: 14,
  },
  emptyText: {
    marginTop: 12,
    color: theme.muted,
    fontFamily: FONTS.regular,
    fontSize: 13,
  },
  fileList: {
    marginTop: 12,
    gap: 10,
  },
  fileItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#1a1710',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: theme.border,
    paddingHorizontal: 10,
    paddingVertical: 8,
  },
  fileMeta: {
    flex: 1,
    marginRight: 10,
  },
  fileName: {
    color: theme.text,
    fontFamily: FONTS.medium,
    fontSize: 13,
  },
  fileSize: {
    color: theme.muted,
    fontFamily: FONTS.regular,
    fontSize: 12,
    marginTop: 2,
  },
  submitButton: {
    marginTop: 16,
    borderRadius: 12,
    backgroundColor: theme.primary,
    paddingVertical: 13,
    alignItems: 'center',
    justifyContent: 'center',
  },
  submitButtonDisabled: {
    opacity: 0.5,
  },
  submitButtonText: {
    color: '#16130c',
    fontFamily: FONTS.bold,
    fontSize: 14,
  },
});
