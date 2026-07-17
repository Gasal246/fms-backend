import mongoose from "mongoose";
import type { CateringRepository, CateringScope } from "../../domain/repositories/catering.repository.interface.js";
import { CATERING_ENTITIES, type CateringEntity } from "../../infrastructure/persistence/models/catering.model.js";
import { AppError } from "../../shared/utils/AppError.js";
import Camp from "../../infrastructure/persistence/models/camp.model.js";
import Zone from "../../infrastructure/persistence/models/zone.model.js";
import Company from "../../infrastructure/persistence/models/company.model.js";
import Tenant from "../../infrastructure/persistence/models/tenant.model.js";

const orderFlow = ["Draft", "Generated", "Reviewed", "Confirmed", "Sent", "Accepted", "Preparing", "Ready", "Dispatched", "Delivered", "Received", "Completed"];
const dispatchFlow = ["Generated", "Ready", "Dispatched", "Reached", "Received", "Completed"];
const demandFlow = ["Draft", "Generated", "Confirmed", "Sent"];
const wastageFlow = ["Pending Approval", "Approved"];

export class CateringUseCase {
  constructor(private repo: CateringRepository) {}

  entity(value: string): CateringEntity {
    if (!CATERING_ENTITIES.includes(value as CateringEntity)) throw new AppError("Unknown Catering resource", 404);
    return value as CateringEntity;
  }

  async bootstrap(scope: CateringScope) {
    const masterFilter: any = { client_id: scope.clientId, deleted_at: null };
    const tenantFilter: any = { ...masterFilter };
    if (scope.companyId) tenantFilter.company_id = scope.companyId;
    const clientScope: CateringScope = { clientId: scope.clientId, userId: scope.userId, role: scope.role };
    const [camps, zones, companies, tenants, records, sharedRecords] = await Promise.all([
      Camp.find(masterFilter).select("camp_name camp_city status").lean(),
      Zone.find({ client_id: new mongoose.Types.ObjectId(scope.clientId), status: { $ne: 0 } } as any).select("camp_id zone_name status").lean(),
      scope.companyId ? Company.find({ _id: scope.companyId, client_id: scope.clientId }).select("company_name company_code status").lean() : Company.find(masterFilter).select("company_name company_code status").lean(),
      Tenant.find(tenantFilter).select("name email employee_id company_id camp_id zone_id room_id job_title nationality status custom_data").limit(5000).lean(),
      Promise.all(CATERING_ENTITIES.map(async entity => [entity, await this.repo.list(entity, scope)] as const)),
      scope.companyId ? Promise.all((["schedules", "categories", "grades", "diningAreas", "counters"] as CateringEntity[]).map(async entity => [entity, await this.repo.list(entity, clientScope)] as const)) : Promise.resolve([]),
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
    const [allocations, preorders, kitchens, existing] = await Promise.all([
      this.repo.list("companyStaffCateringAllocations", scope), this.repo.list("preorderRequests", scope),
      this.repo.list("kitchens", scope), this.repo.list("demands", scope, { date: serviceDate }),
    ]);
    const groups = new Map<string, any>();
    for (const row of allocations.filter(x => x.status === "Active" && x.effectiveFrom <= serviceDate && (!x.effectiveTo || x.effectiveTo >= serviceDate))) {
      for (const scheduleId of row.scheduleIds || []) {
        const destinationId = row.workSiteId || row.diningAreaId;
        const key = `${destinationId}:${scheduleId}:${row.categoryId}`;
        const group = groups.get(key) || { date: serviceDate, destinationType: row.workSiteId ? "Work Site" : "Dining Area", destinationId, scheduleId, categoryId: row.categoryId, expected: 0, preorder: 0, adjustment: 0, status: "Generated" };
        group.expected += Number(row.collectionLimit || 1);
        groups.set(key, group);
      }
    }
    const session = await mongoose.startSession();
    const output: any[] = [];
    await session.withTransaction(async () => {
      for (const group of groups.values()) {
        group.preorder = preorders.filter(x => x.date === serviceDate && x.toScheduleId === group.scheduleId && !["Rejected", "Expired"].includes(x.status)).length;
        group.final = group.expected + group.preorder;
        group.kitchenId = kitchens.find(x => x.workSiteIds?.includes(group.destinationId) || x.campIds?.includes(group.destinationId))?.id || "";
        const current = existing.find(x => x.destinationId === group.destinationId && x.scheduleId === group.scheduleId && x.categoryId === group.categoryId);
        output.push(current ? await this.repo.update("demands", scope, current.id, { ...current, ...group, adjustment: current.adjustment || 0, final: group.final + Number(current.adjustment || 0) }, current.version, session) : await this.repo.create("demands", scope, group, session));
      }
    });
    await session.endSession();
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
    const workflowHistory = [...(row.workflowHistory || []), { from: row.status, to: next, remarks, actorId: scope.userId, at: new Date().toISOString() }];
    return this.repo.update(entity, scope, id, { ...row, status: next, lastTransitionRemarks: remarks, workflowHistory }, version);
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
    if (scope.role !== "ROLE_COMPANY") return;
    const allowed: CateringEntity[] = ["workSites", "staffWorkSiteAssignments", "companyStaffCateringAllocations", "preorderRequests"];
    if (!allowed.includes(entity)) throw new AppError("Company Admin cannot modify Client Admin Catering setup", 403);
  }
}
