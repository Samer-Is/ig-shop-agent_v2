import { 
  Controller, 
  Get, 
  Post, 
  Put, 
  Body, 
  Param, 
  Query, 
  UseGuards, 
  Req, 
  Res,
  HttpStatus,
  BadRequestException,
  NotFoundException
} from '@nestjs/common';
import { Response } from 'express';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { OrderService } from './order.service';
import { OrderStatus } from '../database/orders.schema';

@Controller('api/orders')
@UseGuards(JwtAuthGuard)
export class OrderController {
  constructor(private orderService: OrderService) {}

  /**
   * Get all orders for authenticated merchant
   */
  @Get()
  async getOrders(
    @Req() req: any,
    @Query('status') status?: OrderStatus,
    @Query('limit') limit?: string
  ) {
    try {
      const merchantId = req.user.merchantId;
      const limitNum = limit ? parseInt(limit, 10) : 50;
      
      const orders = await this.orderService.getOrdersForMerchant(
        merchantId,
        status,
        limitNum
      );

      return {
        success: true,
        data: orders,
        count: orders.length
      };
    } catch (error) {
      throw new BadRequestException({
        success: false,
        message: 'Failed to fetch orders',
        error: error.message
      });
    }
  }

  /**
   * Get pending orders requiring confirmation
   */
  @Get('pending')
  async getPendingOrders(@Req() req: any) {
    try {
      const merchantId = req.user.merchantId;
      
      const orders = await this.orderService.getOrdersForMerchant(
        merchantId,
        'pending_confirmation'
      );

      return {
        success: true,
        data: orders,
        count: orders.length
      };
    } catch (error) {
      throw new BadRequestException({
        success: false,
        message: 'Failed to fetch pending orders',
        error: error.message
      });
    }
  }

  /**
   * Confirm an order
   */
  @Put(':orderId/confirm')
  async confirmOrder(
    @Param('orderId') orderId: string,
    @Req() req: any
  ) {
    try {
      const merchantId = req.user.merchantId;
      
      const updatedOrder = await this.orderService.updateOrderStatus(
        orderId,
        'confirmed',
        merchantId
      );

      return {
        success: true,
        message: 'Order confirmed successfully',
        data: updatedOrder
      };
    } catch (error) {
      if (error.message.includes('not found')) {
        throw new NotFoundException({
          success: false,
          message: 'Order not found',
          error: error.message
        });
      }
      
      throw new BadRequestException({
        success: false,
        message: 'Failed to confirm order',
        error: error.message
      });
    }
  }

  /**
   * Update order status
   */
  @Put(':orderId/status')
  async updateOrderStatus(
    @Param('orderId') orderId: string,
    @Body('status') status: OrderStatus,
    @Req() req: any
  ) {
    try {
      const merchantId = req.user.merchantId;
      
      // Validate status
      const validStatuses: OrderStatus[] = [
        'confirmed',
        'processing',
        'shipped',
        'delivered',
        'cancelled'
      ];
      
      if (!validStatuses.includes(status)) {
        throw new BadRequestException('Invalid order status');
      }

      const updatedOrder = await this.orderService.updateOrderStatus(
        orderId,
        status,
        merchantId
      );

      return {
        success: true,
        message: `Order status updated to ${status}`,
        data: updatedOrder
      };
    } catch (error) {
      if (error.message.includes('not found')) {
        throw new NotFoundException({
          success: false,
          message: 'Order not found',
          error: error.message
        });
      }
      
      throw new BadRequestException({
        success: false,
        message: 'Failed to update order status',
        error: error.message
      });
    }
  }

  /**
   * Export orders to CSV
   */
  @Get('export/csv')
  async exportOrdersCSV(
    @Req() req: any,
    @Res() res: Response,
    @Query('status') status?: OrderStatus
  ) {
    try {
      const merchantId = req.user.merchantId;
      
      const csvContent = await this.orderService.exportOrdersToCSV(
        merchantId,
        status
      );

      const filename = `orders_${merchantId}_${new Date().toISOString().split('T')[0]}.csv`;
      
      res.setHeader('Content-Type', 'text/csv');
      res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
      res.status(HttpStatus.OK).send(csvContent);
    } catch (error) {
      res.status(HttpStatus.BAD_REQUEST).json({
        success: false,
        message: 'Failed to export orders',
        error: error.message
      });
    }
  }

  /**
   * Get order statistics for dashboard
   */
  @Get('stats')
  async getOrderStats(@Req() req: any) {
    try {
      const merchantId = req.user.merchantId;
      
      // Get orders for the last 30 days
      const endDate = new Date();
      const startDate = new Date();
      startDate.setDate(startDate.getDate() - 30);

      const [allOrders, pendingOrders, confirmedOrders] = await Promise.all([
        this.orderService.getOrdersForMerchant(merchantId, undefined, 1000),
        this.orderService.getOrdersForMerchant(merchantId, 'pending_confirmation', 1000),
        this.orderService.getOrdersForMerchant(merchantId, 'confirmed', 1000)
      ]);

      // Calculate statistics
      const totalRevenue = confirmedOrders.reduce((sum, order) => sum + order.total, 0);
      const averageOrderValue = confirmedOrders.length > 0 ? totalRevenue / confirmedOrders.length : 0;

      // Recent orders (last 7 days)
      const sevenDaysAgo = new Date();
      sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
      const recentOrders = allOrders.filter(order => 
        new Date(order.createdAt) >= sevenDaysAgo
      );

      return {
        success: true,
        data: {
          totalOrders: allOrders.length,
          pendingOrders: pendingOrders.length,
          confirmedOrders: confirmedOrders.length,
          totalRevenue,
          averageOrderValue: Math.round(averageOrderValue * 100) / 100,
          recentOrdersCount: recentOrders.length,
          conversionRate: allOrders.length > 0 ? (confirmedOrders.length / allOrders.length * 100) : 0
        }
      };
    } catch (error) {
      throw new BadRequestException({
        success: false,
        message: 'Failed to fetch order statistics',
        error: error.message
      });
    }
  }

  /**
   * Test order creation endpoint for development
   */
  @Post('test/create')
  async createTestOrder(@Req() req: any) {
    try {
      const merchantId = req.user.merchantId;
      const pageId = req.user.pageId || 'test_page';
      
      // Create a mock order extraction for testing
      const mockExtraction = {
        orderId: '',
        messageId: 'test_message',
        extractedData: {
          products: [{
            name: 'Test Product',
            quantity: 2,
            confidence: 0.9,
            extractedFromText: 'I want 2 test products',
            contextSentence: 'I want 2 test products please',
            catalogMatches: []
          }],
          customer: {
            name: { value: 'Test Customer', confidence: 0.9 },
            phone: { value: '+962791234567', confidence: 0.9, isValid: true }
          },
          shipping: {
            address: { raw: 'Test Address, Amman, Jordan', confidence: 0.8 }
          },
          intent: 'order_placement' as const
        },
        confidence: 0.85,
        missingFields: [],
        clarificationNeeded: false,
        extractionTimestamp: new Date()
      };

      const order = await this.orderService.createOrder(
        merchantId,
        pageId,
        'test_customer_123',
        mockExtraction
      );

      return {
        success: true,
        message: 'Test order created successfully',
        data: order
      };
    } catch (error) {
      throw new BadRequestException({
        success: false,
        message: 'Failed to create test order',
        error: error.message
      });
    }
  }
} 