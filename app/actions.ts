'use server';

import { db } from "@/db";
import { bids, items, notifications, watchlist, categories, users, autoBids, auditLogs, payments } from "@/db/schema";
import { eq, and, desc, asc, sql, ne } from "drizzle-orm";
import { auth } from "@/auth";
import { revalidatePath } from "next/cache";
import { formatINR } from "@/lib/format";

const MAX_PRODUCT_IMAGES = 8;
const MAX_IMAGE_BYTES = 2 * 1024 * 1024;
const ALLOWED_IMAGE_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp']);

async function readProductImages(formData: FormData, existingImages: string[] = []) {
  const files = formData.getAll('images').filter((entry): entry is File => entry instanceof File && entry.size > 0);
  if (files.length + existingImages.length > MAX_PRODUCT_IMAGES) {
    throw new Error(`You can upload up to ${MAX_PRODUCT_IMAGES} product photos`);
  }

  const uploaded: string[] = [];
  for (const file of files) {
    if (!ALLOWED_IMAGE_TYPES.has(file.type)) throw new Error('Only JPG, PNG, and WebP photos are supported');
    if (file.size > MAX_IMAGE_BYTES) throw new Error('Each product photo must be 2 MB or smaller');
    const encoded = Buffer.from(await file.arrayBuffer()).toString('base64');
    uploaded.push(`data:${file.type};base64,${encoded}`);
  }
  return [...existingImages, ...uploaded];
}

// ─── Bid Actions ──────────────────────────────────────────────
export async function placeBid(itemId: number, amount: number) {
  const session = await auth();
  if (!session?.user?.id) throw new Error("You must be signed in to bid");

  const item = await db.select().from(items).where(eq(items.id, itemId)).then(res => res[0]);
  if (!item) throw new Error("Item not found");
  if (item.status !== 'active') throw new Error("Auction is not active");
  if (new Date(item.endTime) < new Date()) throw new Error("Auction has ended");
  if (amount <= item.currentBid) throw new Error(`Bid must be higher than current bid (${formatINR(item.currentBid)})`);
  if (item.sellerId === session.user.id) throw new Error("You cannot bid on your own auction");

  const minBid = item.currentBid + (item.bidIncrement || 100);
  if (amount < minBid) throw new Error(`Minimum bid is ${formatINR(minBid)}`);

  // Place the bid
  await db.insert(bids).values({ itemId, userId: session.user.id, amount });

  // Update item
  await db.update(items).set({
    currentBid: amount,
    bidCount: (item.bidCount || 0) + 1,
    updatedAt: new Date(),
  }).where(eq(items.id, itemId));

  // Notify previous highest bidder they've been outbid
  const previousBids = await db.select().from(bids).where(eq(bids.itemId, itemId)).orderBy(desc(bids.amount)).limit(2);
  if (previousBids.length > 1 && previousBids[1].userId !== session.user.id) {
    await db.insert(notifications).values({
      userId: previousBids[1].userId,
      type: 'outbid',
      title: "You've been outbid!",
      message: `Someone placed a higher bid of ${formatINR(amount)} on "${item.title}"`,
      link: `/items/${itemId}`,
    });
  }

  // Process auto-bids
  const activeAutoBids = await db.select().from(autoBids).where(
    and(eq(autoBids.itemId, itemId), eq(autoBids.isActive, 1), ne(autoBids.userId, session.user.id))
  );

  for (const autoBid of activeAutoBids) {
    const newAutoBidAmount = amount + (item.bidIncrement || 100);
    if (newAutoBidAmount <= autoBid.maxAmount) {
      await db.insert(bids).values({ itemId, userId: autoBid.userId, amount: newAutoBidAmount, isAutoBid: 1 });
      await db.update(items).set({
        currentBid: newAutoBidAmount,
        bidCount: (item.bidCount || 0) + 2,
        updatedAt: new Date(),
      }).where(eq(items.id, itemId));

      await db.insert(notifications).values({
        userId: session.user.id,
        type: 'outbid',
        title: "You've been outbid by auto-bid!",
        message: `An auto-bid placed ${formatINR(newAutoBidAmount)} on "${item.title}"`,
        link: `/items/${itemId}`,
      });
      break;
    } else {
      await db.update(autoBids).set({ isActive: 0 }).where(eq(autoBids.id, autoBid.id));
      await db.insert(notifications).values({
        userId: autoBid.userId,
        type: 'system',
        title: "Auto-bid maximum reached",
        message: `Your auto-bid maximum of ${formatINR(autoBid.maxAmount)} was reached for "${item.title}"`,
        link: `/items/${itemId}`,
      });
    }
  }

  // Audit log
  await db.insert(auditLogs).values({
    userId: session.user.id, action: 'BID', entity: 'item', entityId: String(itemId),
    details: `Placed bid of ${formatINR(amount)} on ${item.title}`,
  });

  revalidatePath(`/items/${itemId}`);
  revalidatePath('/');
  revalidatePath('/items');
  revalidatePath('/my-bids');
}

