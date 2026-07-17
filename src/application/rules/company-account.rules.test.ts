import { describe, expect, it } from "vitest";
import { managedMembershipTransition, normalizeCompanyEmail, normalizeCompanyName, selectCompanyMembership } from "./company-account.rules.js";

describe("global Company Account rules", () => {
  it("normalizes legacy identities consistently", () => {
    expect(normalizeCompanyEmail("  Admin@ARAMCO.COM ")).toBe("admin@aramco.com");
    expect(normalizeCompanyName("Saudi  ARAMCO & Co.")).toBe("saudi aramco co");
  });

  it("restores an owned preferred membership and otherwise uses the oldest active row", () => {
    const memberships = [{ _id: { toString: () => "oldest" } }, { _id: { toString: () => "preferred" } }];
    expect(selectCompanyMembership(memberships, "preferred")?._id.toString()).toBe("preferred");
    expect(selectCompanyMembership(memberships, "inactive")?._id.toString()).toBe("oldest");
  });

  it("guards membership lifecycle transitions", () => {
    expect(managedMembershipTransition("Active", "suspend")).toBe("Suspended");
    expect(managedMembershipTransition("Suspended", "resume")).toBe("Active");
    expect(managedMembershipTransition("Rejected", "resume")).toBeNull();
  });
});
