import mongoose from "mongoose";
import type { CateringRepository, CateringScope } from "../../domain/repositories/catering.repository.interface.js";
import { CATERING_ENTITIES, type CateringEntity } from "../../infrastructure/persistence/models/catering.model.js";
import { AppError } from "../../shared/utils/AppError.js";
import Camp from "../../infrastructure/persistence/models/camp.model.js";
import Zone from "../../infrastructure/persistence/models/zone.model.js";
import Company from "../../infrastructure/persistence/models/company.model.js";
import Tenant from "../../infrastructure/persistence/models/tenant.model.js";
import KitchenManager from "../../infrastructure/persistence/models/kitchen-manager.model.js";
import Role from "../../infrastructure/persistence/models/role.model.js";
import type { PasswordService } from "../../domain/repositories/auth.repository.interface.js";

const orderFlow = ["Draft", "Generated", "Reviewed", "Confirmed", "Sent", "Accepted", "Preparing", "Ready", "Dispatched", "Delivered", "Received", "Completed"];
const dispatchFlow = ["Generated", "Ready", "Dispatched", "Reached", "Received", "Completed"];
const demandFlow = ["Draft", "Generated", "Confirmed", "Sent"];
const wastageFlow = ["Pending Approval", "Approved"];
const managerOrderActions: Record<string, [string, string]> = {
  accept: ["Sent", "Accepted"],
  start_preparing: ["Accepted", "Preparing"],
  mark_ready: ["Preparing", "Ready"],
};
const managerDispatchActions: Record<string, [string, string]> = {
  mark_ready: ["Generated", "Ready"],
  mark_dispatched: ["Ready", "Dispatched"],
};

export class CateringUseCase {
  constructor(private repo: CateringRepository, private passwordService: PasswordService) {}

  private managerResponse(row: any) {
    const value = typeof row.toJSON === "function" ? row.toJSON() : row;
    return {
      id: String(value.id || value._id),
      clientId: String(value.clientId || value.client_id),
      roleId: String(value.roleId || value.role_id),
      kitchenIds: (value.kitchenIds || value.kitchen_ids || []).map((id: any) => String(id)),
      name: value.name,
      email: value.email,
      phone: value.phone,
      status: value.status,
      profilePicture: value.profile_picture || value.profilePicture || "",
      version: value.version ?? value.__v ?? 0,
      createdAt: value.createdAt,
      updatedAt: value.updatedAt,
    };
  }

  private assertClientAdmin(scope: CateringScope) {
    if (scope.role !== "ROLE_CLIENT_ADMIN") throw new AppError("Only Client Admins can manage Kitchen Managers", 403);
  }

  private assertKitchenManager(scope: CateringScope) {
    if (scope.role !== "ROLE_KITCHEN_MANAGER") throw new AppError("Kitchen Manager access is required", 403);
  }

  private assertAssignedKitchen(scope: CateringScope, kitchenId: string) {
    this.assertKitchenManager(scope);
    if (!scope.kitchenIds?.includes(kitchenId)) throw new AppError("This kitchen is not assigned to your account", 403);
  }

  private clientScope(scope: CateringScope): CateringScope {
    return { clientId: scope.clientId, userId: scope.userId, role: scope.role };
  }

  private async validateManagerKitchens(scope: CateringScope, values: unknown) {
    const kitchenIds = [...new Set((Array.isArray(values) ? values : []).map(value => String(value)).filter(Boolean))];
    if (!kitchenIds.length) throw new AppError("At least one kitchen assignment is required", 422);
    if (kitchenIds.some(id => !mongoose.Types.ObjectId.isValid(id))) throw new AppError("One or more kitchen assignments are invalid", 422);
    const kitchens = await this.repo.list("kitchens", { clientId: scope.clientId, userId: scope.userId, role: scope.role });
    if (kitchenIds.some(id => !kitchens.some((row: any) => row.id === id))) throw new AppError("Every assigned kitchen must belong to this Client Admin", 422);
    if (!kitchenIds.some(id => kitchens.some((row: any) => row.id === id && row.status === "Active"))) throw new AppError("At least one assigned kitchen must be active", 422);
    return kitchenIds;
  }

  async listKitchenManagers(scope: CateringScope) {
    this.assertClientAdmin(scope);
    const rows = await KitchenManager.find({ client_id: scope.clientId, deleted_at: null }).sort({ updatedAt: -1 }).lean();
    return rows.map(row => this.managerResponse(row));
  }

  async createKitchenManager(scope: CateringScope, payload: any) {
    this.assertClientAdmin(scope);
    const name = String(payload.name || "").trim();
    const email = String(payload.email || "").trim().toLowerCase();
    const phone = String(payload.phone || "").trim();
    const password = String(payload.password || "");
    if (!name || !phone || !/^\S+@\S+\.\S+$/.test(email)) throw new AppError("Name, valid email, and phone are required", 422);
    if (password.length < 8) throw new AppError("Password must contain at least 8 characters", 422);
    if (!["Active", "Blocked"].includes(payload.status || "Active")) throw new AppError("Invalid Kitchen Manager status", 422);
    const kitchenIds = await this.validateManagerKitchens(scope, payload.kitchenIds);
    const [role, duplicate] = await Promise.all([
      Role.findOne({ slug: "ROLE_KITCHEN_MANAGER", deleted_at: null }).lean(),
      KitchenManager.exists({ email, deleted_at: null }),
    ]);
    if (!role) throw new AppError("Kitchen Manager role is not configured", 500);
    if (duplicate) throw new AppError("A Kitchen Manager already uses this email", 409);
    try {
      const row = await KitchenManager.create({
        client_id: scope.clientId,
        role_id: role._id,
        kitchen_ids: kitchenIds,
        name,
        email,
        phone,
        password: await this.passwordService.hash(password),
        status: payload.status || "Active",
        created_by: scope.userId,
      });
      return this.managerResponse(row);
    } catch (error: any) {
      if (error?.code === 11000) throw new AppError("A Kitchen Manager already uses this email", 409);
      throw error;
    }
  }

