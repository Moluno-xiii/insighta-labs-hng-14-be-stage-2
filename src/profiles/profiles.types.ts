import { APISuccessResponse } from 'src/types';

type AgeGroup = 'child' | 'teenager' | 'adult' | 'senior';

type Profile = {
  id: string;
  name: string;
  gender: string;
  gender_probability: number;
  age: number;
  age_group: AgeGroup;
  country_id: string;
  country_name: string;
  country_probability: number;
  created_at: string;
};

type CountryInfo = { country_id: string; probability: number };

type CreateProfileSuccessResponse = APISuccessResponse<Profile>;

type AgifyAPIResponse = {
  count: number;
  name: string;
  age: number;
};

type NationalizeAPIResponse = {
  count: number;
  name: string;
  country: Array<CountryInfo>;
};

type ParsedSearchFilters = {
  gender?: 'male' | 'female';
  age_group?: AgeGroup;
  country_id?: string;
  min_age?: number;
  max_age?: number;
};

type PaginatedProfilesResponse = {
  status: 'success';
  page: number;
  limit: number;
  total: number;
  data: Profile[];
};

export type {
  AgeGroup,
  Profile,
  CountryInfo,
  CreateProfileSuccessResponse,
  AgifyAPIResponse,
  NationalizeAPIResponse,
  ParsedSearchFilters,
  PaginatedProfilesResponse,
};
