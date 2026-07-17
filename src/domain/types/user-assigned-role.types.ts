export interface UserAssignedRoleResponse {
  id: string;
  role_id: string;
  role_name?: string;
  role_slug?: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface AssignRoleRequest {
  user_id: string;
  role_id: string;
}

export interface RemoveRoleRequest {
  user_id: string;
  role_id: string;
}
