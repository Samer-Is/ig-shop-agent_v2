import { 
  Controller, 
  Get, 
  Post, 
  Put, 
  Delete,
  Body, 
  Param, 
  Query, 
  Req, 
  UseGuards,
  UnauthorizedException,
  Logger,
  BadRequestException,
  NotFoundException
} from '@nestjs/common';
import { VendorService } from './vendor.service';
import { VendorAuthGuard, extractVendorUserFromRequest, requireVendorAdmin } from './vendor-auth.guard';
import { JwtService } from '@nestjs/jwt';

export interface VendorLoginDto {
  email: string;
  password: string;
}

export interface VendorLoginResponse {
  accessToken: string;
  user: {
    id: string;
    email: string;
    role: string;
    firstName: string;
    lastName: string;
  };
}

@Controller('vendor')
export class VendorController {
  private readonly logger = new Logger(VendorController.name);

  constructor(
    private vendorService: VendorService,
    private jwtService: JwtService,
  ) {}

  /**
   * Vendor login
   */
  @Post('auth/login')
  async login(@Body() loginDto: VendorLoginDto): Promise<VendorLoginResponse> {
    try {
      this.logger.log(`Vendor login attempt: ${loginDto.email}`);
      
      // Validate vendor credentials
      const vendor = await this.vendorService.validateVendorCredentials(
        loginDto.email,
        loginDto.password
      );

      if (!vendor) {
        this.logger.warn(`Invalid login attempt: ${loginDto.email}`);
        throw new UnauthorizedException('Invalid credentials');
      }

      if (!vendor.isActive) {
        this.logger.warn(`Inactive vendor login attempt: ${loginDto.email}`);
        throw new UnauthorizedException('Account is disabled');
      }

      // Generate JWT token
      const payload = {
        sub: vendor.id,
        email: vendor.email,
        role: vendor.role,
        type: 'vendor',
      };

      const accessToken = await this.jwtService.signAsync(payload, {
        secret: process.env.JWT_SECRET,
        expiresIn: '8h', // 8 hours for vendor sessions
      });

      this.logger.log(`Vendor login successful: ${vendor.email} (${vendor.role})`);

      return {
        accessToken,
        user: {
          id: vendor.id,
          email: vendor.email,
          role: vendor.role,
          firstName: vendor.firstName,
          lastName: vendor.lastName,
        },
      };
    } catch (error) {
      this.logger.error('Vendor login error:', error);
      throw error;
    }
  }

  /**
   * Verify vendor token
   */
  @Get('auth/verify')
  @UseGuards(VendorAuthGuard)
  async verifyToken(@Req() req: any) {
    const vendorUser = extractVendorUserFromRequest(req);
    return {
      valid: true,
      user: vendorUser,
    };
  }

  /**
   * Vendor logout (client-side token removal)
   */
  @Post('auth/logout')
  @UseGuards(VendorAuthGuard)
  async logout(@Req() req: any) {
    const vendorUser = extractVendorUserFromRequest(req);
    this.logger.log(`Vendor logout: ${vendorUser.email}`);
    
    return {
      message: 'Logged out successfully',
    };
  }

  /**
   * Get platform analytics
   */
  @Get('analytics/platform')
  @UseGuards(VendorAuthGuard)
  async getPlatformAnalytics() {
    try {
      const analytics = await this.vendorService.getPlatformAnalytics();

      return {
        success: true,
        data: analytics,
        message: 'Platform analytics retrieved successfully'
      };
    } catch (error) {
      throw new BadRequestException({
        success: false,
        message: 'Failed to retrieve platform analytics',
        error: error.message
      });
    }
  }

  /**
   * Get all merchants
   */
  @Get('merchants')
  @UseGuards(VendorAuthGuard)
  async getAllMerchants() {
    try {
      const merchants = await this.vendorService.getAllMerchants();

      return {
        success: true,
        data: merchants,
        message: 'Merchants retrieved successfully'
      };
    } catch (error) {
      throw new BadRequestException({
        success: false,
        message: 'Failed to retrieve merchants',
        error: error.message
      });
    }
  }

