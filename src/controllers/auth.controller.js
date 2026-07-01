const jwt = require('jsonwebtoken');
const { User, VendorProfile } = require('../models');

// Helper to sign JWT
const generateToken = (id) => {
  return jwt.sign({ id }, process.env.JWT_SECRET || 'supersecretjwtkeyforquickturnecommerceadmin', {
    expiresIn: '30d'
  });
};

// @desc    Register a new user (Customer or Admin/Staff)
// @route   POST /api/auth/register
// @access  Public
const registerUser = async (req, res, next) => {
  try {
    const { name, email, password, role, phoneNumber } = req.body;

    const userExists = await User.findOne({ where: { email } });
    if (userExists) {
      return res.status(400).json({ success: false, message: 'User already exists' });
    }

    // Restrict creating admin roles via public register if necessary, but keep it open for ease of setup
    const user = await User.create({
      name,
      email,
      password,
      role: role || 'Customer',
      phoneNumber
    });

    // If role is Vendor, create Vendor Profile automatically
    if (user.role === 'Vendor') {
      await VendorProfile.create({
        userId: user.id,
        companyName: `${user.name} Co.`,
        email: user.email,
        phone: user.phoneNumber,
        status: 'Pending Approval'
      });
    }

    res.status(201).json({
      success: true,
      data: {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
        token: generateToken(user.id)
      }
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Register a Vendor explicitly with company details
// @route   POST /api/auth/register-vendor
// @access  Public
const registerVendor = async (req, res, next) => {
  try {
    const { name, email, password, phoneNumber, companyName, contactPerson, address } = req.body;

    const userExists = await User.findOne({ where: { email } });
    if (userExists) {
      return res.status(400).json({ success: false, message: 'Email already registered' });
    }

    const user = await User.create({
      name,
      email,
      password,
      role: 'Vendor',
      phoneNumber
    });

    const vendorProfile = await VendorProfile.create({
      userId: user.id,
      companyName,
      contactPerson: contactPerson || name,
      email: email,
      phone: phoneNumber,
      address,
      status: 'Pending Approval'
    });

    res.status(201).json({
      success: true,
      data: {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
        vendorProfile,
        token: generateToken(user.id)
      }
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Authenticate user & get token
// @route   POST /api/auth/login
// @access  Public
const loginUser = async (req, res, next) => {
  try {
    const { email, password } = req.body;

    const user = await User.findOne({
      where: { email },
      include: [{ model: VendorProfile, as: 'vendorProfile' }]
    });

    if (user && (await user.comparePassword(password))) {
      if (!user.isActive) {
        return res.status(403).json({ success: false, message: 'Account is deactivated' });
      }

      res.json({
        success: true,
        data: {
          id: user.id,
          name: user.name,
          email: user.email,
          role: user.role,
          vendorProfile: user.vendorProfile,
          token: generateToken(user.id)
        }
      });
    } else {
      res.status(401).json({ success: false, message: 'Invalid email or password' });
    }
  } catch (error) {
    next(error);
  }
};

// @desc    Get user profile
// @route   GET /api/auth/profile
// @access  Private
const getUserProfile = async (req, res, next) => {
  try {
    const user = await User.findByPk(req.user.id, {
      attributes: { exclude: ['password'] },
      include: [{ model: VendorProfile, as: 'vendorProfile' }]
    });

    if (user) {
      res.json({ success: true, data: user });
    } else {
      res.status(404).json({ success: false, message: 'User not found' });
    }
  } catch (error) {
    next(error);
  }
};

// @desc    Update user profile
// @route   PUT /api/auth/profile
// @access  Private
const updateUserProfile = async (req, res, next) => {
  try {
    const user = await User.findByPk(req.user.id);

    if (user) {
      user.name = req.body.name || user.name;
      user.phoneNumber = req.body.phoneNumber || user.phoneNumber;

      if (req.body.password) {
        user.password = req.body.password;
      }

      const updatedUser = await user.save();

      // If user is a vendor, we can also update vendor fields
      if (user.role === 'Vendor' && req.body.companyName) {
        const vendor = await VendorProfile.findOne({ where: { userId: user.id } });
        if (vendor) {
          vendor.companyName = req.body.companyName || vendor.companyName;
          vendor.contactPerson = req.body.contactPerson || vendor.contactPerson;
          vendor.phone = req.body.phoneNumber || vendor.phone;
          vendor.address = req.body.address || vendor.address;
          await vendor.save();
        }
      }

      res.json({
        success: true,
        data: {
          id: updatedUser.id,
          name: updatedUser.name,
          email: updatedUser.email,
          role: updatedUser.role
        }
      });
    } else {
      res.status(404).json({ success: false, message: 'User not found' });
    }
  } catch (error) {
    next(error);
  }
};

module.exports = {
  registerUser,
  registerVendor,
  loginUser,
  getUserProfile,
  updateUserProfile
};
