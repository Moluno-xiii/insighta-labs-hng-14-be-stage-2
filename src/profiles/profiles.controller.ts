import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  Post,
  Query,
} from '@nestjs/common';
import ProfilesService from './profiles.service';
import {
  CreateProfileBodyDTO,
  DeleteSingleProfileDTO,
  ProfileFilterDTO,
  SearchQueryDTO,
} from './profiles.dto';

@Controller('api/profiles')
export class ProfilesController {
  constructor(private profilesService: ProfilesService) {}

  @Post()
  createProfile(@Body() body: CreateProfileBodyDTO) {
    return this.profilesService.createNewProfile(body.name);
  }

  @Get()
  getAllProfiles(@Query() query: ProfileFilterDTO) {
    return this.profilesService.getAllProfiles(query);
  }

  @Get('search')
  searchProfiles(@Query() query: SearchQueryDTO) {
    return this.profilesService.searchProfiles(query);
  }

  @Get(':id')
  getSingleProfile(@Param('id') id: string) {
    return this.profilesService.getProfileById(id);
  }

  @Delete(':id')
  @HttpCode(204)
  deleteSingleProfile(@Param() param: DeleteSingleProfileDTO) {
    return this.profilesService.deleteSingleProfile(param.id);
  }
}
