export interface PermissionResponse {
  id: string;
  name: string;
  slug: string;
  module: string;
}

export interface RoleAssignedPermissionResponse {
  id: string;
  role_id: string;
  permission_id: string;
  permission_name?: string;
  permission_slug?: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface AssignPermissionToRoleRequest {
  role_id: string;
  permission_ids: string[];
}
