import { Injectable, CanActivate, ExecutionContext, UnauthorizedException, Logger } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { Request } from 'express';

export interface VendorUser {
  id: string;
  email: string;
  role: 'admin' | 'operator';
  firstName: string;
  lastName: string;
  isActive: boolean;
}

export interface VendorJwtPayload {
  sub: string;
  email: string;
  role: string;
  type: 'vendor';
  iat?: number;
  exp?: number;
}

@Injectable()
export class VendorAuthGuard implements CanActivate {
  private readonly logger = new Logger(VendorAuthGuard.name);

  constructor(private jwtService: JwtService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<Request>();
    const token = this.extractTokenFromHeader(request);

    if (!token) {
      this.logger.warn('No vendor authentication token provided');
      throw new UnauthorizedException('Access token required');
    }

    try {
      const payload = await this.jwtService.verifyAsync<VendorJwtPayload>(token, {
        secret: process.env.JWT_SECRET,
      });

      // Verify this is a vendor token
      if (payload.type !== 'vendor') {
        this.logger.warn(`Invalid token type: ${payload.type}, expected vendor`);
        throw new UnauthorizedException('Invalid access token');
      }

      // Add vendor user to request
      request['vendorUser'] = {
        id: payload.sub,
        email: payload.email,
        role: payload.role as 'admin' | 'operator',
      };

      this.logger.log(`Vendor authenticated: ${payload.email} (${payload.role})`);
      return true;
    } catch (error) {
      this.logger.error('Vendor token validation failed:', error.message);
      throw new UnauthorizedException('Invalid or expired access token');
    }
  }

  private extractTokenFromHeader(request: Request): string | undefined {
    const [type, token] = request.headers.authorization?.split(' ') ?? [];
    return type === 'Bearer' ? token : undefined;
  }
}

/**
 * Extract vendor user from authenticated request
 */
export function extractVendorUserFromRequest(request: any): VendorUser {
  const vendorUser = request.vendorUser;
  if (!vendorUser) {
    throw new UnauthorizedException('Vendor authentication required');
  }
  return vendorUser;
}

/**
 * Check if vendor user has admin role
 */
export function requireVendorAdmin(vendorUser: VendorUser): void {
  if (vendorUser.role !== 'admin') {
    throw new UnauthorizedException('Admin role required');
  }
} 