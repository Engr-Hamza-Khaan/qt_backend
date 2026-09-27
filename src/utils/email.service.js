const nodemailer = require('nodemailer');

/**
 * QuickTurn Email Service using Nodemailer
 * Handles customer order confirmations and admin new-sale notifications.
 */

const getTransporter = () => {
  const host = process.env.SMTP_HOST || 'smtp.gmail.com';
  const port = parseInt(process.env.SMTP_PORT || '465', 10);
  const secure = process.env.SMTP_SECURE === 'true' || port === 465;
  const user = process.env.SMTP_USER || 'quickturnpk@gmail.com';
  const pass = process.env.SMTP_PASS || 'Mm221764910';

  return nodemailer.createTransport({
    host,
    port,
    secure,
    auth: {
      user,
      pass,
    },
    connectionTimeout: 15000,
    greetingTimeout: 15000,
    socketTimeout: 20000,
  });
};

const formatCurrency = (amount) => {
  const num = parseFloat(amount) || 0;
  return `Rs ${num.toLocaleString('en-PK', { minimumFractionDigits: 0, maximumFractionDigits: 2 })}`;
};

const formatDate = (date) => {
  const d = date ? new Date(date) : new Date();
  return d.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
};

const formatAddress = (addressObj) => {
  if (!addressObj) return 'N/A';
  if (typeof addressObj === 'string') return addressObj;

  const parts = [
    addressObj.street || addressObj.address || addressObj.addressLine1,
    addressObj.addressLine2,
    addressObj.city,
    addressObj.state,
    addressObj.postalCode || addressObj.zipCode,
    addressObj.country || 'Pakistan',
  ].filter(Boolean);

  return parts.length > 0 ? parts.join(', ') : 'N/A';
};

const getItemVariationDetails = (item) => {
  const v = item?.variation || {};
  const tags = [];
  if (v.platform) tags.push(v.platform);
  if (v.edition) tags.push(v.edition);
  if (v.storage) tags.push(v.storage);
  if (v.color) tags.push(v.color);
  if (v.condition) tags.push(v.condition);
  if (v.bundle) tags.push(v.bundle);
  return tags.join(' • ');
};

/**
 * Generate Customer Order Confirmation HTML Email
 */
