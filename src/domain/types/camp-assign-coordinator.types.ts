// ── Coordinator site-assignment types ─────────────────────────────────────────

export type AssignCoordinatorRequest = {
  coordinator_id: string;
  camp_id: string;       // single site
  status?: number;       // defaults to 1 (active)
};

export type AssignCoordinatorResponse = {
  id: string;
  camp_id: any;          // populated camp object
  coordinator_id: any;   // populated coordinator object
  status: number;
  createdAt: Date;
  updatedAt: Date;
};

export type GetAssignedCampsForCoordinatorResponse = AssignCoordinatorResponse[];
