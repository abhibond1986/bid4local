import 'dotenv/config';
import { db } from "@/db";
import { users, categories, items, bids, notifications, payments, watchlist, auditLogs } from "@/db/schema";
import bcrypt from "bcryptjs";

async function seed() {
  console.log("🌱 Seeding database...");
  const passwordHash = await bcrypt.hash('password123', 10);

  const adminUser = { id: 'admin-1', name: 'Admin User', email: 'admin@bidlocal.com', role: 'superadmin', verified: 'verified', phone: '+91-99999-00001', city: 'Mumbai', state: 'MH', password: passwordHash, bio: 'Super administrator with full platform control.' };
  const seller1 = { id: 'seller-1', name: 'Sarah Mitchell', email: 'sarah@company.com', role: 'seller', verified: 'verified', phone: '+91-98765-00001', organization: 'Mitchell Enterprises', city: 'Delhi', state: 'DL', password: passwordHash, bio: 'Corporate seller dealing in electronics and furniture.' };
  const seller2 = { id: 'seller-2', name: 'Mike Rodriguez', email: 'mike@company.com', role: 'seller', verified: 'verified', phone: '+91-98765-00002', organization: 'Rodriguez Industrial', city: 'Bengaluru', state: 'KA', password: passwordHash, bio: 'Industrial equipment and scrap supplier.' };
  const bidder1 = { id: 'bidder-1', name: 'John Chen', email: 'john@gmail.com', role: 'bidder', verified: 'verified', phone: '+91-98765-00003', city: 'Pune', state: 'MH', password: passwordHash, bio: 'Avid collector of vintage electronics.' };
  const bidder2 = { id: 'bidder-2', name: 'Emma Wilson', email: 'emma@gmail.com', role: 'bidder', verified: 'verified', phone: '+91-98765-00004', city: 'Jaipur', state: 'RJ', password: passwordHash, bio: 'Small business owner looking for office equipment.' };
  const bidder3 = { id: 'bidder-3', name: 'Alex Thompson', email: 'alex@gmail.com', role: 'bidder', verified: 'pending', phone: '+91-98765-00005', city: 'Kolkata', state: 'WB', password: passwordHash, bio: 'New bidder interested in vehicles.' };
  const manager = { id: 'manager-1', name: 'Priya Sharma', email: 'priya@bidlocal.com', role: 'manager', verified: 'verified', phone: '+91-99999-00002', city: 'Hyderabad', state: 'TS', password: passwordHash, bio: 'Auction manager and operations lead.' };

  await db.insert(users).values([adminUser, seller1, seller2, bidder1, bidder2, bidder3, manager]).onConflictDoNothing();

  const cats = [
    { id: 1, name: 'Electronics', slug: 'electronics', icon: 'Monitor', description: 'Computers, laptops, phones, and other electronic devices' },
    { id: 2, name: 'Vehicles', slug: 'vehicles', icon: 'Car', description: 'Cars, trucks, motorcycles, and other vehicles' },
    { id: 3, name: 'Machinery', slug: 'machinery', icon: 'Cog', description: 'Industrial machinery, CNC machines, and equipment' },
    { id: 4, name: 'Furniture', slug: 'furniture', icon: 'Armchair', description: 'Office and home furniture' },
    { id: 5, name: 'Industrial Equipment', slug: 'industrial-equipment', icon: 'Factory', description: 'Factory surplus, tools, and industrial equipment' },
    { id: 6, name: 'Scrap & Surplus', slug: 'scrap-surplus', icon: 'Recycle', description: 'Scrap material, surplus inventory, and recyclables' },
  ];
  await db.insert(categories).values(cats).onConflictDoNothing();

  const now = Date.now();
  const HOUR = 3600000;
  const DAY = 86400000;

  const demoImages: Record<number, string[]> = {
    1: [
      'https://images.pexels.com/photos/1092652/pexels-photo-1092652.jpeg?auto=compress&cs=tinysrgb&fit=crop&h=627&w=1200',
      'https://images.pexels.com/photos/1266982/pexels-photo-1266982.jpeg?auto=compress&cs=tinysrgb&fit=crop&h=627&w=1200',
      'https://images.pexels.com/photos/1143966/pexels-photo-1143966.jpeg?auto=compress&cs=tinysrgb&fit=crop&h=627&w=1200',
    ],
    2: [
      'https://images.pexels.com/photos/14120866/pexels-photo-14120866.jpeg?auto=compress&cs=tinysrgb&fit=crop&h=627&w=1200',
      'https://images.pexels.com/photos/14310918/pexels-photo-14310918.jpeg?auto=compress&cs=tinysrgb&fit=crop&h=627&w=1200',
      'https://images.pexels.com/photos/11101564/pexels-photo-11101564.jpeg?auto=compress&cs=tinysrgb&fit=crop&h=627&w=1200',
    ],
    3: [
      'https://images.pexels.com/photos/28990583/pexels-photo-28990583.jpeg?auto=compress&cs=tinysrgb&fit=crop&h=627&w=1200',
      'https://images.pexels.com/photos/36211585/pexels-photo-36211585.jpeg?auto=compress&cs=tinysrgb&fit=crop&h=627&w=1200',
      'https://images.pexels.com/photos/29226694/pexels-photo-29226694.jpeg?auto=compress&cs=tinysrgb&fit=crop&h=627&w=1200',
    ],
  };

  const auctionItems = [
    { id: 1, title: 'Dell Latitude 5520 Laptop', description: 'Dell Latitude 5520 in excellent condition. Intel Core i7, 16GB RAM, 512GB SSD. Includes charger and carrying case. Used for 18 months in a corporate environment. Full inspection report available.', categoryId: 1, originalPrice: 1299 * 80, startingBid: 200 * 80, currentBid: 425 * 80, reservePrice: 500 * 80, bidIncrement: 25 * 80, condition: 'good', brand: 'Dell', model: 'Latitude 5520', year: 2022, location: 'Corporate Office - Downtown', city: 'Delhi', state: 'DL', quantity: 1, status: 'active', sellerId: 'seller-1', startTime: new Date(now - 2 * HOUR), endTime: new Date(now + 22 * HOUR), views: 342, bidCount: 8, featured: 1 },
    { id: 2, title: '2019 Honda Civic Sedan EX', description: '2019 Honda Civic EX in silver. 42,000 km, automatic transmission, 1.5L turbo engine. Clean title, no accidents. Features include Honda Sensing suite, Apple CarPlay, and Android Auto. Recent oil change and new tires.', categoryId: 2, originalPrice: 24500 * 80, startingBid: 5000 * 80, currentBid: 8750 * 80, reservePrice: 12000 * 80, bidIncrement: 250 * 80, condition: 'good', brand: 'Honda', model: 'Civic EX', year: 2019, location: 'Main Dealership Lot', city: 'Bengaluru', state: 'KA', quantity: 1, status: 'active', sellerId: 'seller-2', startTime: new Date(now - 4 * HOUR), endTime: new Date(now + 44 * HOUR), views: 891, bidCount: 12, featured: 1 },
    { id: 3, title: 'Industrial Drill Press - Clausing 2286', description: 'Clausing 2286 20-inch drill press in working condition. 3HP motor, variable speed. Removed from active manufacturing floor during facility upgrade.', categoryId: 3, originalPrice: 8500 * 80, startingBid: 1000 * 80, currentBid: 1350 * 80, reservePrice: 3000 * 80, bidIncrement: 100 * 80, condition: 'fair', brand: 'Clausing', model: '2286', year: 2015, location: 'Factory Warehouse B', city: 'Bengaluru', state: 'KA', quantity: 1, status: 'active', sellerId: 'seller-2', startTime: new Date(now - 1 * HOUR), endTime: new Date(now + 71 * HOUR), views: 156, bidCount: 4 },
    { id: 4, title: 'Executive Office Desk Set (6 Units)', description: 'Set of 6 premium executive L-shaped desks with built-in cable management. Mahogany finish, metal frame.', categoryId: 4, originalPrice: 4800 * 80, startingBid: 500 * 80, currentBid: 750 * 80, reservePrice: 1500 * 80, bidIncrement: 50 * 80, condition: 'good', brand: 'Herman Miller', model: 'L-Shape Executive', year: 2020, location: 'Corporate HQ - Floor 12', city: 'Delhi', state: 'DL', quantity: 6, status: 'active', sellerId: 'seller-1', startTime: new Date(now - 3 * HOUR), endTime: new Date(now + 93 * HOUR), views: 89, bidCount: 3 },
    { id: 5, title: 'Samsung 55" QLED Smart TV (4K)', description: 'Samsung QN55Q80A 55-inch QLED 4K Smart TV. Includes original remote, power cable, and wall mount bracket.', categoryId: 1, originalPrice: 1100 * 80, startingBid: 150 * 80, currentBid: 150 * 80, reservePrice: 400 * 80, bidIncrement: 25 * 80, condition: 'like_new', brand: 'Samsung', model: 'QN55Q80A', year: 2022, location: 'Executive Lounge', city: 'Delhi', state: 'DL', quantity: 1, status: 'scheduled', sellerId: 'seller-1', startTime: new Date(now + 24 * HOUR), endTime: new Date(now + 96 * HOUR), views: 234, bidCount: 0 },
    { id: 6, title: '2017 Toyota Tacoma SR5 Access Cab', description: '2017 Toyota Tacoma SR5 Access Cab 4x4. V6 3.5L engine, 78,000 km. Tow package, bed liner.', categoryId: 2, originalPrice: 32000 * 80, startingBid: 8000 * 80, currentBid: 15000 * 80, reservePrice: 18000 * 80, bidIncrement: 500 * 80, condition: 'good', brand: 'Toyota', model: 'Tacoma SR5', year: 2017, location: 'Fleet Yard - Bay 3', city: 'Bengaluru', state: 'KA', quantity: 1, status: 'active', sellerId: 'seller-2', startTime: new Date(now - 6 * HOUR), endTime: new Date(now + 18 * HOUR), views: 1247, bidCount: 15, featured: 1 },
    { id: 7, title: 'Stainless Steel Scrap Lot (2.5 Tons)', description: 'Approximately 2.5 tons of 304 stainless steel scrap. Mix of sheet offcuts, pipe remnants.', categoryId: 6, originalPrice: 7500 * 80, startingBid: 2000 * 80, currentBid: 2800 * 80, reservePrice: 3500 * 80, bidIncrement: 100 * 80, condition: 'scrap', location: 'Scrap Yard - Section C', city: 'Bengaluru', state: 'KA', quantity: 1, status: 'active', sellerId: 'seller-2', startTime: new Date(now - 8 * HOUR), endTime: new Date(now + 40 * HOUR), views: 67, bidCount: 5 },
    { id: 8, title: 'HP LaserJet Pro M404dn Printer', description: 'HP LaserJet Pro M404dn monochrome laser printer. Dual-sided printing, 40 PPM.', categoryId: 1, originalPrice: 450 * 80, startingBid: 50 * 80, currentBid: 125 * 80, reservePrice: 100 * 80, bidIncrement: 10 * 80, condition: 'good', brand: 'HP', model: 'LaserJet Pro M404dn', year: 2021, location: 'Branch Office - Room 204', city: 'Delhi', state: 'DL', quantity: 1, status: 'ended', sellerId: 'seller-1', startTime: new Date(now - 48 * HOUR), endTime: new Date(now - 2 * HOUR), views: 198, bidCount: 6, winnerId: 'bidder-1' },
    { id: 9, title: 'Mahogany Conference Table (12-seater)', description: 'Premium 12-seat conference table in dark mahogany. 144 inches long with integrated power and data ports.', categoryId: 4, originalPrice: 6000 * 80, startingBid: 800 * 80, currentBid: 800 * 80, reservePrice: 2500 * 80, bidIncrement: 100 * 80, condition: 'fair', brand: 'Custom', year: 2018, location: 'Corporate HQ - Board Room', city: 'Delhi', state: 'DL', quantity: 1, status: 'ended', sellerId: 'seller-1', startTime: new Date(now - 72 * HOUR), endTime: new Date(now - 24 * HOUR), views: 45, bidCount: 0 },
    { id: 10, title: 'CNC Router Machine - ShopBot PRSalpha', description: 'ShopBot PRSalpha CNC Router with 96x48 cutting area. Includes dust collection system.', categoryId: 5, originalPrice: 28000 * 80, startingBid: 5000 * 80, currentBid: 5000 * 80, reservePrice: 15000 * 80, bidIncrement: 500 * 80, condition: 'good', brand: 'ShopBot', model: 'PRSalpha', year: 2019, location: 'Workshop Building 2', city: 'Bengaluru', state: 'KA', quantity: 1, status: 'draft', sellerId: 'seller-2', startTime: null, endTime: new Date(now + 7 * DAY), views: 0, bidCount: 0 },
  ];

  for (const item of auctionItems) {
    const imgs = demoImages[item.id] || [];
    await db.insert(items).values({
      ...item,
      imageUrl: imgs[0] || null,
      images: imgs.length ? JSON.stringify(imgs) : null,
    }).onConflictDoNothing();
  }

  const sampleBids = [
    { itemId: 1, userId: 'bidder-1', amount: 200 * 80 }, { itemId: 1, userId: 'bidder-2', amount: 250 * 80 },
    { itemId: 1, userId: 'bidder-1', amount: 300 * 80 }, { itemId: 1, userId: 'bidder-3', amount: 325 * 80 },
    { itemId: 1, userId: 'bidder-2', amount: 375 * 80 }, { itemId: 1, userId: 'bidder-1', amount: 400 * 80 },
    { itemId: 1, userId: 'bidder-3', amount: 425 * 80, isAutoBid: 1 }, { itemId: 1, userId: 'bidder-2', amount: 425 * 80 },
    { itemId: 2, userId: 'bidder-1', amount: 5000 * 80 }, { itemId: 2, userId: 'bidder-3', amount: 6000 * 80 },
    { itemId: 2, userId: 'bidder-2', amount: 7000 * 80 }, { itemId: 2, userId: 'bidder-1', amount: 7500 * 80 },
    { itemId: 2, userId: 'bidder-3', amount: 8000 * 80, isAutoBid: 1 }, { itemId: 2, userId: 'bidder-1', amount: 8250 * 80 },
    { itemId: 2, userId: 'bidder-2', amount: 8500 * 80 }, { itemId: 2, userId: 'bidder-1', amount: 8750 * 80 },
    { itemId: 6, userId: 'bidder-1', amount: 8000 * 80 }, { itemId: 6, userId: 'bidder-2', amount: 10000 * 80 },
    { itemId: 6, userId: 'bidder-3', amount: 12000 * 80 }, { itemId: 6, userId: 'bidder-1', amount: 13000 * 80 },
    { itemId: 6, userId: 'bidder-2', amount: 14000 * 80 }, { itemId: 6, userId: 'bidder-1', amount: 15000 * 80 },
    { itemId: 3, userId: 'bidder-1', amount: 1000 * 80 }, { itemId: 3, userId: 'bidder-2', amount: 1100 * 80 },
    { itemId: 3, userId: 'bidder-1', amount: 1200 * 80 }, { itemId: 3, userId: 'bidder-3', amount: 1350 * 80 },
    { itemId: 4, userId: 'bidder-2', amount: 500 * 80 }, { itemId: 4, userId: 'bidder-1', amount: 600 * 80 },
    { itemId: 4, userId: 'bidder-2', amount: 750 * 80 },
    { itemId: 7, userId: 'bidder-3', amount: 2000 * 80 }, { itemId: 7, userId: 'bidder-1', amount: 2200 * 80 },
    { itemId: 7, userId: 'bidder-3', amount: 2500 * 80 }, { itemId: 7, userId: 'bidder-2', amount: 2700 * 80 },
    { itemId: 7, userId: 'bidder-3', amount: 2800 * 80, isAutoBid: 1 },
    { itemId: 8, userId: 'bidder-2', amount: 50 * 80 }, { itemId: 8, userId: 'bidder-1', amount: 75 * 80 },
    { itemId: 8, userId: 'bidder-3', amount: 90 * 80 }, { itemId: 8, userId: 'bidder-2', amount: 100 * 80 },
    { itemId: 8, userId: 'bidder-1', amount: 110 * 80 }, { itemId: 8, userId: 'bidder-1', amount: 125 * 80 },
  ];
  await db.insert(bids).values(sampleBids).onConflictDoNothing();

  const sampleNotifications = [
    { userId: 'bidder-1', type: 'outbid', title: "You've been outbid!", message: 'Someone placed a higher bid on "2019 Honda Civic Sedan EX"', link: '/items/2', read: 0 },
    { userId: 'bidder-1', type: 'bid', title: 'Bid Confirmed', message: 'Your bid of ₹7,00,000 on "2019 Honda Civic Sedan EX" was confirmed', link: '/items/2', read: 1 },
    { userId: 'bidder-1', type: 'won', title: 'Auction Won! 🎉', message: 'You won the auction for "HP LaserJet Pro M404dn Printer" at ₹10,000', link: '/items/8', read: 0 },
    { userId: 'bidder-2', type: 'outbid', title: "You've been outbid!", message: 'Someone placed a higher bid on "Dell Latitude 5520 Laptop"', link: '/items/1', read: 0 },
    { userId: 'bidder-2', type: 'system', title: 'Welcome to Bid 4 Local', message: 'Your account has been verified. You can now start bidding!', link: '/items', read: 1 },
    { userId: 'seller-1', type: 'auction_end', title: 'Auction Ended', message: 'Your auction "HP LaserJet Pro M404dn Printer" has ended with a winning bid of ₹10,000', link: '/my-auctions', read: 1 },
    { userId: 'seller-1', type: 'bid', title: 'New Bid Received', message: 'A new bid of ₹60,000 was placed on "Executive Office Desk Set (6 Units)"', link: '/items/4', read: 0 },
    { userId: 'admin-1', type: 'system', title: 'New Registration', message: 'Alex Thompson has registered and is pending verification', link: '/admin/users', read: 0 },
    { userId: 'bidder-3', type: 'payment', title: 'Payment Reminder', message: 'Complete your payment for the won auction to avoid penalties', link: '/my-bids', read: 0 },
  ];
  await db.insert(notifications).values(sampleNotifications).onConflictDoNothing();

  const samplePayments = [
    { itemId: 8, userId: 'bidder-1', amount: 125 * 80, type: 'full_payment', status: 'completed', method: 'upi', transactionId: 'TXN-001-AUCTION8' },
    { itemId: 1, userId: 'bidder-1', amount: 50 * 80, type: 'emd', status: 'completed', method: 'credit_card', transactionId: 'TXN-002-EMD1' },
    { itemId: 2, userId: 'bidder-3', amount: 100 * 80, type: 'emd', status: 'completed', method: 'net_banking', transactionId: 'TXN-003-EMD2' },
    { itemId: 6, userId: 'bidder-1', amount: 100 * 80, type: 'emd', status: 'completed', method: 'debit_card', transactionId: 'TXN-004-EMD6' },
  ];
  await db.insert(payments).values(samplePayments).onConflictDoNothing();

  const sampleWatchlist = [
    { userId: 'bidder-1', itemId: 2 }, { userId: 'bidder-1', itemId: 6 },
    { userId: 'bidder-2', itemId: 1 }, { userId: 'bidder-2', itemId: 3 },
    { userId: 'bidder-3', itemId: 5 },
  ];
  await db.insert(watchlist).values(sampleWatchlist).onConflictDoNothing();

  const sampleLogs = [
    { userId: 'admin-1', action: 'CREATE', entity: 'category', entityId: '1', details: 'Created Electronics category' },
    { userId: 'seller-1', action: 'CREATE', entity: 'item', entityId: '1', details: 'Created auction: Dell Latitude 5520 Laptop' },
    { userId: 'seller-2', action: 'CREATE', entity: 'item', entityId: '2', details: 'Created auction: 2019 Honda Civic Sedan EX' },
    { userId: 'bidder-1', action: 'BID', entity: 'item', entityId: '1', details: 'Placed bid of ₹16,000 on Dell Latitude 5520 Laptop' },
    { userId: 'admin-1', action: 'UPDATE', entity: 'user', entityId: 'bidder-3', details: 'User registration pending verification' },
  ];
  await db.insert(auditLogs).values(sampleLogs).onConflictDoNothing();

  console.log("✅ Seeding complete!");
  process.exit(0);
}

seed().catch((e) => { console.error(e); process.exit(1); });
