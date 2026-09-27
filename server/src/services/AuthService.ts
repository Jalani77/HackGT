import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import type { AuthResponse } from '../../../shared/types';
import { env } from '../config/env';
import { User } from '../models/User';
import { AppError } from '../utils/AppError';
import { UserService } from './UserService';

export interface TokenPayload {
  sub: string;
  campusId: string;
}

const TOKEN_TTL = '30d';

/**
 * MVP auth: username + password → JWT. Isolated here so campus SSO/OAuth can replace it
 * without touching the rest of the app (everything downstream only sees req.user).
 */
export const AuthService = {
  async register(input: { username: string; password: string; displayName?: string }): Promise<AuthResponse> {
    const username = input.username.toLowerCase();
    if (await User.exists({ username })) throw new AppError('CONFLICT', 'That username is taken.');
    const user = await User.create({
      username,
      displayName: input.displayName?.trim() || input.username,
      passwordHash: await bcrypt.hash(input.password, 10),
      campusId: env.DEFAULT_CAMPUS_ID,
    });
    return { token: this.sign(String(user._id), user.campusId), user: await UserService.toPublic(user, { isSelf: true }) };
  },

  async login(input: { username: string; password: string }): Promise<AuthResponse> {
    const user = await User.findOne({ username: input.username.toLowerCase() }).select('+passwordHash');
    if (!user || !(await bcrypt.compare(input.password, user.passwordHash))) {
      throw new AppError('UNAUTHORIZED', 'Wrong username or password.');
    }
    return { token: this.sign(String(user._id), user.campusId), user: await UserService.toPublic(user, { isSelf: true }) };
  },

  sign(userId: string, campusId: string): string {
    return jwt.sign({ campusId } satisfies Omit<TokenPayload, 'sub'>, env.JWT_SECRET, {
      subject: userId,
      expiresIn: TOKEN_TTL,
    });
  },

  verify(token: string): TokenPayload {
    try {
      return jwt.verify(token, env.JWT_SECRET) as TokenPayload;
    } catch {
      throw new AppError('UNAUTHORIZED', 'Your session expired. Please log in again.');
    }
  },
};
