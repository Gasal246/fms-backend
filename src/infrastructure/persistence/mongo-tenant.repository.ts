import mongoose from "mongoose";
import type { TenantRepository } from "../../domain/repositories/tenant.repository.interface.js";
import UserRegister from "./models/tenant.model.js";
import BedHistory from "./models/bed-history.model.js";
import Camp_zones from "./models/zone.model.js";

export class MongoTenantRepository implements TenantRepository {
    async findByEmail(email: string): Promise<any> {
        return await UserRegister.findOne({ email, deleted_at: null });
    }

    async findByPhone(phone: string): Promise<any> {
        return await UserRegister.findOne({ phone, deleted_at: null });
    }

    async findById(id: string): Promise<any> {
        return await UserRegister.findOne({ _id: id, deleted_at: null }).populate("company_id").populate("contract_id");
    }

    async findBasicById(id: string): Promise<any> {
        return await UserRegister.findOne({ _id: id, deleted_at: null })
            .select("employee_id name email gender status country_code phone company_name company_id user_image createdAt dob country_id country_state nationality emergency_contact_name emergency_contact_phone")
            .populate("company_id", "company_name");
    }

    async createTenant(data: any): Promise<any> {
        const newTenant = new UserRegister(data);
        await newTenant.save();
        return await newTenant.populate(["company_id", "contract_id"]);
    }

    async updateTenant(id: string, data: any): Promise<any> {
        console.log("update tenant",data)
        return await UserRegister.findOneAndUpdate({ _id: id, deleted_at: null }, data, { returnDocument: 'after' }).populate("company_id").populate("contract_id");
    }

    async deleteTenant(id: string): Promise<any> {
        return await UserRegister.findByIdAndUpdate(id, {
            status: 0,
            deleted_at: new Date()
        }, { returnDocument: 'after' });
    }

