import { pgTable, serial, text, timestamp, integer, primaryKey, uniqueIndex } from 'drizzle-orm/pg-core';
import { type AdapterAccount } from '@auth/core/adapters';

// ─── NextAuth Tables ────────────────────────────────────────
export const users = pgTable('user', {
  id: text('id').primaryKey().$defaultFn(() => crypto.randomUUID()),
  name: text('name'),
  email: text('email').unique(),
  emailVerified: timestamp('emailVerified', { mode: 'date' }),
  image: text('image'),
  password: text('password'),
  role: text('role').default('bidder'),
  phone: text('phone'),
  organization: text('organization'),
  verified: text('verified').default('pending'),
  gstNumber: text('gstNumber'),
  panNumber: text('panNumber'),
  address: text('address'),
  city: text('city'),
  state: text('state'),
  pincode: text('pincode'),
  bankName: text('bankName'),
  bankAccount: text('bankAccount'),
  bankIfsc: text('bankIfsc'),
  bio: text('bio'),
  createdAt: timestamp('createdAt', { mode: 'date' }).defaultNow().notNull(),
});

export const accounts = pgTable('account', {
  userId: text('userId').notNull().references(() => users.id, { onDelete: 'cascade' }),
  type: text('type').$type<AdapterAccount['type']>().notNull(),
  provider: text('provider').notNull(),
  providerAccountId: text('providerAccountId').notNull(),
  refresh_token: text('refresh_token'),
  access_token: text('access_token'),
  expires_at: integer('expires_at'),
  token_type: text('token_type'),
  scope: text('scope'),
  id_token: text('id_token'),
  session_state: text('session_state'),
}, (account) => ({
  compoundKey: primaryKey({ columns: [account.provider, account.providerAccountId] }),
}));

export const sessions = pgTable('session', {
  sessionToken: text('sessionToken').primaryKey(),
  userId: text('userId').notNull().references(() => users.id, { onDelete: 'cascade' }),
  expires: timestamp('expires', { mode: 'date' }).notNull(),
});

export const verificationTokens = pgTable('verificationToken', {
  identifier: text('identifier').notNull(),
  token: text('token').notNull().unique(),
  expires: timestamp('expires', { mode: 'date' }).notNull(),
}, (vt) => [primaryKey({ columns: [vt.identifier, vt.token] })]);

// ─── Application Tables ─────────────────────────────────────
export const categories = pgTable('category', {
  id: serial('id').primaryKey(),
  name: text('name').notNull(),
  slug: text('slug').notNull().unique(),
  icon: text('icon'),
  description: text('description'),
});

export const items = pgTable('item', {
  id: serial('id').primaryKey(),
  title: text('title').notNull(),
  description: text('description').notNull(),
  categoryId: integer('categoryId').references(() => categories.id),
  originalPrice: integer('originalPrice').notNull(),
  startingBid: integer('startingBid').notNull(),
  currentBid: integer('currentBid').notNull(),
  reservePrice: integer('reservePrice'),
  bidIncrement: integer('bidIncrement').default(100).notNull(),
  condition: text('condition').default('good'),
  brand: text('brand'),
  model: text('model'),
  year: integer('year'),
  serialNumber: text('serialNumber'),
  location: text('location'),
  city: text('city'),
  state: text('state'),
  quantity: integer('quantity').default(1),
  inspectionDate: timestamp('inspectionDate', { mode: 'date' }),
  inspectionReport: text('inspectionReport'),
  imageUrl: text('imageUrl'),
  images: text('images'),
  videoUrl: text('videoUrl'),
  status: text('status').default('draft').notNull(),
  sellerId: text('sellerId').notNull().references(() => users.id),
  startTime: timestamp('startTime', { mode: 'date' }),
  endTime: timestamp('endTime', { mode: 'date' }).notNull(),
  views: integer('views').default(0),
  bidCount: integer('bidCount').default(0),
  winnerId: text('winnerId'),
  featured: integer('featured').default(0),
  createdAt: timestamp('createdAt', { mode: 'date' }).defaultNow().notNull(),
  updatedAt: timestamp('updatedAt', { mode: 'date' }).defaultNow().notNull(),
});

export const bids = pgTable('bid', {
  id: serial('id').primaryKey(),
  itemId: integer('itemId').notNull().references(() => items.id, { onDelete: 'cascade' }),
  userId: text('userId').notNull().references(() => users.id),
  amount: integer('amount').notNull(),
  isAutoBid: integer('isAutoBid').default(0),
  createdAt: timestamp('createdAt', { mode: 'date' }).defaultNow().notNull(),
});

export const autoBids = pgTable('autoBid', {
  id: serial('id').primaryKey(),
  itemId: integer('itemId').notNull().references(() => items.id, { onDelete: 'cascade' }),
  userId: text('userId').notNull().references(() => users.id),
  maxAmount: integer('maxAmount').notNull(),
  incrementStrategy: text('incrementStrategy').default('minimum'),
  isActive: integer('isActive').default(1),
  createdAt: timestamp('createdAt', { mode: 'date' }).defaultNow().notNull(),
});

export const notifications = pgTable('notification', {
  id: serial('id').primaryKey(),
  userId: text('userId').notNull().references(() => users.id, { onDelete: 'cascade' }),
  type: text('type').notNull(),
  title: text('title').notNull(),
  message: text('message').notNull(),
  read: integer('read').default(0),
  link: text('link'),
  createdAt: timestamp('createdAt', { mode: 'date' }).defaultNow().notNull(),
});

export const payments = pgTable('payment', {
  id: serial('id').primaryKey(),
  itemId: integer('itemId').notNull().references(() => items.id),
  userId: text('userId').notNull().references(() => users.id),
  amount: integer('amount').notNull(),
  type: text('type').notNull(),
  status: text('status').default('pending'),
  method: text('method'),
  transactionId: text('transactionId'),
  createdAt: timestamp('createdAt', { mode: 'date' }).defaultNow().notNull(),
});

export const watchlist = pgTable('watchlist', {
  id: serial('id').primaryKey(),
  userId: text('userId').notNull().references(() => users.id, { onDelete: 'cascade' }),
  itemId: integer('itemId').notNull().references(() => items.id, { onDelete: 'cascade' }),
  createdAt: timestamp('createdAt', { mode: 'date' }).defaultNow().notNull(),
});

export const auditLogs = pgTable('auditLog', {
  id: serial('id').primaryKey(),
  userId: text('userId'),
  action: text('action').notNull(),
  entity: text('entity').notNull(),
  entityId: text('entityId'),
  details: text('details'),
  createdAt: timestamp('createdAt', { mode: 'date' }).defaultNow().notNull(),
});
