import { sql } from "drizzle-orm";
import { pgTable, text, varchar, decimal, integer, timestamp, boolean, pgEnum } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

export const userRoleEnum = pgEnum("user_role", ["owner", "customer_service", "receptionist", "sorter", "stock_manager", "shipping_staff"]);
export const orderStatusEnum = pgEnum("order_status", ["pending", "processing", "shipped", "delivered", "cancelled", "partially_arrived", "ready_to_collect", "with_shipping_company", "received_in_warehouse", "ready_to_buy"]);
export const taskStatusEnum = pgEnum("task_status", ["pending", "completed", "to_collect"]);
export const taskTypeEnum = pgEnum("task_type", ["task", "receive_payment", "receive_shipments"]);

export const users = pgTable("users", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  username: text("username").notNull().unique(),
  password: text("password").notNull(),
  role: userRoleEnum("role").notNull().default("customer_service"),
  firstName: text("first_name").notNull(),
  lastName: text("last_name").notNull(),
  email: text("email").notNull().unique(),
  isActive: boolean("is_active").notNull().default(true),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const customers = pgTable("customers", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  firstName: text("first_name").notNull(),
  lastName: text("last_name").notNull(),
  email: text("email"),
  phone: text("phone").notNull().unique(),
  address: text("address"),
  city: text("city"),
  country: text("country"),
  postalCode: text("postal_code"),
  shippingCode: text("shipping_code"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const orders = pgTable("orders", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  orderNumber: text("order_number").notNull().unique(),
  customerId: varchar("customer_id").notNull().references(() => customers.id),
  status: orderStatusEnum("status").notNull().default("pending"),
  totalAmount: decimal("total_amount", { precision: 10, scale: 2 }).notNull(),
  downPayment: decimal("down_payment", { precision: 10, scale: 2 }).notNull().default("0"),
  remainingBalance: decimal("remaining_balance", { precision: 10, scale: 2 }).notNull().default("0"),
  shippingCost: decimal("shipping_cost", { precision: 10, scale: 2 }).notNull().default("0"),
  shippingWeight: decimal("shipping_weight", { precision: 10, scale: 2 }).notNull().default("1"),
  shippingCountry: text("shipping_country"),
  shippingCategory: text("shipping_category"),
  trackingNumber: text("tracking_number"),
  commission: decimal("commission", { precision: 10, scale: 2 }).notNull().default("0"),
  shippingProfit: decimal("shipping_profit", { precision: 10, scale: 2 }).notNull().default("0"),
  itemsProfit: decimal("items_profit", { precision: 10, scale: 2 }).notNull().default("0"),
  totalProfit: decimal("total_profit", { precision: 10, scale: 2 }).notNull().default("0"),
  lydExchangeRate: decimal("lyd_exchange_rate", { precision: 10, scale: 4 }),
  shippingLydExchangeRate: decimal("shipping_lyd_exchange_rate", { precision: 10, scale: 4 }),
  notes: text("notes"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const orderItems = pgTable("order_items", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  orderId: varchar("order_id").notNull().references(() => orders.id, { onDelete: "cascade" }),
  productName: text("product_name").notNull(),
  productCode: text("product_code"),
  productUrl: text("product_url"),
  quantity: integer("quantity").notNull(),
  unitPrice: decimal("unit_price", { precision: 10, scale: 2 }).notNull(),
  originalPrice: decimal("original_price", { precision: 10, scale: 2 }),
  discountedPrice: decimal("discounted_price", { precision: 10, scale: 2 }),
  markupProfit: decimal("markup_profit", { precision: 10, scale: 2 }).notNull().default("0"),
  totalPrice: decimal("total_price", { precision: 10, scale: 2 }).notNull(),
});

export const shippingRates = pgTable("shipping_rates", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  country: text("country").notNull(),
  category: text("category").notNull(), // e.g., normal, perfumes, household, etc.
  pricePerKg: decimal("price_per_kg", { precision: 10, scale: 2 }).notNull(),
  currency: text("currency").notNull().default("USD"), // USD, GBP, LYD, etc.
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const commissionRules = pgTable("commission_rules", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  country: text("country").notNull(),
  minValue: decimal("min_value", { precision: 10, scale: 2 }).notNull(),
  maxValue: decimal("max_value", { precision: 10, scale: 2 }), // NULL = no max
  percentage: decimal("percentage", { precision: 5, scale: 4 }).notNull(),
  fixedFee: decimal("fixed_fee", { precision: 10, scale: 2 }).notNull().default("0"), // for cases like "$1 purchase tax"
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const settings = pgTable("settings", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  key: text("key").notNull().unique(),
  value: text("value").notNull(),
  type: text("type").notNull().default("string"), // string, boolean, number, json
  description: text("description"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const orderImages = pgTable("order_images", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  orderId: varchar("order_id").notNull().references(() => orders.id, { onDelete: "cascade" }),
  url: text("url").notNull(),
  altText: text("alt_text"),
  position: integer("position").notNull().default(1),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const messages = pgTable("messages", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  senderId: varchar("sender_id").notNull().references(() => users.id),
  recipientId: varchar("recipient_id").notNull().references(() => users.id),
  content: text("content").notNull(),
  isRead: boolean("is_read").notNull().default(false),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const deliveryTasks = pgTable("delivery_tasks", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  taskType: taskTypeEnum("task_type").notNull().default("task"),
  orderId: varchar("order_id").references(() => orders.id),
  assignedToUserId: varchar("assigned_to_user_id").notNull().references(() => users.id),
  assignedByUserId: varchar("assigned_by_user_id").notNull().references(() => users.id),
  pickupLocation: text("pickup_location"),
  deliveryLocation: text("delivery_location"),
  customerCode: text("customer_code"),
  paymentType: text("payment_type"), // "collect" or "delivered"
  paymentAmount: decimal("payment_amount", { precision: 10, scale: 2 }),
  address: text("address"),
  value: decimal("value", { precision: 10, scale: 2 }),
  weight: decimal("weight", { precision: 10, scale: 2 }),
  status: taskStatusEnum("status").notNull().default("pending"),
  completedAt: timestamp("completed_at"),
  notes: text("notes"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

// Insert schemas
export const insertUserSchema = createInsertSchema(users).omit({
  id: true,
  createdAt: true,
});

export const insertCustomerSchema = createInsertSchema(customers).omit({
  id: true,
  createdAt: true,
});

export const insertOrderSchema = createInsertSchema(orders).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
}).extend({
  orderNumber: z.string().optional(),
});

export const insertOrderItemSchema = createInsertSchema(orderItems).omit({
  id: true,
});

export const insertShippingRateSchema = createInsertSchema(shippingRates).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertCommissionRuleSchema = createInsertSchema(commissionRules).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertSettingSchema = createInsertSchema(settings).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertOrderImageSchema = createInsertSchema(orderImages).omit({
  id: true,
  createdAt: true,
});

export const insertMessageSchema = createInsertSchema(messages).omit({
  id: true,
  createdAt: true,
  isRead: true,
});

export const insertDeliveryTaskSchema = createInsertSchema(deliveryTasks).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
  completedAt: true,
}).extend({
  paymentAmount: z.union([z.string(), z.number()]).optional().transform(val => val?.toString()),
  value: z.union([z.string(), z.number()]).optional().transform(val => val?.toString()),
  weight: z.union([z.string(), z.number()]).optional().transform(val => val?.toString()),
});

// Login schema
export const loginSchema = z.object({
  username: z.string().min(1, "Username is required"),
  password: z.string().min(1, "Password is required"),
});

// Types
export type InsertUser = z.infer<typeof insertUserSchema>;
export type User = typeof users.$inferSelect;

export type InsertCustomer = z.infer<typeof insertCustomerSchema>;
export type Customer = typeof customers.$inferSelect;

export type InsertOrder = z.infer<typeof insertOrderSchema>;
export type Order = typeof orders.$inferSelect;

export type InsertOrderItem = z.infer<typeof insertOrderItemSchema>;
export type OrderItem = typeof orderItems.$inferSelect;

export type InsertShippingRate = z.infer<typeof insertShippingRateSchema>;
export type ShippingRate = typeof shippingRates.$inferSelect;

export type InsertCommissionRule = z.infer<typeof insertCommissionRuleSchema>;
export type CommissionRule = typeof commissionRules.$inferSelect;

export type InsertSetting = z.infer<typeof insertSettingSchema>;
export type Setting = typeof settings.$inferSelect;

export type InsertOrderImage = z.infer<typeof insertOrderImageSchema>;
export type OrderImage = typeof orderImages.$inferSelect;

export type InsertMessage = z.infer<typeof insertMessageSchema>;
export type Message = typeof messages.$inferSelect;

export type InsertDeliveryTask = z.infer<typeof insertDeliveryTaskSchema>;
export type DeliveryTask = typeof deliveryTasks.$inferSelect;

export type LoginCredentials = z.infer<typeof loginSchema>;

// Extended types for API responses
export type OrderWithCustomer = Order & {
  customer: Customer;
  items: OrderItem[];
  images: OrderImage[];
};

export type CustomerWithOrders = Customer & {
  orders: Order[];
};

export type DeliveryTaskWithDetails = DeliveryTask & {
  order?: OrderWithCustomer;
  assignedTo: User;
  assignedBy: User;
};
