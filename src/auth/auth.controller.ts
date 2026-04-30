import {
  BadRequestException,
  Controller,
  Get,
  Post,
  Query,
  Req,
  Res,
} from '@nestjs/common';
import AuthService from './auth.service';
import { CallbackQueryDTO } from './auth.dto';
import type { Response, Request } from 'express';
import { OAUTH_COOKIE, OAUTH_COOKIE_MAX_AGE_MS } from 'src/constants';
import { parseOAuthCookie } from 'src/utils';

@Controller('/auth')
class AuthController {
  constructor(private authService: AuthService) {}

  @Get('github')
  authorizeGithubOauth(@Res() res: Response) {
    const { url, state, code_verifier } = this.authService.buildAuthorizeUrl();
    res.cookie(OAUTH_COOKIE, JSON.stringify({ state, code_verifier }), {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      signed: true,
      path: '/auth/github',
      maxAge: OAUTH_COOKIE_MAX_AGE_MS,
    });
    res.redirect(url);
  }

  @Get('github/callback')
  async githubCallback(
    @Query() query: CallbackQueryDTO,
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ) {
    const signedCookies = req.signedCookies as
      | Record<string, string | undefined>
      | undefined;
    const raw = signedCookies?.[OAUTH_COOKIE];
    if (!raw) {
      throw new BadRequestException('Missing OAuth session cookie');
    }
    const parsed = parseOAuthCookie(raw);
    if (parsed.state !== query.state) {
      throw new BadRequestException('OAuth state mismatch');
    }
    res.clearCookie(OAUTH_COOKIE, { path: '/auth/github' });

    return await this.authService.exchangeCodeForToken(
      query.code,
      parsed.code_verifier,
    );
  }

  @Post('refresh')
  refreshToken() {
    return { message: 'refresh token endpoint' };
  }

  @Post('logout')
  logout() {
    return { message: 'logout endpoint' };
  }
}

export default AuthController;
