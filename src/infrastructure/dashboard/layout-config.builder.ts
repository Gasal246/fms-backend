import type { LayoutConfig, SnapshotType } from '../../domain/types/dashboard.types.js';

/**
 * Returns the layout configuration for a given snapshot type and role.
 * The frontend uses this to render only the widgets the user is authorised to see.
 */
export function buildLayoutConfig(snapshotType: SnapshotType, role?: string): LayoutConfig {
  const isSuperAdmin = role === 'super_admin';
  const isAdmin      = role === 'admin' || isSuperAdmin;
  const isManager    = role === 'manager' || isAdmin;

  const layouts: Record<SnapshotType, LayoutConfig> = {
    tenants_overview: {
      columns: 3,
      widgets: [
        { id: 'total_tenants',    type: 'stat_card', title: 'Total Tenants',     dataKey: 'total',             visible: true,         order: 1 },
        { id: 'active_tenants',   type: 'stat_card', title: 'Active Tenants',    dataKey: 'active',            visible: true,         order: 2 },
        { id: 'pending_tenants',  type: 'stat_card', title: 'Pending Approval',  dataKey: 'pending',           visible: isManager,    order: 3 },
        { id: 'tenant_by_type',   type: 'chart_pie', title: 'Tenant Types',      dataKey: 'by_type',           visible: isAdmin,      order: 4 },
        { id: 'tenant_trend',     type: 'chart_bar', title: 'Registrations (30d)',dataKey: 'monthly_trend',    visible: isAdmin,      order: 5 },
        { id: 'recent_tenants',   type: 'table',     title: 'Recent Registrations',dataKey: 'recent_list',     visible: isSuperAdmin, order: 6 },
      ],
    },

    camps_overview: {
      columns: 2,
      widgets: [
        { id: 'total_camps',      type: 'stat_card', title: 'Total Camps',       dataKey: 'total',             visible: true,         order: 1 },
        { id: 'active_camps',     type: 'stat_card', title: 'Active Camps',      dataKey: 'active',            visible: true,         order: 2 },
        { id: 'camps_by_zone',    type: 'chart_bar', title: 'Camps per Zone',    dataKey: 'by_zone',           visible: isManager,    order: 3 },
        { id: 'camp_list',        type: 'table',     title: 'Camp Details',      dataKey: 'camp_list',         visible: isAdmin,      order: 4 },
      ],
    },

    rooms_overview: {
      columns: 3,
      widgets: [
        { id: 'total_rooms',      type: 'stat_card', title: 'Total Rooms',       dataKey: 'total',             visible: true,         order: 1 },
        { id: 'available_rooms',  type: 'stat_card', title: 'Available',         dataKey: 'available',         visible: true,         order: 2 },
        { id: 'occupied_rooms',   type: 'stat_card', title: 'Occupied',          dataKey: 'occupied',          visible: true,         order: 3 },
        { id: 'rooms_by_floor',   type: 'chart_bar', title: 'Rooms per Floor',   dataKey: 'by_floor',          visible: isManager,    order: 4 },
        { id: 'rooms_by_building',type: 'chart_pie', title: 'Rooms per Building',dataKey: 'by_building',       visible: isAdmin,      order: 5 },
      ],
    },

    occupancy_overview: {
      columns: 3,
      widgets: [
        { id: 'occupancy_rate',   type: 'stat_card', title: 'Occupancy Rate (%)',dataKey: 'occupancy_rate',    visible: true,         order: 1 },
        { id: 'total_beds',       type: 'stat_card', title: 'Total Beds',        dataKey: 'total_beds',        visible: true,         order: 2 },
        { id: 'occupied_beds',    type: 'stat_card', title: 'Occupied Beds',     dataKey: 'occupied_beds',     visible: true,         order: 3 },
        { id: 'occupancy_trend',  type: 'chart_bar', title: 'Occupancy Trend',   dataKey: 'occupancy_trend',   visible: isManager,    order: 4 },
        { id: 'top_camps',        type: 'list',      title: 'Most Occupied Camps',dataKey: 'top_camps',        visible: isAdmin,      order: 5 },
        { id: 'raw_occupancy',    type: 'table',     title: 'Full Occupancy Data',dataKey: 'occupancy_table',  visible: isSuperAdmin, order: 6 },
      ],
    },

    analytical_summary: {
      columns: 4,
      widgets: [
        { id: 'hero_stats',       type: 'stat_card', title: 'Hero Stats',        dataKey: 'heroStats',         visible: true,         order: 1 },
        { id: 'mini_cards',       type: 'stat_card', title: 'Mini Cards',        dataKey: 'miniCards',         visible: true,         order: 2 },
        { id: 'occupancy_donut',  type: 'chart_pie', title: 'Occupancy Donut',   dataKey: 'occupancyDonut',    visible: true,         order: 3 },
        { id: 'live_activity',    type: 'list',      title: 'Live Activity',     dataKey: 'liveActivity',      visible: true,         order: 4 },
        { id: 'site_performance', type: 'table',     title: 'Site Performance',  dataKey: 'sitePerformance',   visible: true,         order: 5 },
      ],
    },
  };

  return layouts[snapshotType];
}
