import type {
  CustomFieldDefinitionRequest,
  CustomFieldDefinitionResponse,
} from "../types/custom-field.types.js";

export interface CustomFieldRepository {
  findByClientAndModule(
    clientId: string,
    module: string
  ): Promise<CustomFieldDefinitionResponse | null>;

  upsert(data: CustomFieldDefinitionRequest): Promise<CustomFieldDefinitionResponse>;
}
