import mongoose from "mongoose";
import crypto from "node:crypto";
import { env } from "../config/env.config.js";
import Company from "../infrastructure/persistence/models/company.model.js";
import GlobalCompanyAccount from "../infrastructure/persistence/models/global-company-account.model.js";
import CompanyClientMembership from "../infrastructure/persistence/models/company-client-membership.model.js";
import CompanyAccountToken from "../infrastructure/persistence/models/company-account-token.model.js";
import { cateringModel } from "../infrastructure/persistence/models/catering.model.js";

const apply = process.argv.includes("--apply");
const report = {
  mode: apply ? "apply" : "dry-run",
  accounts: 0,
  memberships: 0,
  counters: 0,
  missingEmail: [] as string[],
  missingPassword: [] as string[],
  conflicts: [] as Array<{ email: string; companyIds: string[]; names: string[] }>,
  setupLinks: [] as Array<{ email: string; url: string }>,
  unlinkedCompanies: [] as string[],
};

await mongoose.connect(env.dburl);
const companies: any[] = await Company.find({ deleted_at: null }).select("+password").sort({ createdAt: 1 }).lean();
const groups = new Map<string, any[]>();
for (const company of companies) {
  const email = String(company.email || "").trim().toLowerCase();
  if (!email) { report.missingEmail.push(company._id.toString()); continue; }
  groups.set(email, [...(groups.get(email) || []), company]);
}

for (const [email, rows] of groups) {
  const oldest = rows[0];
  if (!oldest.password) report.missingPassword.push(oldest._id.toString());
  const distinctNames = [...new Set(rows.map(row => String(row.company_name || "").trim().toLowerCase()))];
  if (distinctNames.length > 1) report.conflicts.push({ email, companyIds: rows.map(row => row._id.toString()), names: rows.map(row => row.company_name) });
  report.accounts += 1; report.memberships += rows.length;
  if (!apply) continue;
  const account: any = await GlobalCompanyAccount.findOneAndUpdate({ login_email: email }, { $setOnInsert: { company_name: oldest.company_name, normalized_name: String(oldest.company_name).toLowerCase().replace(/[^a-z0-9]+/g, " ").trim(), login_email: email, password: oldest.password || null, status: oldest.password ? "Active" : "PendingSetup", setup_completed_at: oldest.password ? new Date() : null } }, { upsert: true, new: true });
  for (const company of rows) {
    await Company.updateOne({ _id: company._id }, { $set: { global_company_account_id: account._id } });
    await CompanyClientMembership.updateOne({ global_company_account_id: account._id, client_id: company.client_id }, { $setOnInsert: { company_id: company._id, status: company.password ? "Active" : "PendingAccountSetup", requested_by: company.client_id, requested_at: company.createdAt, activated_at: company.password ? new Date() : null, history: [{ to: company.password ? "Active" : "PendingAccountSetup", actor_id: company.client_id, actor_role: "migration", at: new Date() }] } }, { upsert: true });
  }
  if (!oldest.password) {
    const existingToken = await CompanyAccountToken.findOne({ global_company_account_id: account._id, purpose: "AccountSetup", consumed_at: null, expires_at: { $gt: new Date() } }).lean();
    if (!existingToken) {
      const membership: any = await CompanyClientMembership.findOne({ global_company_account_id: account._id, status: "PendingAccountSetup" }).sort({ createdAt: 1 }).lean();
      if (membership) {
        const token = crypto.randomBytes(32).toString("base64url");
        await CompanyAccountToken.create({ global_company_account_id: account._id, membership_id: membership._id, token_hash: crypto.createHash("sha256").update(token).digest("hex"), expires_at: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000) });
        report.setupLinks.push({ email, url: `${env.frontendUrl}/company/setup?token=${encodeURIComponent(token)}` });
      }
    }
  }
}

const workSites: any[] = await cateringModel("workSites").find({ deleted_at: null }).select("client_id company_id data").lean();
const siteMap = new Map(workSites.map(site => [site._id.toString(), site]));
const counters: any[] = await cateringModel("counters").find({ deleted_at: null, company_id: null, "data.type": "Work Site", "data.workSiteId": { $exists: true, $ne: "" } }).lean();
for (const counter of counters) {
  const site = siteMap.get(counter.data.workSiteId);
  if (!site?.company_id || String(site.client_id) !== String(counter.client_id)) continue;
  report.counters += 1;
  if (apply) await cateringModel("counters").updateOne({ _id: counter._id }, { $set: { company_id: site.company_id, "data.companyId": site.company_id.toString() } });
}

if (apply) {
  const unlinked: any[] = await Company.find({ deleted_at: null, global_company_account_id: null }).select("_id").lean();
  report.unlinkedCompanies = unlinked.map(row => row._id.toString());
} else {
  report.unlinkedCompanies = report.missingEmail;
}

console.log(JSON.stringify(report, null, 2));
await mongoose.disconnect();
