import { router, type Href } from 'expo-router';

export function safeBack(fallback: Href = '/(tabs)') {
  if (router.canGoBack()) {
    router.back();
    return;
  }
  router.replace(fallback);
}

/** One-way exit from Welcome / account so Back cannot reopen completed onboarding. */
export function leaveOnboarding(href: Href = '/(tabs)') {
  if (typeof router.dismissTo === 'function') {
    try {
      router.dismissTo(href);
      return;
    } catch {
      undefined;
    }
  }
  router.replace(href);
}