export async function setAutoBid(itemId: number, maxAmount: number, strategy: string = 'minimum') {
  const session = await auth();
  if (!session?.user?.id) throw new Error("You must be signed in");

  const item = await db.select().from(items).where(eq(items.id, itemId)).then(res => res[0]);
  if (!item) throw new Error("Item not found");
  if (maxAmount <= item.currentBid) throw new Error("Maximum must be higher than current bid");

  await db.insert(autoBids).values({
    itemId, userId: session.user.id, maxAmount, incrementStrategy: strategy, isActive: 1,
  }).onConflictDoNothing();

  await db.insert(notifications).values({
    userId: session.user.id, type: 'system', title: 'Auto-bid activated',
    message: `Auto-bid set up to ${formatINR(maxAmount)} for "${item.title}"`,
    link: `/items/${itemId}`,
  });

  revalidatePath(`/items/${itemId}`);
}

// ─── Item Actions ─────────────────────────────────────────────
export async function createItem(formData: FormData) {
  const session = await auth();
  if (!session?.user?.id) throw new Error("You must be signed in");

  const title = formData.get('title') as string;
  const description = formData.get('description') as string;
  const categoryId = parseInt(formData.get('categoryId') as string) || null;
  const originalPrice = parseInt(formData.get('originalPrice') as string);
  const startingBid = parseInt(formData.get('startingBid') as string);
  const reservePrice = parseInt(formData.get('reservePrice') as string) || null;
  const bidIncrement = parseInt(formData.get('bidIncrement') as string) || 100;
  const condition = formData.get('condition') as string;
  const brand = formData.get('brand') as string || null;
  const model = formData.get('model') as string || null;
  const year = parseInt(formData.get('year') as string) || null;
  const location = formData.get('location') as string || null;
  const city = formData.get('city') as string || null;
  const state = formData.get('state') as string || null;
  const quantity = parseInt(formData.get('quantity') as string) || 1;
  const endTimeStr = formData.get('endTime') as string;
  const status = formData.get('status') as string || 'draft';

  if (!title || !description || !originalPrice || !startingBid || !endTimeStr) {
    throw new Error("Missing required fields");
  }

  const endTime = new Date(endTimeStr);
  const startTime = status === 'active' ? new Date() : null;
  const productImages = await readProductImages(formData);

  const result = await db.insert(items).values({
    title, description, categoryId, originalPrice, startingBid, currentBid: startingBid,
    reservePrice, bidIncrement, condition, brand, model, year, location, city, state,
    quantity, endTime, status, sellerId: session.user.id, startTime, featured: 0,
    images: productImages.length ? JSON.stringify(productImages) : null,
    imageUrl: productImages[0] || null,
  }).returning({ id: items.id });

  await db.insert(auditLogs).values({
    userId: session.user.id, action: 'CREATE', entity: 'item',
    entityId: String(result[0].id), details: `Created auction: ${title}`,
  });

  revalidatePath('/items');
  revalidatePath('/my-auctions');
  revalidatePath('/');
  return result[0].id;
}