const buildCustomerOrderEmailHtml = ({ order, customer, items }) => {
  const orderNumber = order?.orderNumber || 'N/A';
  const orderDate = formatDate(order?.createdAt);
  const paymentMethod = order?.paymentMethod || 'Cash on Delivery';
  const totalAmount = formatCurrency(order?.totalAmount);
  const discountAmount = parseFloat(order?.discountAmount) || 0;
  const couponCode = order?.couponCode;
  const shippingAddress = order?.shippingAddress || {};
  const customerName = customer?.name || shippingAddress?.receiverName || shippingAddress?.guestName || 'Customer';

  const orderItems = items || order?.items || [];

  let itemsHtml = '';
  let subtotal = 0;

  for (const item of orderItems) {
    const title = item.variation?.product?.title || item.variation?.title || 'Gaming Product';
    const varDetails = getItemVariationDetails(item);
    const sku = item.variation?.sku ? `SKU: ${item.variation.sku}` : '';
    const quantity = item.quantity || 1;
    const price = parseFloat(item.price) || 0;
    const lineTotal = price * quantity;
    subtotal += lineTotal;

    itemsHtml += `
      <tr>
        <td style="padding: 14px 16px; border-bottom: 1px solid #27213d; vertical-align: top;">
          <div style="font-weight: 600; font-size: 14px; color: #ffffff; line-height: 1.4;">${title}</div>
          ${varDetails ? `<div style="font-size: 12px; color: #a59fc4; margin-top: 4px;">${varDetails}</div>` : ''}
          ${sku ? `<div style="font-size: 11px; color: #7d759e; margin-top: 2px;">${sku}</div>` : ''}
        </td>
        <td style="padding: 14px 16px; border-bottom: 1px solid #27213d; text-align: center; color: #ded9f5; font-size: 14px; vertical-align: top;">
          ${quantity}
        </td>
        <td style="padding: 14px 16px; border-bottom: 1px solid #27213d; text-align: right; color: #ded9f5; font-size: 14px; vertical-align: top;">
          ${formatCurrency(price)}
        </td>
        <td style="padding: 14px 16px; border-bottom: 1px solid #27213d; text-align: right; font-weight: 700; color: #a855f7; font-size: 14px; vertical-align: top;">
          ${formatCurrency(lineTotal)}
        </td>
      </tr>
    `;
  }

  const shippingStr = formatAddress(shippingAddress);
  const receiverPhone = shippingAddress.receiverPhone || shippingAddress.phoneNumber || customer?.phoneNumber || 'N/A';

  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Order Confirmation - QuickTurn</title>
</head>
<body style="margin: 0; padding: 0; background-color: #0b0716; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; color: #ffffff;">
  <table width="100%" border="0" cellspacing="0" cellpadding="0" style="background-color: #0b0716; padding: 30px 10px;">
    <tr>
      <td align="center">
        <!-- Container -->
        <table width="100%" border="0" cellspacing="0" cellpadding="0" style="max-width: 600px; background-color: #15102a; border-radius: 16px; overflow: hidden; border: 1px solid #2a204d; box-shadow: 0 10px 30px rgba(0,0,0,0.5);">
          
          <!-- Header Banner -->
          <tr>
            <td style="background: linear-gradient(135deg, #7c16c9 0%, #4338ca 100%); padding: 32px 24px; text-align: center;">
              <h1 style="margin: 0; font-size: 26px; font-weight: 800; letter-spacing: 1px; color: #ffffff; text-transform: uppercase;">
                QUICK<span style="color: #22d3ee;">TURN</span>
              </h1>
              <p style="margin: 6px 0 0 0; color: #e0e7ff; font-size: 13px; letter-spacing: 0.5px;">Premium Gaming Consoles, Games & Tech</p>
            </td>
          </tr>

          <!-- Success Alert -->
          <tr>
            <td style="padding: 28px 24px 20px 24px; text-align: center;">
              <div style="display: inline-block; background-color: rgba(34, 197, 94, 0.15); border: 1px solid #22c55e; border-radius: 50px; padding: 8px 18px; color: #4ade80; font-size: 14px; font-weight: 600; margin-bottom: 16px;">
                ✓ Order Confirmed Successfully
              </div>
              <h2 style="margin: 0 0 8px 0; font-size: 22px; font-weight: 700; color: #ffffff;">
                Thank you for your order, ${customerName}!
              </h2>
              <p style="margin: 0; font-size: 14px; color: #a59fc4; line-height: 1.5;">
                We've received your order and are getting it ready. You'll receive updates as we process and ship your items.
              </p>
            </td>
          </tr>

          <!-- Order Summary Meta Box -->
          <tr>
            <td style="padding: 0 24px 24px 24px;">
              <table width="100%" border="0" cellspacing="0" cellpadding="0" style="background-color: #1c1538; border-radius: 12px; padding: 16px; border: 1px solid #2f245c;">
                <tr>
                  <td width="50%" style="padding: 6px 12px;">
                    <div style="font-size: 11px; text-transform: uppercase; color: #8f87b8; font-weight: 600; letter-spacing: 0.5px;">Order Number</div>
                    <div style="font-size: 15px; font-weight: 700; color: #38bdf8; margin-top: 3px;">#${orderNumber}</div>
                  </td>
                  <td width="50%" style="padding: 6px 12px;">
                    <div style="font-size: 11px; text-transform: uppercase; color: #8f87b8; font-weight: 600; letter-spacing: 0.5px;">Order Date</div>
                    <div style="font-size: 13px; font-weight: 600; color: #ded9f5; margin-top: 3px;">${orderDate}</div>
                  </td>
                </tr>
                <tr>
                  <td width="50%" style="padding: 6px 12px; border-top: 1px solid #2a204d;">
                    <div style="font-size: 11px; text-transform: uppercase; color: #8f87b8; font-weight: 600; letter-spacing: 0.5px;">Payment Method</div>
                    <div style="font-size: 13px; font-weight: 600; color: #ded9f5; margin-top: 3px;">${paymentMethod}</div>
                  </td>
                  <td width="50%" style="padding: 6px 12px; border-top: 1px solid #2a204d;">
                    <div style="font-size: 11px; text-transform: uppercase; color: #8f87b8; font-weight: 600; letter-spacing: 0.5px;">Payment Status</div>
                    <div style="font-size: 13px; font-weight: 600; color: #facc15; margin-top: 3px;">${order?.paymentStatus || 'Pending'}</div>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- Items Table -->
          <tr>
            <td style="padding: 0 24px 20px 24px;">
              <h3 style="margin: 0 0 12px 0; font-size: 16px; font-weight: 700; color: #ffffff;">Order Summary</h3>
              <table width="100%" border="0" cellspacing="0" cellpadding="0" style="border-collapse: collapse; background-color: #1a1334; border-radius: 12px; overflow: hidden; border: 1px solid #2a204d;">
                <thead>
                  <tr style="background-color: #211942;">
                    <th style="padding: 10px 16px; text-align: left; font-size: 12px; text-transform: uppercase; color: #8f87b8; font-weight: 600;">Item</th>
                    <th style="padding: 10px 16px; text-align: center; font-size: 12px; text-transform: uppercase; color: #8f87b8; font-weight: 600;">Qty</th>
                    <th style="padding: 10px 16px; text-align: right; font-size: 12px; text-transform: uppercase; color: #8f87b8; font-weight: 600;">Price</th>
                    <th style="padding: 10px 16px; text-align: right; font-size: 12px; text-transform: uppercase; color: #8f87b8; font-weight: 600;">Total</th>
                  </tr>
                </thead>
                <tbody>
                  ${itemsHtml}
                </tbody>
              </table>
            </td>
          </tr>

          <!-- Pricing Totals -->
          <tr>
            <td style="padding: 0 24px 24px 24px;">
              <table width="100%" border="0" cellspacing="0" cellpadding="0" style="background-color: #1c1538; border-radius: 12px; padding: 18px; border: 1px solid #2f245c;">
                <tr>
                  <td style="padding: 6px 0; color: #a59fc4; font-size: 14px;">Subtotal</td>
                  <td style="padding: 6px 0; text-align: right; color: #ffffff; font-size: 14px; font-weight: 600;">${formatCurrency(subtotal)}</td>
                </tr>
                ${discountAmount > 0 ? `
                <tr>
                  <td style="padding: 6px 0; color: #4ade80; font-size: 14px;">
                    Discount ${couponCode ? `<span style="background: rgba(74, 222, 128, 0.15); border: 1px dashed #4ade80; padding: 2px 6px; border-radius: 4px; font-size: 11px;">${couponCode}</span>` : ''}
                  </td>
                  <td style="padding: 6px 0; text-align: right; color: #4ade80; font-size: 14px; font-weight: 600;">-${formatCurrency(discountAmount)}</td>
                </tr>` : ''}
                <tr>
                  <td style="padding: 6px 0; color: #a59fc4; font-size: 14px;">Delivery / Shipping</td>
                  <td style="padding: 6px 0; text-align: right; color: #38bdf8; font-size: 14px; font-weight: 600;">FREE</td>
                </tr>
                <tr>
                  <td colspan="2" style="border-top: 1px solid #2f245c; padding-top: 12px; margin-top: 6px;"></td>
                </tr>
                <tr>
                  <td style="padding: 4px 0; color: #ffffff; font-size: 17px; font-weight: 800;">Grand Total</td>
                  <td style="padding: 4px 0; text-align: right; color: #c084fc; font-size: 20px; font-weight: 800;">${totalAmount}</td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- Shipping Details Box -->
          <tr>
            <td style="padding: 0 24px 28px 24px;">
              <table width="100%" border="0" cellspacing="0" cellpadding="0" style="background-color: #1a1334; border-radius: 12px; padding: 18px; border: 1px solid #2a204d;">
                <tr>
                  <td style="padding-bottom: 8px;">
                    <div style="font-size: 13px; font-weight: 700; text-transform: uppercase; color: #c084fc; letter-spacing: 0.5px;">📦 Shipping Details</div>
                  </td>
                </tr>
                <tr>
                  <td style="color: #ded9f5; font-size: 14px; line-height: 1.6;">
                    <strong>${customerName}</strong><br>
                    ${shippingStr}<br>
                    Phone: <strong>${receiverPhone}</strong>
                  </td>
                </tr>
                ${order?.customerNotes ? `
                <tr>
                  <td style="padding-top: 12px; border-top: 1px solid #27213d; margin-top: 10px; color: #a59fc4; font-size: 13px;">
                    <strong>Customer Note:</strong> "${order.customerNotes}"
                  </td>
                </tr>` : ''}
              </table>
            </td>
          </tr>

          <!-- Footer / Support -->
          <tr>
            <td style="background-color: #100b21; padding: 24px; text-align: center; border-top: 1px solid #241c42;">
              <p style="margin: 0 0 10px 0; font-size: 13px; color: #a59fc4;">
                Have questions about your order? Need help?
              </p>
              <p style="margin: 0 0 16px 0; font-size: 14px; font-weight: 600; color: #38bdf8;">
                Email us directly at <a href="mailto:quickturnpk@gmail.com" style="color: #38bdf8; text-decoration: underline;">quickturnpk@gmail.com</a>
              </p>
              <p style="margin: 0; font-size: 11px; color: #6d668c;">
                © ${new Date().getFullYear()} QuickTurn PK. All rights reserved.
              </p>
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>
</body>
</html>
  `;
};

/**
 * Generate Admin New Sale Alert HTML Email
 */
const buildAdminOrderEmailHtml = ({ order, customer, items }) => {
  const orderNumber = order?.orderNumber || 'N/A';
  const orderDate = formatDate(order?.createdAt);
  const paymentMethod = order?.paymentMethod || 'Cash on Delivery';
  const totalAmount = formatCurrency(order?.totalAmount);
  const discountAmount = parseFloat(order?.discountAmount) || 0;
  const couponCode = order?.couponCode;
  const shippingAddress = order?.shippingAddress || {};
  const customerName = customer?.name || shippingAddress?.receiverName || shippingAddress?.guestName || 'Customer';
  const customerEmail = customer?.email || shippingAddress?.guestEmail || 'N/A';
  const customerPhone = customer?.phoneNumber || shippingAddress?.receiverPhone || shippingAddress?.phoneNumber || 'N/A';

  const orderItems = items || order?.items || [];

  let itemsHtml = '';
  let subtotal = 0;

  for (const item of orderItems) {
    const title = item.variation?.product?.title || item.variation?.title || 'Gaming Product';
    const varDetails = getItemVariationDetails(item);
    const sku = item.variation?.sku ? `SKU: ${item.variation.sku}` : '';
    const quantity = item.quantity || 1;
    const price = parseFloat(item.price) || 0;
    const lineTotal = price * quantity;
    subtotal += lineTotal;

    itemsHtml += `
      <tr>
        <td style="padding: 12px 14px; border-bottom: 1px solid #e2e8f0; font-size: 13px; color: #1e293b;">
          <strong>${title}</strong>
          ${varDetails ? `<div style="font-size: 12px; color: #64748b; margin-top: 2px;">${varDetails}</div>` : ''}
          ${sku ? `<div style="font-size: 11px; color: #0284c7; font-family: monospace; margin-top: 2px;">${sku}</div>` : ''}
        </td>
        <td style="padding: 12px 14px; border-bottom: 1px solid #e2e8f0; text-align: center; font-size: 13px; color: #1e293b;">
          ${quantity}
        </td>
        <td style="padding: 12px 14px; border-bottom: 1px solid #e2e8f0; text-align: right; font-size: 13px; color: #1e293b;">
          ${formatCurrency(price)}
        </td>
        <td style="padding: 12px 14px; border-bottom: 1px solid #e2e8f0; text-align: right; font-weight: 700; font-size: 13px; color: #0f172a;">
          ${formatCurrency(lineTotal)}
        </td>
      </tr>
    `;
  }

  const shippingStr = formatAddress(shippingAddress);

  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>New Order Alert - QuickTurn</title>
</head>
<body style="margin: 0; padding: 0; background-color: #f1f5f9; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; color: #0f172a;">
  <table width="100%" border="0" cellspacing="0" cellpadding="0" style="background-color: #f1f5f9; padding: 24px 10px;">
    <tr>
      <td align="center">
        <!-- Container -->
        <table width="100%" border="0" cellspacing="0" cellpadding="0" style="max-width: 600px; background-color: #ffffff; border-radius: 12px; overflow: hidden; border: 1px solid #cbd5e1; box-shadow: 0 4px 12px rgba(0,0,0,0.06);">
          
          <!-- Top Alert Banner -->
          <tr>
            <td style="background: linear-gradient(135deg, #1e1b4b 0%, #312e81 100%); padding: 22px 24px; text-align: left;">
              <table width="100%" border="0" cellspacing="0" cellpadding="0">
                <tr>
                  <td>
                    <span style="background-color: #ef4444; color: #ffffff; padding: 4px 10px; border-radius: 4px; font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.5px;">
                      🚨 NEW SALE RECEIVED
                    </span>
                    <h1 style="margin: 8px 0 0 0; font-size: 22px; font-weight: 800; color: #ffffff;">
                      Order #${orderNumber}
                    </h1>
                  </td>
                  <td align="right" style="vertical-align: middle;">
                    <div style="font-size: 12px; color: #c7d2fe;">Total Revenue</div>
                    <div style="font-size: 22px; font-weight: 800; color: #38bdf8;">${totalAmount}</div>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- Quick Stats Summary -->
          <tr>
            <td style="padding: 20px 24px 10px 24px;">
              <table width="100%" border="0" cellspacing="0" cellpadding="0" style="background-color: #f8fafc; border-radius: 8px; border: 1px solid #e2e8f0; padding: 14px;">
                <tr>
                  <td width="33%" style="padding: 4px 8px;">
                    <div style="font-size: 11px; color: #64748b; text-transform: uppercase; font-weight: 600;">Time</div>
                    <div style="font-size: 13px; font-weight: 600; color: #0f172a; margin-top: 2px;">${orderDate}</div>
                  </td>
                  <td width="33%" style="padding: 4px 8px; border-left: 1px solid #e2e8f0;">
                    <div style="font-size: 11px; color: #64748b; text-transform: uppercase; font-weight: 600;">Payment</div>
                    <div style="font-size: 13px; font-weight: 600; color: #0f172a; margin-top: 2px;">${paymentMethod}</div>
                  </td>
                  <td width="33%" style="padding: 4px 8px; border-left: 1px solid #e2e8f0;">
                    <div style="font-size: 11px; color: #64748b; text-transform: uppercase; font-weight: 600;">Status</div>
                    <div style="font-size: 13px; font-weight: 700; color: #b45309; margin-top: 2px;">${order?.orderStatus || 'Pending'}</div>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- Customer Details -->
          <tr>
            <td style="padding: 10px 24px 16px 24px;">
              <table width="100%" border="0" cellspacing="0" cellpadding="0" style="border: 1px solid #e2e8f0; border-radius: 8px; padding: 14px; background-color: #ffffff;">
                <tr>
                  <td style="font-size: 13px; font-weight: 700; color: #334155; text-transform: uppercase; letter-spacing: 0.5px; padding-bottom: 8px;">
                    👤 Customer & Shipping Information
                  </td>
                </tr>
                <tr>
                  <td style="font-size: 14px; line-height: 1.6; color: #1e293b;">
                    <strong>Name:</strong> ${customerName}<br>
                    <strong>Email:</strong> <a href="mailto:${customerEmail}" style="color: #2563eb;">${customerEmail}</a><br>
                    <strong>Phone:</strong> <a href="tel:${customerPhone}" style="color: #2563eb;">${customerPhone}</a><br>
                    <strong>Address:</strong> ${shippingStr}
                  </td>
                </tr>
                ${order?.customerNotes ? `
                <tr>
                  <td style="padding-top: 10px; margin-top: 8px; border-top: 1px solid #f1f5f9; color: #d97706; font-size: 13px;">
                    <strong>Customer Note:</strong> "${order.customerNotes}"
                  </td>
                </tr>` : ''}
              </table>
            </td>
          </tr>

          <!-- Items Ordered Table -->
          <tr>
            <td style="padding: 0 24px 16px 24px;">
              <div style="font-size: 13px; font-weight: 700; color: #334155; text-transform: uppercase; letter-spacing: 0.5px; margin-bottom: 8px;">
                📦 Items Ordered (${orderItems.length})
              </div>
              <table width="100%" border="0" cellspacing="0" cellpadding="0" style="border-collapse: collapse; border: 1px solid #e2e8f0; border-radius: 8px; overflow: hidden;">
                <thead>
                  <tr style="background-color: #f8fafc;">
                    <th style="padding: 10px 14px; text-align: left; font-size: 11px; text-transform: uppercase; color: #64748b; font-weight: 600;">Product</th>
                    <th style="padding: 10px 14px; text-align: center; font-size: 11px; text-transform: uppercase; color: #64748b; font-weight: 600;">Qty</th>
                    <th style="padding: 10px 14px; text-align: right; font-size: 11px; text-transform: uppercase; color: #64748b; font-weight: 600;">Price</th>
                    <th style="padding: 10px 14px; text-align: right; font-size: 11px; text-transform: uppercase; color: #64748b; font-weight: 600;">Subtotal</th>
                  </tr>
                </thead>
                <tbody>
                  ${itemsHtml}
                </tbody>
              </table>
            </td>
          </tr>

          <!-- Financial Breakdown -->
          <tr>
            <td style="padding: 0 24px 20px 24px;">
              <table width="100%" border="0" cellspacing="0" cellpadding="0" style="background-color: #f8fafc; border-radius: 8px; padding: 14px; border: 1px solid #e2e8f0;">
                <tr>
                  <td style="padding: 4px 0; font-size: 13px; color: #64748b;">Subtotal:</td>
                  <td style="padding: 4px 0; text-align: right; font-size: 13px; font-weight: 600; color: #1e293b;">${formatCurrency(subtotal)}</td>
                </tr>
                ${discountAmount > 0 ? `
                <tr>
                  <td style="padding: 4px 0; font-size: 13px; color: #16a34a;">Discount (${couponCode || 'Promo'}):</td>
                  <td style="padding: 4px 0; text-align: right; font-size: 13px; font-weight: 600; color: #16a34a;">-${formatCurrency(discountAmount)}</td>
                </tr>` : ''}
                <tr>
                  <td style="padding: 4px 0; font-size: 13px; color: #64748b;">Shipping:</td>
                  <td style="padding: 4px 0; text-align: right; font-size: 13px; font-weight: 600; color: #0284c7;">FREE</td>
                </tr>
                <tr>
                  <td colspan="2" style="border-top: 1px solid #e2e8f0; padding-top: 8px;"></td>
                </tr>
                <tr>
                  <td style="font-size: 16px; font-weight: 800; color: #0f172a;">Total Payable:</td>
                  <td style="text-align: right; font-size: 18px; font-weight: 800; color: #4338ca;">${totalAmount}</td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- Admin Footer -->
          <tr>
            <td style="background-color: #f1f5f9; padding: 18px 24px; text-align: center; border-top: 1px solid #e2e8f0;">
              <p style="margin: 0; font-size: 12px; color: #64748b;">
                This is an automated notification from your <strong>QuickTurn Admin System</strong>.
              </p>
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>
</body>
</html>
  `;
};

