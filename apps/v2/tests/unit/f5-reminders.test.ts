import { beforeEach, describe, expect, it } from 'vitest';
import { ReviewService } from '../../src/application/review-service';
import { LocalPlanningRepository } from '../../src/platform/local-planning-repository';
import { LocalReviewRepository } from '../../src/platform/local-review-repository';
import { LocalSessionRepository } from '../../src/platform/local-session-repository';
import { deleteV2DatabaseForTests } from '../../src/platform/indexeddb';
import {
  reminderNotificationKey,
  type ReviewCommitment,
} from '../../src/domain/review';

const profileId = 'profile-f5-reminders';
const today = '2026-11-01';

function service(now = `${today}T12:00:00.000Z`, repository = new LocalReviewRepository()): ReviewService {
  return new ReviewService(
    repository,
    new LocalSessionRepository(),
    new LocalPlanningRepository(),
    { now: () => now, zone: 'America/Fortaleza' },
  );
}

function commitment(id: string, dueDate = '2026-10-20'): ReviewCommitment {
  return {
    id,
    profileId,
    canonicalTopicKey: 'disc-1::assunto-1',
    topicLinkId: 'topic-1',
    editalId: 'edital-1',
    assuntoId: 'assunto-1',
    label: `Revisão ${id}`,
    originalDueDate: dueDate,
    currentDueDate: dueDate,
    status: 'PENDING',
    coverage: 'UNKNOWN',
    policyVersion: 1,
    source: 'MANUAL',
    localRevision: 1,
    history: [],
  };
}

async function seedOverdue(
  review: ReviewService,
  count = 5,
  dueDate = '2026-10-20',
): Promise<void> {
  const repository = new LocalReviewRepository();
  for (let index = 1; index <= count; index += 1) {
    const result = await repository.commit({
      type: 'SAVE_COMMITMENT',
      scope: { profileId, operationId: `op-commitment-${index}`, baseRevision: null },
      commitment: {
        ...commitment(`commitment-${index}`, dueDate),
        canonicalTopicKey: `disc-1::assunto-${index}`,
      },
    });
    if (result.kind !== 'LOCAL_COMMITTED') throw new Error('commitment seed failed');
  }
}

beforeEach(async () => {
  await deleteV2DatabaseForTests();
});

describe('F5-T46 local reminders and optional external notifications', () => {
  it('groups five overdue reviews into one summary without promising background delivery', async () => {
    const review = service();
    await seedOverdue(review, 5);
    const reminders = await review.reminders(profileId, today);
    expect(reminders.overdue).toHaveLength(5);
    expect(reminders.message).toContain('5 atrasada');
    expect(reminders.externalNotificationPromise).toBe(false);
  });

  it('dismisses an external notice without completing or cancelling the commitment', async () => {
    const review = service();
    await seedOverdue(review, 1);
    const before = await review.listCommitments(profileId);
    const dismissed = await review.dismissReminder(profileId, 'commitment-1');
    expect(dismissed.kind).toBe('LOCAL_COMMITTED');
    const reminders = await review.reminders(profileId, today);
    expect(reminders.dismissedIds).toContain('commitment-1');
    expect(reminders.overdue).toHaveLength(1);
    const after = await review.listCommitments(profileId);
    expect(after[0]?.status).toBe('PENDING');
    expect(after[0]?.localRevision).toBe(before[0]?.localRevision);

    const rescheduled = await review.reschedule(
      profileId,
      'commitment-1',
      '2026-11-20',
      'op-reschedule-dismissed',
    );
    expect(rescheduled.kind).toBe('LOCAL_COMMITTED');
    expect((await review.reminders(profileId, today)).dismissedIds).not.toContain('commitment-1');
  });

  it('keeps the central list while quiet hours suppress only the external notice', async () => {
    const review = service('2026-11-02T02:00:00.000Z');
    await seedOverdue(review, 1);
    const saved = await review.updateReminderSettings(profileId, {
      externalNotifications: true,
      quietStart: '22:00',
      quietEnd: '07:00',
    });
    expect(saved.kind).toBe('LOCAL_COMMITTED');
    const commitment = (await review.listCommitments(profileId))[0]!;
    expect(await review.claimExternalNotification(profileId, commitment)).toBe('SUPPRESSED_QUIET');
    const reminders = await review.reminders(profileId, today);
    expect(reminders.quietActive).toBe(true);
    expect(reminders.overdue).toHaveLength(1);
    expect(reminders.message).toContain('central local');
  });

  it('deduplicates the same notification across two repository instances', async () => {
    const first = new LocalReviewRepository();
    const second = new LocalReviewRepository();
    const review = service(`${today}T12:00:00.000Z`, first);
    await seedOverdue(review, 1);
    await review.updateReminderSettings(profileId, {
      externalNotifications: true,
      quietStart: '00:00',
      quietEnd: '00:00',
    });
    const key = reminderNotificationKey(commitment('commitment-1'));
    const claims = await Promise.all([
      first.claimNotification(profileId, key, '2026-11-01T12:00:00.000Z'),
      second.claimNotification(profileId, key, '2026-11-01T12:00:01.000Z'),
    ]);
    expect(claims.filter(Boolean)).toHaveLength(1);
    const settings = await review.getReminderSettings(profileId);
    expect(settings.notificationLeases[key]).toBeTruthy();
  });

  it('degrades to disabled when the explicit preference is off', async () => {
    const review = service();
    await seedOverdue(review, 1);
    const commitmentItem = (await review.listCommitments(profileId))[0]!;
    expect(await review.claimExternalNotification(profileId, commitmentItem)).toBe('DISABLED');
    expect((await review.getReminderSettings(profileId)).notificationLeases).toEqual({});
  });

  it('rejects invalid quiet-hour settings instead of silently accepting them', async () => {
    const review = service();
    const result = await review.updateReminderSettings(profileId, {
      quietStart: '25:00',
      quietEnd: '07:00',
    });
    expect(result).toMatchObject({ kind: 'INVALID' });
  });

  it('keeps a subject topic visible when a commitment is dismissed', async () => {
    const review = service();
    await seedOverdue(review, 1);
    await review.dismissReminder(profileId, 'commitment-1');
    expect((await review.reminders(profileId, today)).overdue[0]?.assuntoId).toBe('assunto-1');
  });

  it('F5-T07 orders the overdue backlog by the oldest due date', async () => {
    const review = service();
    await seedOverdue(review, 3, '2026-10-01');
    const repository = new LocalReviewRepository();
    await repository.commit({
      type: 'SAVE_COMMITMENT',
      scope: { profileId, operationId: 'op-older', baseRevision: null },
      commitment: {
        ...commitment('commitment-older', '2026-09-01'),
        canonicalTopicKey: 'disc-1::assunto-older',
      },
    });
    const reminders = await review.reminders(profileId, today);
    expect(reminders.overdue[0]?.id).toBe('commitment-older');
    expect(reminders.overdue.map((item) => item.currentDueDate)).toEqual([
      '2026-09-01',
      '2026-10-01',
      '2026-10-01',
      '2026-10-01',
    ]);
  });
});
