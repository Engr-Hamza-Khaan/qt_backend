const swaggerJsdoc = require('swagger-jsdoc');

const options = {
  definition: {
    openapi: '3.0.0',
    info: {
      title: 'Quickturn Ecommerce Admin API',
      version: '1.0.0',
      description: 'Comprehensive backend API documentation for Quickturn Ecommerce Administration Panel',
      contact: {
        name: 'Developer Support'
      }
    },
    servers: [
      {
        url: 'http://localhost:5000/api',
        description: 'Development Server'
      }
    ],
    components: {
      securitySchemes: {
        bearerAuth: {
          type: 'http',
          scheme: 'bearer',
          bearerFormat: 'JWT',
          description: 'Enter your Bearer token in the format: Bearer <token>'
        }
      },
      schemas: {
        User: {
          type: 'object',
          properties: {
            id: { type: 'string', format: 'uuid' },
            name: { type: 'string' },
            email: { type: 'string', format: 'email' },
            role: { type: 'string', enum: ['Super Admin', 'Admin', 'Staff', 'Vendor', 'Customer'] },
            isActive: { type: 'boolean' },
            phoneNumber: { type: 'string' }
          }
        },
        VendorProfile: {
          type: 'object',
          properties: {
            id: { type: 'string', format: 'uuid' },
            companyName: { type: 'string' },
            email: { type: 'string', format: 'email' },
            phone: { type: 'string' },
            address: { type: 'string' },
            balance: { type: 'number' },
            pendingPayments: { type: 'number' },
            paidPayments: { type: 'number' },
            status: { type: 'string', enum: ['Active', 'Suspended', 'Pending Approval'] }
          }
        },
        Product: {
          type: 'object',
          properties: {
            id: { type: 'string', format: 'uuid' },
            title: { type: 'string' },
            description: { type: 'string' },
            condition: { type: 'string', enum: ['New', 'Used'] },
            modelNumber: { type: 'string' },
            categoryId: { type: 'string', format: 'uuid' },
            tags: { type: 'array', items: { type: 'string' } },
            attributes: { type: 'object' },
            isFeatured: { type: 'boolean' },
            isBestSeller: { type: 'boolean' },
            isFlashSale: { type: 'boolean' },
            status: { type: 'string', enum: ['Draft', 'Published', 'Hidden'] },
            vendorId: { type: 'string', format: 'uuid' }
          }
        },
        ProductVariation: {
          type: 'object',
          properties: {
            id: { type: 'string', format: 'uuid' },
            sku: { type: 'string' },
            color: { type: 'string' },
            storage: { type: 'string' },
            edition: { type: 'string' },
            platform: { type: 'string' },
            price: { type: 'number' },
            costPrice: { type: 'number' },
            stockQuantity: { type: 'integer' },
            lowStockThreshold: { type: 'integer' }
          }
        },
        Order: {
          type: 'object',
          properties: {
            id: { type: 'string', format: 'uuid' },
            orderNumber: { type: 'string' },
            customerId: { type: 'string', format: 'uuid' },
            totalAmount: { type: 'number' },
            paymentStatus: { type: 'string', enum: ['Pending', 'Paid', 'Refunded'] },
            orderStatus: { type: 'string', enum: ['Pending', 'Processing', 'Supplier Assigned', 'Shipped', 'Delivered', 'Cancelled', 'Refunded'] },
            shippingAddress: { type: 'object' },
            trackingNumber: { type: 'string' },
            carrier: { type: 'string' }
          }
        }
      }
    },
    security: [
      {
        bearerAuth: []
      }
    ]
  },
  // Paths to files containing annotations
  apis: ['./src/routes/*.js', './src/swagger/*.js']
};

const swaggerSpec = swaggerJsdoc(options);

module.exports = swaggerSpec;
