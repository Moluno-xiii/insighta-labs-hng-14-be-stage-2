import { Type } from 'class-transformer';
import {
  IsIn,
  IsInt,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  Matches,
  Max,
  Min,
} from 'class-validator';

class CreateProfileBodyDTO {
  @Matches(/^[a-zA-ZÀ-ÖØ-öø-ÿ' -]+$/, {
    message: 'name is not a string',
  })
  @IsNotEmpty({ message: 'Missing or empty name parameter' })
  @IsString({ message: 'name is not a string' })
  name!: string;
}

class DeleteSingleProfileDTO {
  @IsUUID(undefined, { message: 'Invalid profile ID' })
  @IsNotEmpty({ message: 'Missing or empty id' })
  @IsString({ message: 'id must be a string' })
  id!: string;
}

class ProfileFilterDTO {
  @IsOptional()
  @IsString()
  @IsIn(['male', 'female'])
  gender?: 'male' | 'female';

  @IsOptional()
  @IsString()
  country_id?: string;

  @IsOptional()
  @IsIn(['child', 'teenager', 'adult', 'senior'])
  age_group?: 'child' | 'teenager' | 'adult' | 'senior';

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  min_age?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  max_age?: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  @Max(1)
  min_gender_probability?: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  @Max(1)
  min_country_probability?: number;

  @IsOptional()
  @IsIn(['age', 'created_at', 'gender_probability'])
  sort_by?: 'age' | 'created_at' | 'gender_probability';

  @IsOptional()
  @IsIn(['asc', 'desc'])
  order?: 'asc' | 'desc';

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  page?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  limit?: number;
}

class SearchQueryDTO {
  @IsNotEmpty({ message: 'Missing or empty q parameter' })
  @IsString({ message: 'Invalid query parameters' })
  q!: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  page?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  limit?: number;
}

export {
  CreateProfileBodyDTO,
  DeleteSingleProfileDTO,
  ProfileFilterDTO,
  SearchQueryDTO,
};