export async function updateItem(itemId: number, formData: FormData) {
  const session = await auth();
  if (!session?.user?.id) throw new Error("You must be signed in");

  const item = await db.select().from(items).where(eq(items.id, itemId)).then(res => res[0]);
  if (!item) throw new Error("Item not found");
  if (item.sellerId !== session.user.id && session.user.role !== 'superadmin') {
    throw new Error("Not authorized");
  }
  if (item.status === 'active' || item.status === 'ended') {
    throw new Error("Cannot edit active or ended auctions");
  }

  const title = formData.get('title') as string;
  const description = formData.get('description') as string;
  const categoryId = parseInt(formData.get('categoryId') as string) || null;
  const originalPrice = parseInt(formData.get('originalPrice') as string);
  const startingBid = parseInt(formData.get('startingBid') as string);
  const reservePrice = parseInt(formData.get('reservePrice') as string) || null;
  const bidIncrement = parseInt(formData.get('bidIncrement') as string) || 100;
  const condition = formData.get('condition') as string;
  const brand = formData.get('brand') as string || null;
  const model = formData.get('model') as string || null;
  const year = parseInt(formData.get('year') as string) || null;
  const location = formData.get('location') as string || null;
  const city = formData.get('city') as string || null;
  const state = formData.get('state') as string || null;
  const quantity = parseInt(formData.get('quantity') as string) || 1;
  const endTimeStr = formData.get('endTime') as string;
  const status = formData.get('status') as string;
  let existingImages: string[] = [];
  if (item.images) {
    try { existingImages = JSON.parse(item.images); } catch { existingImages = item.imageUrl ? [item.imageUrl] : []; }
  } else if (item.imageUrl) {
    existingImages = [item.imageUrl];
  }
  const productImages = await readProductImages(formData, existingImages);

  await db.update(items).set({
    title, description, categoryId, originalPrice, startingBid, currentBid: startingBid,
    reservePrice, bidIncrement, condition, brand, model, year, location, city, state,
    quantity, endTime: new Date(endTimeStr), status,
    startTime: status === 'active' ? new Date() : null,
    images: productImages.length ? JSON.stringify(productImages) : null,
    imageUrl: productImages[0] || null,
    updatedAt: new Date(),
  }).where(eq(items.id, itemId));

  revalidatePath(`/items/${itemId}`);
  revalidatePath('/items');
  revalidatePath('/my-auctions');
  revalidatePath('/');
}

export async function deleteItem(itemId: number) {
  const session = await auth();
  if (!session?.user?.id) throw new Error("Not authorized");

  const item = await db.select().from(items).where(eq(items.id, itemId)).then(res => res[0]);
  if (!item) throw new Error("Item not found");
  if (item.sellerId !== session.user.id && session.user.role !== 'superadmin') throw new Error("Not authorized");

  await db.update(items).set({ status: 'cancelled', updatedAt: new Date() }).where(eq(items.id, itemId));
  revalidatePath('/items');
  revalidatePath('/my-auctions');
  revalidatePath('/');
}

// ─── Watchlist Actions ────────────────────────────────────────
export async function toggleWatchlist(itemId: number) {
  const session = await auth();
  if (!session?.user?.id) throw new Error("You must be signed in");

  const existing = await db.select().from(watchlist).where(
    and(eq(watchlist.userId, session.user.id), eq(watchlist.itemId, itemId))
  ).then(res => res[0]);

  if (existing) {
    await db.delete(watchlist).where(eq(watchlist.id, existing.id));
  } else {
    await db.insert(watchlist).values({ userId: session.user.id, itemId });
  }
  revalidatePath('/watchlist');
  revalidatePath(`/items/${itemId}`);
}

// ─── Notification Actions ─────────────────────────────────────
export async function markNotificationRead(notificationId: number) {
  await db.update(notifications).set({ read: 1 }).where(eq(notifications.id, notificationId));
  revalidatePath('/notifications');
}

export async function markAllNotificationsRead() {
  const session = await auth();
  if (!session?.user?.id) return;
  await db.update(notifications).set({ read: 1 }).where(eq(notifications.userId, session.user.id));
  revalidatePath('/notifications');
}

// ─── Admin Actions ────────────────────────────────────────────
export async function updateUserRole(userId: string, role: string) {
  const session = await auth();
  if (session?.user?.role !== 'superadmin') throw new Error("Not authorized");
  await db.update(users).set({ role }).where(eq(users.id, userId));
  revalidatePath('/admin/users');
}

export async function verifyUser(userId: string, status: string) {
  const session = await auth();
  if (session?.user?.role !== 'superadmin') throw new Error("Not authorized");
  await db.update(users).set({ verified: status }).where(eq(users.id, userId));
  revalidatePath('/admin/users');
}

export async function toggleItemFeatured(itemId: number) {
  const session = await auth();
  if (session?.user?.role !== 'superadmin') throw new Error("Not authorized");
  const item = await db.select().from(items).where(eq(items.id, itemId)).then(res => res[0]);
  await db.update(items).set({ featured: item.featured ? 0 : 1, updatedAt: new Date() }).where(eq(items.id, itemId));
  revalidatePath('/admin/auctions');
  revalidatePath('/');
  revalidatePath('/items');
}

export async function createCategory(name: string, slug: string, icon: string, description: string) {
  const session = await auth();
  if (session?.user?.role !== 'superadmin') throw new Error("Not authorized");
  await db.insert(categories).values({ name, slug, icon, description });
  revalidatePath('/admin/categories');
}

