import mongoose from "mongoose";
import type { CountryStateRepository } from "../../domain/repositories/country-state.repository.interface.js";
import type { CreateCountryStateRequest, UpdateCountryStateRequest, CountryStateFilter } from "../../domain/types/country-state.types.js";
import CountryState from "./models/country-state.model.js";

export class MongoCountryStateRepository implements CountryStateRepository {
  async create(data: CreateCountryStateRequest): Promise<any> {
    const countryState = new CountryState({
      nationality_name: data.nationality_name,
      country_state_name: data.country_state_name,
    });
    return countryState.save();
  }

  async findById(id: string): Promise<any | null> {
    if (!mongoose.Types.ObjectId.isValid(id)) {
      throw new Error("Invalid country state ID");
    }
    return CountryState.findOne({ _id: new mongoose.Types.ObjectId(id), deleted_at: null });
  }

  async findAll(filter?: CountryStateFilter): Promise<any[]> {
    const query: any = { 
      deleted_at: null
    };
    
    if (filter?.nationality_name) {
      query.nationality_name = { $regex: new RegExp(`^${filter.nationality_name}$`, "i") };
    }

    return CountryState.find(query).sort({ createdAt: -1 });
  }

  async update(id: string, data: UpdateCountryStateRequest): Promise<any | null> {
    if (!mongoose.Types.ObjectId.isValid(id)) {
      throw new Error("Invalid country state ID");
    }
    return CountryState.findOneAndUpdate(
      { _id: new mongoose.Types.ObjectId(id), deleted_at: null },
      data,
      { returnDocument: "after" }
    );
  }

  async delete(id: string): Promise<void> {
    if (!mongoose.Types.ObjectId.isValid(id)) {
      throw new Error("Invalid country state ID");
    }
    await CountryState.findOneAndUpdate(
      { _id: new mongoose.Types.ObjectId(id), deleted_at: null },
      { deleted_at: new Date() }
    );
  }
}
