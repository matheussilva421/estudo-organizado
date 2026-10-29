import { describe, expect, it } from 'vitest';
import {
  nextPriorityRevision,
  rankContent,
  type PriorityItem,
  type PriorityProfile,
} from '../../src/domain/planning-priority';

const profile: PriorityProfile = {
  id: 'priority-default',
  revision: 1,
  name: 'Padrão',
  weights: { urgency: 2, depth: 1, volume: 0.5, pending: 3 },
};

function items(count: number): PriorityItem[] {
  return Array.from({ length: count }, (_, index) => ({
    contentKey: `disc-${Math.floor(index / 15) + 1}/assunto-${(index % 15) + 1}`,
    editalDisciplineId: `link-${Math.floor(index / 15) + 1}`,
    assuntoId: `assunto-${index + 1}`,
    label: `Conteúdo ${index + 1}`,
    depth: index % 3,
    plannedMinutes: 30 + (index % 4) * 15,
    pending: index % 5 === 0,
    examDate: '2027-01-24',
  }));
}

describe('F3 priority profiles', () => {
  it('new_revision_never_rewrites_the_pinned_one', () => {
    const snapshot = { ...profile, weights: { ...profile.weights } };
    const updated = nextPriorityRevision(profile, {
      name: 'Padrão 2',
      weights: { pending: 5 },
    });
    expect(profile).toEqual(snapshot);
    expect(profile.revision).toBe(1);
    expect(updated.revision).toBe(2);
    expect(updated.weights.pending).toBe(5);
    expect(updated.weights.urgency).toBe(2);
    expect(rankContent({ profile, items: items(3) })).toHaveLength(3);
    expect(rankContent({ profile: updated, items: items(3) })).toHaveLength(3);
  });

  it('ranking_is_deterministic_and_ties_break_on_stable_keys', () => {
    const tied: PriorityItem[] = [
      { contentKey: 'b', editalDisciplineId: 'link-1', depth: 1, plannedMinutes: 60 },
      { contentKey: 'a', editalDisciplineId: 'link-1', depth: 1, plannedMinutes: 60 },
      { contentKey: 'c', editalDisciplineId: 'link-1', depth: 1, plannedMinutes: 60 },
    ];
    const flat: PriorityProfile = {
      ...profile,
      weights: { urgency: 0, depth: 0, volume: 0, pending: 0 },
    };
    const first = rankContent({ profile: flat, items: tied });
    const second = rankContent({ profile: flat, items: [...tied].reverse() });
    expect(first.map((item) => item.contentKey)).toEqual(['a', 'b', 'c']);
    expect(second.map((item) => item.contentKey)).toEqual(['a', 'b', 'c']);
    expect(first.map((item) => item.rank)).toEqual([1, 2, 3]);
  });

  it('ranks_one_hundred_and_twenty_items_without_losing_any', () => {
    const ranked = rankContent({ profile, items: items(120), referenceDate: '2026-10-29' });
    expect(ranked).toHaveLength(120);
    expect(new Set(ranked.map((item) => item.contentKey)).size).toBe(120);
    expect(ranked.every((item) => item.explanation.length > 0)).toBe(true);
    expect(ranked.every((item, index) => item.rank === index + 1)).toBe(true);
    expect(ranked.some((item) => /desempenho/i.test(item.explanation))).toBe(false);
  });
});
