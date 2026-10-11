import { Capacitor } from '@capacitor/core';
import { Filesystem, Directory, Encoding } from '@capacitor/filesystem';
import { Share } from '@capacitor/share';

/**
 * Converts ArrayBuffer / Uint8Array to base64 string safely
 */
function bufferToBase64(buffer) {
  let binary = '';
  const bytes = new Uint8Array(buffer);
  const len = bytes.byteLength;
  for (let i = 0; i < len; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return window.btoa(binary);
}

/**
 * Downloads or shares a file across Web and Native (Capacitor Android / iOS)
 * @param {Object} options
 * @param {string} options.fileName - e.g. "report.xlsx", "sales.pdf", "backup.json"
 * @param {string|ArrayBuffer|Blob} options.data - file content (string, ArrayBuffer, or Blob)
 * @param {string} [options.mimeType] - MIME type of the file
 * @param {string} [options.shareTitle] - Dialog title for native share
 * @param {string} [options.shareText] - Dialog text for native share
 * @returns {Promise<{ success: boolean, native: boolean, path?: string }>}
 */
export async function downloadOrShareFile({
  fileName,
  data,
  mimeType = 'application/octet-stream',
  shareTitle = 'Exported File',
  shareText = 'Exported from Aster POS'
}) {
  try {
    const isNative = Capacitor.isNativePlatform();

    if (isNative) {
      let base64Data = '';
      let isTextEncoding = false;

      if (typeof data === 'string') {
        // Plain text / JSON
        base64Data = data;
        isTextEncoding = true;
      } else if (data instanceof Blob) {
        const arrayBuffer = await data.arrayBuffer();
        base64Data = bufferToBase64(arrayBuffer);
      } else if (data instanceof ArrayBuffer || ArrayBuffer.isView(data)) {
        base64Data = bufferToBase64(data);
      } else {
        base64Data = JSON.stringify(data, null, 2);
        isTextEncoding = true;
      }

      const fileOptions = {
        path: fileName,
        data: base64Data,
        directory: Directory.Cache,
      };

      if (isTextEncoding) {
        fileOptions.encoding = Encoding.UTF8;
      }

      const result = await Filesystem.writeFile(fileOptions);

      await Share.share({
        title: shareTitle,
        text: shareText,
        url: result.uri,
        dialogTitle: shareTitle
      });

      return { success: true, native: true, path: result.uri };
    } else {
      // Browser web download
      let blob;
      if (data instanceof Blob) {
        blob = data;
      } else if (typeof data === 'string') {
        blob = new Blob([data], { type: mimeType });
      } else if (data instanceof ArrayBuffer || ArrayBuffer.isView(data)) {
        blob = new Blob([data], { type: mimeType });
      } else {
        blob = new Blob([JSON.stringify(data, null, 2)], { type: mimeType });
      }

      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = fileName;
      document.body.appendChild(link);
      link.click();
      setTimeout(() => {
        document.body.removeChild(link);
        URL.revokeObjectURL(url);
      }, 200);

      return { success: true, native: false };
    }
  } catch (err) {
    console.error('downloadOrShareFile failed:', err);
    throw err;
  }
}