    async findAll(page: number = 1, limit: number = 10, filters?: any, client_id?: string): Promise<{ data: any[], total: number }> {
        const skip = (page - 1) * limit;
        const queryConditions: any[] = [{ deleted_at: null }];
     
        if (filters) {
            // Basic filters
            if (filters.name) {
                queryConditions.push({ name: { $regex: filters.name, $options: "i" } });
            }
            if (filters.email) {
                queryConditions.push({ email: { $regex: filters.email, $options: "i" } });
            }
            if (filters.type) {
                queryConditions.push({ type: filters.type });
            }
            if (filters.allocation_status !== undefined) {
                queryConditions.push({ allocation_status: filters.allocation_status });
            }
            if (filters.status !== undefined) {
                queryConditions.push({ status: filters.status });
            } else {
                queryConditions.push({ status: { $nin: [2, 3] } });
            }
            if (filters.company_id) {
                if (filters.company_id === 'unassigned') {
                    queryConditions.push({ company_id: null });
                } else if (filters.company_id !== 'all' && mongoose.Types.ObjectId.isValid(filters.company_id)) {
                    queryConditions.push({ company_id: new mongoose.Types.ObjectId(filters.company_id) });
                }
            }

            if (filters.country_state) {
                queryConditions.push({ country_state: { $regex: filters.country_state, $options: "i" } });
            }
            if (filters.contract_id) {
                if (filters.contract_id === 'unassigned') {
                    queryConditions.push({ contract_id: null });
                } else if (filters.contract_id !== 'all' && mongoose.Types.ObjectId.isValid(filters.contract_id)) {
                    queryConditions.push({ contract_id: new mongoose.Types.ObjectId(filters.contract_id) });
                }
            }

            // Search filter (name, email, phone, or employee_id)
            if (filters.search) {
                const searchRegex = { $regex: filters.search, $options: "i" };
                queryConditions.push({
                    $or: [
                        { name: searchRegex },
                        { email: searchRegex },
                        { phone: searchRegex },
                        { employee_id: searchRegex }
                    ]
                });
            }

            // Location filters
            const bedHistoryQuery: any = { unassigned_at: null };
            let hasLocationFilter = false;

            if (filters.role === 'ROLE_COORDINATOR' || filters.role === 'ROLE_ZONE_COORDINATOR') {
                const assignedCampIds = (filters.assigned_camps || []).map((id: any) => new mongoose.Types.ObjectId(id));
                const assignedZoneIds = (filters.assigned_zones || []).map((id: any) => new mongoose.Types.ObjectId(id));
                
                // Fetch all zones belonging to coordinator's assigned camps
                const campsZoneDocs = await Camp_zones.find({ camp_id: { $in: assignedCampIds } }, { _id: 1 }).lean();
                const campZoneIds = campsZoneDocs.map((z: any) => z._id);
                const allAllowedZoneIds = [...assignedZoneIds, ...campZoneIds];

                // Fetch all camps containing the coordinator's assigned zones
                const zoneCampDocs = await Camp_zones.find({ _id: { $in: assignedZoneIds } }, { camp_id: 1 }).lean();
                const zoneCampIds = zoneCampDocs.map((z: any) => z.camp_id).filter(Boolean);
                const allAllowedCampIds = [...assignedCampIds, ...zoneCampIds];

                if (filters.site && mongoose.Types.ObjectId.isValid(filters.site)) {
                    const siteId = new mongoose.Types.ObjectId(filters.site);
                    const isCampAllowed = allAllowedCampIds.some((id: any) => id.toString() === siteId.toString());
                    
                    if (isCampAllowed) {
                        const siteConditions: any[] = [];
                        
                        // Unallocated condition for this camp
                        siteConditions.push({
                            allocation_status: false,
                            camp_id: siteId
                        });

                        // Allocated condition for this camp
                        if (assignedCampIds.some((id: any) => id.toString() === siteId.toString())) {
                            // Coordinator directly assigned to this camp: see all allocated in this camp
                            siteConditions.push({
                                allocation_status: true,
                                camp_id: siteId
                            });
                        } else {
                            // Coordinator only zone-assigned: see allocated only in assigned zones in this camp
                            siteConditions.push({
                                allocation_status: true,
                                camp_id: siteId,
                                zone_id: { $in: allAllowedZoneIds }
                            });
                        }
                        
                        queryConditions.push({ $or: siteConditions });
                    } else {
                        queryConditions.push({ _id: { $in: [] } });
                    }
                } else {
                    const coordinatorConditions: any[] = [];
                    
                    // Unallocated tenants: see if camp_id is in allowed camps
                    if (allAllowedCampIds.length > 0) {
                        coordinatorConditions.push({
                            allocation_status: false,
                            camp_id: { $in: allAllowedCampIds }
                        });
                    }

                    // Allocated tenants: see if camp_id is directly assigned or zone_id is in allowed zones
                    const allocatedConditions: any[] = [];
                    if (assignedCampIds.length > 0) {
                        allocatedConditions.push({ camp_id: { $in: assignedCampIds } });
                    }
                    if (allAllowedZoneIds.length > 0) {
                        allocatedConditions.push({ zone_id: { $in: allAllowedZoneIds } });
                    }
                    
                    if (allocatedConditions.length > 0) {
                        coordinatorConditions.push({
                            allocation_status: true,
                            $or: allocatedConditions
                        });
                    }

                    if (coordinatorConditions.length > 0) {
                        queryConditions.push({ $or: coordinatorConditions });
                    } else {
                        queryConditions.push({ _id: { $in: [] } });
                    }
                }
            } else if (filters.site && mongoose.Types.ObjectId.isValid(filters.site)) {
                queryConditions.push({ camp_id: new mongoose.Types.ObjectId(filters.site) });
            }

            if (filters.zone && mongoose.Types.ObjectId.isValid(filters.zone)) {
                bedHistoryQuery.zone_id = new mongoose.Types.ObjectId(filters.zone);
                hasLocationFilter = true;
            }
            if (filters.building && mongoose.Types.ObjectId.isValid(filters.building)) {
                bedHistoryQuery.building_id = new mongoose.Types.ObjectId(filters.building);
                hasLocationFilter = true;
            }
            if (filters.room && mongoose.Types.ObjectId.isValid(filters.room)) {
                bedHistoryQuery.room_id = new mongoose.Types.ObjectId(filters.room);
                hasLocationFilter = true;
            }

            if (hasLocationFilter) {
                const activeAllocations = await BedHistory.find(bedHistoryQuery, { tenant_id: 1 }).lean();
                const tenantIds = activeAllocations.map(a => a.tenant_id);
                queryConditions.push({ _id: { $in: tenantIds } });
            }
        }

        // Enforce client_id
        if (client_id) {
            queryConditions.push({ client_id: new mongoose.Types.ObjectId(client_id) });
        }

        const finalQuery = queryConditions.length > 1 ? { $and: queryConditions } : queryConditions[0];
        
        const [total, data] = await Promise.all([
            UserRegister.countDocuments(finalQuery),
            UserRegister.find(finalQuery)
                .skip(skip)
                .limit(limit)
                .populate("company_id")
                .populate("contract_id")
                .lean()
                .select("employee_id name phone email status user_image allocation_status type createdAt gender dob nationality emergency_contact_name emergency_contact_phone camp_id")
        ]);
        
        return { data, total };
    }
}
