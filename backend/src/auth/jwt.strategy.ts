import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { ConfigService } from '@nestjs/config';

export interface JwtPayload {
  sub: string; // merchant ID
  merchantId: string;
  pageId: string;
  pageName: string;
  iat?: number;
  exp?: number;
}

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(private configService: ConfigService) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: configService.get<string>('auth.jwtSecret'),
    });
  }

  async validate(payload: JwtPayload) {
    if (!payload.sub || !payload.merchantId) {
      throw new UnauthorizedException('Invalid token payload');
    }

    // Return user object that will be attached to request.user
    return {
      merchantId: payload.merchantId,
      pageId: payload.pageId,
      pageName: payload.pageName,
    };
  }
} 