  async updateKitchenManager(scope: CateringScope, id: string, payload: any) {
    this.assertClientAdmin(scope);
    const current: any = await KitchenManager.findOne({ _id: id, client_id: scope.clientId, deleted_at: null }).lean();
    if (!current) throw new AppError("Kitchen Manager not found", 404);
    const name = String(payload.name ?? current.name).trim();
    const email = String(payload.email ?? current.email).trim().toLowerCase();
    const phone = String(payload.phone ?? current.phone).trim();
    const status = payload.status ?? current.status;
    if (!name || !phone || !/^\S+@\S+\.\S+$/.test(email)) throw new AppError("Name, valid email, and phone are required", 422);
    if (!["Active", "Blocked"].includes(status)) throw new AppError("Invalid Kitchen Manager status", 422);
    const kitchenIds = await this.validateManagerKitchens(scope, payload.kitchenIds ?? current.kitchen_ids);
    const duplicate = await KitchenManager.exists({ _id: { $ne: id }, email, deleted_at: null });
    if (duplicate) throw new AppError("A Kitchen Manager already uses this email", 409);
    const filter: any = { _id: id, client_id: scope.clientId, deleted_at: null };
    if (payload.version !== undefined) filter.__v = Number(payload.version);
    try {
      const row = await KitchenManager.findOneAndUpdate(filter, {
        $set: { name, email, phone, status, kitchen_ids: kitchenIds, updated_by: scope.userId },
        $inc: { __v: 1 },
      }, { new: true, runValidators: true }).lean();
      if (!row) throw new AppError("Kitchen Manager was changed by another user; refresh and try again", 409);
      return this.managerResponse(row);
    } catch (error: any) {
      if (error?.code === 11000) throw new AppError("A Kitchen Manager already uses this email", 409);
      throw error;
    }
  }

  async resetKitchenManagerPassword(scope: CateringScope, id: string, password: string) {
    this.assertClientAdmin(scope);
    if (String(password || "").length < 8) throw new AppError("Password must contain at least 8 characters", 422);
    const row = await KitchenManager.findOneAndUpdate(
      { _id: id, client_id: scope.clientId, deleted_at: null },
      { $set: { password: await this.passwordService.hash(password), updated_by: scope.userId }, $inc: { __v: 1 } },
      { new: true }
    ).lean();
    if (!row) throw new AppError("Kitchen Manager not found", 404);
    return this.managerResponse(row);
  }

  async removeKitchenManager(scope: CateringScope, id: string) {
    this.assertClientAdmin(scope);
    const row = await KitchenManager.findOneAndUpdate(
      { _id: id, client_id: scope.clientId, deleted_at: null },
      { $set: { deleted_at: new Date(), status: "Blocked", updated_by: scope.userId }, $inc: { __v: 1 } },
      { new: true }
    );
    if (!row) throw new AppError("Kitchen Manager not found", 404);
  }

  async kitchenManagerContext(scope: CateringScope) {
    this.assertKitchenManager(scope);
    const manager: any = await KitchenManager.findOne({ _id: scope.userId, client_id: scope.clientId, status: "Active", deleted_at: null }).lean();
    if (!manager) throw new AppError("Kitchen Manager account is not active", 401);
    const assigned = new Set((manager.kitchen_ids || []).map((id: any) => id.toString()));
    const kitchens = (await this.repo.list("kitchens", this.clientScope(scope)))
      .filter((row: any) => assigned.has(row.id) && row.status === "Active");
    if (!kitchens.length) throw new AppError("No active kitchen assignment is available", 403);
    return { manager: this.managerResponse(manager), kitchens };
  }

  async kitchenBootstrap(scope: CateringScope, kitchenId: string) {
    this.assertAssignedKitchen(scope, kitchenId);
    const clientScope = this.clientScope(scope);
    const [kitchens, schedules, categories, demands, kitchenOrders, dispatches, workSites, diningAreas, counters] = await Promise.all([
      this.repo.list("kitchens", clientScope, { _id: kitchenId }),
      this.repo.list("schedules", clientScope),
      this.repo.list("categories", clientScope),
      this.repo.list("demands", clientScope, { kitchenId }),
      this.repo.list("kitchenOrders", clientScope, { kitchenId }),
      this.repo.list("dispatches", clientScope, { kitchenId }),
      this.repo.list("workSites", clientScope),
      this.repo.list("diningAreas", clientScope),
      this.repo.list("counters", clientScope),
    ]);
    const kitchen = kitchens[0];
    if (!kitchen || kitchen.status !== "Active") throw new AppError("Assigned kitchen is not active", 403);
    const campIds = new Set<string>(kitchen.campIds || []);
    const workSiteIds = new Set<string>(kitchen.workSiteIds || []);
    const [camps, zones] = await Promise.all([
      Camp.find({ _id: { $in: [...campIds] }, client_id: scope.clientId, deleted_at: null } as any).select("camp_name camp_city status").lean(),
      Zone.find({ camp_id: { $in: [...campIds] }, status: { $ne: 0 } } as any).select("camp_id zone_name status").lean(),
    ]);
    const relevantDining = diningAreas.filter((row: any) => campIds.has(row.campId));
    const diningIds = new Set(relevantDining.map((row: any) => row.id));
    return {
      schemaVersion: 4,
      dataMode: "Live API",
      activeKitchenId: kitchenId,
      kitchens: [kitchen],
      schedules: schedules.filter((row: any) => kitchen.scheduleIds?.includes(row.id)),
      categories: categories.filter((row: any) => !kitchen.categoryIds?.length || kitchen.categoryIds.includes(row.id)),
      demands,
      kitchenOrders,
      dispatches,
      workSites: workSites.filter((row: any) => workSiteIds.has(row.id)),
      diningAreas: relevantDining,
      counters: counters.filter((row: any) => (row.type === "Work Site" && workSiteIds.has(row.workSiteId)) || (row.type === "Dining Area" && diningIds.has(row.diningAreaId))),
      masters: {
        camps: camps.map((row: any) => ({ id: row._id.toString(), name: row.camp_name, city: row.camp_city, status: row.status })),
        zones: zones.map((row: any) => ({ id: row._id.toString(), campId: row.camp_id?.toString(), name: row.zone_name, status: row.status })),
        companies: [],
        tenants: [],
      },
    };
  }

  async kitchenDashboard(scope: CateringScope, kitchenId: string) {
    const state: any = await this.kitchenBootstrap(scope, kitchenId);
    const today = new Date().toISOString().slice(0, 10);
    const tomorrowDate = new Date(); tomorrowDate.setDate(tomorrowDate.getDate() + 1);
    const tomorrow = tomorrowDate.toISOString().slice(0, 10);
    const tomorrowOrders = state.kitchenOrders.filter((row: any) => row.date === tomorrow);
    const todayDispatches = state.dispatches.filter((row: any) => String(row.createdAt || row.dispatchDate || "").slice(0, 10) === today);
    const expected = state.kitchenOrders.reduce((sum: number, row: any) => sum + Number(row.quantity || 0), 0);
    const dispatched = state.dispatches.filter((row: any) => ["Dispatched", "Reached", "Received", "Completed"].includes(row.status)).reduce((sum: number, row: any) => sum + Number(row.dispatchedQuantity ?? row.delivered ?? 0), 0);
    const group = (field: string) => [...new Map(tomorrowOrders.map((row: any) => [row[field], 0])).keys()].map(id => ({ id, quantity: tomorrowOrders.filter((row: any) => row[field] === id).reduce((sum: number, row: any) => sum + Number(row.quantity || 0), 0) }));
    return {
      tomorrowOrderCount: tomorrowOrders.length,
      tomorrowTotalQuantity: tomorrowOrders.reduce((sum: number, row: any) => sum + Number(row.quantity || 0), 0),
      todayDispatchCount: todayDispatches.length,
      pendingDispatches: state.dispatches.filter((row: any) => !["Received", "Completed"].includes(row.status)).length,
      completedDispatches: state.dispatches.filter((row: any) => ["Received", "Completed"].includes(row.status)).length,
      shortageQuantity: Math.max(0, expected - dispatched),
      issueCount: state.dispatches.filter((row: any) => row.status === "Issue Reported" || Number(row.rejected || 0) > 0).length,
      bySchedule: group("scheduleId"),
      byCategory: group("categoryId"),
    };
  }

