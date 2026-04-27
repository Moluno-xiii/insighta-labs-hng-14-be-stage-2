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

export type { GenderizeResponse, APISuccessResponse };
