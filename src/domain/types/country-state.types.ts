export type CreateCountryStateRequest = {
  nationality_name: string;
  country_state_name: string;
};

export type UpdateCountryStateRequest = {
  nationality_name?: string;
  country_state_name?: string;
};

export type CountryStateFilter = {
  nationality_name?: string;
};

export type CountryStateResponse = {
  id: string;
  nationality_name: string;
  country_state_name: string;
  createdAt: Date;
  updatedAt: Date;
};
