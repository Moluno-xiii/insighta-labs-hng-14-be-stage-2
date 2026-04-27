import {
  BadGatewayException,
  HttpException,
  InternalServerErrorException,
} from '@nestjs/common';

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
): Promise<T> => {
  try {
    const request = await fetch(url, { method });
    if (!request.ok)
      throw new BadGatewayException('Upstream or server failure');
    const response = (await request.json()) as T;
    return response;
  } catch (err) {
    if (err instanceof HttpException) throw err;
    throw new InternalServerErrorException('Upstream or server failure');
  }
};

export { customTryCatch };
