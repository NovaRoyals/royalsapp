import { router, type Href } from 'expo-router';

export function safeBack(fallback: Href = '/(tabs)') {
  if (router.canGoBack()) {
    router.back();
    return;
  }
  router.replace(fallback);
}
