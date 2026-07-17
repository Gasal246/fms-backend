export type SignInRequest = {
  email: string;
  password: string;
  role_slug: string;
  preferred_membership_id?: string;
};
export type SignInResponse = {
  id: string;
  email: string;
  role: string;
};
