import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { ConfigModule } from '@nestjs/config';
import ProfilesService from 'src/profiles/profiles.service';
import { ProfilesController } from 'src/profiles/profiles.controller';
import AuthService from 'src/auth/auth.service';
import AuthController from 'src/auth/auth.controller';

@Module({
  imports: [ConfigModule.forRoot()],
  controllers: [AppController, ProfilesController, AuthController],
  providers: [AppService, ProfilesService, AuthService],
})
export class AppModule {}