  async kitchenPreparationSheet(scope: CateringScope, kitchenId: string, date?: string) {
    const serviceDate = date || (() => { const value = new Date(); value.setDate(value.getDate() + 1); return value.toISOString().slice(0, 10); })();
    if (!/^\d{4}-\d{2}-\d{2}$/.test(serviceDate)) throw new AppError("A valid service date is required", 422);
    const state: any = await this.kitchenBootstrap(scope, kitchenId);
    const orders = state.kitchenOrders.filter((row: any) => row.date === serviceDate);
    const totalMap = new Map<string, any>();
    const destinations: any[] = [];
    for (const order of orders) {
      const key = `${order.scheduleId}:${order.categoryId}`;
      const total = totalMap.get(key) || { scheduleId: order.scheduleId, categoryId: order.categoryId, count: 0 };
      total.count += Number(order.quantity || 0); totalMap.set(key, total);
      for (const line of order.lines || []) destinations.push({ orderId: order.id, scheduleId: order.scheduleId, categoryId: order.categoryId, destinationType: line.destinationType, destinationId: line.destinationId, count: Number(line.quantity || line.final || 0) });
    }
    return { date: serviceDate, totals: [...totalMap.values()], destinations };
  }

  async kitchenReport(scope: CateringScope, kitchenId: string, type: string, from?: string, to?: string) {
    const allowed = ["prepared-vs-dispatched", "shortage", "category", "camp", "work-site"];
    if (!allowed.includes(type)) throw new AppError("Unknown Kitchen report type", 404);
    const state: any = await this.kitchenBootstrap(scope, kitchenId);
    const start = from || "0000-01-01";
    const end = to || "9999-12-31";
    const orders = state.kitchenOrders.filter((row: any) => row.date >= start && row.date <= end);
    const dispatches = state.dispatches.filter((row: any) => String(row.dispatchDate || row.createdAt || "").slice(0, 10) >= start && String(row.dispatchDate || row.createdAt || "").slice(0, 10) <= end);
    const dispatchedByOrder = new Map<string, number>();
    for (const row of dispatches) dispatchedByOrder.set(row.orderId, (dispatchedByOrder.get(row.orderId) || 0) + Number(row.dispatchedQuantity ?? row.delivered ?? 0));
    if (type === "prepared-vs-dispatched" || type === "shortage") return orders.map((row: any) => {
      const dispatched = dispatchedByOrder.get(row.id) || 0;
      return { id: row.id, date: row.date, orderCode: row.code, scheduleId: row.scheduleId, categoryId: row.categoryId, prepared: Number(row.quantity || 0), dispatched, shortage: Math.max(0, Number(row.quantity || 0) - dispatched), status: row.status };
    }).filter((row: any) => type !== "shortage" || row.shortage > 0);
    const grouped = new Map<string, any>();
    for (const order of orders) for (const line of order.lines || []) {
      if (type === "camp" && line.destinationType !== "Camp") continue;
      if (type === "work-site" && line.destinationType !== "Work Site") continue;
      const groupId = type === "category" ? order.categoryId : line.destinationId;
      const key = `${groupId}:${order.scheduleId}`;
      const row = grouped.get(key) || { id: key, groupId, scheduleId: order.scheduleId, prepared: 0, dispatched: 0 };
      row.prepared += Number(line.quantity || line.final || 0);
      row.dispatched += dispatches.filter((item: any) => item.orderId === order.id && item.lineId === (line.id || line.demandId)).reduce((sum: number, item: any) => sum + Number(item.dispatchedQuantity ?? item.delivered ?? 0), 0);
      grouped.set(key, row);
    }
    return [...grouped.values()].map(row => ({ ...row, shortage: Math.max(0, row.prepared - row.dispatched) }));
  }

  entity(value: string): CateringEntity {
    if (!CATERING_ENTITIES.includes(value as CateringEntity)) throw new AppError("Unknown Catering resource", 404);
    return value as CateringEntity;
  }

