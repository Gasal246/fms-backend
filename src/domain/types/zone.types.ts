export type ZoneFilter = {
  client_id?: string | undefined;
  camp_id?: string | undefined;
  status?: number | undefined;
};

export type ZoneResponse = {
  id: string;
  client_id: string | null;
  camp_id: string | null;
  zone_name: string | null;
  wm_ssid: string | null;
  wm_pass: string | null;
  status: number | null;
  createdAt: Date;
  updatedAt: Date;
};
