import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createHash, randomBytes, randomUUID } from 'crypto';
import { buildQuery, customTryCatch } from 'src/utils';
import {
  GithubAccessTokenEndpointResponse,
  GithubUserResponse,
  User,
  UserAuthToken,
  UserRoles,
  Verifiers,
} from './auth.types';
import auth_endpoints from './endpoints';
import SupabaseUsers from 'src/supabase/usersDb';
import { uuidv7 } from 'uuidv7';
import jwt from 'jsonwebtoken';
import { Response } from 'express';

@Injectable()
class AuthService {
  private readonly github_client_id: string;
  private readonly github_redirect_uri: string;
  private readonly github_client_secret: string;
  private readonly refresh_token_secret: string;
  private readonly access_token_secret: string;
  private readonly frontend_url: string;
  private db: SupabaseUsers;

  constructor(private configService: ConfigService) {
    this.github_client_id =
      this.configService.getOrThrow<string>('GITHUB_CLIENT_ID');
    this.github_redirect_uri = this.configService.getOrThrow(
      'GITHUB_REDIRECT_URI',
    );
    this.github_client_secret = this.configService.getOrThrow(
      'GITHUB_CLIENT_SECRET',
    );
    this.db = new SupabaseUsers();
    this.access_token_secret = this.configService.getOrThrow(
      'ACCESS_TOKEN_SECRET',
    );
    this.refresh_token_secret = this.configService.getOrThrow(
      'REFRESH_TOKEN_SECRET',
    );
    this.frontend_url = this.configService.getOrThrow('FRONTEND_URL');
  }

  buildAuthorizeUrl = () => {
    const state = randomUUID();
    const { code_verifier, code_challenge } = this.generateVerifierSecrets();
    const url = `${auth_endpoints.github.authorize}?${buildQuery({
      client_id: this.github_client_id,
      redirect_uri: this.github_redirect_uri,
      state,
      code_challenge,
      code_challenge_method: 'S256',
    })}`;
    return { url, state, code_verifier };
  };

  exchangeCodeForToken = async (
    code: string,
    code_verifier: string,
    res: Response,
  ) => {
    const body = buildQuery({
      client_id: this.github_client_id,
      redirect_uri: this.github_redirect_uri,
      code,
      code_verifier,
      client_secret: this.github_client_secret,
    });
    const data = await customTryCatch<GithubAccessTokenEndpointResponse>(
      auth_endpoints.github.access_token,
      'POST',
      {
        'Content-Type': 'application/x-www-form-urlencoded',
        Accept: 'application/json',
      },
      body,
    );
    await this.handleUser(data.access_token, res);
  };

  private handleUser = async (
    access_token: string,
    res: Response,
  ): Promise<void> => {
    const { avatar_url, email, id, login } =
      await this.getUserGithubProfile(access_token);

    const user: User = {
      avatar_url,
      email,
      github_id: id,
      id: uuidv7(),
      is_active: true,
      last_login_at: new Date().toISOString(),
      role: 'analyst',
      username: login,
      created_at: new Date().toISOString(),
    };
    const userData = await this.db.createNewUser(user);
    const userTokens = this.issueTokens({
      id: userData.id,
      role: userData.role,
    });
    this.setAuthCookies(userTokens, res);
    res.redirect(this.frontend_url);
    console.log('user tokens, \n', userTokens);
    console.log('user data, \n', userData);
  };

  private setAuthCookies = (tokens: UserAuthToken, res: Response): void => {
    res.cookie('access_token', tokens.access_token, {
      httpOnly: true,
      secure: true,
      sameSite: 'none',
    });
    res.cookie('refresh_token', tokens.refresh_token, {
      httpOnly: true,
      secure: true,
      sameSite: 'none',
    });
  };

  private issueTokens = (payload: {
    id: string;
    role: UserRoles;
  }): UserAuthToken => {
    const access_token = jwt.sign(payload, this.access_token_secret, {
      expiresIn: '3m',
    });
    const refresh_token = jwt.sign(payload, this.refresh_token_secret, {
      expiresIn: '5m',
    });
    return {
      access_token,
      refresh_token,
    };
  };

  private getUserGithubProfile = async (
    access_token: string,
  ): Promise<GithubUserResponse> => {
    return customTryCatch<GithubUserResponse>(
      auth_endpoints.github.user,
      'GET',
      {
        Authorization: `Bearer ${access_token}`,
        Accept: 'application/json',
      },
    );
  };

  private generateVerifierSecrets = (): Verifiers => {
    const code_verifier = randomBytes(32).toString('base64url');
    const code_challenge = createHash('sha256')
      .update(code_verifier)
      .digest('base64url');
    return { code_verifier, code_challenge };
  };
}

export default AuthService;
