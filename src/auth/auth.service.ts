import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createHash, randomBytes, randomUUID } from 'crypto';
import { buildQuery, customTryCatch } from 'src/utils';
import {
  GithubAccessTokenEndpointResponse,
  GithubUserResponse,
  Verifiers,
} from './auth.types';
import auth_endpoints from './endpoints';

@Injectable()
class AuthService {
  private readonly github_client_id: string;
  private readonly github_redirect_uri: string;
  private readonly github_client_secret: string;

  constructor(private configService: ConfigService) {
    this.github_client_id =
      this.configService.getOrThrow<string>('GITHUB_CLIENT_ID');
    this.github_redirect_uri = this.configService.getOrThrow(
      'GITHUB_REDIRECT_URI',
    );
    this.github_client_secret = this.configService.getOrThrow(
      'GITHUB_CLIENT_SECRET',
    );
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

  exchangeCodeForToken = async (code: string, code_verifier: string) => {
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
    return this.getUserGithubProfile(data.access_token);
  };

  private getUserGithubProfile = async (access_token: string) => {
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
