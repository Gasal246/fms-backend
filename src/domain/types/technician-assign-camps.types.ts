// ── Technician site-assignment types ──────────────────────────────────────────

export type AssignTechnicianRequest = {
  technician_id: string;
  client_id: string;
  camp_ids: string[];   // one or many sites
  status?: number;      // defaults to 1 (active)
};

export type AssignTechnicianResponse = {
  id: string;
  technician_id: any;   // populated
  client_id: any;       // populated
  camp_id: any[];       // array of populated camps
  status: number;
  createdAt: Date;
  updatedAt: Date;
};
