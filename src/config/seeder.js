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
  ChatConversation,
  SearchTerm
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

    // const staffUser = await User.create({
    //   name: 'Staff Clerk',
    //   email: 'staff@quickturn.com',
    //   password: 'staffpassword123',
    //   role: 'Staff',
    //   phoneNumber: '+1222333444',
    //   isActive: true
    // });

    // const vendorUser1 = await User.create({
    //   name: 'Sony Supplier',
    //   email: 'sony@supplier.com',
    //   password: 'vendorpassword123',
    //   role: 'Vendor',
    //   phoneNumber: '+1888777666',
    //   isActive: true
    // });

    const vendorUser2 = await User.create({
      name: 'Retro Gaming Inc',
      email: 'retro@supplier.com',
      password: 'vendorpassword123',
      role: 'Vendor',
      phoneNumber: '+1999888777',
      isActive: true
    });

    // const customerUser = await User.create({
    //   name: 'John Doe',
    //   email: 'customer@gmail.com',
    //   password: 'customerpassword123',
    //   role: 'Customer',
    //   phoneNumber: '+1555444333',
    //   isActive: true
    // });

    console.log('-> Users seeded');

    // 2. Seed Vendor Profiles
    // const sonyVendor = await VendorProfile.create({
    //   userId: vendorUser1.id,
    //   companyName: 'Sony Interactive Distribution',
    //   contactPerson: 'Alex Mercer',
    //   email: 'sony@supplier.com',
    //   phone: '+1888777666',
    //   address: '100 Playstation Way, California',
    //   balance: 1500.00,
    //   pendingPayments: 0.00,
    //   paidPayments: 4500.00,
    //   status: 'Active'
    // });

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
      aliases: ['PS5', 'PS5 Console', 'PlayStation 5', 'PS 5', 'PlayStation', 'Sony PS5'],
      keywords: ['next gen', 'sony', '4k', '8k', 'ray tracing', 'disc edition', 'digital edition', 'console', 'gaming', 'playstation'],
      attributes: { platform: 'PS5' },
      isFeatured: true,
      isBestSeller: true,
      status: 'Published'
    });

    const ps5Disc = await ProductVariation.create({
      productId: ps5.id,
      sku: 'PS5-NEW-DISC-825G-7731',
      color: 'Glacier White',
      storage: '825GB',
      edition: 'Disc Edition',
      platform: 'PS5',
      condition: 'New',
      bundle: 'Console Only',
      price: 499.99,
      costPrice: 420.00,
      stockQuantity: 12,
      lowStockThreshold: 3
    });

    const ps5Digital = await ProductVariation.create({
      productId: ps5.id,
      sku: 'PS5-NEW-DIGI-825G-8812',
      color: 'Glacier White',
      storage: '825GB',
      edition: 'Digital Edition',
      platform: 'PS5',
      condition: 'New',
      bundle: 'Console Only',
      price: 399.99,
      costPrice: 340.00,
      stockQuantity: 8,
      lowStockThreshold: 3
    });

    await ProductVariation.create({
      productId: ps5.id,
      sku: 'PS5-NEW-BLK-1TB-9921',
      color: 'Midnight Black',
      storage: '1TB',
      edition: 'Slim Edition',
      platform: 'PS5',
      condition: 'New',
      bundle: 'Console + Extra DualSense Controller',
      price: 569.99,
      costPrice: 470.00,
      stockQuantity: 6,
      lowStockThreshold: 2
    });

    await ProductVariation.create({
      productId: ps5.id,
      sku: 'PS5-USD-WHT-825G-3319',
      color: 'Glacier White',
      storage: '825GB',
      edition: 'Disc Edition',
      platform: 'PS5',
      condition: 'Used',
      bundle: 'Console Only',
      price: 389.99,
      costPrice: 300.00,
      stockQuantity: 3,
      lowStockThreshold: 2
    });

    // Product 2: DualSense Controller (Sony Vendor Product)
    const controller = await Product.create({
      title: 'DualSense Wireless Controller',
      description: 'Discover a deeper, highly immersive gaming experience that brings the action to life in the palms of your hands.',
      condition: 'New',
      modelNumber: 'CFI-ZCT1W',
      categoryId: accessories.id,
      tags: ['Controller', 'DualSense', 'Sony', 'Accessories'],
      aliases: ['DualSense', 'PS5 Controller', 'Dual Sense', 'PS5 Gamepad', 'Sony Controller', 'PS5 Pad'],
      keywords: ['haptic feedback', 'adaptive triggers', 'controller', 'gamepad', 'wireless', 'accessories', 'joystick', 'midnight black'],
      attributes: { platform: 'PS5' },
      isFeatured: true,
      status: 'Published',
      vendorId: sonyVendor.id
    });

    await ProductVariation.create({
      productId: controller.id,
      sku: 'DS5-NEW-WHT-9931',
      color: 'Glacier White',
      edition: 'Standard',
      platform: 'PS5',
      condition: 'New',
      bundle: 'Standard Pack',
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
      condition: 'New',
      bundle: 'Standard Pack',
      price: 74.99,
      costPrice: 48.00,
      stockQuantity: 15,
      lowStockThreshold: 5
    });

    await ProductVariation.create({
      productId: controller.id,
      sku: 'DS5-NEW-RED-7714',
      color: 'Cosmic Red',
      edition: 'Special Edition',
      platform: 'PS5',
      condition: 'New',
      bundle: 'Controller + Charging Dock Bundle',
      price: 89.99,
      costPrice: 58.00,
      stockQuantity: 10,
      lowStockThreshold: 3
    });

    // Product 3: retro games (Retro Vendor Product)
    const mario = await Product.create({
      title: 'Super Mario Bros (NES)',
      description: 'The classic NES side-scrolling platform video game.',
      condition: 'Used',
      modelNumber: 'NES-SM-USA',
      categoryId: games.id,
      tags: ['NES', 'Mario', 'Retro', 'Used'],
      aliases: ['Mario', 'SMB', 'Super Mario', 'NES Mario', 'Mario Bros', 'Retro Mario'],
      keywords: ['nintendo', 'nes', 'vintage', 'classic', 'platformer', 'retro', 'cartridge'],
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

    // Product 4: Red Dead Redemption (Admin Product)
    const rdr = await Product.create({
      title: 'Red Dead Redemption',
      description: 'Experience the epic Western adventures of outlaw John Marston as he journeys across the sprawling expanses of the American West and Mexico.',
      condition: 'New',
      modelNumber: 'PS5-RDR-STD-2024',
      categoryId: games.id,
      tags: ['RDR', 'Rockstar', 'Western', 'Open World', 'Action'],
      aliases: ['RDR', 'RDR1', 'Red Dead', 'Red Dead 1', 'RDR 1', 'John Marston'],
      keywords: ['rockstar', 'wild west', 'cowboy', 'outlaw', 'open world', 'western', 'horses', 'gunslinger', 'undead nightmare'],
      attributes: { platform: 'PS5' },
      isFeatured: true,
      isBestSeller: true,
      status: 'Published'
    });

    await ProductVariation.create({
      productId: rdr.id,
      sku: 'PS5-RDR-STD-7711',
      color: 'Standard Case',
      edition: 'Standard Edition',
      platform: 'PS5',
      price: 49.99,
      costPrice: 32.00,
      stockQuantity: 18,
      lowStockThreshold: 4
    });

    // Product 5: Grand Theft Auto V
    const gta5 = await Product.create({
      title: 'Grand Theft Auto V',
      description: 'When a young street hustler, a retired bank robber and a terrifying psychopath find themselves entangled with some of the most frightening and deranged elements of the criminal underworld.',
      condition: 'New',
      modelNumber: 'PS5-GTAV-STD-2023',
      categoryId: games.id,
      tags: ['GTA V', 'GTA 5', 'Rockstar', 'Open World', 'Crime'],
      aliases: ['GTA V', 'GTA 5', 'Grand Theft Auto 5', 'GTA5', 'GTAV', 'Los Santos', 'Grand Theft Auto'],
      keywords: ['rockstar', 'heist', 'open world', 'crime', 'michael', 'franklin', 'trevor', 'cars', 'online', 'multiplayer', 'los santos'],
      attributes: { platform: 'PS5' },
      isFeatured: true,
      isBestSeller: true,
      status: 'Published'
    });

    await ProductVariation.create({
      productId: gta5.id,
      sku: 'PS5-GTAV-STD-9901',
      color: 'Standard Case',
      edition: 'Premium Edition',
      platform: 'PS5',
      price: 29.99,
      costPrice: 18.00,
      stockQuantity: 30,
      lowStockThreshold: 5
    });

    // Product 6: Call of Duty: Black Ops 6
    const cod = await Product.create({
      title: 'Call of Duty: Black Ops 6',
      description: 'Developed by Treyarch and Raven Software, Black Ops 6 is a spy action thriller set in the early 90s, a period of transition in global politics.',
      condition: 'New',
      modelNumber: 'PS5-CODBO6-STD-2024',
      categoryId: games.id,
      tags: ['COD', 'Black Ops', 'FPS', 'Multiplayer', 'Zombies'],
      aliases: ['COD BO6', 'Call of Duty', 'BO6', 'COD', 'Black Ops 6', 'Black Ops', 'Call of Duty BO6', 'COD 6'],
      keywords: ['fps', 'first person shooter', 'treyarch', 'activision', 'zombies', 'warzone', 'multiplayer', 'campaign', 'omnimovement'],
      attributes: { platform: 'PS5' },
      isFeatured: true,
      isBestSeller: true,
      status: 'Published'
    });

    await ProductVariation.create({
      productId: cod.id,
      sku: 'PS5-CODBO6-STD-8841',
      color: 'Standard Case',
      edition: 'Cross-Gen Bundle',
      platform: 'PS5',
      price: 69.99,
      costPrice: 45.00,
      stockQuantity: 22,
      lowStockThreshold: 5
    });

    // Product 7: Xbox Series X Console
    const xbox = await Product.create({
      title: 'Xbox Series X Console',
      description: 'The fastest, most powerful Xbox ever. Play thousands of titles from four generations of consoles-all games look and play best on Xbox Series X.',
      condition: 'New',
      modelNumber: 'XBOX-SX-1TB-2024',
      categoryId: consoles.id,
      tags: ['Xbox', 'XSX', 'Console', 'Microsoft', '4K'],
      aliases: ['XSX', 'Xbox X', 'Series X', 'Xbox Series X', 'Microsoft Xbox', 'Xbox Series'],
      keywords: ['microsoft', 'xbox', 'next gen', '4k 120fps', 'game pass', 'velocity architecture', 'console', '1tb ssd', 'black'],
      attributes: { platform: 'Xbox Series X' },
      isFeatured: true,
      isBestSeller: true,
      status: 'Published'
    });

    await ProductVariation.create({
      productId: xbox.id,
      sku: 'XSX-1TB-BLK-1001',
      color: 'Matte Black',
      storage: '1TB',
      edition: 'Standard Edition',
      platform: 'Xbox Series X',
      price: 499.99,
      costPrice: 430.00,
      stockQuantity: 10,
      lowStockThreshold: 2
    });

    console.log('-> Products and variations seeded with aliases & keywords');

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
        text: '🚚 Free shipping on orders over Rs 150! | Summer Sale Active Now!',
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

    await WebsiteSetting.create({
      key: 'terms_and_conditions',
      value: {
        title: 'Terms & Conditions',
        subtitle: 'Please review the policies governing purchases, console repairs, trade-ins, and services at Quickturn.',
        lastUpdated: 'August 2026',
        bannerBadge: 'Quickturn Gaming Policies',
        sections: [
          {
            id: 'acceptance',
            heading: '1. Acceptance of Agreement',
            content: 'By accessing our website, browsing products, submitting orders, or requesting console repair and trade-in services, you agree to comply with and be bound by these Terms and Conditions along with our privacy policies.'
          },
          {
            id: 'orders_payments',
            heading: '2. Orders, Pricing & Payment Methods',
            content: 'All product prices are quoted in PKR (Pakistani Rupee) and are subject to change without prior notice. We accept Cash on Delivery (COD) and direct Bank Transfers. Orders are subject to item availability and confirmation. Quickturn reserves the right to decline or cancel orders due to pricing errors or inventory discrepancies.'
          },
          {
            id: 'shipping_delivery',
            heading: '3. Shipping, Delivery & Tracking',
            content: 'We provide nationwide delivery across Pakistan through reliable courier services. Orders are typically processed and delivered within 2-4 business days. Real-time tracking information is communicated once the consignment is dispatched. Customers must inspect packages upon arrival and notify us immediately of any transit damage.'
          },
          {
            id: 'repair_services',
            heading: '4. Console Repair & Diagnostic Services',
            content: 'Consoles and accessories submitted for repair undergo preliminary diagnostics. Pre-existing issues, prior unauthorized repairs, or liquid damage must be disclosed beforehand. We offer a 30-day service warranty on components replaced during repair. Damages caused by electrical surges, misuse, or tampering after repair are excluded from warranty.'
          },
          {
            id: 'sell_tradein',
            heading: '5. Sell & Trade-in Policy',
            content: 'Valuations provided through our online estimation form are provisional. The final trade-in value or cash payout is confirmed after technical inspection and grading at our facility. All trade-in devices must belong to the seller and must not be blacklisted, iCloud-locked, or reported lost/stolen.'
          },
          {
            id: 'warranty_returns',
            heading: '6. Warranty, Replacements & Returns',
            content: 'Brand new hardware items include standard official warranty coverage or a 7-day initial replacement warranty for manufacturing defects. Pre-owned items include a 7-day checking warranty. Items must be returned in their original packaging with all included accessories. Physical damage or water intrusion voids warranty.'
          },
          {
            id: 'custom_3d',
            heading: '7. Custom 3D Figures & Bespoke Mods',
            content: 'Custom 3D figures and personalized modding requests are built to individual specifications. Production begins following order confirmation and upfront deposit. Because these are custom-made items, orders cannot be cancelled or refunded once production has begun.'
          },
          {
            id: 'liability',
            heading: '8. Limitation of Liability',
            content: 'Quickturn shall not be held liable for indirect, incidental, or consequential damages resulting from product misuse, ungrounded household power issues, or third-party courier delays.'
          }
        ],
        contactEmail: 'info@quickturn.pk',
        contactPhone: '+92 300 1234567',
        contactAddress: 'Karachi, Sindh, Pakistan'
      }
    });

    console.log('-> Website setting variables seeded');

    // 8. Seed Discounts
    await Discount.create({
      name: 'Welcome Discount',
      code: 'WELCOME10',
      type: 'Percentage',
      value: 10.00,
      applyTo: 'All',
      minPurchaseAmount: 0.00,
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

    // 12. Seed Popular Search Terms
    const seedSearchTerms = [
      { term: 'ps5', searchCount: 230, resultsCount: 4, isPinned: true },
      { term: 'playstation 5', searchCount: 184, resultsCount: 4, isPinned: true },
      { term: 'gta 5', searchCount: 165, resultsCount: 2, isPinned: true },
      { term: 'rdr', searchCount: 142, resultsCount: 1, isPinned: true },
      { term: 'cod bo6', searchCount: 128, resultsCount: 1, isPinned: true },
      { term: 'dualsense', searchCount: 95, resultsCount: 2, isPinned: true },
      { term: 'black myth wukong', searchCount: 110, resultsCount: 1, isPinned: true },
      { term: 'spider-man 2', searchCount: 88, resultsCount: 1, isPinned: false },
      { term: 'xbox series x', searchCount: 65, resultsCount: 1, isPinned: false },
    ];

    for (const st of seedSearchTerms) {
      await SearchTerm.create(st);
    }

    console.log('-> Search terms seeded');
    console.log('--- Database Seeding Completed Successfully ---');

  } catch (error) {
    console.error('CRITICAL Error Seeding Database:', error);
  }
};

module.exports = seedDatabase;
