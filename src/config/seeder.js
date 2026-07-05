const {
  User,
  VendorProfile,
  Category,
  Product,
  ProductVariation,
  InventoryMovement,
  Page,
  WebsiteSetting,
  Discount,
  RepairRequest,
  SellRequest,
  ChatConversation
} = require('../models');

const seedDatabase = async () => {
  try {
    console.log('--- Starting Database Seeding ---');

    // 1. Seed Users (Super Admin, Staff, Vendors, Customers)
    const adminUser = await User.create({
      name: 'Super Admin',
      email: 'admin@quickturn.com',
      password: 'adminpassword123',
      role: 'Super Admin',
      phoneNumber: '+1111222333',
      isActive: true
    });

    const staffUser = await User.create({
      name: 'Staff Clerk',
      email: 'staff@quickturn.com',
      password: 'staffpassword123',
      role: 'Staff',
      phoneNumber: '+1222333444',
      isActive: true
    });

    const vendorUser1 = await User.create({
      name: 'Sony Supplier',
      email: 'sony@supplier.com',
      password: 'vendorpassword123',
      role: 'Vendor',
      phoneNumber: '+1888777666',
      isActive: true
    });

    const vendorUser2 = await User.create({
      name: 'Retro Gaming Inc',
      email: 'retro@supplier.com',
      password: 'vendorpassword123',
      role: 'Vendor',
      phoneNumber: '+1999888777',
      isActive: true
    });

    const customerUser = await User.create({
      name: 'John Doe',
      email: 'customer@gmail.com',
      password: 'customerpassword123',
      role: 'Customer',
      phoneNumber: '+1555444333',
      isActive: true
    });

    console.log('-> Users seeded');

    // 2. Seed Vendor Profiles
    const sonyVendor = await VendorProfile.create({
      userId: vendorUser1.id,
      companyName: 'Sony Interactive Distribution',
      contactPerson: 'Alex Mercer',
      email: 'sony@supplier.com',
      phone: '+1888777666',
      address: '100 Playstation Way, California',
      balance: 1500.00,
      pendingPayments: 0.00,
      paidPayments: 4500.00,
      status: 'Active'
    });

    const retroVendor = await VendorProfile.create({
      userId: vendorUser2.id,
      companyName: 'Retro Gaming Solutions',
      contactPerson: 'Sarah Connor',
      email: 'retro@supplier.com',
      phone: '+1999888777',
      address: '42 Nostalgia Ave, Oregon',
      balance: 320.00,
      pendingPayments: 100.00,
      paidPayments: 1200.00,
      status: 'Active'
    });

    console.log('-> Vendor profiles seeded');

    // 3. Seed Categories
    const consoles = await Category.create({
      name: 'Consoles',
      slug: 'consoles',
      platform: 'Hardware',
      description: 'Gaming consoles like PS5, Xbox Series X, Nintendo Switch'
    });

    const games = await Category.create({
      name: 'Games',
      slug: 'games',
      platform: 'Software',
      description: 'Physical & digital game titles'
    });

    const accessories = await Category.create({
      name: 'Accessories',
      slug: 'accessories',
      platform: 'Peripherals',
      description: 'Controllers, headsets, chargers'
    });

    const custom3d = await Category.create({
      name: 'Custom 3D Figures',
      slug: 'custom-3d-figures',
      platform: 'Collectibles',
      description: '3D printed custom game figures and models'
    });

    console.log('-> Categories seeded');

    // 4. Seed Products & Variations
    // Product 1: PS5 Console (Admin Product)
    const ps5 = await Product.create({
      title: 'PlayStation 5 Console',
      description: 'Experience lightning-fast loading with an ultra-high speed SSD, deeper immersion with support for haptic feedback, adaptive triggers and 3D Audio.',
      condition: 'New',
      modelNumber: 'CFI-1200',
      categoryId: consoles.id,
      tags: ['PS5', 'Sony', 'Console', 'Next Gen'],
      attributes: { platform: 'PS5' },
      isFeatured: true,
      isBestSeller: true,
      status: 'Published'
    });

    const ps5Disc = await ProductVariation.create({
      productId: ps5.id,
      sku: 'PS5-NEW-DISC-7731',
      color: 'White',
      storage: '825GB',
      edition: 'Disc Edition',
      platform: 'PS5',
      price: 499.99,
      costPrice: 420.00,
      stockQuantity: 12,
      lowStockThreshold: 3
    });

    const ps5Digital = await ProductVariation.create({
      productId: ps5.id,
      sku: 'PS5-NEW-DIGI-8812',
      color: 'White',
      storage: '825GB',
      edition: 'Digital Edition',
      platform: 'PS5',
      price: 399.99,
      costPrice: 340.00,
      stockQuantity: 2, // low stock alert trigger
      lowStockThreshold: 5
    });

    // Product 2: DualSense Controller (Sony Vendor Product)
    const controller = await Product.create({
      title: 'DualSense Wireless Controller',
      description: 'Discover a deeper, highly immersive gaming experience that brings the action to life in the palms of your hands.',
      condition: 'New',
      modelNumber: 'CFI-ZCT1W',
      categoryId: accessories.id,
      tags: ['Controller', 'DualSense', 'Sony', 'Accessories'],
      attributes: { platform: 'PS5' },
      isFeatured: true,
      status: 'Published',
      vendorId: sonyVendor.id
    });

    await ProductVariation.create({
      productId: controller.id,
      sku: 'DS5-NEW-WHT-9931',
      color: 'White',
      edition: 'Standard',
      platform: 'PS5',
      price: 69.99,
      costPrice: 45.00,
      stockQuantity: 25,
      lowStockThreshold: 5
    });

    await ProductVariation.create({
      productId: controller.id,
      sku: 'DS5-NEW-BLK-8822',
      color: 'Midnight Black',
      edition: 'Standard',
      platform: 'PS5',
      price: 74.99,
      costPrice: 48.00,
      stockQuantity: 15,
      lowStockThreshold: 5
    });

    // Product 3: retro games (Retro Vendor Product)
    const mario = await Product.create({
      title: 'Super Mario Bros (NES)',
      description: 'The classic NES side-scrolling platform video game.',
      condition: 'Used',
      modelNumber: 'NES-SM-USA',
      categoryId: games.id,
      tags: ['NES', 'Mario', 'Retro', 'Used'],
      attributes: { platform: 'NES' },
      status: 'Published',
      vendorId: retroVendor.id
    });

    await ProductVariation.create({
      productId: mario.id,
      sku: 'NES-USD-MARIO-1100',
      color: 'Standard Cartridge',
      edition: 'Original Release',
      platform: 'NES',
      price: 49.99,
      costPrice: 20.00,
      stockQuantity: 1, // trigger low stock alert
      lowStockThreshold: 2
    });

    console.log('-> Products and variations seeded');

    // 5. Seed Inventory Logs
    await InventoryMovement.create({
      variationId: ps5Disc.id,
      quantityChanged: 12,
      previousStock: 0,
      newStock: 12,
      type: 'Restock',
      notes: 'Initial seed stocking'
    });

    console.log('-> Inventory movements seeded');

    // 6. Seed System Pages
    await Page.create({
      title: 'Home Page',
      slug: 'home',
      content: '<h1>Welcome to Quickturn Gaming Shop</h1><p>Home of the best gaming products, accessories, custom 3D figure mods, and console repair service.</p>',
      status: 'Published',
      isSystemPage: true
    });

    await Page.create({
      title: 'About Us',
      slug: 'about-us',
      content: '<h1>About Quickturn</h1><p>We are a dedicated gaming store specializing in console repair, hardware upgrades, and custom collectibles.</p>',
      status: 'Published',
      isSystemPage: true
    });

    await Page.create({
      title: 'Custom 3D Figures',
      slug: 'custom-3d-figures',
      content: '<h1>Custom 3D Figure Printing & Design</h1><p>Send us your reference images or character models to print, paint, and ship a high-quality collectible model directly to your desk.</p>',
      status: 'Published',
      isSystemPage: true
    });

    console.log('-> CMS Pages seeded');

    // 7. Seed Website Settings
    await WebsiteSetting.create({
      key: 'homepage_banners',
      value: {
        hero: {
          title: 'Next Gen Gaming Starts Here',
          subtitle: 'Check out our newly restocked PlayStation 5 consoles and controllers.',
          buttonText: 'Shop PS5',
          imageUrl: 'https://images.unsplash.com/photo-1606813907291-d86efa9b94db?auto=format&fit=crop&w=1200&q=80'
        },
        promotion: {
          title: 'Flash Sale is Live!',
          subtitle: 'Get up to 20% off on all vintage cartridges and accessories.',
          endDate: '2026-07-04T00:00:00Z'
        }
      }
    });

    await WebsiteSetting.create({
      key: 'notification_bar',
      value: {
        text: '🚚 Free shipping on orders over $150! | Summer Sale Active Now!',
        color: '#E11D48',
        active: true
      }
    });

    await WebsiteSetting.create({
      key: 'chatbot_welcome_message',
      value: {
        text: 'Hello, welcome to Quickturn support! Ask me about console repairs, order status, or our return policies.'
      }
    });

    await WebsiteSetting.create({
      key: 'chatbot_business_hours',
      value: {
        display: 'Mon–Fri 9am–6pm, Sat 10am–4pm (PKT)',
        offlineMessage: "We're currently offline. Leave us a message and our team will respond during business hours.",
        schedule: {
          monday: { enabled: true, open: '09:00', close: '18:00' },
          tuesday: { enabled: true, open: '09:00', close: '18:00' },
          wednesday: { enabled: true, open: '09:00', close: '18:00' },
          thursday: { enabled: true, open: '09:00', close: '18:00' },
          friday: { enabled: true, open: '09:00', close: '18:00' },
          saturday: { enabled: true, open: '10:00', close: '16:00' },
          sunday: { enabled: false, open: '09:00', close: '18:00' },
        },
      },
    });

    console.log('-> Website setting variables seeded');

    // 8. Seed Discounts
    await Discount.create({
      name: 'Welcome Discount',
      code: 'WELCOME10',
      type: 'Percentage',
      value: 10.00,
      applyTo: 'All',
      minPurchaseAmount: 50.00,
      startDate: new Date(),
      endDate: new Date(new Date().setFullYear(new Date().getFullYear() + 1)),
      isActive: true
    });

    await Discount.create({
      name: 'Summer Accessories Sale',
      code: null, // Auto campaign applied to Category
      type: 'Percentage',
      value: 15.00,
      applyTo: 'Category',
      targetId: accessories.id,
      startDate: new Date(),
      endDate: new Date(new Date().setDate(new Date().getDate() + 15)),
      isActive: true
    });

    console.log('-> Discounts seeded');

    // 9. Seed Repair tickets
    await RepairRequest.create({
      customerName: 'Marcus Fenix',
      customerEmail: 'marcus@gmail.com',
      customerPhone: '+10987654321',
      description: 'PS5 Disc Drive doesn\'t read discs. Makes clicking noises upon insertion.',
      status: 'Pending',
      notes: 'Customer offered to ship the console on Monday. Needs diagnostic review.'
    });

    await RepairRequest.create({
      customerName: 'Samus Aran',
      customerEmail: 'samus@nintendo.com',
      customerPhone: '+19876543210',
      description: 'Nintendo Switch joystick drift on left blue joycon. Requires joystick replacement.',
      status: 'Completed',
      notes: 'Joystick replaced with brand new Hall-Effect sensor joystick. Completed and shipped back.'
    });

    // 10. Seed Sell / Valuation tickets
    await SellRequest.create({
      customerName: 'Geralt of Rivia',
      customerEmail: 'geralt@kaermorhen.org',
      customerPhone: '+14242424242',
      productName: 'Xbox One S 500GB Console',
      description: 'Very good condition console with minor scratches. Comes with HDMI cable, power cord, but no controllers.',
      status: 'Pending',
      notes: 'Valuation pending standard condition grading.'
    });

    // 11. Seed Chat Conversation transcripts
    await ChatConversation.create({
      customerSessionId: 'session_chat_98124',
      customerName: 'Link Hero',
      customerEmail: 'link@hyrule.org',
      messages: [
        { sender: 'customer', text: 'Hi, do you offer custom paint on controllers?', timestamp: new Date() },
        { sender: 'bot', text: 'Hello, welcome to Quickturn support! Ask me about console repairs, order status, or our return policies.', timestamp: new Date() },
        { sender: 'customer', text: 'I would like a custom green paint with gold triforce on a PS5 controller.', timestamp: new Date() },
        { sender: 'bot', text: 'Thanks for your message! Our team is reviewing this and will get back to you shortly.', timestamp: new Date() }
      ],
      status: 'Open'
    });

    console.log('-> Support & Services tickets seeded');
    console.log('--- Database Seeding Completed Successfully ---');

  } catch (error) {
    console.error('CRITICAL Error Seeding Database:', error);
  }
};

module.exports = seedDatabase;
