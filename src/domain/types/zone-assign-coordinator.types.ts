// ── Coordinator zone-assignment types ─────────────────────────────────────────

export type AssignZoneCoordinatorRequest = {
  coordinator_id: string;
  zone_id: string;       // single zone
  status?: number;       // defaults to 1 (active)
};

export type AssignZoneCoordinatorResponse = {
  id: string;
  zone_id: any;          // populated zone object
  coordinator_id: any;   // populated coordinator object
  status: number;
  createdAt: Date;
  updatedAt: Date;
};

export type GetAssignedZonesForCoordinatorResponse = AssignZoneCoordinatorResponse[];