/**
 * Send order notifications to both Customer and Admin.
 * Safe execution: errors will be logged and captured without crashing or rolling back order processing.
 */
const sendOrderEmails = async ({ order, customer, items }) => {
  const fromEmail = process.env.SMTP_FROM_EMAIL || process.env.SMTP_USER || 'quickturnpk@gmail.com';
  const fromName = process.env.SMTP_FROM_NAME || 'QuickTurn';
  const adminEmail = process.env.ADMIN_NOTIFICATION_EMAIL || process.env.SMTP_USER || 'quickturnpk@gmail.com';

  const customerEmail = customer?.email || order?.shippingAddress?.guestEmail || order?.shippingAddress?.email;
  const customerName = customer?.name || order?.shippingAddress?.guestName || order?.shippingAddress?.receiverName || 'Customer';

  const transporter = getTransporter();

  const results = {
    customerEmailSent: false,
    adminEmailSent: false,
    errors: [],
  };

  // 1. Send Customer Email
  if (customerEmail) {
    try {
      const customerHtml = buildCustomerOrderEmailHtml({
        order,
        customer: { ...customer, name: customerName, email: customerEmail },
        items,
      });

      await transporter.sendMail({
        from: `"${fromName}" <${fromEmail}>`,
        to: customerEmail,
        subject: `🎮 Order Confirmed! #${order.orderNumber} - QuickTurn`,
        html: customerHtml,
      });

      results.customerEmailSent = true;
      console.log(`[EmailService] Customer confirmation successfully sent to ${customerEmail} for order #${order.orderNumber}`);
    } catch (err) {
      console.error(`[EmailService] Failed to send customer email to ${customerEmail}:`, err.message);
      results.errors.push({ recipient: 'customer', error: err.message });
      if (err.message?.includes('535') || err.code === 'EAUTH') {
        console.error('[EmailService] ⚠️ SMTP AUTHENTICATION FAILED: Gmail requires an App Password (16 characters) instead of standard password. Generate one at https://myaccount.google.com/apppasswords and update SMTP_PASS in .env');
      }
    }
  } else {
    console.warn(`[EmailService] Skipping customer email: No customer email found for order #${order?.orderNumber}`);
  }

  // 2. Send Admin Notification Email
  if (adminEmail) {
    try {
      const adminHtml = buildAdminOrderEmailHtml({
        order,
        customer: { ...customer, name: customerName, email: customerEmail },
        items,
      });

      await transporter.sendMail({
        from: `"${fromName}" <${fromEmail}>`,
        to: adminEmail,
        subject: `🚨 New Sale Alert: Order #${order.orderNumber} (${formatCurrency(order.totalAmount)})`,
        html: adminHtml,
      });

      results.adminEmailSent = true;
      console.log(`[EmailService] Admin sale alert successfully sent to ${adminEmail} for order #${order.orderNumber}`);
    } catch (err) {
      console.error(`[EmailService] Failed to send admin email to ${adminEmail}:`, err.message);
      results.errors.push({ recipient: 'admin', error: err.message });
      if (err.message?.includes('535') || err.code === 'EAUTH') {
        console.error('[EmailService] ⚠️ SMTP AUTHENTICATION FAILED: Gmail requires an App Password (16 characters). See https://myaccount.google.com/apppasswords');
      }
    }
  }

  return results;
};

