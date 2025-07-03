import { Injectable, ExecutionContext, UnauthorizedException } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { Request } from 'express';

@Injectable()
export class JwtAuthGuard extends AuthGuard('jwt') {
  handleRequest(err, user, info, context: ExecutionContext) {
    if (err || !user) {
      throw err || new UnauthorizedException('Invalid or missing authentication');
    }
    return user;
  }
}

export function extractMerchantIdFromRequest(req: Request): string {
  // Assumes JWT payload contains merchantId
  return req.user?.merchantId;
} 