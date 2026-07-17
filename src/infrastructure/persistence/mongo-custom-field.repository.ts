import mongoose from "mongoose";
import type { CustomFieldRepository } from "../../domain/repositories/custom-field.repository.interface.js";
import type {
  CustomFieldDefinitionRequest,
  CustomFieldDefinitionResponse,
} from "../../domain/types/custom-field.types.js";
import CustomFieldDefinition from "./models/custom-field-definition.model.js";

export class MongoCustomFieldRepository implements CustomFieldRepository {
  private mapToResponse(doc: any): CustomFieldDefinitionResponse {
    return {
      ...doc,
      id: doc._id?.toString() ?? doc.id,
      client_id: doc.client_id?.toString(),
    } as CustomFieldDefinitionResponse;
  }

  async findByClientAndModule(
    clientId: string,
    module: string
  ): Promise<CustomFieldDefinitionResponse | null> {
    const doc = await CustomFieldDefinition.findOne({
      client_id: new mongoose.Types.ObjectId(clientId),
      module,
    })
      .select("-__v")
      .lean();
    if (!doc) return null;
    return this.mapToResponse(doc);
  }

  async upsert(
    data: CustomFieldDefinitionRequest
  ): Promise<CustomFieldDefinitionResponse> {
    const doc = await CustomFieldDefinition.findOneAndUpdate(
      {
        client_id: new mongoose.Types.ObjectId(data.client_id),
        module: data.module,
      },
      {
        $set: {
          entity_type: data.entity_type,
          fields: data.fields,
          updated_by: data.updated_by,
          created_by: data.created_by,
        },
      },
      {
        upsert: true,
        returnDocument: 'after',
        setDefaultsOnInsert: true,
      }
    )
      .select("-__v")
      .lean();

    return this.mapToResponse(doc as any);
  }
}
