
import Client from "./models/user.model.js";
import Coordinator from "./models/coordinator.model.js";
import Technician from "./models/technician.model.js";
import type { UserRepository } from "../../domain/repositories/user.repository.interface.js";
import mongoose from "mongoose";
import Company from "./models/company.model.js";

export class MongoUserRepository implements UserRepository {
    private getModel(roleSlug: string): any {
        switch (roleSlug) {
            case "ROLE_ZONE_COORDINATOR":
                return Coordinator;
            case "ROLE_COORDINATOR":
                return Coordinator;
            case "ROLE_TECHNICIAN":
                return Technician;
            case "ROLE_COMPANY":
                return Company;
            default:
                return Client;
        }
    }

    async findById(id: string, roleSlug: string): Promise<any> {
        const model = this.getModel(roleSlug);
        const user = await model.findOne(
            { _id: new mongoose.Types.ObjectId(id) },
            { password: 0, __v: 0 }
        ).lean();
        if (!user) return null;
        const result: any = { ...user, id: (user as any)._id?.toString() };
        delete result._id;
        return result;
    }
    async updateProfile(id: string, roleSlug: string, data: any): Promise<any> {
        const model = this.getModel(roleSlug);
        const user = await model.findById(id);
        if (user) {
            Object.assign(user, data);
            return await user.save();
        }
        return null;
    }
}