  async bootstrap(scope: CateringScope) {
    const masterFilter: any = { client_id: scope.clientId, deleted_at: null };
    const tenantFilter: any = { ...masterFilter };
    if (scope.companyId) tenantFilter.company_id = scope.companyId;
    const clientScope: CateringScope = { clientId: scope.clientId, userId: scope.userId, role: scope.role };
    const [camps, zones, companies, tenants, records, sharedRecords, kitchenManagers] = await Promise.all([
      Camp.find(masterFilter).select("camp_name camp_city status").lean(),
      Zone.find({ client_id: new mongoose.Types.ObjectId(scope.clientId), status: { $ne: 0 } } as any).select("camp_id zone_name status").lean(),
      scope.companyId ? Company.find({ _id: scope.companyId, client_id: scope.clientId }).select("company_name company_code status").lean() : Company.find(masterFilter).select("company_name company_code status").lean(),
      Tenant.find(tenantFilter).select("name email employee_id company_id camp_id zone_id room_id job_title nationality status custom_data").limit(5000).lean(),
      Promise.all(CATERING_ENTITIES.map(async entity => [entity, await this.repo.list(entity, scope)] as const)),
      scope.companyId ? Promise.all((["schedules", "categories", "grades", "diningAreas", "counters"] as CateringEntity[]).map(async entity => [entity, await this.repo.list(entity, clientScope)] as const)) : Promise.resolve([]),
      scope.role === "ROLE_CLIENT_ADMIN" ? KitchenManager.find({ client_id: scope.clientId, deleted_at: null }).sort({ updatedAt: -1 }).lean() : Promise.resolve([]),
    ]);
    const entityRecords: any = Object.fromEntries(records);
    if (scope.companyId) {
      const shared: any = Object.fromEntries(sharedRecords);
      const workSiteIds = new Set((entityRecords.workSites || []).map((row: any) => row.id));
      const relevantCampIds = new Set<string>([
        ...(entityRecords.workSites || []).map((row: any) => row.campId).filter(Boolean),
        ...tenants.map((row: any) => row.camp_id?.toString()).filter(Boolean),
      ]);
      entityRecords.schedules = (shared.schedules || []).filter((row: any) => row.status === "Active");
      entityRecords.categories = (shared.categories || []).filter((row: any) => row.status === "Active");
      entityRecords.grades = (shared.grades || []).filter((row: any) => row.status === "Active");
      entityRecords.diningAreas = (shared.diningAreas || []).filter((row: any) => row.status === "Active" && relevantCampIds.has(row.campId));
      const diningAreaIds = new Set(entityRecords.diningAreas.map((row: any) => row.id));
      entityRecords.counters = (shared.counters || []).filter((row: any) => row.status === "Active" && ((row.type === "Work Site" && workSiteIds.has(row.workSiteId)) || (row.type === "Dining Area" && diningAreaIds.has(row.diningAreaId))));
    }
    const companyGroups = new Map<string, any>();
    for (const row of entityRecords.companyStaffCateringAllocations || []) {
      if (row.status !== "Active") continue;
      const key = `${row.companyId}:${row.workSiteId || ""}:${row.diningAreaId || row.counterId || ""}`;
      const group = companyGroups.get(key) || { id: `summary_${key}`, companyId: row.companyId, workSiteId: row.workSiteId || "", diningAreaId: row.diningAreaId || "", counterId: row.counterId || "", collectionLocation: row.collectionLocation, scheduleIds: [], staffIds: new Set(), preorderCount: 0, expectedDemand: 0, status: "Active" };
      row.scheduleIds?.forEach((id: string) => { if (!group.scheduleIds.includes(id)) group.scheduleIds.push(id); });
      group.staffIds.add(row.staffId); group.preorderCount += row.preorderEnabled ? 1 : 0; group.expectedDemand += (row.scheduleIds?.length || 0) * Number(row.collectionLimit || 1); group.categoryId = row.categoryId;
      companyGroups.set(key, group);
    }
    entityRecords.companyAllocations = [...companyGroups.values()].map(x => ({ ...x, staffCount: x.staffIds.size, staffIds: undefined }));
    return {
      schemaVersion: 3, dataMode: "Live API",
      masters: {
        camps: camps.map((x: any) => ({ id: x._id.toString(), name: x.camp_name, city: x.camp_city, status: x.status })),
        zones: zones.map((x: any) => ({ id: x._id.toString(), campId: x.camp_id?.toString(), name: x.zone_name, status: x.status })),
        companies: companies.map((x: any) => ({ id: x._id.toString(), name: x.company_name, code: x.company_code, status: x.status })),
        tenants: tenants.map((x: any) => ({ id: x._id.toString(), name: x.name, email: x.email, employeeId: x.employee_id, companyId: x.company_id?.toString() || "", campId: x.camp_id?.toString() || "", zoneId: x.zone_id?.toString() || "", room: x.room_id?.toString() || "", department: x.job_title || x.custom_data?.department || "", grade: x.custom_data?.grade || "", nationality: x.nationality || "", status: x.status === 1 ? "Active" : "Inactive" })),
      },
      ...entityRecords,
      kitchenManagers: kitchenManagers.map(row => this.managerResponse(row)),
    };
  }

  async dashboard(scope: CateringScope) {
    const state: any = await this.bootstrap(scope);
    const today = new Date().toISOString().slice(0, 10);
    const active = (rows: any[]) => rows.filter(x => x.status === "Active").length;
    const expectedMeals = state.demands.reduce((sum: number, x: any) => sum + Number(x.final || 0), 0);
    const collectedMeals = state.servingLogs.filter((x: any) => x.date === today && x.status === "Collected").length;
    return { expectedMeals, collectedMeals, activeKitchens: active(state.kitchens), activeDiningAreas: active(state.diningAreas), activeCounters: active(state.counters), activeTablets: active(state.machines), pendingKitchenOrders: state.kitchenOrders.filter((x: any) => !["Completed", "Received"].includes(x.status)).length, pendingDispatches: state.dispatches.filter((x: any) => !["Completed", "Received"].includes(x.status)).length, wastageToday: state.wastage.filter((x: any) => x.date === today).reduce((sum: number, x: any) => sum + Number(x.wastage || 0), 0), preordersToday: state.preorderRequests.filter((x: any) => x.date === today).length };
  }

  async report(scope: CateringScope, type: string) {
    const allowed: Record<string, CateringEntity> = { staff: "servingLogs", schedule: "servingLogs", worksite: "companyStaffCateringAllocations", missed: "companyStaffCateringAllocations", preorder: "preorderRequests", tenant: "servingLogs", dispatch: "dispatches", wastage: "wastage", sync: "localServers", kitchen: "kitchenOrders" };
    const entity = allowed[type];
    if (!entity) throw new AppError("Unknown report type", 404);
    return this.repo.list(entity, scope);
  }

