export type DashboardDevice = 'desktop' | 'tablet' | 'mobile';
export type DashboardTemplate = 'FOCUS' | 'PERFORMANCE' | 'FINAL_STRETCH' | 'CUSTOM';
export type DashboardWidgetId =
  | 'next-action'
  | 'agenda'
  | 'study-time'
  | 'reviews'
  | 'questions'
  | 'planning'
  | 'exams';

export type DashboardWidget = { id: DashboardWidgetId; span: number };
export type DashboardDeviceOverride = { widgetIds: DashboardWidgetId[] };

export type DashboardState = {
  template: DashboardTemplate;
  widgets: DashboardWidget[];
  devices: Partial<Record<DashboardDevice, DashboardDeviceOverride>>;
};

export type ResolvedDashboardLayout = {
  template: DashboardTemplate;
  device: DashboardDevice;
  columns: 1 | 2 | 4;
  widgets: DashboardWidget[];
  source: 'device' | 'base';
};

export const DASHBOARD_TEMPLATES: DashboardTemplate[] = [
  'FOCUS',
  'PERFORMANCE',
  'FINAL_STRETCH',
  'CUSTOM',
];

const TEMPLATE_WEIGHTS: Record<Exclude<DashboardTemplate, 'CUSTOM'>, DashboardWidget[]> = {
  FOCUS: [
    { id: 'next-action', span: 4 },
    { id: 'agenda', span: 4 },
    { id: 'study-time', span: 2 },
    { id: 'reviews', span: 2 },
    { id: 'questions', span: 2 },
    { id: 'planning', span: 2 },
  ],
  PERFORMANCE: [
    { id: 'questions', span: 4 },
    { id: 'study-time', span: 4 },
    { id: 'next-action', span: 4 },
    { id: 'planning', span: 4 },
    { id: 'reviews', span: 4 },
    { id: 'agenda', span: 4 },
  ],
  FINAL_STRETCH: [
    { id: 'exams', span: 4 },
    { id: 'next-action', span: 4 },
    { id: 'planning', span: 4 },
    { id: 'reviews', span: 4 },
    { id: 'agenda', span: 4 },
    { id: 'study-time', span: 4 },
  ],
};

export const DEFAULT_DASHBOARD_STATE: DashboardState = {
  template: 'FOCUS',
  widgets: TEMPLATE_WEIGHTS.FOCUS.map((widget) => ({ ...widget })),
  devices: {},
};

export function dashboardWidgetsForTemplate(template: DashboardTemplate): DashboardWidget[] {
  if (template === 'CUSTOM') return DEFAULT_DASHBOARD_STATE.widgets.map((widget) => ({ ...widget }));
  return TEMPLATE_WEIGHTS[template].map((widget) => ({ ...widget }));
}

export function resolveDashboardLayout(
  state: DashboardState,
  device: DashboardDevice,
): ResolvedDashboardLayout {
  const byId = new Map(state.widgets.map((widget) => [widget.id, widget]));
  const override = state.devices[device];
  const ids =
    override?.widgetIds ??
    (device === 'mobile'
      ? (['next-action', 'agenda', 'study-time', 'reviews'] as DashboardWidgetId[])
      : state.widgets.map((widget) => widget.id));
  const seen = new Set<DashboardWidgetId>();
  const widgets: DashboardWidget[] = [];
  for (const id of ids) {
    if (seen.has(id)) continue;
    const widget = byId.get(id);
    if (!widget) continue;
    seen.add(id);
    widgets.push({ ...widget });
  }
  if (widgets.length === 0) {
    for (const widget of state.widgets.slice(0, 1)) widgets.push({ ...widget });
  }
  return {
    template: state.template,
    device,
    columns: device === 'mobile' ? 1 : device === 'tablet' ? 2 : 4,
    widgets,
    source: override ? 'device' : 'base',
  };
}

export function updateDashboardDevice(
  state: DashboardState,
  device: DashboardDevice,
  update: DashboardDeviceOverride,
): DashboardState {
  const valid = new Set(state.widgets.map((widget) => widget.id));
  const seen = new Set<DashboardWidgetId>();
  const widgetIds = update.widgetIds.filter((id) => valid.has(id) && !seen.has(id) && Boolean(seen.add(id)));
  return {
    ...state,
    devices: {
      ...state.devices,
      [device]: { widgetIds: widgetIds.length > 0 ? widgetIds : state.widgets.map((widget) => widget.id) },
    },
  };
}

export function moveDashboardWidget(
  widgetIds: readonly string[],
  id: string,
  delta: -1 | 1,
): DashboardWidgetId[] {
  const next = [...widgetIds] as DashboardWidgetId[];
  const from = next.indexOf(id as DashboardWidgetId);
  const to = from + delta;
  if (from < 0 || to < 0 || to >= next.length) return next;
  [next[from], next[to]] = [next[to]!, next[from]!];
  return next;
}

export function applyDashboardTemplate(
  state: DashboardState,
  template: DashboardTemplate,
): DashboardState {
  const widgets = dashboardWidgetsForTemplate(template);
  return { template, widgets, devices: {} };
}
