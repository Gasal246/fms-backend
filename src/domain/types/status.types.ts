export type StatusResponse = {
  id: string;
  name: string;
  slug: string;
  code: string;
  deleted_at?: Date | null;
  createdAt: Date;
  updatedAt: Date;
};
