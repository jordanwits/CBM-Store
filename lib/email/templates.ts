import { getSiteUrl } from './resend';
import { getTrackingUrl } from '@/lib/tracking';

interface OrderData {
  orderId: string;
  orderNumber: string;
  customerEmail: string;
  customerName?: string;
  totalPoints: number;
  itemCount: number;
  deliveryMethod: string;
  createdAt: string;
}

interface OrderStatusData extends OrderData {
  status: string;
  trackingNumber?: string;
}

export function customerOrderConfirmationEmail(order: OrderData) {
  const siteUrl = getSiteUrl();
  const orderUrl = `${siteUrl}/orders/${order.orderId}`;
  
  const subject = `Order Confirmation - #${order.orderNumber}`;
  
  const html = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${subject}</title>
</head>
<body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
  <div style="background-color: #f8f9fa; border-radius: 8px; padding: 30px; margin-bottom: 20px;">
    <h1 style="color: #2563eb; margin: 0 0 10px 0;">Order Confirmed!</h1>
    <p style="font-size: 16px; margin: 0; color: #666;">Thank you for your order.</p>
  </div>
  
  <div style="background-color: #fff; border: 1px solid #e5e7eb; border-radius: 8px; padding: 20px; margin-bottom: 20px;">
    <h2 style="font-size: 18px; margin: 0 0 15px 0;">Order Details</h2>
    <table style="width: 100%; border-collapse: collapse;">
      <tr>
        <td style="padding: 8px 0; border-bottom: 1px solid #f3f4f6;"><strong>Order Number:</strong></td>
        <td style="padding: 8px 0; border-bottom: 1px solid #f3f4f6; text-align: right;">#${order.orderNumber}</td>
      </tr>
      <tr>
        <td style="padding: 8px 0; border-bottom: 1px solid #f3f4f6;"><strong>Order Date:</strong></td>
        <td style="padding: 8px 0; border-bottom: 1px solid #f3f4f6; text-align: right;">${new Date(order.createdAt).toLocaleDateString()}</td>
      </tr>
      <tr>
        <td style="padding: 8px 0; border-bottom: 1px solid #f3f4f6;"><strong>Total Points:</strong></td>
        <td style="padding: 8px 0; border-bottom: 1px solid #f3f4f6; text-align: right; color: #2563eb; font-weight: bold;">${order.totalPoints.toLocaleString()} points</td>
      </tr>
      <tr>
        <td style="padding: 8px 0; border-bottom: 1px solid #f3f4f6;"><strong>Items:</strong></td>
        <td style="padding: 8px 0; border-bottom: 1px solid #f3f4f6; text-align: right;">${order.itemCount}</td>
      </tr>
      <tr>
        <td style="padding: 8px 0;"><strong>Delivery Method:</strong></td>
        <td style="padding: 8px 0; text-align: right;">${order.deliveryMethod === 'pickup' ? 'Pickup' : 'Delivery'}</td>
      </tr>
    </table>
  </div>
  
  <div style="text-align: center; margin: 30px 0;">
    <a href="${orderUrl}" style="display: inline-block; background-color: #2563eb; color: #fff; text-decoration: none; padding: 12px 24px; border-radius: 6px; font-weight: bold;">View Order Details</a>
  </div>
  
  <div style="background-color: #f8f9fa; border-radius: 8px; padding: 20px; margin-top: 20px;">
    <p style="margin: 0; font-size: 14px; color: #666;">
      ${order.deliveryMethod === 'pickup' 
        ? 'You will be notified when your order is ready for pickup.' 
        : 'You will receive shipping updates as your order is processed.'}
    </p>
  </div>
  
  <div style="margin-top: 30px; padding-top: 20px; border-top: 1px solid #e5e7eb; text-align: center;">
    <p style="font-size: 12px; color: #999; margin: 0;">
      If you have any questions about your order, please contact our support team.
    </p>
  </div>
</body>
</html>
  `;
  
  return { subject, html };
}

export function adminNewOrderEmail(order: OrderData) {
  const siteUrl = getSiteUrl();
  const orderUrl = `${siteUrl}/admin/orders/${order.orderId}`;
  
  const subject = `New Order - #${order.orderNumber}`;
  
  const html = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${subject}</title>
</head>
<body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
  <div style="background-color: #fef3c7; border-radius: 8px; padding: 30px; margin-bottom: 20px;">
    <h1 style="color: #92400e; margin: 0 0 10px 0;">New Order Received</h1>
    <p style="font-size: 16px; margin: 0; color: #78350f;">A new order has been placed and requires processing.</p>
  </div>
  
  <div style="background-color: #fff; border: 1px solid #e5e7eb; border-radius: 8px; padding: 20px; margin-bottom: 20px;">
    <h2 style="font-size: 18px; margin: 0 0 15px 0;">Order Summary</h2>
    <table style="width: 100%; border-collapse: collapse;">
      <tr>
        <td style="padding: 8px 0; border-bottom: 1px solid #f3f4f6;"><strong>Order Number:</strong></td>
        <td style="padding: 8px 0; border-bottom: 1px solid #f3f4f6; text-align: right;">#${order.orderNumber}</td>
      </tr>
      <tr>
        <td style="padding: 8px 0; border-bottom: 1px solid #f3f4f6;"><strong>Customer:</strong></td>
        <td style="padding: 8px 0; border-bottom: 1px solid #f3f4f6; text-align: right;">${order.customerEmail}</td>
      </tr>
      <tr>
        <td style="padding: 8px 0; border-bottom: 1px solid #f3f4f6;"><strong>Order Date:</strong></td>
        <td style="padding: 8px 0; border-bottom: 1px solid #f3f4f6; text-align: right;">${new Date(order.createdAt).toLocaleString()}</td>
      </tr>
      <tr>
        <td style="padding: 8px 0; border-bottom: 1px solid #f3f4f6;"><strong>Total Points:</strong></td>
        <td style="padding: 8px 0; border-bottom: 1px solid #f3f4f6; text-align: right; font-weight: bold;">${order.totalPoints.toLocaleString()}</td>
      </tr>
      <tr>
        <td style="padding: 8px 0; border-bottom: 1px solid #f3f4f6;"><strong>Items:</strong></td>
        <td style="padding: 8px 0; border-bottom: 1px solid #f3f4f6; text-align: right;">${order.itemCount}</td>
      </tr>
      <tr>
        <td style="padding: 8px 0;"><strong>Delivery Method:</strong></td>
        <td style="padding: 8px 0; text-align: right; text-transform: capitalize;">${order.deliveryMethod}</td>
      </tr>
    </table>
  </div>
  
  <div style="text-align: center; margin: 30px 0;">
    <a href="${orderUrl}" style="display: inline-block; background-color: #2563eb; color: #fff; text-decoration: none; padding: 12px 24px; border-radius: 6px; font-weight: bold;">View Order in Admin Panel</a>
  </div>
</body>
</html>
  `;
  
  return { subject, html };
}

export function customerOrderStatusEmail(order: OrderStatusData) {
  const siteUrl = getSiteUrl();
  const orderUrl = `${siteUrl}/orders/${order.orderId}`;
  
  const statusText = order.status.charAt(0).toUpperCase() + order.status.slice(1);
  const subject = `Order ${statusText} - #${order.orderNumber}`;
  
  const statusMessages: Record<string, string> = {
    processing: 'Your order is now being processed and prepared for shipment.',
    shipped: order.trackingNumber 
      ? `Your order has been shipped! Tracking number: ${order.trackingNumber}`
      : 'Your order has been shipped and is on its way to you.',
    delivered: 'Your order has been delivered. We hope you enjoy your items!',
    cancelled: 'Your order has been cancelled. If you have questions, please contact support.',
  };
  
  const html = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${subject}</title>
</head>
<body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
  <div style="background-color: #f8f9fa; border-radius: 8px; padding: 30px; margin-bottom: 20px;">
    <h1 style="color: #2563eb; margin: 0 0 10px 0;">Order Status Update</h1>
    <p style="font-size: 16px; margin: 0; color: #666;">Order #${order.orderNumber}</p>
  </div>
  
  <div style="background-color: #fff; border: 1px solid #e5e7eb; border-radius: 8px; padding: 20px; margin-bottom: 20px;">
    <h2 style="font-size: 18px; margin: 0 0 15px 0;">Status: ${statusText}</h2>
    <p style="margin: 0; color: #666;">${statusMessages[order.status] || 'Your order status has been updated.'}</p>
    ${order.trackingNumber ? `
      <div style="margin-top: 15px; padding: 15px; background-color: #f3f4f6; border-radius: 6px;">
        <p style="margin: 0 0 5px 0; font-size: 14px; color: #666;">Tracking Number:</p>
        <p style="margin: 0;">
          <a href="${getTrackingUrl(order.trackingNumber)}" style="font-family: monospace; font-size: 16px; font-weight: bold; color: #2563eb; text-decoration: underline;">${order.trackingNumber}</a>
        </p>
        <p style="margin: 5px 0 0 0; font-size: 12px; color: #666;">Click the tracking number to track your package</p>
      </div>
    ` : ''}
  </div>
  
  <div style="text-align: center; margin: 30px 0;">
    <a href="${orderUrl}" style="display: inline-block; background-color: #2563eb; color: #fff; text-decoration: none; padding: 12px 24px; border-radius: 6px; font-weight: bold;">View Order Details</a>
  </div>
  
  <div style="margin-top: 30px; padding-top: 20px; border-top: 1px solid #e5e7eb; text-align: center;">
    <p style="font-size: 12px; color: #999; margin: 0;">
      If you have any questions, please contact our support team.
    </p>
  </div>
</body>
</html>
  `;
  
  return { subject, html };
}

export function adminOrderStatusEmail(order: OrderStatusData) {
  const siteUrl = getSiteUrl();
  const orderUrl = `${siteUrl}/admin/orders/${order.orderId}`;
  
  const statusText = order.status.charAt(0).toUpperCase() + order.status.slice(1);
  const subject = `Order Status Updated - #${order.orderNumber}`;
  
  const html = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${subject}</title>
</head>
<body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
  <div style="background-color: #f8f9fa; border-radius: 8px; padding: 30px; margin-bottom: 20px;">
    <h1 style="color: #2563eb; margin: 0 0 10px 0;">Order Status Updated</h1>
    <p style="font-size: 16px; margin: 0; color: #666;">Order #${order.orderNumber} - ${statusText}</p>
  </div>
  
  <div style="background-color: #fff; border: 1px solid #e5e7eb; border-radius: 8px; padding: 20px; margin-bottom: 20px;">
    <table style="width: 100%; border-collapse: collapse;">
      <tr>
        <td style="padding: 8px 0; border-bottom: 1px solid #f3f4f6;"><strong>Customer:</strong></td>
        <td style="padding: 8px 0; border-bottom: 1px solid #f3f4f6; text-align: right;">${order.customerEmail}</td>
      </tr>
      <tr>
        <td style="padding: 8px 0; border-bottom: 1px solid #f3f4f6;"><strong>New Status:</strong></td>
        <td style="padding: 8px 0; border-bottom: 1px solid #f3f4f6; text-align: right;"><strong>${statusText}</strong></td>
      </tr>
      ${order.trackingNumber ? `
      <tr>
        <td style="padding: 8px 0;"><strong>Tracking:</strong></td>
        <td style="padding: 8px 0; text-align: right;">
          <a href="${getTrackingUrl(order.trackingNumber)}" style="font-family: monospace; color: #2563eb; text-decoration: underline;">${order.trackingNumber}</a>
        </td>
      </tr>
      ` : ''}
    </table>
  </div>
  
  <div style="text-align: center; margin: 30px 0;">
    <a href="${orderUrl}" style="display: inline-block; background-color: #2563eb; color: #fff; text-decoration: none; padding: 12px 24px; border-radius: 6px; font-weight: bold;">View in Admin Panel</a>
  </div>
</body>
</html>
  `;
  
  return { subject, html };
}
