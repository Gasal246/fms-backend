export type BindMachineRequest = {
  machine_id: string;
  mac_id: string;
};

export type BindMachineResponse = {
  success: boolean;
  message: string;
  data: {
    machine_id: string;
    mac_id: string;
    binding_status: string;
    api_key: string;
  };
};

export type MachineBindingLogResponse = {
  id: string;
  client_id: string;
  machine_id: string;
  machine_ref_id: string | null;
  mac_id: string;
  binding_status: "bound" | "failed";
  ip_address: string;
  user_agent: string;
  reason: string;
  createdAt: Date;
};

export type BindingHistoryResponse = {
  success: boolean;
  history: MachineBindingLogResponse[];
};

export type BindingStatusResponse = {
  success: boolean;
  data: {
    machine_id: string;
    mac_id: string | null;
    binding_status: string;
  };
};