  /**
   * Toggle merchant status
   */
  @Put('merchants/:merchantId/toggle')
  @UseGuards(VendorAuthGuard)
  async toggleMerchantStatus(@Param('merchantId') merchantId: string) {
    try {
      await this.vendorService.toggleMerchantStatus(merchantId);

      return {
        success: true,
        message: 'Merchant status updated successfully'
      };
    } catch (error) {
      if (error.message.includes('not found')) {
        throw new NotFoundException({
          success: false,
          message: 'Merchant not found',
          error: error.message
        });
      }
      
      throw new BadRequestException({
        success: false,
        message: 'Failed to update merchant status',
        error: error.message
      });
    }
  }

  /**
   * Get whitelist entries
   */
  @Get('whitelist')
  @UseGuards(VendorAuthGuard)
  async getWhitelist() {
    try {
      const whitelist = await this.vendorService.getWhitelist();

      return {
        success: true,
        data: whitelist,
        message: 'Whitelist retrieved successfully'
      };
    } catch (error) {
      throw new BadRequestException({
        success: false,
        message: 'Failed to retrieve whitelist',
        error: error.message
      });
    }
  }

  /**
   * Add whitelist entry
   */
  @Post('whitelist')
  @UseGuards(VendorAuthGuard)
  async addWhitelistEntry(@Body() body: {
    businessName: string;
    email: string;
    instagramHandle: string;
    requestReason?: string;
  }) {
    try {
      const { businessName, email, instagramHandle, requestReason } = body;
      
      if (!businessName || !email || !instagramHandle) {
        throw new BadRequestException('Business name, email, and Instagram handle are required');
      }

      const entry = await this.vendorService.addWhitelistEntry({
        businessName,
        email,
        instagramHandle,
        requestReason
      });

      return {
        success: true,
        data: entry,
        message: 'Whitelist entry added successfully'
      };
    } catch (error) {
      throw new BadRequestException({
        success: false,
        message: 'Failed to add whitelist entry',
        error: error.message
      });
    }
  }

  /**
   * Update whitelist entry status
   */
  @Put('whitelist/:entryId')
  @UseGuards(VendorAuthGuard)
  async updateWhitelistStatus(
    @Param('entryId') entryId: string,
    @Body() body: { status: 'approved' | 'rejected' }
  ) {
    try {
      const { status } = body;
      
      if (!['approved', 'rejected'].includes(status)) {
        throw new BadRequestException('Status must be either approved or rejected');
      }

      await this.vendorService.updateWhitelistStatus(entryId, status);

      return {
        success: true,
        message: 'Whitelist entry status updated successfully'
      };
    } catch (error) {
      if (error.message.includes('not found')) {
        throw new NotFoundException({
          success: false,
          message: 'Whitelist entry not found',
          error: error.message
        });
      }
      
      throw new BadRequestException({
        success: false,
        message: 'Failed to update whitelist entry status',
        error: error.message
      });
    }
  }

  /**
   * Get merchant activity summary
   */
  @Get('merchants/:merchantId/activity')
  @UseGuards(VendorAuthGuard)
  async getMerchantActivity(@Param('merchantId') merchantId: string) {
    try {
      const activity = await this.vendorService.getMerchantActivity(merchantId);

      return {
        success: true,
        data: activity,
        message: 'Merchant activity retrieved successfully'
      };
    } catch (error) {
      if (error.message.includes('not found')) {
        throw new NotFoundException({
          success: false,
          message: 'Merchant not found',
          error: error.message
        });
      }
      
      throw new BadRequestException({
        success: false,
        message: 'Failed to retrieve merchant activity',
        error: error.message
      });
    }
  }

  /**
   * Get platform usage metrics
   */
  @Get('analytics/usage')
  @UseGuards(VendorAuthGuard)
  async getUsageMetrics() {
    try {
      const metrics = await this.vendorService.getUsageMetrics();

      return {
        success: true,
        data: metrics,
        message: 'Usage metrics retrieved successfully'
      };
    } catch (error) {
      throw new BadRequestException({
        success: false,
        message: 'Failed to retrieve usage metrics',
        error: error.message
      });
    }
  }
} 