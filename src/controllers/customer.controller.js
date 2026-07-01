const { User, Order } = require('../models');

// @desc    Get all customers
// @route   GET /api/customers
// @access  Private (Admin/Staff)
const getCustomers = async (req, res, next) => {
  try {
    const { search, isActive } = req.query;
    const where = { role: 'Customer' };

    if (isActive !== undefined) {
      where.isActive = isActive === 'true';
    }

    if (search) {
      const { Op } = require('sequelize');
      where[Op.or] = [
        { name: { [Op.iLike]: `%${search}%` } },
        { email: { [Op.iLike]: `%${search}%` } }
      ];
    }

    const customers = await User.findAll({
      where,
      attributes: ['id', 'name', 'email', 'phoneNumber', 'isActive', 'createdAt'],
      order: [['createdAt', 'DESC']]
    });

    res.json({ success: true, count: customers.length, data: customers });
  } catch (error) {
    next(error);
  }
};

// @desc    Get customer details and order history
// @route   GET /api/customers/:id
// @access  Private (Admin/Staff)
const getCustomerById = async (req, res, next) => {
  try {
    const { id } = req.params;
    const customer = await User.findOne({
      where: { id, role: 'Customer' },
      attributes: { exclude: ['password'] },
      include: [
        {
          model: Order,
          as: 'orders',
          order: [['createdAt', 'DESC']]
        }
      ]
    });

    if (!customer) return res.status(404).json({ success: false, message: 'Customer not found' });

    // Mocking wishlist data for the response
    const mockWishlist = [
      { id: '1', title: 'PlayStation 5 Console', price: 499.99 },
      { id: '2', title: 'DualSense Wireless Controller', price: 69.99 }
    ];

    res.json({
      success: true,
      data: {
        customer,
        wishlist: mockWishlist,
        supportNotes: 'First-time buyer, interested in custom 3D figure commissions.'
      }
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Block or Unblock a customer
// @route   PUT /api/customers/:id/status
// @access  Private (Admin/Super Admin)
const toggleCustomerStatus = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { isActive } = req.body; // true or false

    const customer = await User.findOne({ where: { id, role: 'Customer' } });
    if (!customer) return res.status(404).json({ success: false, message: 'Customer not found' });

    customer.isActive = isActive;
    await customer.save();

    res.json({
      success: true,
      message: `Customer account has been ${isActive ? 'activated' : 'blocked'} successfully`,
      data: customer
    });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  getCustomers,
  getCustomerById,
  toggleCustomerStatus
};
