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
    limit: number = 50
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
      
      return orders.slice(0, limit);
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
    merchantId: string
  ): Promise<Order> {
    try {
      const container = this.cosmosService.getContainer('orders');
      
      const { resource: order } = await container.item(orderId).read();
      if (!order) {
        throw new Error(`Order not found: ${orderId}`);
      }

      if (order.merchantId !== merchantId) {
        throw new Error('Unauthorized: Order belongs to different merchant');
      }

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
      
      this.logger.log(`Order ${order.orderNumber} status updated to: ${newStatus}`);
      return updatedOrder;
    } catch (error) {
      this.logger.error('Error updating order status:', error);
      throw error;
    }
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
      'Created Date'
    ];

    const csvRows = orders.map(order => [
      order.orderNumber,
      order.status,
      order.customer.name || 'N/A',
      order.customer.phone || 'N/A',
      order.items.map(item => `${item.productName} (${item.quantity})`).join('; '),
      `${order.total} ${order.currency}`,
      order.createdAt.toISOString().split('T')[0]
    ]);

    const csvContent = [headers, ...csvRows]
      .map(row => row.map(cell => `"${cell}"`).join(','))
      .join('\n');

    return csvContent;
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
} 