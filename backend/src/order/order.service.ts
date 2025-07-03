import { Injectable, Logger } from '@nestjs/common';
import { CosmosService } from '../database/cosmos.service';
import { 
  Order, 
  OrderStatus, 
  OrderExtraction, 
  OrderValidationResult,
  OrderMetrics,
  OrderStatusHistory
} from '../database/orders.schema';

@Injectable()
export class OrderService {
  private readonly logger = new Logger(OrderService.name);

  constructor(private cosmosService: CosmosService) {}

  /**
   * Create new order from AI extraction
   */
  async createOrder(
    merchantId: string,
    pageId: string,
    customerId: string,
    extraction: OrderExtraction,
    orderNumber?: string
  ): Promise<Order> {
    try {
      const container = this.cosmosService.getContainer('orders');
      
      const order: Order = {
        id: this.generateOrderId(),
        merchantId,
        pageId,
        customerId,
        conversationId: extraction.orderId || '',
        status: 'pending_confirmation',
        orderNumber: orderNumber || this.generateOrderNumber(merchantId),
        createdAt: new Date(),
        updatedAt: new Date(),
        
        customer: {
          name: extraction.extractedData.customer.name?.value,
          phone: extraction.extractedData.customer.phone?.value,
          instagramId: customerId,
          isVerified: false
        },
        
        items: extraction.extractedData.products.map(product => ({
          id: this.generateItemId(),
          productName: product.name,
          productId: product.matchedProductId,
          quantity: product.quantity,
          unitPrice: 0, // Will be updated from catalog
          totalPrice: 0,
          size: product.size,
          color: product.color,
          variant: product.variant,
          isAvailable: true,
          extractionConfidence: product.confidence,
          extractedFromText: product.extractedFromText
        })),
        
        subtotal: 0,
        total: 0,
        currency: 'JOD',
        
        extractionConfidence: extraction.confidence,
        extractionMethod: 'ai_automatic',
        missingFields: extraction.missingFields,
        clarificationAttempts: 0,
        
        orderSource: 'instagram_dm'
      };

      // Add shipping address if available
      if (extraction.extractedData.shipping.address?.raw) {
        order.shippingAddress = {
          street: extraction.extractedData.shipping.address.raw,
          city: 'Unknown',
          country: 'Jordan',
          isValidated: false
        };
      }

      const { resource: createdOrder } = await container.items.create(order);
      
      // Create status history entry
      await this.createStatusHistory(createdOrder.id, 'pending_confirmation', 'ai');
      
      this.logger.log(`Order created successfully: ${createdOrder.orderNumber}`);
      return createdOrder;
    } catch (error) {
      this.logger.error('Error creating order:', error);
      throw error;
    }
  }

  /**
   * Get orders for merchant
   */
  async getOrdersForMerchant(
    merchantId: string,
    status?: OrderStatus,
    limit: number = 50,
    offset: number = 0
  ): Promise<Order[]> {
    try {
      const container = this.cosmosService.getContainer('orders');
      
      let query = 'SELECT * FROM c WHERE c.merchantId = @merchantId';
      const parameters = [{ name: '@merchantId', value: merchantId }];
      
      if (status) {
        query += ' AND c.status = @status';
        parameters.push({ name: '@status', value: status });
      }
      
      query += ' ORDER BY c.createdAt DESC';
      
      const { resources: orders } = await container.items
        .query({ query, parameters })
        .fetchAll();
      
      return orders.slice(offset, offset + limit);
    } catch (error) {
      this.logger.error('Error fetching orders:', error);
      throw error;
    }
  }

  /**
   * Update order status
   */
  async updateOrderStatus(
    orderId: string,
    newStatus: OrderStatus,
    changedBy: 'system' | 'merchant' | 'customer' | 'ai',
    reason?: string
  ): Promise<Order> {
    try {
      const container = this.cosmosService.getContainer('orders');
      
      const { resource: order } = await container.item(orderId).read();
      if (!order) {
        throw new Error(`Order not found: ${orderId}`);
      }

      const previousStatus = order.status;
      order.status = newStatus;
      order.updatedAt = new Date();

      // Set status-specific timestamps
      switch (newStatus) {
        case 'confirmed':
          order.confirmedAt = new Date();
          break;
        case 'shipped':
          order.shippedAt = new Date();
          break;
        case 'delivered':
          order.deliveredAt = new Date();
          break;
        case 'cancelled':
          order.cancelledAt = new Date();
          break;
      }

      const { resource: updatedOrder } = await container.item(orderId).replace(order);
      
      // Create status history
      await this.createStatusHistory(orderId, newStatus, changedBy, reason);
      
      this.logger.log(`Order ${order.orderNumber} status updated: ${previousStatus} -> ${newStatus}`);
      return updatedOrder;
    } catch (error) {
      this.logger.error('Error updating order status:', error);
      throw error;
    }
  }

