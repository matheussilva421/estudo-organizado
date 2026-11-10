export type WidgetScope = 'ALL' | 'REVIEWS' | 'PLANNING' | 'CONTENT' | 'INTEGRITY';

export type WidgetFilterState = {
  global: WidgetScope;
  local: Partial<Record<string, WidgetScope>>;
  groups: Record<string, string[]>;
  groupScope: Record<string, WidgetScope>;
};

export type EffectiveWidgetFilter = {
  scope: WidgetScope;
  source: 'widget' | 'group' | 'global';
  nonAdditive: true;
};

export const EMPTY_WIDGET_FILTERS: WidgetFilterState = {
  global: 'ALL',
  local: {},
  groups: {},
  groupScope: {},
};

export function effectiveWidgetFilter(
  widgetId: string,
  state: WidgetFilterState,
): EffectiveWidgetFilter {
  const local = state.local[widgetId];
  if (local) return { scope: local, source: 'widget', nonAdditive: true };
  for (const [groupId, members] of Object.entries(state.groups)) {
    if (members.includes(widgetId) && state.groupScope[groupId]) {
      return { scope: state.groupScope[groupId]!, source: 'group', nonAdditive: true };
    }
  }
  return { scope: state.global, source: 'global', nonAdditive: true };
}

export function setWidgetScope(
  state: WidgetFilterState,
  widgetId: string,
  scope: WidgetScope | null,
): WidgetFilterState {
  const local = { ...state.local };
  if (scope === null) delete local[widgetId];
  else local[widgetId] = scope;
  return { ...state, local };
}

export function applyScopeToGroup(
  state: WidgetFilterState,
  groupId: string,
  members: readonly string[],
  scope: WidgetScope,
): WidgetFilterState {
  return {
    ...state,
    groups: { ...state.groups, [groupId]: [...new Set(members)] },
    groupScope: { ...state.groupScope, [groupId]: scope },
  };
}
