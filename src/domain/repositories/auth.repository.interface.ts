export interface AuthRepository {
  findByEmail(email: string): Promise<any>;
  findById(id: string): Promise<any>;
  findByEmailAndRoleSlug(email: string, roleSlug: string): Promise<any>;
  getUserRoles(email: string): Promise<any[]>;
  getroleByid(roleId: string): Promise<any>;
  getRolesBySlugs(slugs: string[]): Promise<any[]>;
}
export interface PasswordService {
  compare(plainText: string, hash: string): Promise<boolean>;
  hash(plainText: string): Promise<string>;
}
export interface AuthService {
  signIn(data: any): Promise<any>;
  getRolesByEmail(email: string): Promise<any>;
  getUserPermissions(roleSlug: string, client_id?: string): Promise<string[]>;
}
export interface TokenService {
  sign(payload: any): Promise<string>;
}

