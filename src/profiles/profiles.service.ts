import {
  BadGatewayException,
  BadRequestException,
  Injectable,
  InternalServerErrorException,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Supabase from 'src/supabase/supabase';
import { APISuccessResponse, GenderizeResponse } from 'src/types';
import { customTryCatch } from 'src/utils';
import { getCountryName } from './countries';
import { parseNaturalQuery } from './nlQuery';
import { ProfileFilterDTO, SearchQueryDTO } from './profiles.dto';
import {
  AgeGroup,
  AgifyAPIResponse,
  CountryInfo,
  CreateProfileSuccessResponse,
  NationalizeAPIResponse,
  PaginatedProfilesResponse,
  Profile,
} from './profiles.types';

@Injectable()
class ProfilesService {
  private readonly nationalize_api_url: string;
  private readonly agify_api_url: string;
  private readonly genderize_api_url: string;
  private db = new Supabase();

  constructor(private configService: ConfigService) {
    this.nationalize_api_url = this.configService.getOrThrow<string>(
      'NATIONALIZE_API_URL',
    );
    this.agify_api_url = this.configService.getOrThrow<string>('AGIFY_API_URL');
    this.genderize_api_url =
      this.configService.getOrThrow<string>('GENDERIZE_API_URL');
  }

  async createNewProfile(name: string): Promise<CreateProfileSuccessResponse> {
    const transformedName = name.trim().toLowerCase();

    const existingProfile = await this.db.getProfileByName(transformedName);
    if (existingProfile)
      return {
        status: 'success',
        message: 'Profile already exists',
        data: existingProfile,
      };

    const encodedName = encodeURIComponent(name);
    const [nationalizeInfo, agifyInfo, genderizeInfo] = await Promise.all([
      this.getNationalizeInfo(encodedName),
      this.getAgifyInfo(encodedName),
      this.getGenderizeInfo(encodedName),
    ]);

    const age_group: AgeGroup = this.getAgeGroup(agifyInfo.age);
    const countryInfo: CountryInfo = nationalizeInfo.country[0];

    try {
      const data = await this.db.createProfile({
        name: transformedName,
        gender: genderizeInfo.gender!,
        gender_probability: genderizeInfo.probability,
        age: agifyInfo.age,
        age_group,
        country_id: countryInfo.country_id,
        country_name: getCountryName(countryInfo.country_id),
        country_probability: countryInfo.probability,
        created_at: new Date().toISOString(),
      });

      return {
        status: 'success',
        data,
      };
    } catch (err) {
      if (err instanceof Error) throw new BadGatewayException(err.message);
      throw new InternalServerErrorException('Failed to save profile');
    }
  }

  async getProfileById(id: string): Promise<APISuccessResponse<Profile>> {
    const data = await this.db.getProfileById(id);
    if (!data) throw new NotFoundException('Profile not found');
    return {
      status: 'success',
      data,
    };
  }

  async getAllProfiles(
    filters: ProfileFilterDTO,
  ): Promise<PaginatedProfilesResponse> {
    const { page, limit } = this.clampPagination(filters.page, filters.limit);

    const { data, total } = await this.db.getAllProfiles({
      ...filters,
      page,
      limit,
    });

    return {
      status: 'success',
      page,
      limit,
      total,
      data,
    };
  }

  async searchProfiles(
    query: SearchQueryDTO,
  ): Promise<PaginatedProfilesResponse> {
    const parsed = parseNaturalQuery(query.q);
    if (!parsed) {
      throw new BadRequestException('Unable to interpret query');
    }

    const { page, limit } = this.clampPagination(query.page, query.limit);

    const { data, total } = await this.db.getAllProfiles({
      ...parsed,
      page,
      limit,
    });

    return {
      status: 'success',
      page,
      limit,
      total,
      data,
    };
  }

  private clampPagination(
    rawPage?: number,
    rawLimit?: number,
  ): { page: number; limit: number } {
    const page = Math.max(1, Math.floor(rawPage ?? 1));
    const limit = Math.max(1, Math.min(50, Math.floor(rawLimit ?? 10)));
    return { page, limit };
  }

  async deleteSingleProfile(id: string): Promise<void> {
    const deleted = await this.db.deleteProfile(id);
    if (!deleted) throw new NotFoundException('Profile not found');
  }

  private async getNationalizeInfo(
    name: string,
  ): Promise<NationalizeAPIResponse> {
    const response = await customTryCatch<NationalizeAPIResponse>(
      `${this.nationalize_api_url}?name=${name}`,
      'GET',
    );
    if (response.country.length < 1)
      throw new BadGatewayException('Nationalize returned an invalid response');
    return response;
  }

  private async getAgifyInfo(name: string): Promise<AgifyAPIResponse> {
    const response = await customTryCatch<AgifyAPIResponse>(
      `${this.agify_api_url}?name=${name}`,
      'GET',
    );
    if (!response.age)
      throw new BadGatewayException('Agify returned an invalid response');
    return response;
  }

  private async getGenderizeInfo(name: string): Promise<GenderizeResponse> {
    const response = await customTryCatch<GenderizeResponse>(
      `${this.genderize_api_url}?name=${name}`,
      'GET',
    );
    if (!response.gender || !response.count)
      throw new BadGatewayException('Genderize returned an invalid response');
    return response;
  }

  private getAgeGroup(age: number): AgeGroup {
    return age < 13
      ? 'child'
      : age < 20
        ? 'teenager'
        : age < 60
          ? 'adult'
          : 'senior';
  }
}

export default ProfilesService;
