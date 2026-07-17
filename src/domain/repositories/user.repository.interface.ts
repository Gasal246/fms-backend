export interface UserRepository {
    findById(id: string, roleSlug: string): Promise<any>;
    updateProfile(id: string, roleSlug: string, data: any): Promise<any>;
}
