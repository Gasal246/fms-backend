import mongoose from 'mongoose';
import { logger } from '../../shared/logger/logger.js';
import { MongoDashboardRepository } from '../persistence/mongo-dashboard.repository.js';
import { buildLayoutConfig } from './layout-config.builder.js';

import UserRegister from '../persistence/models/tenant.model.js';
import Client       from '../persistence/models/user.model.js';

const repo = new MongoDashboardRepository();

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

/** Returns { thisMonth, lastMonth } Date boundaries. */
function getMonthBounds() {
  const now = new Date();
  const startOfThisMonth = new Date(now.getFullYear(), now.getMonth(), 1);
  const startOfLastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
  return { startOfThisMonth, startOfLastMonth };
}

/**
 * Compute a percent-change trend value.
 * Returns { trend: number, trendDirection: 'up'|'down'|'neutral' }.
 */
function calcTrend(current: number, previous: number) {
  if (previous === 0) {
    return { trend: current > 0 ? 100 : 0, trendDirection: current > 0 ? 'up' : 'neutral' };
  }
  const pct = Math.round(((current - previous) / previous) * 100);
  return {
    trend: Math.abs(pct),
    trendDirection: pct >= 0 ? 'up' : 'down',
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// computeTenantsOverview – one snapshot per client
// ─────────────────────────────────────────────────────────────────────────────
async function computeTenantsOverview(): Promise<void> {
  const clients = await Client.find({}, { _id: 1 }).lean();

  for (const client of clients) {
    const clientId = new mongoose.Types.ObjectId(client._id.toString());

    const [totals, byType, recentList, monthlyTrend] = await Promise.all([
      UserRegister.aggregate([
        { $match: { client_id: clientId } },
        {
          $group: {
            _id: null,
            total:   { $sum: 1 },
            active:  { $sum: { $cond: [{ $eq: ['$status', 1] }, 1, 0] } },
            pending: { $sum: { $cond: [{ $eq: ['$status', 2] }, 1, 0] } },
            blocked: { $sum: { $cond: [{ $eq: ['$status', 3] }, 1, 0] } },
          },
        },
      ]),

      UserRegister.aggregate([
        { $match: { client_id: clientId, type: { $exists: true } } },
        { $group: { _id: '$type', count: { $sum: 1 } } },
        { $project: { label: '$_id', value: '$count', _id: 0 } },
      ]),

      UserRegister.aggregate([
        { $match: { client_id: clientId } },
        { $sort: { createdAt: -1 } },
        { $limit: 10 },
        {
          $project: {
            _id: 0,
            name: 1, email: 1, type: 1, status: 1, createdAt: 1,
          },
        },
      ]),

      UserRegister.aggregate([
        {
          $match: {
            client_id: clientId,
            createdAt: { $gte: new Date(Date.now() - 180 * 24 * 60 * 60 * 1000) },
          },
        },
        {
          $group: {
            _id: { year: { $year: '$createdAt' }, month: { $month: '$createdAt' } },
            count: { $sum: 1 },
          },
        },
        { $sort: { '_id.year': 1, '_id.month': 1 } },
        {
          $project: {
            _id: 0,
            label: { $concat: [{ $toString: '$_id.month' }, '/', { $toString: '$_id.year' }] },
            value: '$count',
          },
        },
      ]),
    ]);

    const summary = totals[0] ?? { total: 0, active: 0, pending: 0, blocked: 0 };

    await repo.upsertSummary(
      'tenants_overview',
      { total: summary.total, active: summary.active, pending: summary.pending, blocked: summary.blocked, by_type: byType, recent_list: recentList, monthly_trend: monthlyTrend },
      { orgId: clientId.toString() },
      buildLayoutConfig('tenants_overview', 'manager')
    );
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// computeCampsOverview – one snapshot per client
// ─────────────────────────────────────────────────────────────────────────────
async function computeCampsOverview(): Promise<void> {
  const { default: Camp } = await import('../persistence/models/camp.model.js');
  const clients = await Client.find({}, { _id: 1 }).lean();

  for (const client of clients) {
    const clientId = new mongoose.Types.ObjectId(client._id.toString());

    const [totals, byZone, campList] = await Promise.all([
      Camp.aggregate([
        { $match: { client_id: clientId } },
        {
          $group: {
            _id: null,
            total:  { $sum: 1 },
            active: { $sum: { $cond: [{ $eq: ['$status', 1] }, 1, 0] } },
          },
        },
      ]),

      Camp.aggregate([
        { $match: { client_id: clientId } },
        { $lookup: { from: 'camp_zones', localField: 'zone_id', foreignField: '_id', as: 'zone' } },
        { $unwind: { path: '$zone', preserveNullAndEmptyArrays: true } },
        { $group: { _id: { $ifNull: ['$zone.name', 'Unassigned'] }, count: { $sum: 1 } } },
        { $project: { label: '$_id', value: '$count', _id: 0 } },
      ]),

      Camp.aggregate([
        { $match: { client_id: clientId } },
        { $sort: { createdAt: -1 } },
        { $limit: 50 },
        { $lookup: { from: 'camp_zones', localField: 'zone_id', foreignField: '_id', as: 'zone' } },
        { $unwind: { path: '$zone', preserveNullAndEmptyArrays: true } },
        { $project: { _id: 0, name: 1, status: 1, zone_name: '$zone.name', createdAt: 1 } },
      ]),
    ]);

    const summary = totals[0] ?? { total: 0, active: 0 };

    await repo.upsertSummary(
      'camps_overview',
      { total: summary.total, active: summary.active, by_zone: byZone, camp_list: campList },
      { orgId: clientId.toString() },
      buildLayoutConfig('camps_overview', 'manager')
    );
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// computeRoomsOverview – one snapshot per client
// ─────────────────────────────────────────────────────────────────────────────
async function computeRoomsOverview(): Promise<void> {
  const { default: Room } = await import('../persistence/models/room.model.js');
  const clients = await Client.find({}, { _id: 1 }).lean();

  for (const client of clients) {
    const clientId = new mongoose.Types.ObjectId(client._id.toString());

    const [totals, byFloor, byBuilding] = await Promise.all([
      Room.aggregate([
        { $match: { client_id: clientId } },
        {
          $group: {
            _id: null,
            total:     { $sum: 1 },
            available: { $sum: { $cond: [{ $eq: ['$status', 1] }, 1, 0] } },
            occupied:  { $sum: { $cond: [{ $eq: ['$status', 2] }, 1, 0] } },
          },
        },
      ]),

      Room.aggregate([
        { $match: { client_id: clientId } },
        { $group: { _id: '$floor', count: { $sum: 1 } } },
        { $project: { label: { $toString: '$_id' }, value: '$count', _id: 0 } },
        { $sort: { label: 1 } },
      ]),

      Room.aggregate([
        { $match: { client_id: clientId } },
        { $lookup: { from: 'zone_buildings', localField: 'building_id', foreignField: '_id', as: 'building' } },
        { $unwind: { path: '$building', preserveNullAndEmptyArrays: true } },
        { $group: { _id: { $ifNull: ['$building.building_name', 'Unassigned'] }, count: { $sum: 1 } } },
        { $project: { label: '$_id', value: '$count', _id: 0 } },
      ]),
    ]);

    const summary = totals[0] ?? { total: 0, available: 0, occupied: 0 };

    await repo.upsertSummary(
      'rooms_overview',
      { total: summary.total, available: summary.available, occupied: summary.occupied, by_floor: byFloor, by_building: byBuilding },
      { orgId: clientId.toString() },
      buildLayoutConfig('rooms_overview', 'manager')
    );
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// computeOccupancyOverview – one snapshot per client
// ─────────────────────────────────────────────────────────────────────────────
async function computeOccupancyOverview(): Promise<void> {
  // Bed.status is a string enum: "available" | "occupied"
  const { default: Bed  } = await import('../persistence/models/bed.model.js');
  const clients = await Client.find({}, { _id: 1 }).lean();

  for (const client of clients) {
    const clientId = new mongoose.Types.ObjectId(client._id.toString());

    const [bedStats, campOccupancy, monthlyTrend] = await Promise.all([
      Bed.aggregate([
        { $match: { client_id: clientId, deleted_at: null } },
        {
          $group: {
            _id: null,
            total_beds:    { $sum: 1 },
            // status is a string: "available" | "occupied"
            occupied_beds: { $sum: { $cond: [{ $eq: ['$status', 'occupied'] }, 1, 0] } },
          },
        },
      ]),

      // Occupied beds per camp using BedHistory (active assignments)
      (async () => {
        const { default: BedHistory } = await import('../persistence/models/bed-history.model.js');
        return BedHistory.aggregate([
          { $match: { unassigned_at: null } },
          {
            $lookup: {
              from: 'camp',
              localField: 'camp_id',
              foreignField: '_id',
              as: 'camp',
            },
          },
          { $unwind: { path: '$camp', preserveNullAndEmptyArrays: true } },
          {
            $match: { 'camp.client_id': clientId },
          },
          {
            $group: {
              _id: { $ifNull: ['$camp.camp_name', 'Unassigned'] },
              count: { $sum: 1 },
            },
          },
          { $sort: { count: -1 } },
          { $limit: 10 },
          { $project: { label: '$_id', value: '$count', _id: 0 } },
        ]);
      })(),

      UserRegister.aggregate([
        {
          $match: {
            client_id: clientId,
            createdAt: { $gte: new Date(Date.now() - 180 * 24 * 60 * 60 * 1000) },
          },
        },
        {
          $group: {
            _id: { year: { $year: '$createdAt' }, month: { $month: '$createdAt' } },
            count: { $sum: 1 },
          },
        },
        { $sort: { '_id.year': 1, '_id.month': 1 } },
        {
          $project: {
            _id: 0,
            label: { $concat: [{ $toString: '$_id.month' }, '/', { $toString: '$_id.year' }] },
            value: '$count',
          },
        },
      ]),
    ]);

    const stats = bedStats[0] ?? { total_beds: 0, occupied_beds: 0 };
    const occupancyRate = stats.total_beds > 0
      ? Math.round((stats.occupied_beds / stats.total_beds) * 100)
      : 0;

    await repo.upsertSummary(
      'occupancy_overview',
      { total_beds: stats.total_beds, occupied_beds: stats.occupied_beds, occupancy_rate: occupancyRate, top_camps: campOccupancy, occupancy_trend: monthlyTrend, occupancy_table: [] },
      { orgId: clientId.toString() },
      buildLayoutConfig('occupancy_overview', 'manager')
    );
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// computeAnalyticalSummary – one snapshot per client (the main dashboard feed)
// ─────────────────────────────────────────────────────────────────────────────
async function computeAnalyticalSummary(): Promise<void> {

  const { default: Room       } = await import('../persistence/models/room.model.js');
  const { default: Bed        } = await import('../persistence/models/bed.model.js');
  const { default: Camp       } = await import('../persistence/models/camp.model.js');
  const { default: BedHistory } = await import('../persistence/models/bed-history.model.js');
  const { default: Attendance } = await import('../persistence/models/attendance.model.js');

  const clients = await Client.find({}, { _id: 1 }).lean();

  for (const client of clients) {
    const clientId = new mongoose.Types.ObjectId(client._id.toString());
    const { startOfThisMonth, startOfLastMonth } = getMonthBounds();

    const [
      tenantStats,
      lastMonthTenantStats,
      bedStats,
      lastMonthBedStats,
      roomStats,
      lastMonthRoomStats,
      thisMonthTenants,
      lastMonthTenants,
      camps,
      latestTenants,
      latestAttendance,
    ] = await Promise.all([

      // ── This-month tenant totals ──────────────────────────────────────────
      UserRegister.aggregate([
        { $match: { client_id: clientId } },
        {
          $group: {
            _id: null,
            total:   { $sum: 1 },
            pending: { $sum: { $cond: [{ $eq: ['$status', 2] }, 1, 0] } },
          },
        },
      ]),

      // ── Last-month tenant count (for MoM trend) ───────────────────────────
      UserRegister.countDocuments({
        client_id: clientId as any,
        createdAt: { $lt: startOfThisMonth },
      }),

      // ── Bed occupancy (string enum: "available" | "occupied") ─────────────
      Bed.aggregate([
        { $match: { client_id: clientId, deleted_at: null } },
        {
          $group: {
            _id: null,
            total:       { $sum: 1 },
            occupied:    { $sum: { $cond: [{ $eq: ['$status', 'occupied'] }, 1, 0] } },
            available:   { $sum: { $cond: [{ $eq: ['$status', 'available'] }, 1, 0] } },
          },
        },
      ]),

      // ── Last month bed occupied count ─────────────────────────────────────
      Bed.countDocuments({
        client_id: clientId as any,
        status: 'occupied',
        tenant_assigned_at: { $lt: startOfThisMonth },
        deleted_at: null,
      }),

      // ── Room stats: compute status from available_space (same logic as repository) ──
      // status 0=deactive, 1=available (available_space>0), 2=occupied (available_space===0)
      Room.aggregate([
        { $match: { client_id: clientId } },
        {
          $group: {
            _id: null,
            total:    { $sum: 1 },
            deactive: { $sum: { $cond: [{ $eq: ['$status', 0] }, 1, 0] } },
            // occupied: status=0 excluded; available_space<=0 AND status != 0
            occupied: {
              $sum: {
                $cond: [
                  { $and: [
                    { $ne: ['$status', 0] },
                    { $lte: ['$available_space', 0] }
                  ]},
                  1, 0
                ]
              }
            },
            // available: available_space > 0 AND status != 0
            available: {
              $sum: {
                $cond: [
                  { $and: [
                    { $ne: ['$status', 0] },
                    { $gt: ['$available_space', 0] }
                  ]},
                  1, 0
                ]
              }
            },
          },
        },
      ]),

      // ── Last month rooms occupied ─────────────────────────────────────────
      Room.countDocuments({
        client_id: clientId as any,
        status: 2,
        updatedAt: { $lt: startOfThisMonth },
      }),

      // ── New tenants this month ────────────────────────────────────────────
      UserRegister.countDocuments({
        client_id: clientId as any,
        createdAt: { $gte: startOfThisMonth },
      }),

      // ── New tenants last month ────────────────────────────────────────────
      UserRegister.countDocuments({
        client_id: clientId as any,
        createdAt: { $gte: startOfLastMonth, $lt: startOfThisMonth },
      }),

      // ── All active camps for site performance ────────────────────────────
      Camp.find({ client_id: clientId as any, status: 1 }).lean(),

      // ── 5 most-recent tenants for live activity feed ──────────────────────
      UserRegister.find({ client_id: clientId as any })
        .sort({ createdAt: -1 })
        .limit(5)
        .lean(),

      // ── Recent attendance events (check-ins/check-outs) ──────────────────
      Attendance.find({ client_id: clientId as any })
        .sort({ createdAt: -1 })
        .limit(5)
        .lean(),
    ]);

    // ── Context objects ────────────────────────────────────────────────────
    const tenantsCtx    = tenantStats[0]    ?? { total: 0, pending: 0 };
    const bedsCtx       = bedStats[0]       ?? { total: 0, occupied: 0, available: 0 };
    const roomsCtx      = roomStats[0]      ?? { total: 0, occupied: 0, available: 0, deactive: 0 };

    // Occupancy rate is room-based: occupied / (occupied + available) — excludes deactive
    const activeRooms   = roomsCtx.occupied + roomsCtx.available;
    const occupancyRate = activeRooms > 0
      ? Math.round((roomsCtx.occupied / activeRooms) * 100)
      : 0;

    // ── Real MoM trends ───────────────────────────────────────────────────
    const tenantTrend       = calcTrend(tenantsCtx.total,   lastMonthTenantStats as number);
    const roomOccupiedTrend = calcTrend(roomsCtx.occupied,  lastMonthRoomStats as number);
    const lastMonthOccRate  = activeRooms > 0 && (lastMonthRoomStats as number) > 0
      ? Math.round(((lastMonthRoomStats as number) / activeRooms) * 100)
      : 0;
    const occRateTrend     = calcTrend(occupancyRate, lastMonthOccRate);
    const newTenantTrend   = calcTrend(thisMonthTenants, lastMonthTenants as number);

    // ── Live activity feed ─────────────────────────────────────────────────
    const liveActivity: any[] = [];

    // Attendance events (check-ins / check-outs)
    for (const att of (latestAttendance as any[])) {
      const isCheckOut = !!att.check_out;
      liveActivity.push({
        id:        `evt_att_${att._id}`,
        type:      isCheckOut ? 'CHECK_OUT' : 'CHECK_IN',
        title:     isCheckOut ? 'Check-out Recorded' : 'Check-in Recorded',
        subtitle:  `${att.user_type === 'staff' ? 'Staff' : 'Tenant'}${att.notes ? ' · ' + att.notes : ''}`,
        timestamp: isCheckOut ? att.check_out : att.check_in,
      });
    }

    // Fallback: newly registered tenants (up to 5 total)
    for (const t of (latestTenants as any[])) {
      if (liveActivity.length >= 8) break;
      liveActivity.push({
        id:        `evt_reg_${t._id}`,
        type:      'TENANT_REGISTERED',
        title:     'New Tenant Registered',
        subtitle:  `${t.name ?? 'Unknown'} · ${t.type ?? 'Individual'}`,
        timestamp: t.createdAt,
      });
    }

    // Sort by timestamp descending
    liveActivity.sort((a, b) =>
      new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
    );

    // ── Site performance – real data from BedHistory + Room ───────────────
    const sitePerformance: any[] = [];
    for (const c of (camps as any[])) {
      const campObjectId = new mongoose.Types.ObjectId(c._id.toString());

      const [bedCounts, roomCounts] = await Promise.all([
        // Active bed assignments in this camp
        BedHistory.aggregate([
          { $match: { camp_id: campObjectId, unassigned_at: null } },
          {
            $group: {
              _id: null,
              occupied: { $sum: 1 },
            },
          },
        ]),
        // Rooms in this camp
        Room.aggregate([
          { $match: { camp_id: campObjectId } },
          {
            $group: {
              _id: null,
              total:  { $sum: 1 },
              vacant: { $sum: { $cond: [{ $eq: ['$status', 1] }, 1, 0] } },
            },
          },
        ]),
      ]);

      const occupiedBedsInCamp = bedCounts[0]?.occupied ?? 0;
      const totalRoomsInCamp   = roomCounts[0]?.total    ?? 0;
      const capacity           = c.no_of_allowed_user     ?? totalRoomsInCamp;
      const efficiency         = capacity > 0
        ? Math.round((occupiedBedsInCamp / capacity) * 100)
        : 0;

      sitePerformance.push({
        siteId:        c._id?.toString(),
        siteName:      c.camp_name ?? 'Unknown Site',
        occupied:      occupiedBedsInCamp,
        totalCapacity: capacity,
        revenue:       null,    // Revenue not tracked yet – will be added with billing module
        efficiency,
      });
    }

    // ── Build final payload ────────────────────────────────────────────────
    const data = {
      heroStats: {
        tenantsRegistered: {
          value:          tenantsCtx.total,
          trend:          tenantTrend.trend,
          trendDirection: tenantTrend.trendDirection,
          trendLabel:     'vs last month',
        },
        roomsOccupied: {
          value:          roomsCtx.occupied,
          trend:          roomOccupiedTrend.trend,
          trendDirection: roomOccupiedTrend.trendDirection,
          trendLabel:     'vs last month',
        },
        occupancyRate: {
          value:          occupancyRate,
          trend:          occRateTrend.trend,
          trendDirection: occRateTrend.trendDirection,
          trendLabel:     'vs last month',
        },
      },
      miniCards: {
        roomsVacant:   {
          value:          roomsCtx.available,
          trendDirection: 'down',
          trendLabel:     `${roomsCtx.available} available`,
        },
        totalCapacity: { value: activeRooms },
        newTenants:    {
          value:          thisMonthTenants,
          trend:          newTenantTrend.trend,
          trendDirection: newTenantTrend.trendDirection,
          trendLabel:     `${newTenantTrend.trendDirection === 'up' ? '+' : '-'}${newTenantTrend.trend}% vs last month`,
        },
        checkOuts:     {
          value:    tenantsCtx.pending,
          subLabel: 'Pending handover',
        },
      },
      occupancyDonut: {
        rate: occupancyRate,
        // Uses room-level status: Available / Occupied / Deactive
        breakdown: [
          { status: 'Available', count: roomsCtx.available },
          { status: 'Occupied',  count: roomsCtx.occupied  },
          { status: 'Deactive',  count: roomsCtx.deactive  },
        ],
      },
      liveActivity,
      sitePerformance,
    };

    await repo.upsertSummary(
      'analytical_summary',
      data,
      { orgId: clientId.toString() },
      buildLayoutConfig('analytical_summary', 'manager')
    );
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Main exported runner – called by the scheduler
// ─────────────────────────────────────────────────────────────────────────────
export async function runAllAggregations(): Promise<void> {
  logger.info('[DashboardWorker] Starting full aggregation run (computing all overviews)...');
  try {
    const results = await Promise.allSettled([
      computeTenantsOverview(),
      computeCampsOverview(),
      computeRoomsOverview(),
      computeOccupancyOverview(),
      computeAnalyticalSummary(),
    ]);
    
    let hasErrors = false;
    results.forEach((result, index) => {
      if (result.status === 'rejected') {
        hasErrors = true;
        logger.error(`[DashboardWorker] Task ${index} failed: ${result.reason}`);
      }
    });

    if (!hasErrors) {
      logger.info('[DashboardWorker] Aggregation run complete and all summaries saved successfully.');
    } else {
      logger.info('[DashboardWorker] Aggregation run complete, but with some errors.');
    }
  } catch (err) {
    logger.error(`[DashboardWorker] Aggregation run failed: ${err}`);
  }
}
