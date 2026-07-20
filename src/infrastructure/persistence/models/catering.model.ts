import mongoose, { Schema, type Model } from "mongoose";

const auditFields = {
  client_id: { type: Schema.Types.ObjectId, ref: "client", required: true, index: true },
  company_id: { type: Schema.Types.ObjectId, ref: "companies", default: null, index: true },
  data: { type: Schema.Types.Mixed, required: true, default: {} },
  status: { type: String, default: "Active", index: true },
  deleted_at: { type: Date, default: null, index: true },
  created_by: { type: Schema.Types.ObjectId, required: true },
  updated_by: { type: Schema.Types.ObjectId, default: null },
  transitions: [{ from: String, to: String, remarks: String, actor_id: Schema.Types.ObjectId, at: Date }],
};

export const CATERING_ENTITIES = [
  "schedules", "categories", "grades", "kitchens", "diningAreas",
  "counters", "machines", "counterStaff", "workSites", "staffWorkSiteAssignments",
  "tenantAllocations", "companyStaffCateringAllocations", "demands", "kitchenOrders",
  "dispatches", "preorderRules", "preorderRequests", "wastage", "localServers", "servingLogs",
] as const;

export type CateringEntity = typeof CATERING_ENTITIES[number];

const models = new Map<CateringEntity, Model<any>>();

for (const entity of CATERING_ENTITIES) {
  const schema = new Schema(auditFields, { timestamps: true, optimisticConcurrency: true });
  schema.index({ client_id: 1, deleted_at: 1, updatedAt: -1 });
  schema.index({ client_id: 1, company_id: 1, deleted_at: 1, updatedAt: -1 });
  if (entity !== "workSites") schema.index({ client_id: 1, "data.code": 1 }, {
    unique: true, partialFilterExpression: { "data.code": { $type: "string" }, deleted_at: null },
  });
  if (entity === "workSites") {
    schema.index({ client_id: 1, company_id: 1, "data.code": 1 }, {
      unique: true, partialFilterExpression: { "data.code": { $type: "string" }, deleted_at: null },
    });
  }
  if (entity === "staffWorkSiteAssignments") {
    schema.index({ client_id: 1, company_id: 1, "data.staffId": 1 }, {
      unique: true, partialFilterExpression: { "data.status": 1, deleted_at: null },
    });
  }
  if (entity === "kitchenOrders") {
    schema.index({ client_id: 1, "data.orderKey": 1 }, {
      unique: true, partialFilterExpression: { "data.orderKey": { $type: "string" }, deleted_at: null },
    });
  }
  models.set(entity, mongoose.models[`Catering_${entity}`] || mongoose.model(`Catering_${entity}`, schema, `catering_${entity}`));
}

export const cateringModel = (entity: CateringEntity) => models.get(entity)!;
