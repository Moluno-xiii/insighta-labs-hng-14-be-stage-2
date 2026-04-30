type GenderizeResponse = {
  count: number;
  name: string;
  gender: string | null;
  probability: number;
};

type APISuccessResponse<T> = {
  status: 'success';
  message?: string;
  data: T;
  count?: number;
};

type OAuthCookiePayload = { state: string; code_verifier: string };

export type { GenderizeResponse, APISuccessResponse, OAuthCookiePayload };
