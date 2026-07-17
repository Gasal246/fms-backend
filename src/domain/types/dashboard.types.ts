export type SnapshotType = 
  | 'tenants_overview'
  | 'camps_overview'
  | 'rooms_overview'
  | 'occupancy_overview'
  | 'analytical_summary';

export type RbacScope = {
  role?: string;
  orgId?: string;
  userId?: string;
};

export type WidgetConfig = {
  id: string;
  type: 'stat_card' | 'table' | 'chart_bar' | 'chart_pie' | 'list';
  title: string;
  dataKey: string;
  visible: boolean;
  order: number;
};

export type LayoutConfig = {
  columns: number;
  widgets: WidgetConfig[];
};

export type DashboardSummaryDocument = {
  _id: string;
  snapshot_type: SnapshotType;
  data: Record<string, any>;
  layout: LayoutConfig;
  metadata: RbacScope;
  computed_at: Date;
  expires_at: Date;
};

export type DashboardQueryRequest = {
  snapshot_type?: SnapshotType;
};