  async generateDemand(scope: CateringScope, serviceDate: string) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(serviceDate)) throw new AppError("A valid service date is required", 422);
    const clientScope = this.clientScope(scope);
    const [companyAllocations, tenantAllocations, preorders, kitchens, existing, diningAreas] = await Promise.all([
      this.repo.list("companyStaffCateringAllocations", clientScope),
      this.repo.list("tenantAllocations", clientScope),
      this.repo.list("preorderRequests", clientScope),
      this.repo.list("kitchens", clientScope),
      this.repo.list("demands", clientScope, { date: serviceDate }),
      this.repo.list("diningAreas", clientScope),
    ]);
    const groups = new Map<string, any>();

    const addAllocation = (row: any, tenantId: string, destinationType: "Camp" | "Work Site", destinationId: string, counterId = "") => {
      for (const scheduleId of row.scheduleIds || []) {
        const key = `${destinationId}:${scheduleId}:${row.categoryId}`;
        const group = groups.get(key) || { date: serviceDate, destinationType, destinationId, counterId, scheduleId, categoryId: row.categoryId, expected: 0, preorder: 0, adjustment: 0, status: "Generated", tenantIds: new Set<string>() };
        group.expected += Number(row.collectionLimit || 1);
        group.tenantIds.add(tenantId);
        groups.set(key, group);
      }
    };

    const activeForDate = (row: any) => row.status === "Active" && row.effectiveFrom <= serviceDate && (!row.effectiveTo || row.effectiveTo >= serviceDate);
    for (const row of companyAllocations.filter(activeForDate)) {
      if (row.collectionLocation === "Work Site" && row.workSiteId) addAllocation(row, row.staffId, "Work Site", row.workSiteId, row.counterId || "");
      else {
        const dining = diningAreas.find((item: any) => item.id === row.diningAreaId);
        if (dining?.campId) addAllocation(row, row.staffId, "Camp", dining.campId, row.counterId || "");
      }
    }
    for (const row of tenantAllocations.filter(activeForDate)) {
      const dining = diningAreas.find((item: any) => item.id === row.diningAreaId);
      const campId = row.campId || dining?.campId;
      if (campId) addAllocation(row, row.tenantId, "Camp", campId, row.counterId || "");
    }
    const session = await mongoose.startSession();
    const output: any[] = [];
    const sentToSync: any[] = [];
    try {
      await session.withTransaction(async () => {
        for (const group of groups.values()) {
          group.preorder = preorders.filter((row: any) => row.date === serviceDate && row.toScheduleId === group.scheduleId && row.categoryId === group.categoryId && row.status === "Approved" && group.tenantIds.has(row.tenantId)).length;
          group.final = group.expected + group.preorder;
          const matches = kitchens.filter((row: any) => row.status === "Active"
            && (group.destinationType === "Work Site" ? row.workSiteIds?.includes(group.destinationId) : row.campIds?.includes(group.destinationId))
            && row.scheduleIds?.includes(group.scheduleId)
            && (!row.categoryIds?.length || row.categoryIds.includes(group.categoryId)));
          if (!matches.length) throw new AppError(`No active kitchen covers ${group.destinationType} ${group.destinationId} for the selected schedule and category`, 422);
          if (matches.length > 1) throw new AppError(`Multiple active kitchens overlap for ${group.destinationType} ${group.destinationId} and schedule ${group.scheduleId}`, 409);
          group.kitchenId = matches[0].id;
          delete group.tenantIds;
          const current = existing.find((row: any) => row.destinationId === group.destinationId && row.scheduleId === group.scheduleId && row.categoryId === group.categoryId);
          if (current?.status === "Sent") {
            const [order] = await this.repo.list("kitchenOrders", clientScope, { orderKey: this.orderKey(current) });
            if (order && order.status !== "Sent") throw new AppError("Demand is locked because the kitchen accepted its order", 409);
          }
          const adjustment = Number(current?.adjustment || 0);
          const data = { ...(current || {}), ...group, adjustment, final: group.final + adjustment };
          const saved = current
            ? await this.repo.update("demands", clientScope, current.id, data, current.version, session)
            : await this.repo.create("demands", clientScope, data, session);
          output.push(saved);
          if (saved.status === "Sent") sentToSync.push(saved);
        }
      });
    } finally {
      await session.endSession();
    }
    for (const demand of sentToSync) await this.syncKitchenOrder(scope, demand);
    return output;
  }

  async list(entityValue: string, scope: CateringScope, query?: any) {
    const entity = this.entity(entityValue);
    if (scope.role === "ROLE_COMPANY" && ["schedules", "categories", "grades", "diningAreas", "counters"].includes(entity)) {
      const state: any = await this.bootstrap(scope);
      return (state[entity] || []).filter((row: any) => Object.entries(query || {}).every(([key, value]) => value === undefined || value === "" || String(row[key]) === String(value)));
    }
    return this.repo.list(entity, scope, query);
  }

  async save(entityValue: string, scope: CateringScope, data: any, id?: string, version?: number) {
    const entity = this.entity(entityValue);
    this.assertWriteAllowed(entity, scope);
    if (entity === "counters" && data.type === "Work Site" && data.workSiteId && !data.companyId) {
      const clientScope: CateringScope = { clientId: scope.clientId, userId: scope.userId, role: scope.role };
      const [site] = await this.repo.list("workSites", clientScope, { _id: data.workSiteId });
      if (!site) throw new AppError("Selected work site was not found", 404);
      data.companyId = site.companyId;
    }
    await this.validate(entity, data, scope, id);
    if (entity === "demands" && id) {
      const [current] = await this.repo.list("demands", this.clientScope(scope), { _id: id });
      if (!current) throw new AppError("Demand record not found", 404);
      if (current.status === "Sent") {
        const [order] = await this.repo.list("kitchenOrders", this.clientScope(scope), { orderKey: this.orderKey(current) });
        if (order && order.status !== "Sent") throw new AppError("Demand is locked because the kitchen accepted its order", 409);
      }
      const updated = await this.repo.update(entity, scope, id, data, version);
      if (updated.status === "Sent") await this.syncKitchenOrder(scope, updated);
      return updated;
    }
    return id ? this.repo.update(entity, scope, id, data, version) : this.repo.create(entity, scope, data);
  }

  async remove(entityValue: string, scope: CateringScope, id: string) {
    const entity = this.entity(entityValue);
    this.assertWriteAllowed(entity, scope);
    const refs: Partial<Record<CateringEntity, Array<[CateringEntity, string]>>> = {
      schedules: [["kitchens", "scheduleIds"], ["diningAreas", "scheduleIds"], ["counters", "scheduleIds"], ["tenantAllocations", "scheduleIds"], ["demands", "scheduleId"], ["kitchenOrders", "scheduleId"]],
      categories: [["kitchens", "categoryIds"], ["diningAreas", "categoryIds"], ["counters", "categoryIds"], ["tenantAllocations", "categoryId"], ["demands", "categoryId"]],
      workSites: [["counters", "workSiteId"], ["staffWorkSiteAssignments", "workSiteId"], ["companyStaffCateringAllocations", "workSiteId"]],
    };
    for (const [target, field] of refs[entity] || []) if ((await this.repo.list(target, scope, { [field]: id })).length) throw new AppError(`${entity} record is already referenced and cannot be deleted`, 409);
    return this.repo.remove(entity, scope, id);
  }

  async transition(entityValue: string, scope: CateringScope, id: string, expectedStatus: string, version?: number, remarks = "") {
    const entity = this.entity(entityValue);
    this.assertWriteAllowed(entity, scope);
    const flow = entity === "kitchenOrders" ? orderFlow : entity === "dispatches" ? dispatchFlow : entity === "demands" ? demandFlow : entity === "wastage" ? wastageFlow : [];
    const [row] = await this.repo.list(entity, scope, { _id: id });
    if (!row) throw new AppError("Record not found", 404);
    if (row.status !== expectedStatus) throw new AppError("Workflow status changed; refresh and try again", 409);
    const index = flow.indexOf(row.status);
    if (index < 0 || index === flow.length - 1) throw new AppError("Invalid or completed workflow", 409);
    const next = flow[index + 1];
    if (entity === "kitchenOrders" && scope.role === "ROLE_CLIENT_ADMIN" && row.status === "Sent") throw new AppError("Sent orders are controlled by the assigned Kitchen Manager", 403);
    if (entity === "demands" && next === "Sent") {
      const orderKey = this.orderKey(row);
      const [existingOrder] = await this.repo.list("kitchenOrders", this.clientScope(scope), { orderKey });
      if (existingOrder && !["Sent"].includes(existingOrder.status)) throw new AppError("This demand belongs to an order already accepted by the kitchen", 409);
    }
    const workflowHistory = [...(row.workflowHistory || []), { from: row.status, to: next, remarks, actorId: scope.userId, at: new Date().toISOString() }];
    const updated = await this.repo.update(entity, scope, id, { ...row, status: next, lastTransitionRemarks: remarks, workflowHistory }, version);
    if (entity === "demands" && next === "Sent") await this.syncKitchenOrder(scope, updated);
    return updated;
  }

  private orderKey(row: any) {
    return `${row.kitchenId}:${row.date}:${row.scheduleId}:${row.categoryId}`;
  }

  private async syncKitchenOrder(scope: CateringScope, demand: any) {
    const clientScope = this.clientScope(scope);
    const orderKey = this.orderKey(demand);
    const [demands, existingOrders] = await Promise.all([
      this.repo.list("demands", clientScope, { kitchenId: demand.kitchenId }),
      this.repo.list("kitchenOrders", clientScope, { orderKey }),
    ]);
    const existing = existingOrders[0];
    const grouped = demands.filter((row: any) => row.status === "Sent" && this.orderKey(row) === orderKey);
    const lines = grouped.map((row: any) => ({
      id: row.id,
      demandId: row.id,
      destinationType: row.destinationType,
      destinationId: row.destinationId,
      counterId: row.counterId || "",
      expected: Number(row.expected || 0),
      preorder: Number(row.preorder || 0),
      adjustment: Number(row.adjustment || 0),
      quantity: Number(row.final || 0),
    }));
    const data = {
      ...(existing || {}), orderKey,
      code: existing?.code || `KO-${demand.date.replaceAll("-", "")}-${String(demand.kitchenId).slice(-4)}-${String(demand.scheduleId).slice(-3)}-${String(demand.categoryId).slice(-3)}`,
      date: demand.date,
      kitchenId: demand.kitchenId,
      scheduleId: demand.scheduleId,
      categoryId: demand.categoryId,
      destinationCount: lines.length,
      quantity: lines.reduce((sum: number, row: any) => sum + row.quantity, 0),
      lines,
      status: existing?.status || "Sent",
    };
    return existing
      ? this.repo.update("kitchenOrders", clientScope, existing.id, data, existing.version)
      : this.repo.create("kitchenOrders", clientScope, data);
  }

  async kitchenOrderAction(scope: CateringScope, id: string, payload: any) {
    this.assertKitchenManager(scope);
    const transition = managerOrderActions[String(payload.action || "")];
    if (!transition) throw new AppError("Unknown Kitchen order action", 422);
    const clientScope = this.clientScope(scope);
    const [row] = await this.repo.list("kitchenOrders", clientScope, { _id: id });
    if (!row) throw new AppError("Kitchen order not found", 404);
    this.assertAssignedKitchen(scope, row.kitchenId);
    const [from, to] = transition;
    if (row.status !== from || (payload.expectedStatus && payload.expectedStatus !== row.status)) throw new AppError("Order status changed; refresh and try again", 409);
    const history = [...(row.workflowHistory || []), { from, to, remarks: String(payload.remarks || ""), actorId: scope.userId, at: new Date().toISOString() }];
    return this.repo.update("kitchenOrders", clientScope, id, { ...row, status: to, workflowHistory: history }, payload.version);
  }

  private validateProofUrl(value: string) {
    if (!value) return;
    let url: URL;
    try { url = new URL(value); } catch { throw new AppError("Invalid proof URL", 422); }
    if (![/firebasestorage\.googleapis\.com$/, /storage\.googleapis\.com$/].some(pattern => pattern.test(url.hostname))) throw new AppError("Proof must use the configured Firebase storage", 422);
  }

  async createKitchenDispatch(scope: CateringScope, payload: any) {
    this.assertKitchenManager(scope);
    const clientScope = this.clientScope(scope);
    const [order] = await this.repo.list("kitchenOrders", clientScope, { _id: String(payload.orderId || "") });
    if (!order) throw new AppError("Kitchen order not found", 404);
    this.assertAssignedKitchen(scope, order.kitchenId);
    if (!["Ready", "Dispatched"].includes(order.status)) throw new AppError("Order must be ready before dispatch can be created", 409);
    const line = (order.lines || []).find((item: any) => (item.id || item.demandId) === payload.lineId);
    if (!line) throw new AppError("Selected order destination was not found", 404);
    const quantity = Number(payload.dispatchedQuantity);
    if (!Number.isFinite(quantity) || quantity <= 0) throw new AppError("Dispatched quantity must be greater than zero", 422);
    const dispatches = await this.repo.list("dispatches", clientScope, { orderId: order.id });
    const alreadyDispatched = dispatches.filter((row: any) => row.lineId === payload.lineId).reduce((sum: number, row: any) => sum + Number(row.dispatchedQuantity ?? row.delivered ?? 0), 0);
    if (alreadyDispatched + quantity > Number(line.quantity || 0)) throw new AppError("Dispatch quantity exceeds the outstanding order quantity", 409);
    const [counter] = payload.counterId ? await this.repo.list("counters", clientScope, { _id: payload.counterId }) : [];
    let counterMatchesDestination = !payload.counterId;
    if (counter?.status === "Active" && line.destinationType === "Work Site") {
      counterMatchesDestination = counter.type === "Work Site" && counter.workSiteId === line.destinationId;
    } else if (counter?.status === "Active" && line.destinationType === "Camp" && counter.type === "Dining Area" && counter.diningAreaId) {
      const [diningArea] = await this.repo.list("diningAreas", clientScope, { _id: counter.diningAreaId });
      counterMatchesDestination = diningArea?.campId === line.destinationId;
    }
    if (!counterMatchesDestination) throw new AppError("Receiving counter does not belong to this destination", 422);
    this.validateProofUrl(String(payload.proofUrl || ""));
    return this.repo.create("dispatches", clientScope, {
      code: `DSP-${Date.now().toString().slice(-8)}`,
      managerId: scope.userId,
      orderId: order.id,
      lineId: payload.lineId,
      kitchenId: order.kitchenId,
      destinationType: line.destinationType,
      destinationId: line.destinationId,
      counterId: payload.counterId || line.counterId || "",
      scheduleId: order.scheduleId,
      categoryId: order.categoryId,
      expected: Number(line.quantity || 0),
      dispatchedQuantity: quantity,
      delivered: quantity,
      accepted: 0,
      rejected: 0,
      rejectionReason: "",
      vehicleDetails: String(payload.vehicleDetails || "").trim(),
      driverOrStaff: String(payload.driverOrStaff || "").trim(),
      proofUrl: String(payload.proofUrl || ""),
      remarks: String(payload.remarks || "").trim(),
      dispatchDate: new Date().toISOString(),
      status: "Generated",
    });
  }

  async updateKitchenDispatch(scope: CateringScope, id: string, payload: any) {
    this.assertKitchenManager(scope);
    const clientScope = this.clientScope(scope);
    const [row] = await this.repo.list("dispatches", clientScope, { _id: id });
    if (!row) throw new AppError("Dispatch not found", 404);
    this.assertAssignedKitchen(scope, row.kitchenId);
    if (row.managerId !== scope.userId) throw new AppError("Only the Kitchen Manager who created this dispatch can edit it", 403);
    if (!["Generated", "Ready"].includes(row.status)) throw new AppError("A dispatched delivery can no longer be edited", 409);
    this.validateProofUrl(String(payload.proofUrl ?? row.proofUrl ?? ""));
    const quantity = Number(payload.dispatchedQuantity ?? row.dispatchedQuantity ?? row.delivered);
    const [order] = await this.repo.list("kitchenOrders", clientScope, { _id: row.orderId });
    const line = order?.lines?.find((item: any) => (item.id || item.demandId) === row.lineId);
    if (!line) throw new AppError("Order destination no longer exists", 409);
    const siblings = (await this.repo.list("dispatches", clientScope, { orderId: row.orderId })).filter((item: any) => item.id !== id && item.lineId === row.lineId);
    const otherQuantity = siblings.reduce((sum: number, item: any) => sum + Number(item.dispatchedQuantity ?? item.delivered ?? 0), 0);
    if (!Number.isFinite(quantity) || quantity <= 0 || otherQuantity + quantity > Number(line.quantity || 0)) throw new AppError("Dispatch quantity exceeds the outstanding order quantity", 409);
    return this.repo.update("dispatches", clientScope, id, {
      ...row,
      dispatchedQuantity: quantity,
      delivered: quantity,
      counterId: payload.counterId ?? row.counterId,
      vehicleDetails: String(payload.vehicleDetails ?? row.vehicleDetails ?? "").trim(),
      driverOrStaff: String(payload.driverOrStaff ?? row.driverOrStaff ?? "").trim(),
      proofUrl: String(payload.proofUrl ?? row.proofUrl ?? ""),
      remarks: String(payload.remarks ?? row.remarks ?? "").trim(),
    }, payload.version);
  }

  async kitchenDispatchAction(scope: CateringScope, id: string, payload: any) {
    this.assertKitchenManager(scope);
    const transition = managerDispatchActions[String(payload.action || "")];
    if (!transition) throw new AppError("Unknown dispatch action", 422);
    const clientScope = this.clientScope(scope);
    const [row] = await this.repo.list("dispatches", clientScope, { _id: id });
    if (!row) throw new AppError("Dispatch not found", 404);
    this.assertAssignedKitchen(scope, row.kitchenId);
    if (row.managerId !== scope.userId) throw new AppError("Only the Kitchen Manager who created this dispatch can advance it", 403);
    const [from, to] = transition;
    if (row.status !== from || (payload.expectedStatus && payload.expectedStatus !== row.status)) throw new AppError("Dispatch status changed; refresh and try again", 409);
    const history = [...(row.workflowHistory || []), { from, to, remarks: String(payload.remarks || ""), actorId: scope.userId, at: new Date().toISOString() }];
    const updated = await this.repo.update("dispatches", clientScope, id, { ...row, status: to, workflowHistory: history }, payload.version);
    if (to === "Dispatched") {
      const [order] = await this.repo.list("kitchenOrders", clientScope, { _id: row.orderId });
      if (order) {
        const allDispatches = await this.repo.list("dispatches", clientScope, { orderId: order.id });
        const total = allDispatches.filter((item: any) => ["Dispatched", "Reached", "Received", "Completed"].includes(item.id === id ? to : item.status)).reduce((sum: number, item: any) => sum + Number(item.dispatchedQuantity ?? item.delivered ?? 0), 0);
        if (total >= Number(order.quantity || 0) && order.status === "Ready") {
          await this.repo.update("kitchenOrders", clientScope, order.id, { ...order, status: "Dispatched", workflowHistory: [...(order.workflowHistory || []), { from: "Ready", to: "Dispatched", actorId: scope.userId, at: new Date().toISOString() }] }, order.version);
        }
      }
    }
    return updated;
  }

  async assignStaff(scope: CateringScope, workSiteId: string, staffIds: string[], assignedAt = new Date().toISOString()) {
    if (!scope.companyId) throw new AppError("Company scope is required", 403);
    const [site] = await this.repo.list("workSites", scope, { _id: workSiteId });
    if (!site) throw new AppError("Work site not found for this company", 404);
    const validStaff = await Tenant.countDocuments({ _id: { $in: staffIds }, client_id: scope.clientId, company_id: scope.companyId, deleted_at: null });
    if (validStaff !== new Set(staffIds).size) throw new AppError("One or more staff members do not belong to this company", 403);
    const session = await mongoose.startSession();
    const result: any[] = [];
    await session.withTransaction(async () => {
      const current = await this.repo.list("staffWorkSiteAssignments", scope);
      for (const staffId of staffIds) {
        const active = current.find(x => x.staffId === staffId && x.status === 1);
        if (active?.workSiteId === workSiteId) continue;
        if (active) await this.repo.update("staffWorkSiteAssignments", scope, active.id, { ...active, status: 0, endedAt: assignedAt }, active.version, session);
        result.push(await this.repo.create("staffWorkSiteAssignments", scope, { companyId: scope.companyId, staffId, workSiteId, status: 1, startedAt: assignedAt, endedAt: "" }, session));
      }
    });
    await session.endSession();
    return result;
  }

  async allocateCompanyStaff(scope: CateringScope, payload: any) {
    if (!scope.companyId) throw new AppError("Company scope is required", 403);
    const staffIds = [...new Set<string>(payload.staffIds || [])];
    if (!staffIds.length || !payload.scheduleIds?.length || !payload.categoryId || !payload.effectiveFrom) throw new AppError("Staff, schedules, category, and effective date are required", 422);
    if (!['Work Site', 'Dining Area'].includes(payload.collectionLocation)) throw new AppError("A valid collection location is required", 422);
    if (payload.effectiveTo && payload.effectiveTo < payload.effectiveFrom) throw new AppError("Effective end date cannot be before the start date", 422);
    if (!Number.isInteger(Number(payload.collectionLimit)) || Number(payload.collectionLimit) < 1) throw new AppError("Collection limit must be at least 1", 422);
    if (payload.preorderEnabled && (!payload.collectFromScheduleId || !payload.collectToScheduleId || payload.collectFromScheduleId === payload.collectToScheduleId)) throw new AppError("Valid preorder collection schedules are required", 422);
    const validStaff = await Tenant.countDocuments({ _id: { $in: staffIds }, client_id: scope.clientId, company_id: scope.companyId, deleted_at: null });
    if (validStaff !== staffIds.length) throw new AppError("One or more staff members do not belong to this company", 403);
    const clientScope: CateringScope = { clientId: scope.clientId, userId: scope.userId, role: scope.role };
    const [site] = payload.workSiteId ? await this.repo.list("workSites", scope, { _id: payload.workSiteId }) : [];
    if (payload.collectionLocation === "Work Site" && !site) throw new AppError("Selected work site does not belong to this company context", 403);
    const [counter] = payload.counterId ? await this.repo.list("counters", clientScope, { _id: payload.counterId }) : [];
    if (payload.collectionLocation === "Work Site" && (!counter || counter.status !== "Active" || counter.type !== "Work Site" || counter.workSiteId !== payload.workSiteId)) throw new AppError("Selected serving counter is not active for this work site", 422);
    const [diningArea] = payload.diningAreaId ? await this.repo.list("diningAreas", clientScope, { _id: payload.diningAreaId }) : [];
    if (payload.collectionLocation === "Dining Area") {
      if (!diningArea || diningArea.status !== "Active") throw new AppError("Selected dining area is not active in this Client Admin context", 422);
      const relevantCampIds = new Set<string>([
        ...(await Tenant.distinct("camp_id", { client_id: scope.clientId, company_id: scope.companyId, deleted_at: null })).map(value => String(value)),
        ...(await this.repo.list("workSites", scope)).map((row: any) => row.campId).filter(Boolean),
      ]);
      if (!relevantCampIds.has(diningArea.campId)) throw new AppError("Selected dining area is not available to this company", 403);
    }
    const servicePoint = payload.collectionLocation === "Work Site" ? counter : diningArea;
    const schedules = await this.repo.list("schedules", clientScope);
    if (payload.scheduleIds.some((id: string) => !schedules.some((row: any) => row.id === id && row.status === "Active") || !servicePoint?.scheduleIds?.includes(id))) throw new AppError("One or more schedules are unavailable at the selected serving point", 422);
    if (payload.preorderEnabled && [payload.collectFromScheduleId, payload.collectToScheduleId].some((id: string) => !schedules.some((row: any) => row.id === id && row.status === "Active"))) throw new AppError("Preorder schedules are not active in this Client Admin context", 422);
    const categories = await this.repo.list("categories", clientScope);
    if (!categories.some((row: any) => row.id === payload.categoryId && row.status === "Active") || !servicePoint?.categoryIds?.includes(payload.categoryId)) throw new AppError("Selected category is unavailable at the selected serving point", 422);
    const session = await mongoose.startSession();
    const created: any[] = [];
    await session.withTransaction(async () => {
      const current = await this.repo.list("companyStaffCateringAllocations", scope);
      for (const staffId of staffIds) {
        for (const active of current.filter(x => x.staffId === staffId && x.status === "Active")) {
          const overlaps = active.scheduleIds?.some((id: string) => payload.scheduleIds.includes(id)) && active.effectiveFrom <= (payload.effectiveTo || "9999-12-31") && (active.effectiveTo || "9999-12-31") >= payload.effectiveFrom;
          if (overlaps) await this.repo.update("companyStaffCateringAllocations", scope, active.id, { ...active, status: "Inactive", endedAt: new Date().toISOString() }, active.version, session);
        }
        const data = { ...payload, staffId, companyId: scope.companyId, status: "Active", startedAt: new Date().toISOString(), endedAt: "" };
        delete data.staffIds;
        created.push(await this.repo.create("companyStaffCateringAllocations", scope, data, session));
      }
    });
    await session.endSession();
    return created;
  }

  private async validate(entity: CateringEntity, data: any, scope: CateringScope, ignoreId?: string) {
    const required: Partial<Record<CateringEntity, string[]>> = {
      schedules: ["name", "startTime", "endTime"], categories: ["name", "group", "foodType"], grades: ["name"],
      kitchens: ["name", "code", "address"], diningAreas: ["campId", "zoneId", "name", "code"],
      counters: ["type", "name", "code", "layer"], machines: ["machineId", "name", "counterId"],
      workSites: ["name", "code", "campId", "location"],
    };
    const missing = required[entity]?.find(key => data[key] === undefined || data[key] === "");
    if (missing) throw new AppError(`${missing} is required`, 422);
    if (entity === "schedules" && data.startTime >= data.endTime) throw new AppError("End time must be later than start time", 422);
    if (entity === "kitchens" && data.status === "Active") {
      const rows = await this.repo.list("kitchens", this.clientScope(scope));
      const destinations = new Set([...(data.campIds || []).map((id: string) => `camp:${id}`), ...(data.workSiteIds || []).map((id: string) => `site:${id}`)]);
      const overlap = rows.find((row: any) => row.id !== ignoreId && row.status === "Active"
        && row.scheduleIds?.some((id: string) => data.scheduleIds?.includes(id))
        && [...(row.campIds || []).map((id: string) => `camp:${id}`), ...(row.workSiteIds || []).map((id: string) => `site:${id}`)].some((id: string) => destinations.has(id)));
      if (overlap) throw new AppError(`${overlap.name} already covers one of these destinations for the selected schedule`, 409);
    }
    if (entity === "dispatches" && Number(data.rejected) > 0 && !data.rejectionReason?.trim()) throw new AppError("Rejection reason is required", 422);
    if (entity === "tenantAllocations" && data.status === "Active") {
      const rows = await this.repo.list(entity, scope, { tenantId: data.tenantId });
      const duplicate = rows.find(x => x.id !== ignoreId && x.status === "Active" && x.scheduleIds?.some((id: string) => data.scheduleIds?.includes(id)) && x.effectiveFrom <= (data.effectiveTo || "9999-12-31") && (x.effectiveTo || "9999-12-31") >= data.effectiveFrom);
      if (duplicate) throw new AppError("Tenant already has an overlapping active allocation", 409);
    }
    if (entity === "preorderRequests") {
      const rows = await this.repo.list(entity, scope, { tenantId: data.tenantId, date: data.date });
      if (rows.some(x => x.id !== ignoreId && x.fromScheduleId === data.fromScheduleId && x.toScheduleId === data.toScheduleId)) throw new AppError("A matching preorder already exists", 409);
    }
    if (entity === "machines" && data.status === "Active") {
      const rows = await this.repo.list(entity, scope, { counterId: data.counterId });
      if (rows.some(x => x.id !== ignoreId && x.status === "Active")) throw new AppError("This counter already has an active machine", 409);
    }
    if (entity === "wastage") {
      if (data.proofUrl) {
        let url: URL;
        try { url = new URL(data.proofUrl); } catch { throw new AppError("Invalid proof image URL", 422); }
        if (![/firebasestorage\.googleapis\.com$/, /storage\.googleapis\.com$/].some(pattern => pattern.test(url.hostname))) throw new AppError("Proof image must use the configured Firebase storage", 422);
      }
      data.remaining = Math.max(0, Number(data.accepted || 0) - Number(data.served || 0));
      data.wastage = data.remaining + Number(data.rejected || 0);
      data.wastagePercent = data.accepted ? Number((data.wastage / Number(data.accepted) * 100).toFixed(2)) : 0;
    }
  }

  private assertWriteAllowed(entity: CateringEntity, scope: CateringScope) {
    if (scope.role === "ROLE_KITCHEN_MANAGER") throw new AppError("Kitchen Managers must use the kitchen-scoped workflow routes", 403);
    if (scope.role !== "ROLE_COMPANY") return;
    const allowed: CateringEntity[] = ["workSites", "staffWorkSiteAssignments", "companyStaffCateringAllocations", "preorderRequests"];
    if (!allowed.includes(entity)) throw new AppError("Company Admin cannot modify Client Admin Catering setup", 403);
  }
}
