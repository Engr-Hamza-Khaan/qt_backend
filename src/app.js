const express = require('express');
const cors = require('cors');
const morgan = require('morgan');
const path = require('path');
const swaggerUi = require('swagger-ui-express');
const swaggerSpec = require('./swagger/swagger.config');
const routes = require('./routes');
const { errorHandler } = require('./middlewares/error.middleware');

const helmet = require('helmet');
const rateLimit = require('express-rate-limit');

const app = express();

// Secure HTTP headers (allow cross-origin images for admin/store frontends)
app.use(helmet({
  crossOriginResourcePolicy: { policy: 'cross-origin' },
}));

// Global Rate Limiting for API routes
const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 500, // Limit each IP to 500 requests per 15 mins
  message: { success: false, message: 'Too many requests from this IP, please try again later.' },
  standardHeaders: true,
  legacyHeaders: false
});

// Stricter Rate Limiting for auth endpoints to prevent brute-force
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 20, // Limit each IP to 20 register/login requests per 15 mins
  message: { success: false, message: 'Too many authentication attempts, please try again after 15 minutes.' },
  standardHeaders: true,
  legacyHeaders: false
});

app.use('/api/auth/login', authLimiter);
app.use('/api/auth/register', authLimiter);
app.use('/api', apiLimiter);

// Middlewares
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

if (process.env.NODE_ENV === 'development') {
  app.use(morgan('dev'));
}

// Serve uploaded static files
app.use(
  '/uploads',
  (req, res, next) => {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Cross-Origin-Resource-Policy', 'cross-origin');
    next();
  },
  express.static(path.join(__dirname, '../public/uploads'))
);

// Swagger UI Route
app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerSpec));

// Base status check
app.get('/api/status', (req, res) => {
  res.json({
    success: true,
    message: 'Quickturn Admin API is running smoothly',
    timestamp: new Date()
  });
});

// Mount Routes
app.use('/api', routes);

// 404 Route handler
app.use((req, res, next) => {
  res.status(404);
  const error = new Error(`API Endpoint Not Found - ${req.originalUrl}`);
  next(error);
});

// Global Error Handler Middleware
app.use(errorHandler);

module.exports = app;
