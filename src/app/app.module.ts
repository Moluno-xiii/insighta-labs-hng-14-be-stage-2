import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { ConfigModule } from '@nestjs/config';
import ProfilesService from 'src/profiles/profiles.service';
import { ProfilesController } from 'src/profiles/profiles.controller';

@Module({
  imports: [ConfigModule.forRoot()],
  controllers: [AppController, ProfilesController],
  providers: [AppService, ProfilesService],
})
export class AppModule {}