export async function deleteCategory(id: number) {
  const session = await auth();
  if (session?.user?.role !== 'superadmin') throw new Error("Not authorized");
  await db.delete(categories).where(eq(categories.id, id));
  revalidatePath('/admin/categories');
}

export async function adminDeleteUser(userId: string) {
  const session = await auth();
  if (session?.user?.role !== 'superadmin') throw new Error("Not authorized");
  await db.delete(users).where(eq(users.id, userId));
  revalidatePath('/admin/users');
}

// ─── Auth / Profile Actions ───────────────────────────────────
export async function registerUser(formData: FormData) {
  const name = (formData.get('name') as string)?.trim();
  const email = (formData.get('email') as string)?.toLowerCase()?.trim();
  const password = formData.get('password') as string;
  const role = (formData.get('role') as string) || 'bidder';
  if (!name || !email || !password) throw new Error("All fields required");
  if (password.length < 6) throw new Error("Password must be at least 6 characters");
  const existing = await db.select().from(users).where(eq(users.email, email)).then(r => r[0]);
  if (existing) throw new Error("Email already registered");
  const bcrypt = (await import('bcryptjs')).default;
  const hash = await bcrypt.hash(password, 10);
  await db.insert(users).values({ name, email, password: hash, role, verified: role === 'bidder' ? 'verified' : 'pending' });
  return true;
}

export async function updateProfile(formData: FormData) {
  const session = await auth();
  if (!session?.user?.id) throw new Error("Not signed in");
  const name = formData.get('name') as string;
  const phone = formData.get('phone') as string;
  const organization = formData.get('organization') as string;
  const city = formData.get('city') as string;
  const state = formData.get('state') as string;
  const address = formData.get('address') as string;
  const bio = formData.get('bio') as string;
  const gstNumber = formData.get('gstNumber') as string;
  const panNumber = formData.get('panNumber') as string;
  const bankName = formData.get('bankName') as string;
  const bankAccount = formData.get('bankAccount') as string;
  const bankIfsc = formData.get('bankIfsc') as string;
  const newPassword = formData.get('newPassword') as string;

  const updates: any = { name: name || undefined, phone: phone || null, organization: organization || null, city: city || null, state: state || null, address: address || null, bio: bio || null, gstNumber: gstNumber || null, panNumber: panNumber || null, bankName: bankName || null, bankAccount: bankAccount || null, bankIfsc: bankIfsc || null };
  if (newPassword) {
    if (newPassword.length < 6) throw new Error("Password too short");
    const bcrypt = (await import('bcryptjs')).default;
    updates.password = await bcrypt.hash(newPassword, 10);
  }
  await db.update(users).set(updates).where(eq(users.id, session.user.id));
  revalidatePath('/profile');
}

export async function adminUpdateAuctionStatus(itemId: number, status: string) {
  const session = await auth();
  if (!session?.user?.role || !['superadmin','manager'].includes(session.user.role)) throw new Error("Not authorized");
  await db.update(items).set({ status, updatedAt: new Date(), startTime: status === 'active' ? new Date() : undefined } as any).where(eq(items.id, itemId));
  revalidatePath('/admin/auctions'); revalidatePath('/items'); revalidatePath('/');
}

export async function adminDeleteAuction(itemId: number) {
  const session = await auth();
  if (!session?.user?.role || session.user.role !== 'superadmin') throw new Error("Not authorized");
  await db.delete(items).where(eq(items.id, itemId));
  revalidatePath('/admin/auctions'); revalidatePath('/items');
}

export async function adminUpdatePaymentStatus(paymentId: number, status: string) {
  const session = await auth();
  if (!session?.user?.role || !['superadmin','manager','finance'].includes(session.user.role)) throw new Error("Not authorized");
  await db.update(payments).set({ status }).where(eq(payments.id, paymentId));
  revalidatePath('/admin/payments');
}

export async function adminCreateNotification(formData: FormData) {
  const session = await auth();
  if (!session?.user?.role || session.user.role !== 'superadmin') throw new Error("Not authorized");
  const userId = formData.get('userId') as string;
  const title = formData.get('title') as string;
  const message = formData.get('message') as string;
  const type = formData.get('type') as string || 'system';
  if (!userId || !title || !message) throw new Error("Missing fields");
  await db.insert(notifications).values({ userId, type, title, message });
  revalidatePath('/admin/users');
}

