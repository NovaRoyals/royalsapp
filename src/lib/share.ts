import { Platform, Share } from 'react-native';

export async function shareContent(payload: { title: string; message: string; url?: string }) {
  const text = payload.url ? `${payload.message}\n${payload.url}` : payload.message;
  try {
    if (Platform.OS === 'web' && typeof navigator !== 'undefined') {
      if (typeof navigator.share === 'function') {
        await navigator.share({ title: payload.title, text: payload.message, url: payload.url });
        return 'shared' as const;
      }
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(text);
        return 'copied' as const;
      }
    }
    await Share.share({ title: payload.title, message: text });
    return 'shared' as const;
  } catch {
    return 'cancelled' as const;
  }
}
