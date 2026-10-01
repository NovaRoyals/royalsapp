/**
 * Reviewer labs are not Profile content.
 * They open in local development, or in a build that sets EXPO_PUBLIC_REVIEWER_TOOLS=1.
 */
export const showReviewerLabs =
  (typeof __DEV__ !== 'undefined' && __DEV__) || process.env.EXPO_PUBLIC_REVIEWER_TOOLS === '1';