  /**
   * Confirm order (merchant action)
   */
  async confirmOrder(orderId: string, merchantId: string): Promise<Order> {
    const order = await this.getOrderById(orderId);
    
    if (order.merchantId !== merchantId) {
      throw new Error('Unauthorized: Order belongs to different merchant');
    }
    
    if (order.status !== 'pending_confirmation') {
      throw new Error(`Cannot confirm order with status: ${order.status}`);
    }

    return this.updateOrderStatus(orderId, 'confirmed', 'merchant', 'Order confirmed by merchant');
  }

  /**
   * Get single order by ID
   */
  async getOrderById(orderId: string): Promise<Order> {
    try {
      const container = this.cosmosService.getContainer('orders');
      const { resource: order } = await container.item(orderId).read();
      
      if (!order) {
        throw new Error(`Order not found: ${orderId}`);
      }
      
      return order;
    } catch (error) {
      this.logger.error('Error fetching order:', error);
      throw error;
    }
  }

  /**
   * Get order metrics for merchant
   */
  async getOrderMetrics(
    merchantId: string,
    startDate: Date,
    endDate: Date
  ): Promise<OrderMetrics> {
    try {
      const container = this.cosmosService.getContainer('orders');
      
      const query = `
        SELECT * FROM c 
        WHERE c.merchantId = @merchantId 
        AND c.createdAt >= @startDate 
        AND c.createdAt <= @endDate
      `;
      
      const { resources: orders } = await container.items
        .query({
          query,
          parameters: [
            { name: '@merchantId', value: merchantId },
            { name: '@startDate', value: startDate.toISOString() },
            { name: '@endDate', value: endDate.toISOString() }
          ]
        })
        .fetchAll();

      const metrics: OrderMetrics = {
        merchantId,
        period: { startDate, endDate },
        totalOrders: orders.length,
        confirmedOrders: orders.filter(o => o.status === 'confirmed').length,
        cancelledOrders: orders.filter(o => o.status === 'cancelled').length,
        pendingOrders: orders.filter(o => o.status === 'pending_confirmation').length,
        totalRevenue: orders.filter(o => o.status === 'confirmed').reduce((sum, o) => sum + o.total, 0),
        averageOrderValue: 0,
        aiExtractionAccuracy: orders.reduce((sum, o) => sum + o.extractionConfidence, 0) / orders.length || 0,
        averageExtractionConfidence: orders.reduce((sum, o) => sum + o.extractionConfidence, 0) / orders.length || 0,
        clarificationRate: orders.filter(o => o.clarificationAttempts > 0).length / orders.length * 100 || 0,
        averageProcessingTime: 0,
        onTimeDeliveryRate: 0,
        topProducts: []
      };

      metrics.averageOrderValue = metrics.confirmedOrders > 0 ? metrics.totalRevenue / metrics.confirmedOrders : 0;

      return metrics;
    } catch (error) {
      this.logger.error('Error calculating order metrics:', error);
      throw error;
    }
  }

  /**
   * Create order status history entry
   */
  private async createStatusHistory(
    orderId: string,
    status: OrderStatus,
    changedBy: 'system' | 'merchant' | 'customer' | 'ai',
    reason?: string
  ): Promise<void> {
    try {
      const container = this.cosmosService.getContainer('order_status_history');
      
      const historyEntry: OrderStatusHistory = {
        id: this.generateHistoryId(),
        orderId,
        status,
        timestamp: new Date(),
        changedBy,
        reason,
        notes: reason
      };

      await container.items.create(historyEntry);
    } catch (error) {
      this.logger.error('Error creating status history:', error);
      // Don't throw error here to avoid failing the main operation
    }
  }

  /**
   * Generate unique order ID
   */
  private generateOrderId(): string {
    return `order_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Generate order number
   */
  private generateOrderNumber(merchantId: string): string {
    const timestamp = Date.now().toString().slice(-6);
    const merchantPrefix = merchantId.slice(-3).toUpperCase();
    return `${merchantPrefix}-${timestamp}`;
  }

  /**
   * Generate item ID
   */
  private generateItemId(): string {
    return `item_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`;
  }

  /**
   * Generate history ID
   */
  private generateHistoryId(): string {
    return `history_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`;
  }

  /**
   * Export orders to CSV format
   */
  async exportOrdersToCSV(merchantId: string, status?: OrderStatus): Promise<string> {
    const orders = await this.getOrdersForMerchant(merchantId, status, 1000);
    
    const headers = [
      'Order Number',
      'Status',
      'Customer Name',
      'Customer Phone',
      'Items',
      'Total',
      'Created Date',
      'Confirmed Date'
    ];

    const csvRows = orders.map(order => [
      order.orderNumber,
      order.status,
      order.customer.name || 'N/A',
      order.customer.phone || 'N/A',
      order.items.map(item => `${item.productName} (${item.quantity})`).join('; '),
      `${order.total} ${order.currency}`,
      order.createdAt.toISOString().split('T')[0],
      order.confirmedAt?.toISOString().split('T')[0] || 'N/A'
    ]);

    const csvContent = [headers, ...csvRows]
      .map(row => row.map(cell => `"${cell}"`).join(','))
      .join('\n');

    return csvContent;
  }
} 