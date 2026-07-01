/**
 * @swagger
 * /auth/register:
 *   post:
 *     summary: Register a new user
 *     tags: [Authentication]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [name, email, password]
 *             properties:
 *               name: { type: string }
 *               email: { type: string, format: email }
 *               password: { type: string }
 *               role: { type: string, enum: ['Customer', 'Vendor', 'Staff'] }
 *               phoneNumber: { type: string }
 *     responses:
 *       201:
 *         description: User registered successfully
 *
 * /auth/register-vendor:
 *   post:
 *     summary: Register a vendor explicitly with company details
 *     tags: [Authentication]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [name, email, password, companyName]
 *             properties:
 *               name: { type: string }
 *               email: { type: string, format: email }
 *               password: { type: string }
 *               companyName: { type: string }
 *               address: { type: string }
 *               phoneNumber: { type: string }
 *     responses:
 *       201:
 *         description: Vendor registered successfully
 *
 * /auth/login:
 *   post:
 *     summary: User Login
 *     tags: [Authentication]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [email, password]
 *             properties:
 *               email: { type: string, format: email }
 *               password: { type: string }
 *     responses:
 *       200:
 *         description: Logged in successfully
 *
 * /products:
 *   get:
 *     summary: List all products (Filtered by role permissions)
 *     tags: [Product Management]
 *     parameters:
 *       - in: query
 *         name: search
 *         schema: { type: string }
 *       - in: query
 *         name: categoryId
 *         schema: { type: string }
 *       - in: query
 *         name: condition
 *         schema: { type: string, enum: [New, Used] }
 *       - in: query
 *         name: platform
 *         schema: { type: string }
 *     responses:
 *       200:
 *         description: List of products
 *   post:
 *     summary: Add a new product with variations
 *     tags: [Product Management]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [title]
 *             properties:
 *               title: { type: string }
 *               description: { type: string }
 *               condition: { type: string, enum: [New, Used] }
 *               categoryId: { type: string }
 *               variations:
 *                 type: array
 *                 items:
 *                   type: object
 *                   properties:
 *                     price: { type: number }
 *                     costPrice: { type: number }
 *                     stockQuantity: { type: integer }
 *                     platform: { type: string }
 *     responses:
 *       201:
 *         description: Product created
 *
 * /orders:
 *   post:
 *     summary: Create an order (Checkout)
 *     tags: [Order Management]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [items, shippingAddress]
 *             properties:
 *               items:
 *                 type: array
 *                 items:
 *                   type: object
 *                   properties:
 *                     variationId: { type: string }
 *                     quantity: { type: integer }
 *               shippingAddress: { type: object }
 *     responses:
 *       201:
 *         description: Order created
 *
 * /orders/{orderId}/items/{itemId}/assign-supplier:
 *   post:
 *     summary: Manually assign a supplier/vendor to an order line item
 *     tags: [Order Management]
 *     parameters:
 *       - in: path
 *         name: orderId
 *         required: true
 *         schema: { type: string }
 *       - in: path
 *         name: itemId
 *         required: true
 *         schema: { type: string }
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [vendorId]
 *             properties:
 *               vendorId: { type: string }
 *     responses:
 *       200:
 *         description: Supplier assigned, stock updated, vendor earnings credited
 *
 * /vendors/portal/dashboard:
 *   get:
 *     summary: Retrieve Vendor Portal statistics
 *     tags: [Vendor Portal]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Vendor summary cards & earnings trends
 *
 * /reports/dashboard:
 *   get:
 *     summary: Admin panel business overview summary
 *     tags: [Financial & Reports]
 *     responses:
 *       200:
 *         description: Sales stats, low stock warnings, revenue trends
 *
 * /reports/financial:
 *   get:
 *     summary: Retrieve profit/loss financial audit report
 *     tags: [Financial & Reports]
 *     parameters:
 *       - in: query
 *         name: dateFrom
 *         schema: { type: string, format: date }
 *       - in: query
 *         name: dateTo
 *         schema: { type: string, format: date }
 *     responses:
 *       200:
 *         description: Gross revenue, COGS, Net profit calculations
 *
 * /services/repairs:
 *   post:
 *     summary: Intake custom console/controller repair request
 *     tags: [Services Management]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [customerName, customerEmail, description]
 *     responses:
 *       201:
 *         description: Repair request ticket created
 */
