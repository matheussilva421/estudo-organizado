import { describe, expect, it } from 'vitest';
import {
  applyScopeToGroup,
  effectiveWidgetFilter,
  EMPTY_WIDGET_FILTERS,
  setWidgetScope,
} from '../../src/presentation/widget-filters';

describe('F7-UX widget filters', () => {
  it('preserves a local override and never mutates the global scope', () => {
    const local = setWidgetScope({ ...EMPTY_WIDGET_FILTERS, global: 'REVIEWS' }, 'study-time', 'PLANNING');
    expect(effectiveWidgetFilter('study-time', local)).toMatchObject({ scope: 'PLANNING', source: 'widget' });
    expect(effectiveWidgetFilter('reviews', local)).toMatchObject({ scope: 'REVIEWS', source: 'global' });
    expect(local.global).toBe('REVIEWS');
  });

  it('applies a connected group only to its members and keeps scopes non-additive', () => {
    const grouped = applyScopeToGroup(EMPTY_WIDGET_FILTERS, 'academic', ['questions', 'planning', 'questions'], 'CONTENT');
    expect(grouped.groups.academic).toEqual(['questions', 'planning']);
    expect(effectiveWidgetFilter('questions', grouped)).toMatchObject({ scope: 'CONTENT', source: 'group', nonAdditive: true });
    expect(effectiveWidgetFilter('study-time', grouped)).toMatchObject({ scope: 'ALL', source: 'global' });
  });
});