/**
 * Verify SMTP connection
 */
const verifySmtpConnection = async () => {
  try {
    const transporter = getTransporter();
    await transporter.verify();
    return { success: true, message: 'SMTP connection verified successfully' };
  } catch (error) {
    return {
      success: false,
      message: error.message,
      code: error.code,
      isAuthError: error.message?.includes('535') || error.code === 'EAUTH',
    };
  }
};

/**
 * Send a test email to verify credentials
 */
const sendTestEmail = async (toEmail) => {
  const transporter = getTransporter();
  const fromEmail = process.env.SMTP_FROM_EMAIL || process.env.SMTP_USER || 'quickturnpk@gmail.com';
  const fromName = process.env.SMTP_FROM_NAME || 'QuickTurn';
  const target = toEmail || process.env.ADMIN_NOTIFICATION_EMAIL || process.env.SMTP_USER || 'quickturnpk@gmail.com';

  const html = `
    <div style="font-family: sans-serif; padding: 20px; background-color: #0b0716; color: #ffffff; border-radius: 8px;">
      <h2 style="color: #c084fc;">🎮 QuickTurn Email Notification Test</h2>
      <p>This is a test email from QuickTurn to verify that your Nodemailer SMTP setup is working perfectly!</p>
      <p><strong>Configured Sender:</strong> ${fromEmail}</p>
      <p><strong>Time:</strong> ${new Date().toISOString()}</p>
      <div style="margin-top: 20px; padding: 12px; background: rgba(34, 197, 94, 0.2); border: 1px solid #22c55e; border-radius: 6px; color: #4ade80;">
        ✓ SMTP authentication and email dispatch confirmed!
      </div>
    </div>
  `;

  return await transporter.sendMail({
    from: `"${fromName}" <${fromEmail}>`,
    to: target,
    subject: '🧪 QuickTurn Nodemailer Setup Test',
    html,
  });
};

module.exports = {
  getTransporter,
  sendOrderEmails,
  verifySmtpConnection,
  sendTestEmail,
  buildCustomerOrderEmailHtml,
  buildAdminOrderEmailHtml,
};
