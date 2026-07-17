import type { CompanyMembershipStatus } from "../../infrastructure/persistence/models/company-client-membership.model.js";

export const normalizeCompanyName = (value = "") =>
  value.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();

export const normalizeCompanyEmail = (value = "") => value.trim().toLowerCase();

export function selectCompanyMembership<T extends { _id: { toString(): string } }>(memberships: T[], preferredId?: string) {
  return memberships.find(row => row._id.toString() === preferredId) || memberships[0];
}

export function managedMembershipTransition(status: CompanyMembershipStatus, action: "suspend" | "resume" | "revoke") {
  const transitions: Record<string, Partial<Record<CompanyMembershipStatus, CompanyMembershipStatus>>> = {
    suspend: { Active: "Suspended" },
    resume: { Suspended: "Active" },
    revoke: { Active: "Revoked", Suspended: "Revoked", ApprovedAwaitingClientSetup: "Revoked", PendingCompanyApproval: "Revoked" },
  };
  return transitions[action]?.[status] || null;
}
