import {
  BadGatewayException,
  BadRequestException,
  HttpException,
  InternalServerErrorException,
} from '@nestjs/common';
import { OAuthCookiePayload } from './types';

type HttpMethod =
  | 'GET'
  | 'POST'
  | 'PUT'
  | 'DELETE'
  | 'PATCH'
  | 'HEAD'
  | 'OPTIONS';

const customTryCatch = async <T>(
  url: string,
  method: HttpMethod,
  headers?: HeadersInit,
  body?: BodyInit,
): Promise<T> => {
  try {
    const request = await fetch(url, { method, headers, body });
    if (!request.ok)
      throw new BadGatewayException(
        `Upstream server error: ${request.status} ${request.statusText}`,
      );
    const response = (await request.json()) as T;
    return response;
  } catch (err) {
    if (err instanceof HttpException) throw err;
    throw new InternalServerErrorException('Upstream or server failure');
  }
};

const buildQuery = (params: Record<string, string | number>): string =>
  Object.entries(params)
    .map(([key, value]) => `${key}=${encodeURIComponent(value)}`)
    .join('&');

const isOAuthCookiePayload = (value: unknown): value is OAuthCookiePayload =>
  typeof value === 'object' &&
  value !== null &&
  typeof (value as Record<string, unknown>).state === 'string' &&
  typeof (value as Record<string, unknown>).code_verifier === 'string';

const parseOAuthCookie = (raw: string): OAuthCookiePayload => {
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch (e) {
    const message = e instanceof Error ? e.message : 'Unnown error';
    throw new BadRequestException('Cookie parsing error ' + message);
  }
  if (!isOAuthCookiePayload(parsed)) {
    throw new BadRequestException('Malformed OAuth session cookie');
  }
  return parsed;
};
export { customTryCatch, buildQuery, parseOAuthCookie };
