import { useMemo } from 'react';

import { familyThreadLabels, kidsU8Roster, parentChatOptedIn } from '@/data/demo';
import { ACTIVE_COACH } from '@/lib/coachRecap';
import {
  COACH_THREAD,
  canSeeThread,
  initialsOf,
  lastMessage,
  parentLabel,
  threadChildId,
  threadKind,
  totalUnread,
  unreadCount,
  viewerFor,
} from '@/lib/messaging';
import { useApp } from '@/state/AppProvider';
import type { TintName } from '@/theme/tokens';
import type { DirectMessage } from '@/types/domain';

export type ThreadSummary = {
  id: string;
  title: string;
  subtitle?: string;
  avatar: string;
  tint: TintName;
  last?: DirectMessage;
  unread: number;
};

const PARENT_TINTS: TintName[] = ['sky', 'blush', 'lilac', 'mint'];

/** Everything the inbox, the Home chat bar and the badges need, for whoever is signed in. */
export function useThreads() {
  const { role, household, messages, threadReads, parentChatOn, blockedThreads } = useApp();
  const viewer = viewerFor(role, household.id);

  return useMemo(() => {
    const summary = (id: string, title: string, subtitle: string | undefined, tint: TintName, avatarFrom: string = title): ThreadSummary => ({
      id,
      title,
      subtitle,
      avatar: initialsOf(avatarFrom),
      tint,
      last: lastMessage(messages, id),
      unread: blockedThreads.includes(id) ? 0 : unreadCount(messages, id, viewer, threadReads),
    });

    const byRecent = (a: ThreadSummary, b: ThreadSummary) =>
      new Date(b.last?.createdAt ?? 0).getTime() - new Date(a.last?.createdAt ?? 0).getTime();

    const coach = viewer?.role === 'guardian' ? summary(COACH_THREAD, ACTIVE_COACH.displayName, 'U8 coach', 'gold', ACTIVE_COACH.fullName) : undefined;

    // The coach's inbox: one thread per family, newest first.
    const families =
      viewer?.role === 'coach'
        ? [...new Set(messages.map((message) => message.threadId))]
            .filter((id) => canSeeThread(viewer, id) && (threadKind(id) === 'coach' || threadKind(id) === 'family'))
            .map((id) => summary(id, familyThreadLabels[id]?.title ?? 'Family', familyThreadLabels[id]?.subtitle, 'gold'))
            .sort(byRecent)
        : [];

    const ownChildren = new Set(household.children.map((child) => child.id));
    const parentThreads =
      viewer?.role === 'guardian' && parentChatOn
        ? [...new Set(messages.map((message) => message.threadId))]
            .filter((id) => threadKind(id) === 'parent' && canSeeThread(viewer, id))
            .map((id, index) => {
              const child = kidsU8Roster.find((person) => person.id === threadChildId(id));
              return summary(id, parentLabel(child?.firstName ?? 'a teammate'), 'U8 parent', PARENT_TINTS[index % PARENT_TINTS.length]);
            })
            .sort(byRecent)
        : [];

    const talking = new Set(parentThreads.map((thread) => threadChildId(thread.id)));
    const available =
      viewer?.role === 'guardian' && parentChatOn
        ? kidsU8Roster.filter((child) => child.familyContact !== false && !ownChildren.has(child.id) && parentChatOptedIn.has(child.id) && !talking.has(child.id))
        : [];

    return {
      viewer,
      coach,
      families,
      parentThreads,
      available,
      blocked: blockedThreads,
      unread: totalUnread(messages, viewer, threadReads, blockedThreads, parentChatOn),
    };
  }, [blockedThreads, household.children, messages, parentChatOn, threadReads, viewer]);
}
