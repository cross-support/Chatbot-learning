import { Request } from 'express';

export interface RequestUser {
  id: string;
  email: string;
  name: string;
  role: string;
}

export interface RequestWithUser extends Request {
  user: RequestUser;
}
