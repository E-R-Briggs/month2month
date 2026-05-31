import { Platform } from 'react-native';
import { File, Paths } from 'expo-file-system';
import * as Sharing from 'expo-sharing';
import * as DocumentPicker from 'expo-document-picker';

const EXPORT_FILENAME = 'month2month-backup.m2m';

export async function exportFile(data: Uint8Array): Promise<void> {
  if (Platform.OS === 'web') {
    const blob = new Blob([data.buffer as ArrayBuffer], { type: 'application/octet-stream' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = EXPORT_FILENAME;
    a.click();
    URL.revokeObjectURL(url);
    return;
  }

  const file = new File(Paths.cache, EXPORT_FILENAME);
  if (!file.exists) {
    file.create();
  }
  file.write(data);
  await Sharing.shareAsync(file.uri, {
    mimeType: 'application/octet-stream',
    dialogTitle: 'Save month2month backup',
  });
}

export async function importFile(): Promise<Uint8Array | null> {
  if (Platform.OS === 'web') {
    return importFileWeb();
  }

  const result = await DocumentPicker.getDocumentAsync({
    type: '*/*',
    copyToCacheDirectory: true,
  });

  if (result.canceled || !result.assets || result.assets.length === 0) {
    return null;
  }

  const file = new File(result.assets[0].uri);
  return file.bytes();
}

function importFileWeb(): Promise<Uint8Array | null> {
  return new Promise((resolve) => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.m2m';
    input.onchange = async () => {
      const file = input.files?.[0];
      if (!file) {
        resolve(null);
        return;
      }
      const buffer = await file.arrayBuffer();
      resolve(new Uint8Array(buffer));
    };
    input.click();
  });
}
