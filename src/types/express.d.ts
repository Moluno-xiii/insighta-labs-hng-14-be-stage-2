import { User } from 'src/auth/auth.types';

declare global {
  namespace Express {
    interface Request {
      user: User;
    }
  }
}
export {};
