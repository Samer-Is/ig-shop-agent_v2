import { Injectable, Logger } from '@nestjs/common';
import { CosmosService } from '../database/cosmos.service';

export interface VendorUser {
  id: string;
  email: string;
  passwordHash: string;
  role: 'admin' | 'operator';
  firstName: string;
  lastName: string;
  isActive: boolean;
  createdAt: Date;
  lastLoginAt?: Date;
  partitionKey: string;
}

export interface WhitelistApplication {
  id: string;
  instagramPageId: string;
  pageName: string;
  businessName: string;
  contactEmail: string;
  contactPhone?: string;
  businessDescription?: string;
  applicationDate: Date;
  status: 'pending' | 'approved' | 'rejected';
  reviewedBy?: string;
  reviewedAt?: Date;
  rejectionReason?: string;
  partitionKey: string;
}

export interface PlatformAnalytics {
  totalMerchants: number;
  activeMerchants: number;
  totalConversations: number;
  totalOrders: number;
  totalMessages: number;
  averageResponseTime: number;
  topPerformingMerchants: Array<{
    merchantId: string;
    businessName: string;
    conversationCount: number;
    orderCount: number;
    responseTime: number;
  }>;
}

@Injectable()
export class VendorService {
  private readonly logger = new Logger(VendorService.name);

  constructor(private cosmosService: CosmosService) {
    this.initializeDefaultVendorUsers();
  }

  /**
   * Initialize default vendor users if they don't exist
   */
  private async initializeDefaultVendorUsers(): Promise<void> {
    try {
      const container = this.cosmosService.getContainer('vendor_users');
      
      // Check if admin user exists
      const adminQuery = `
        SELECT * FROM c 
        WHERE c.email = 'admin@insta-agent.com'
        AND c.role = 'admin'
      `;
      
      const { resources: adminUsers } = await container.items
        .query({ query: adminQuery })
        .fetchAll();

      if (adminUsers.length === 0) {
        // Create default admin user
        const adminUser: VendorUser = {
          id: `vendor_admin_${Date.now()}`,
          email: 'admin@insta-agent.com',
          passwordHash: await this.hashPassword('admin123'), // Change in production
          role: 'admin',
          firstName: 'Platform',
          lastName: 'Administrator',
          isActive: true,
          createdAt: new Date(),
          partitionKey: 'vendor_users',
        };

        await container.items.create(adminUser);
        this.logger.log('Default admin user created: admin@insta-agent.com');
      }

      // Create operator user if doesn't exist
      const operatorQuery = `
        SELECT * FROM c 
        WHERE c.email = 'operator@insta-agent.com'
        AND c.role = 'operator'
      `;
      
      const { resources: operatorUsers } = await container.items
        .query({ query: operatorQuery })
        .fetchAll();

      if (operatorUsers.length === 0) {
        const operatorUser: VendorUser = {
          id: `vendor_operator_${Date.now()}`,
          email: 'operator@insta-agent.com',
          passwordHash: await this.hashPassword('operator123'), // Change in production
          role: 'operator',
          firstName: 'Platform',
          lastName: 'Operator',
          isActive: true,
          createdAt: new Date(),
          partitionKey: 'vendor_users',
        };

        await container.items.create(operatorUser);
        this.logger.log('Default operator user created: operator@insta-agent.com');
      }
    } catch (error) {
      this.logger.error('Error initializing default vendor users:', error);
    }
  }

  /**
   * Validate vendor credentials for login
   */
  async validateVendorCredentials(email: string, password: string): Promise<VendorUser | null> {
    try {
      const container = this.cosmosService.getContainer('vendor_users');
      
      const query = `
        SELECT * FROM c 
        WHERE c.email = @email
        AND c.isActive = true
      `;
      
      const { resources: users } = await container.items
        .query({
          query,
          parameters: [{ name: '@email', value: email }]
        })
        .fetchAll();

      if (users.length === 0) {
        return null;
      }

      const user = users[0] as VendorUser;
      
      // Verify password
      const isValidPassword = await this.verifyPassword(password, user.passwordHash);
      
      if (!isValidPassword) {
        return null;
      }

      // Update last login time
      user.lastLoginAt = new Date();
      await container.item(user.id, user.partitionKey).replace(user);

      this.logger.log(`Vendor credentials validated: ${email}`);
      return user;
    } catch (error) {
      this.logger.error('Error validating vendor credentials:', error);
      return null;
    }
  }

  /**
   * Hash password (simple implementation - use bcrypt in production)
   */
  private async hashPassword(password: string): Promise<string> {
    // In production, use bcrypt or argon2
    // For now, simple encoding for demo purposes
    const crypto = require('crypto');
    return crypto.createHash('sha256').update(password + 'salt_key').digest('hex');
  }

  /**
   * Verify password against hash
   */
  private async verifyPassword(password: string, hash: string): Promise<boolean> {
    const hashedInput = await this.hashPassword(password);
    return hashedInput === hash;
  }

// ... existing code ... 