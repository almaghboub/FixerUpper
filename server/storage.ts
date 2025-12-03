import {
  type User,
  type InsertUser,
  type Customer,
  type InsertCustomer,
  type Order,
  type InsertOrder,
  type OrderItem,
  type InsertOrderItem,
  type OrderImage,
  type InsertOrderImage,
  type ShippingRate,
  type InsertShippingRate,
  type CommissionRule,
  type InsertCommissionRule,
  type Setting,
  type InsertSetting,
  type Message,
  type InsertMessage,
  type DeliveryTask,
  type InsertDeliveryTask,
  type DeliveryTaskWithDetails,
  type OrderWithCustomer,
  type CustomerWithOrders,
  users,
  customers,
  orders,
  orderItems,
  orderImages,
  shippingRates,
  commissionRules,
  settings,
  messages,
  deliveryTasks,
} from "@shared/schema";
import { randomUUID } from "crypto";
import { hashPassword } from "./auth";
import { drizzle } from "drizzle-orm/neon-http";
import { neon } from "@neondatabase/serverless";
import { eq, desc, sql, or, ilike, and } from "drizzle-orm";

// Database connection
const client = neon(process.env.DATABASE_URL!);
const db = drizzle(client);

export interface IStorage {
  // Users
  getUser(id: string): Promise<User | undefined>;
  getUserByUsername(username: string): Promise<User | undefined>;
  createUser(user: InsertUser): Promise<User>;
  updateUser(id: string, user: Partial<InsertUser>): Promise<User | undefined>;
  deleteUser(id: string): Promise<boolean>;
  getAllUsers(): Promise<User[]>;

  // Customers
  getCustomer(id: string): Promise<Customer | undefined>;
  getCustomerByPhone(phone: string): Promise<Customer | undefined>;
  searchCustomers(query: string): Promise<Customer[]>;
  getCustomerWithOrders(id: string): Promise<CustomerWithOrders | undefined>;
  createCustomer(customer: InsertCustomer): Promise<Customer>;
  updateCustomer(id: string, customer: Partial<InsertCustomer>): Promise<Customer | undefined>;
  deleteCustomer(id: string): Promise<boolean>;
  getAllCustomers(): Promise<Customer[]>;

  // Orders
  getOrder(id: string): Promise<Order | undefined>;
  getOrderWithCustomer(id: string): Promise<OrderWithCustomer | undefined>;
  getOrdersByCustomerId(customerId: string): Promise<Order[]>;
  getNextOrderNumber(countryPrefix: string): Promise<string>;
  createOrder(order: InsertOrder): Promise<Order>;
  updateOrder(id: string, order: Partial<InsertOrder>): Promise<Order | undefined>;
  deleteOrder(id: string): Promise<boolean>;
  getAllOrders(): Promise<OrderWithCustomer[]>;

  // Order Items
  getOrderItems(orderId: string): Promise<OrderItem[]>;
  createOrderItem(item: InsertOrderItem): Promise<OrderItem>;
  updateOrderItem(id: string, item: Partial<InsertOrderItem>): Promise<OrderItem | undefined>;
  deleteOrderItem(id: string): Promise<boolean>;

  // Order Images
  getOrderImages(orderId: string): Promise<OrderImage[]>;
  getAllOrderImagesWithOrders(page?: number, limit?: number): Promise<{ images: any[], total: number }>;
  createOrderImage(image: InsertOrderImage): Promise<OrderImage>;
  deleteOrderImage(id: string): Promise<boolean>;

  // Shipping Rates
  getShippingRate(id: string): Promise<ShippingRate | undefined>;
  getShippingRateByCountryAndCategory(country: string, category: string): Promise<ShippingRate | undefined>;
  createShippingRate(rate: InsertShippingRate): Promise<ShippingRate>;
  updateShippingRate(id: string, rate: Partial<InsertShippingRate>): Promise<ShippingRate | undefined>;
  deleteShippingRate(id: string): Promise<boolean>;
  getAllShippingRates(): Promise<ShippingRate[]>;

  // Commission Rules
  getCommissionRule(id: string): Promise<CommissionRule | undefined>;
  getCommissionRuleByCountryAndValue(country: string, orderValue: number): Promise<CommissionRule | undefined>;
  createCommissionRule(rule: InsertCommissionRule): Promise<CommissionRule>;
  updateCommissionRule(id: string, rule: Partial<InsertCommissionRule>): Promise<CommissionRule | undefined>;
  deleteCommissionRule(id: string): Promise<boolean>;
  getAllCommissionRules(): Promise<CommissionRule[]>;

  // Shipping Calculation
  calculateShipping(country: string, category: string, weight: number, orderValue: number): Promise<{
    base_shipping: number;
    commission: number;
    total: number;
    currency: string;
  }>;

  // Settings
  getSetting(key: string): Promise<Setting | undefined>;
  createSetting(setting: InsertSetting): Promise<Setting>;
  updateSetting(key: string, value: string, type?: string): Promise<Setting | undefined>;
  deleteSetting(key: string): Promise<boolean>;
  getAllSettings(): Promise<Setting[]>;

  // Analytics
  getTotalProfit(): Promise<number>;
  getTotalRevenue(): Promise<number>;
  getActiveOrdersCount(): Promise<number>;

  // Messages
  createMessage(message: InsertMessage): Promise<Message>;
  getMessagesByUserId(userId: string): Promise<Message[]>;
  getUnreadMessageCount(userId: string): Promise<number>;
  markMessageAsRead(messageId: string): Promise<Message | undefined>;
  deleteMessage(messageId: string): Promise<boolean>;

  // Delivery Tasks
  createDeliveryTask(task: InsertDeliveryTask): Promise<DeliveryTask>;
  getDeliveryTask(id: string): Promise<DeliveryTaskWithDetails | undefined>;
  getDeliveryTasksByUserId(userId: string): Promise<DeliveryTaskWithDetails[]>;
  getAllDeliveryTasks(): Promise<DeliveryTaskWithDetails[]>;
  updateDeliveryTask(id: string, task: Partial<InsertDeliveryTask>): Promise<DeliveryTask | undefined>;
  deleteDeliveryTask(id: string): Promise<boolean>;
  getShippingStaffUsers(): Promise<User[]>;
}

export class MemStorage implements IStorage {
  private users: Map<string, User>;
  private customers: Map<string, Customer>;
  private orders: Map<string, Order>;
  private orderItems: Map<string, OrderItem>;
  private orderImages: Map<string, OrderImage>;
  private shippingRates: Map<string, ShippingRate>;
  private commissionRules: Map<string, CommissionRule>;
  private settings: Map<string, Setting>;
  private messages: Map<string, Message>;
  private deliveryTasks: Map<string, DeliveryTask>;
  private orderCounter: number = 1;

  constructor() {
    this.users = new Map();
    this.customers = new Map();
    this.orders = new Map();
    this.orderItems = new Map();
    this.orderImages = new Map();
    this.shippingRates = new Map();
    this.commissionRules = new Map();
    this.settings = new Map();
    this.messages = new Map();
    this.deliveryTasks = new Map();
    
    // Initialize with default data
    this.initializeDefaultData();
  }

  private async initializeDefaultData() {
    // Create default owner user with hashed password
    const hashedPassword = await hashPassword("admin");
    const defaultUser: User = {
      id: randomUUID(),
      username: "admin",
      password: hashedPassword,
      role: "owner",
      firstName: "Admin",
      lastName: "User",
      email: "admin@lynxly.com",
      isActive: true,
      createdAt: new Date(),
    };
    this.users.set(defaultUser.id, defaultUser);

    // Create default shipping rates
    const defaultRates: ShippingRate[] = [
      {
        id: randomUUID(),
        country: "China",
        category: "normal",
        pricePerKg: "8.00",
        currency: "USD",
        createdAt: new Date(),
        updatedAt: new Date(),
      },
      {
        id: randomUUID(),
        country: "China",
        category: "perfumes",
        pricePerKg: "12.00",
        currency: "USD",
        createdAt: new Date(),
        updatedAt: new Date(),
      },
      {
        id: randomUUID(),
        country: "Turkey",
        category: "normal",
        pricePerKg: "12.00",
        currency: "USD",
        createdAt: new Date(),
        updatedAt: new Date(),
      },
      {
        id: randomUUID(),
        country: "UK",
        category: "normal",
        pricePerKg: "15.00",
        currency: "GBP",
        createdAt: new Date(),
        updatedAt: new Date(),
      },
      {
        id: randomUUID(),
        country: "UAE",
        category: "normal",
        pricePerKg: "18.00",
        currency: "USD",
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    ];

    defaultRates.forEach(rate => this.shippingRates.set(rate.id, rate));

    // Create default commission rules
    const defaultCommissionRules: CommissionRule[] = [
      {
        id: randomUUID(),
        country: "China",
        minValue: "0.00",
        maxValue: "100.00",
        percentage: "0.1800",
        fixedFee: "0.00",
        createdAt: new Date(),
        updatedAt: new Date(),
      },
      {
        id: randomUUID(),
        country: "China",
        minValue: "100.01",
        maxValue: null,
        percentage: "0.1500",
        fixedFee: "1.00",
        createdAt: new Date(),
        updatedAt: new Date(),
      },
      {
        id: randomUUID(),
        country: "Turkey",
        minValue: "0.00",
        maxValue: null,
        percentage: "0.2000",
        fixedFee: "0.00",
        createdAt: new Date(),
        updatedAt: new Date(),
      },
      {
        id: randomUUID(),
        country: "UK",
        minValue: "0.00",
        maxValue: null,
        percentage: "0.1500",
        fixedFee: "0.00",
        createdAt: new Date(),
        updatedAt: new Date(),
      },
      {
        id: randomUUID(),
        country: "UAE",
        minValue: "0.00",
        maxValue: null,
        percentage: "0.1200",
        fixedFee: "0.00",
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    ];

    defaultCommissionRules.forEach(rule => this.commissionRules.set(rule.id, rule));
  }

  // Users
  async getUser(id: string): Promise<User | undefined> {
    return this.users.get(id);
  }

  async getUserByUsername(username: string): Promise<User | undefined> {
    return Array.from(this.users.values()).find(user => user.username === username);
  }

  async createUser(insertUser: InsertUser): Promise<User> {
    const id = randomUUID();
    const user: User = {
      ...insertUser,
      id,
      role: insertUser.role || "customer_service",
      isActive: insertUser.isActive ?? true,
      createdAt: new Date(),
    };
    this.users.set(id, user);
    return user;
  }

  async updateUser(id: string, userData: Partial<InsertUser>): Promise<User | undefined> {
    const user = this.users.get(id);
    if (!user) return undefined;
    
    const updatedUser = { ...user, ...userData };
    this.users.set(id, updatedUser);
    return updatedUser;
  }

  async deleteUser(id: string): Promise<boolean> {
    return this.users.delete(id);
  }

  async getAllUsers(): Promise<User[]> {
    return Array.from(this.users.values());
  }

  // Customers
  async getCustomer(id: string): Promise<Customer | undefined> {
    return this.customers.get(id);
  }

  async getCustomerByPhone(phone: string): Promise<Customer | undefined> {
    return Array.from(this.customers.values()).find(customer => customer.phone === phone);
  }

  async searchCustomers(query: string): Promise<Customer[]> {
    const lowerQuery = query.toLowerCase();
    return Array.from(this.customers.values()).filter(customer => 
      customer.phone.includes(query) ||
      customer.firstName.toLowerCase().includes(lowerQuery) ||
      customer.lastName.toLowerCase().includes(lowerQuery) ||
      (customer.shippingCode && customer.shippingCode.toLowerCase().includes(lowerQuery))
    );
  }

  async getCustomerWithOrders(id: string): Promise<CustomerWithOrders | undefined> {
    const customer = this.customers.get(id);
    if (!customer) return undefined;
    
    const orders = Array.from(this.orders.values()).filter(order => order.customerId === id);
    return { ...customer, orders };
  }

  async createCustomer(insertCustomer: InsertCustomer): Promise<Customer> {
    const id = randomUUID();
    const customer: Customer = {
      ...insertCustomer,
      id,
      address: insertCustomer.address ?? null,
      city: insertCustomer.city ?? null,
      postalCode: insertCustomer.postalCode ?? null,
      createdAt: new Date(),
    };
    this.customers.set(id, customer);
    return customer;
  }

  async updateCustomer(id: string, customerData: Partial<InsertCustomer>): Promise<Customer | undefined> {
    const customer = this.customers.get(id);
    if (!customer) return undefined;
    
    const updatedCustomer = { ...customer, ...customerData };
    this.customers.set(id, updatedCustomer);
    return updatedCustomer;
  }

  async deleteCustomer(id: string): Promise<boolean> {
    return this.customers.delete(id);
  }

  async getAllCustomers(): Promise<Customer[]> {
    return Array.from(this.customers.values());
  }

  // Orders
  async getOrder(id: string): Promise<Order | undefined> {
    return this.orders.get(id);
  }

  async getOrderWithCustomer(id: string): Promise<OrderWithCustomer | undefined> {
    const order = this.orders.get(id);
    if (!order) return undefined;
    
    const customer = this.customers.get(order.customerId);
    if (!customer) return undefined;
    
    const items = Array.from(this.orderItems.values()).filter(item => item.orderId === id);
    const images = Array.from(this.orderImages.values()).filter(image => image.orderId === id);
    
    return { ...order, customer, items, images };
  }

  async getOrdersByCustomerId(customerId: string): Promise<Order[]> {
    return Array.from(this.orders.values()).filter(order => order.customerId === customerId);
  }

  async getNextOrderNumber(countryPrefix: string): Promise<string> {
    // Get all orders with this prefix
    const prefix = countryPrefix.toUpperCase().slice(0, 2);
    const existingOrders = Array.from(this.orders.values())
      .filter(order => order.orderNumber.startsWith(prefix))
      .map(order => {
        const match = order.orderNumber.match(new RegExp(`^${prefix}(\\d+)$`));
        return match ? parseInt(match[1], 10) : 0;
      });
    
    const maxNumber = existingOrders.length > 0 ? Math.max(...existingOrders) : 0;
    const nextNumber = maxNumber + 1;
    return `${prefix}${nextNumber.toString().padStart(4, '0')}`;
  }

  async createOrder(insertOrder: InsertOrder): Promise<Order> {
    const id = randomUUID();
    // Use provided orderNumber or generate one
    const orderNumber = insertOrder.orderNumber || `LY-${Date.now()}`;
    const now = new Date();
    
    const order: Order = {
      ...insertOrder,
      id,
      orderNumber,
      status: insertOrder.status || "pending",
      shippingCost: insertOrder.shippingCost || "0.00",
      commission: insertOrder.commission || "0.00",
      shippingProfit: insertOrder.shippingProfit || "0.00",
      itemsProfit: insertOrder.itemsProfit || "0.00",
      totalProfit: insertOrder.totalProfit || "0.00",
      notes: insertOrder.notes || null,
      createdAt: now,
      updatedAt: now,
    };
    this.orders.set(id, order);
    return order;
  }

  async updateOrder(id: string, orderData: Partial<InsertOrder>): Promise<Order | undefined> {
    const order = this.orders.get(id);
    if (!order) return undefined;
    
    const updatedOrder = { ...order, ...orderData, updatedAt: new Date() };
    this.orders.set(id, updatedOrder);
    return updatedOrder;
  }

  async deleteOrder(id: string): Promise<boolean> {
    // Delete associated order items
    Array.from(this.orderItems.keys())
      .filter(itemId => this.orderItems.get(itemId)?.orderId === id)
      .forEach(itemId => this.orderItems.delete(itemId));
    
    return this.orders.delete(id);
  }

  async getAllOrders(): Promise<OrderWithCustomer[]> {
    const orders: OrderWithCustomer[] = [];
    
    for (const order of Array.from(this.orders.values())) {
      const customer = this.customers.get(order.customerId);
      if (customer) {
        const items = Array.from(this.orderItems.values()).filter(item => item.orderId === order.id);
        const images = Array.from(this.orderImages.values()).filter(image => image.orderId === order.id);
        orders.push({ ...order, customer, items, images });
      }
    }
    
    return orders;
  }

  // Order Items
  async getOrderItems(orderId: string): Promise<OrderItem[]> {
    return Array.from(this.orderItems.values()).filter(item => item.orderId === orderId);
  }

  async createOrderItem(insertOrderItem: InsertOrderItem): Promise<OrderItem> {
    const id = randomUUID();
    const item: OrderItem = {
      ...insertOrderItem,
      id,
      productUrl: insertOrderItem.productUrl ?? null,
      originalPrice: insertOrderItem.originalPrice ?? null,
      discountedPrice: insertOrderItem.discountedPrice ?? null,
      markupProfit: insertOrderItem.markupProfit ?? "0.00",
    };
    this.orderItems.set(id, item);
    return item;
  }

  async updateOrderItem(id: string, itemData: Partial<InsertOrderItem>): Promise<OrderItem | undefined> {
    const item = this.orderItems.get(id);
    if (!item) return undefined;
    
    const updatedItem = { ...item, ...itemData };
    this.orderItems.set(id, updatedItem);
    return updatedItem;
  }

  async deleteOrderItem(id: string): Promise<boolean> {
    return this.orderItems.delete(id);
  }

  // Order Images
  async getOrderImages(orderId: string): Promise<OrderImage[]> {
    return Array.from(this.orderImages.values()).filter(image => image.orderId === orderId);
  }

  async getAllOrderImagesWithOrders(page: number = 1, limit: number = 20): Promise<{ images: any[], total: number }> {
    const allImages = Array.from(this.orderImages.values());
    const result = [];
    
    for (const image of allImages) {
      const order = this.orders.get(image.orderId);
      if (order) {
        const customer = this.customers.get(order.customerId);
        result.push({
          ...image,
          order: order,
          customer: customer || null,
        });
      }
    }
    
    // Sort by most recent first
    result.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
    
    // Apply pagination
    const total = result.length;
    const offset = (page - 1) * limit;
    const paginatedResults = result.slice(offset, offset + limit);
    
    return { images: paginatedResults, total };
  }

  async createOrderImage(insertOrderImage: InsertOrderImage): Promise<OrderImage> {
    const id = randomUUID();
    const image: OrderImage = {
      ...insertOrderImage,
      id,
      altText: insertOrderImage.altText ?? null,
      position: insertOrderImage.position ?? 1,
      createdAt: new Date(),
    };
    this.orderImages.set(id, image);
    return image;
  }

  async deleteOrderImage(id: string): Promise<boolean> {
    return this.orderImages.delete(id);
  }

  // Shipping Rates
  async getShippingRate(id: string): Promise<ShippingRate | undefined> {
    return this.shippingRates.get(id);
  }

  async getShippingRateByCountryAndCategory(country: string, category: string): Promise<ShippingRate | undefined> {
    return Array.from(this.shippingRates.values()).find(
      rate => rate.country === country && rate.category === category
    );
  }

  async createShippingRate(insertShippingRate: InsertShippingRate): Promise<ShippingRate> {
    const id = randomUUID();
    const now = new Date();
    const rate: ShippingRate = {
      ...insertShippingRate,
      id,
      currency: insertShippingRate.currency ?? "USD",
      createdAt: now,
      updatedAt: now,
    };
    this.shippingRates.set(id, rate);
    return rate;
  }

  async updateShippingRate(id: string, rateData: Partial<InsertShippingRate>): Promise<ShippingRate | undefined> {
    const rate = this.shippingRates.get(id);
    if (!rate) return undefined;
    
    const updatedRate = { ...rate, ...rateData };
    this.shippingRates.set(id, updatedRate);
    return updatedRate;
  }

  async deleteShippingRate(id: string): Promise<boolean> {
    return this.shippingRates.delete(id);
  }

  async getAllShippingRates(): Promise<ShippingRate[]> {
    return Array.from(this.shippingRates.values());
  }

  // Commission Rules
  async getCommissionRule(id: string): Promise<CommissionRule | undefined> {
    return this.commissionRules.get(id);
  }

  async getCommissionRuleByCountryAndValue(country: string, orderValue: number): Promise<CommissionRule | undefined> {
    return Array.from(this.commissionRules.values()).find(rule => {
      const minValue = parseFloat(rule.minValue);
      const maxValue = rule.maxValue ? parseFloat(rule.maxValue) : null;
      return rule.country === country && 
             minValue <= orderValue && 
             (maxValue === null || maxValue >= orderValue);
    });
  }

  async createCommissionRule(insertCommissionRule: InsertCommissionRule): Promise<CommissionRule> {
    const id = randomUUID();
    const now = new Date();
    const rule: CommissionRule = {
      ...insertCommissionRule,
      id,
      maxValue: insertCommissionRule.maxValue ?? null,
      fixedFee: insertCommissionRule.fixedFee ?? "0.00",
      createdAt: now,
      updatedAt: now,
    };
    this.commissionRules.set(id, rule);
    return rule;
  }

  async updateCommissionRule(id: string, ruleData: Partial<InsertCommissionRule>): Promise<CommissionRule | undefined> {
    const rule = this.commissionRules.get(id);
    if (!rule) return undefined;
    
    const updatedRule = { 
      ...rule, 
      ...ruleData,
      updatedAt: new Date(),
    };
    this.commissionRules.set(id, updatedRule);
    return updatedRule;
  }

  async deleteCommissionRule(id: string): Promise<boolean> {
    return this.commissionRules.delete(id);
  }

  async getAllCommissionRules(): Promise<CommissionRule[]> {
    return Array.from(this.commissionRules.values());
  }

  // Shipping Calculation
  async calculateShipping(country: string, category: string, weight: number, orderValue: number): Promise<{
    base_shipping: number;
    commission: number;
    total: number;
    currency: string;
  }> {
    const shippingRate = await this.getShippingRateByCountryAndCategory(country, category);
    if (!shippingRate) {
      throw new Error(`No shipping rate found for country: ${country}, category: ${category}`);
    }

    const baseShipping = weight * parseFloat(shippingRate.pricePerKg);

    const commissionRule = await this.getCommissionRuleByCountryAndValue(country, orderValue);
    let commission = 0;
    
    if (commissionRule) {
      const percentageCommission = orderValue * parseFloat(commissionRule.percentage);
      const fixedFee = parseFloat(commissionRule.fixedFee);
      commission = percentageCommission + fixedFee;
    }

    return {
      base_shipping: baseShipping,
      commission,
      total: baseShipping + commission,
      currency: shippingRate.currency,
    };
  }

  // Analytics
  async getTotalProfit(): Promise<number> {
    const orders = Array.from(this.orders.values());
    return orders.reduce((total, order) => total + parseFloat(order.totalProfit), 0);
  }

  async getTotalRevenue(): Promise<number> {
    const orders = Array.from(this.orders.values());
    return orders.reduce((total, order) => total + parseFloat(order.totalAmount), 0);
  }

  async getActiveOrdersCount(): Promise<number> {
    const orders = Array.from(this.orders.values());
    return orders.filter(order => order.status !== "delivered" && order.status !== "cancelled").length;
  }

  // Settings methods
  async getSetting(key: string): Promise<Setting | undefined> {
    return this.settings.get(key);
  }

  async createSetting(insertSetting: InsertSetting): Promise<Setting> {
    const id = randomUUID();
    const now = new Date();
    const setting: Setting = {
      ...insertSetting,
      id,
      type: insertSetting.type ?? "string",
      description: insertSetting.description ?? null,
      createdAt: now,
      updatedAt: now,
    };
    this.settings.set(setting.key, setting);
    return setting;
  }

  async updateSetting(key: string, value: string, type?: string): Promise<Setting | undefined> {
    const existing = this.settings.get(key);
    if (!existing) return undefined;

    const updated: Setting = {
      ...existing,
      value,
      type: type || existing.type,
      updatedAt: new Date(),
    };
    this.settings.set(key, updated);
    return updated;
  }

  async deleteSetting(key: string): Promise<boolean> {
    return this.settings.delete(key);
  }

  async getAllSettings(): Promise<Setting[]> {
    return Array.from(this.settings.values());
  }

  // Messages methods
  async createMessage(insertMessage: InsertMessage): Promise<Message> {
    const id = randomUUID();
    const message: Message = {
      ...insertMessage,
      id,
      isRead: false,
      createdAt: new Date(),
    };
    this.messages.set(id, message);
    return message;
  }

  async getMessagesByUserId(userId: string): Promise<Message[]> {
    return Array.from(this.messages.values())
      .filter(msg => msg.senderId === userId || msg.recipientId === userId)
      .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
  }

  async getUnreadMessageCount(userId: string): Promise<number> {
    return Array.from(this.messages.values())
      .filter(msg => msg.recipientId === userId && !msg.isRead)
      .length;
  }

  async markMessageAsRead(messageId: string): Promise<Message | undefined> {
    const message = this.messages.get(messageId);
    if (!message) return undefined;
    const updated = { ...message, isRead: true };
    this.messages.set(messageId, updated);
    return updated;
  }

  async deleteMessage(messageId: string): Promise<boolean> {
    return this.messages.delete(messageId);
  }
}

export class PostgreSQLStorage implements IStorage {
  constructor() {
    this.initializeDefaultData();
  }

  private async initializeDefaultData() {
    try {
      // Check if admin user exists
      const existingAdmin = await this.getUserByUsername("admin");
      if (!existingAdmin) {
        // Create default owner user
        const hashedPassword = await hashPassword("admin");
        await db.insert(users).values({
          username: "admin",
          password: hashedPassword,
          role: "owner",
          firstName: "Admin",
          lastName: "User",
          email: "admin@lynxly.com",
          isActive: true,
        });
      }

      // Check if shipping rates exist
      const existingRates = await this.getAllShippingRates();
      if (existingRates.length === 0) {
        // Create default shipping rates
        await db.insert(shippingRates).values([
          {
            country: "China",
            category: "normal",
            pricePerKg: "8.00",
            currency: "USD",
          },
          {
            country: "China",
            category: "perfumes",
            pricePerKg: "12.00",
            currency: "USD",
          },
          {
            country: "Turkey",
            category: "normal",
            pricePerKg: "12.00",
            currency: "USD",
          },
          {
            country: "UK",
            category: "normal",
            pricePerKg: "15.00",
            currency: "GBP",
          },
          {
            country: "UAE",
            category: "normal",
            pricePerKg: "18.00",
            currency: "USD",
          },
        ]);
      }

      // Check if commission rules exist
      const existingCommissionRules = await this.getAllCommissionRules();
      if (existingCommissionRules.length === 0) {
        // Create default commission rules
        await db.insert(commissionRules).values([
          {
            country: "China",
            minValue: "0.00",
            maxValue: "100.00",
            percentage: "0.1800",
            fixedFee: "0.00",
          },
          {
            country: "China",
            minValue: "100.01",
            maxValue: null, // no max
            percentage: "0.1500",
            fixedFee: "1.00",
          },
          {
            country: "Turkey",
            minValue: "0.00",
            maxValue: null,
            percentage: "0.2000",
            fixedFee: "0.00",
          },
          {
            country: "UK",
            minValue: "0.00",
            maxValue: null,
            percentage: "0.1500",
            fixedFee: "0.00",
          },
          {
            country: "UAE",
            minValue: "0.00",
            maxValue: null,
            percentage: "0.1200",
            fixedFee: "0.00",
          },
        ]);
      }

    } catch (error) {
      console.error("Error initializing default data:", error);
    }
  }

  // Users
  async getUser(id: string): Promise<User | undefined> {
    const result = await db.select().from(users).where(eq(users.id, id)).limit(1);
    return result[0];
  }

  async getUserByUsername(username: string): Promise<User | undefined> {
    const result = await db.select().from(users).where(eq(users.username, username)).limit(1);
    return result[0];
  }

  async createUser(insertUser: InsertUser): Promise<User> {
    const result = await db.insert(users).values({
      ...insertUser,
      role: insertUser.role || "customer_service",
      isActive: insertUser.isActive ?? true,
    }).returning();
    return result[0];
  }

  async updateUser(id: string, userData: Partial<InsertUser>): Promise<User | undefined> {
    const result = await db.update(users).set(userData).where(eq(users.id, id)).returning();
    return result[0];
  }

  async deleteUser(id: string): Promise<boolean> {
    const result = await db.delete(users).where(eq(users.id, id));
    return result.rowCount > 0;
  }

  async getAllUsers(): Promise<User[]> {
    return await db.select().from(users).orderBy(desc(users.createdAt));
  }

  // Customers
  async getCustomer(id: string): Promise<Customer | undefined> {
    const result = await db.select().from(customers).where(eq(customers.id, id)).limit(1);
    return result[0];
  }

  async getCustomerByPhone(phone: string): Promise<Customer | undefined> {
    const result = await db.select().from(customers).where(eq(customers.phone, phone)).limit(1);
    return result[0];
  }

  async searchCustomers(query: string): Promise<Customer[]> {
    const result = await db
      .select()
      .from(customers)
      .where(
        or(
          ilike(customers.phone, `%${query}%`),
          ilike(customers.firstName, `%${query}%`),
          ilike(customers.lastName, `%${query}%`),
          ilike(customers.shippingCode, `%${query}%`)
        )
      )
      .orderBy(desc(customers.createdAt));
    return result;
  }

  async getCustomerWithOrders(id: string): Promise<CustomerWithOrders | undefined> {
    const customer = await this.getCustomer(id);
    if (!customer) return undefined;
    
    const customerOrders = await db.select().from(orders).where(eq(orders.customerId, id));
    return { ...customer, orders: customerOrders };
  }

  async createCustomer(insertCustomer: InsertCustomer): Promise<Customer> {
    const result = await db.insert(customers).values(insertCustomer).returning();
    return result[0];
  }

  async updateCustomer(id: string, customerData: Partial<InsertCustomer>): Promise<Customer | undefined> {
    const result = await db.update(customers).set(customerData).where(eq(customers.id, id)).returning();
    return result[0];
  }

  async deleteCustomer(id: string): Promise<boolean> {
    const result = await db.delete(customers).where(eq(customers.id, id));
    return result.rowCount > 0;
  }

  async getAllCustomers(): Promise<Customer[]> {
    return await db.select().from(customers).orderBy(desc(customers.createdAt));
  }

  // Orders
  async getOrder(id: string): Promise<Order | undefined> {
    const result = await db.select().from(orders).where(eq(orders.id, id)).limit(1);
    return result[0];
  }

  async getOrderWithCustomer(id: string): Promise<OrderWithCustomer | undefined> {
    const result = await db
      .select()
      .from(orders)
      .leftJoin(customers, eq(orders.customerId, customers.id))
      .where(eq(orders.id, id))
      .limit(1);
    
    if (!result[0] || !result[0].orders || !result[0].customers) return undefined;
    
    const items = await this.getOrderItems(id);
    return {
      ...result[0].orders,
      customer: result[0].customers,
      items,
      images: [],
    };
  }

  async getOrdersByCustomerId(customerId: string): Promise<Order[]> {
    return await db.select().from(orders).where(eq(orders.customerId, customerId));
  }

  async getNextOrderNumber(countryPrefix: string): Promise<string> {
    // Get the 2-letter prefix from country name
    const prefix = countryPrefix.toUpperCase().slice(0, 2);
    
    // Find the highest order number with this prefix
    const result = await db.select({ orderNumber: orders.orderNumber })
      .from(orders)
      .where(sql`${orders.orderNumber} LIKE ${prefix + '%'}`);
    
    let maxNumber = 0;
    for (const row of result) {
      const match = row.orderNumber.match(new RegExp(`^${prefix}(\\d+)$`));
      if (match) {
        const num = parseInt(match[1], 10);
        if (num > maxNumber) maxNumber = num;
      }
    }
    
    const nextNumber = maxNumber + 1;
    return `${prefix}${nextNumber.toString().padStart(4, '0')}`;
  }

  async createOrder(insertOrder: InsertOrder): Promise<Order> {
    // Use provided orderNumber or generate one
    const orderNumber = insertOrder.orderNumber || `LY-${Date.now()}`;
    const result = await db.insert(orders).values({
      ...insertOrder,
      orderNumber,
    }).returning();
    return result[0];
  }

  async updateOrder(id: string, orderData: Partial<InsertOrder>): Promise<Order | undefined> {
    const updateData = {
      ...orderData,
      updatedAt: new Date(),
    };
    const result = await db.update(orders).set(updateData).where(eq(orders.id, id)).returning();
    return result[0];
  }

  async deleteOrder(id: string): Promise<boolean> {
    const result = await db.delete(orders).where(eq(orders.id, id));
    return result.rowCount > 0;
  }

  async getAllOrders(): Promise<OrderWithCustomer[]> {
    const result = await db
      .select()
      .from(orders)
      .leftJoin(customers, eq(orders.customerId, customers.id))
      .orderBy(desc(orders.createdAt));
    
    const ordersWithCustomers: OrderWithCustomer[] = [];
    for (const row of result) {
      if (row.orders && row.customers) {
        const items = await this.getOrderItems(row.orders.id);
        ordersWithCustomers.push({
          ...row.orders,
          customer: row.customers,
          items,
          images: [],
        });
      }
    }
    
    return ordersWithCustomers;
  }

  // Order Items
  async getOrderItems(orderId: string): Promise<OrderItem[]> {
    return await db.select().from(orderItems).where(eq(orderItems.orderId, orderId));
  }

  async createOrderItem(insertOrderItem: InsertOrderItem): Promise<OrderItem> {
    const result = await db.insert(orderItems).values(insertOrderItem).returning();
    return result[0];
  }

  async updateOrderItem(id: string, itemData: Partial<InsertOrderItem>): Promise<OrderItem | undefined> {
    const result = await db.update(orderItems).set(itemData).where(eq(orderItems.id, id)).returning();
    return result[0];
  }

  async deleteOrderItem(id: string): Promise<boolean> {
    const result = await db.delete(orderItems).where(eq(orderItems.id, id));
    return result.rowCount > 0;
  }

  // Order Images
  async getOrderImages(orderId: string): Promise<OrderImage[]> {
    return await db.select().from(orderImages).where(eq(orderImages.orderId, orderId));
  }

  async getAllOrderImagesWithOrders(page: number = 1, limit: number = 20): Promise<{ images: any[], total: number }> {
    // Get total count
    const countResult = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(orderImages);
    const total = countResult[0]?.count || 0;
    
    // Get paginated results
    const offset = (page - 1) * limit;
    const result = await db
      .select()
      .from(orderImages)
      .leftJoin(orders, eq(orderImages.orderId, orders.id))
      .leftJoin(customers, eq(orders.customerId, customers.id))
      .orderBy(desc(orderImages.createdAt))
      .limit(limit)
      .offset(offset);
    
    const images = result.map(row => ({
      ...row.order_images,
      order: row.orders,
      customer: row.customers,
    }));
    
    return { images, total };
  }

  async createOrderImage(insertOrderImage: InsertOrderImage): Promise<OrderImage> {
    const result = await db.insert(orderImages).values(insertOrderImage).returning();
    return result[0];
  }

  async deleteOrderImage(id: string): Promise<boolean> {
    const result = await db.delete(orderImages).where(eq(orderImages.id, id));
    return result.rowCount > 0;
  }

  // Shipping Rates
  async getShippingRate(id: string): Promise<ShippingRate | undefined> {
    const result = await db.select().from(shippingRates).where(eq(shippingRates.id, id)).limit(1);
    return result[0];
  }

  async getShippingRateByCountryAndCategory(country: string, category: string): Promise<ShippingRate | undefined> {
    const result = await db.select().from(shippingRates)
      .where(sql`${shippingRates.country} = ${country} AND ${shippingRates.category} = ${category}`)
      .limit(1);
    return result[0];
  }

  async createShippingRate(insertShippingRate: InsertShippingRate): Promise<ShippingRate> {
    const result = await db.insert(shippingRates).values(insertShippingRate).returning();
    return result[0];
  }

  async updateShippingRate(id: string, rateData: Partial<InsertShippingRate>): Promise<ShippingRate | undefined> {
    const result = await db.update(shippingRates).set(rateData).where(eq(shippingRates.id, id)).returning();
    return result[0];
  }

  async deleteShippingRate(id: string): Promise<boolean> {
    const result = await db.delete(shippingRates).where(eq(shippingRates.id, id));
    return result.rowCount > 0;
  }

  async getAllShippingRates(): Promise<ShippingRate[]> {
    return await db.select().from(shippingRates).orderBy(shippingRates.country);
  }

  // Commission Rules
  async getCommissionRule(id: string): Promise<CommissionRule | undefined> {
    const result = await db.select().from(commissionRules).where(eq(commissionRules.id, id)).limit(1);
    return result[0];
  }

  async getCommissionRuleByCountryAndValue(country: string, orderValue: number): Promise<CommissionRule | undefined> {
    const result = await db.select().from(commissionRules)
      .where(sql`${commissionRules.country} = ${country} 
                 AND ${commissionRules.minValue} <= ${orderValue}
                 AND (${commissionRules.maxValue} IS NULL OR ${commissionRules.maxValue} >= ${orderValue})`)
      .orderBy(commissionRules.minValue)
      .limit(1);
    return result[0];
  }

  async createCommissionRule(insertCommissionRule: InsertCommissionRule): Promise<CommissionRule> {
    const result = await db.insert(commissionRules).values(insertCommissionRule).returning();
    return result[0];
  }

  async updateCommissionRule(id: string, ruleData: Partial<InsertCommissionRule>): Promise<CommissionRule | undefined> {
    const updateData = {
      ...ruleData,
      updatedAt: new Date(),
    };
    const result = await db.update(commissionRules).set(updateData).where(eq(commissionRules.id, id)).returning();
    return result[0];
  }

  async deleteCommissionRule(id: string): Promise<boolean> {
    const result = await db.delete(commissionRules).where(eq(commissionRules.id, id));
    return result.rowCount > 0;
  }

  async getAllCommissionRules(): Promise<CommissionRule[]> {
    return await db.select().from(commissionRules).orderBy(commissionRules.country, commissionRules.minValue);
  }

  // Shipping Calculation
  async calculateShipping(country: string, category: string, weight: number, orderValue: number): Promise<{
    base_shipping: number;
    commission: number;
    total: number;
    currency: string;
  }> {
    // Get shipping rate for country and category
    const shippingRate = await this.getShippingRateByCountryAndCategory(country, category);
    if (!shippingRate) {
      throw new Error(`No shipping rate found for country: ${country}, category: ${category}`);
    }

    // Calculate base shipping cost
    const baseShipping = weight * parseFloat(shippingRate.pricePerKg);

    // Get commission rule for country and order value
    const commissionRule = await this.getCommissionRuleByCountryAndValue(country, orderValue);
    let commission = 0;
    
    if (commissionRule) {
      // Calculate commission: percentage + fixed fee
      const percentageCommission = orderValue * parseFloat(commissionRule.percentage);
      const fixedFee = parseFloat(commissionRule.fixedFee);
      commission = percentageCommission + fixedFee;
    }

    return {
      base_shipping: baseShipping,
      commission,
      total: baseShipping + commission,
      currency: shippingRate.currency,
    };
  }

  // Analytics
  async getTotalProfit(): Promise<number> {
    const result = await db.select({
      total: sql<number>`COALESCE(SUM(CAST(${orders.totalProfit} AS NUMERIC)), 0)`,
    }).from(orders);
    return Number(result[0]?.total || 0);
  }

  async getTotalRevenue(): Promise<number> {
    const result = await db.select({
      total: sql<number>`COALESCE(SUM(CAST(${orders.totalAmount} AS NUMERIC)), 0)`,
    }).from(orders);
    return Number(result[0]?.total || 0);
  }

  async getActiveOrdersCount(): Promise<number> {
    const result = await db.select({
      count: sql<number>`COUNT(*)`,
    }).from(orders).where(sql`${orders.status} NOT IN ('delivered', 'cancelled')`);
    return Number(result[0]?.count || 0);
  }

  // Settings methods
  async getSetting(key: string): Promise<Setting | undefined> {
    const result = await db.select().from(settings).where(eq(settings.key, key)).limit(1);
    return result[0];
  }

  async createSetting(insertSetting: InsertSetting): Promise<Setting> {
    const result = await db.insert(settings).values(insertSetting).returning();
    return result[0];
  }

  async updateSetting(key: string, value: string, type?: string): Promise<Setting | undefined> {
    const updateData: any = { 
      value, 
      updatedAt: new Date() 
    };
    if (type) {
      updateData.type = type;
    }
    
    const result = await db.update(settings)
      .set(updateData)
      .where(eq(settings.key, key))
      .returning();
    return result[0];
  }

  async deleteSetting(key: string): Promise<boolean> {
    const result = await db.delete(settings).where(eq(settings.key, key)).returning();
    return result.length > 0;
  }

  async getAllSettings(): Promise<Setting[]> {
    return await db.select().from(settings);
  }

  // Messages methods
  async createMessage(insertMessage: InsertMessage): Promise<Message> {
    const result = await db.insert(messages).values(insertMessage).returning();
    return result[0];
  }

  async getMessagesByUserId(userId: string): Promise<Message[]> {
    return await db.select()
      .from(messages)
      .where(or(eq(messages.senderId, userId), eq(messages.recipientId, userId)))
      .orderBy(desc(messages.createdAt));
  }

  async getUnreadMessageCount(userId: string): Promise<number> {
    const result = await db.select({
      count: sql<number>`COUNT(*)`,
    })
      .from(messages)
      .where(sql`${messages.recipientId} = ${userId} AND ${messages.isRead} = false`);
    return Number(result[0]?.count || 0);
  }

  async markMessageAsRead(messageId: string): Promise<Message | undefined> {
    const result = await db.update(messages)
      .set({ isRead: true })
      .where(eq(messages.id, messageId))
      .returning();
    return result[0];
  }

  async deleteMessage(messageId: string): Promise<boolean> {
    const result = await db.delete(messages).where(eq(messages.id, messageId)).returning();
    return result.length > 0;
  }

  // Delivery Tasks methods
  async createDeliveryTask(insertTask: InsertDeliveryTask): Promise<DeliveryTask> {
    const result = await db.insert(deliveryTasks).values(insertTask).returning();
    return result[0];
  }

  async getDeliveryTask(id: string): Promise<DeliveryTaskWithDetails | undefined> {
    const result = await db.select()
      .from(deliveryTasks)
      .where(eq(deliveryTasks.id, id))
      .limit(1);

    if (result.length === 0) {
      return undefined;
    }

    const task = result[0];
    const order = await this.getOrderWithCustomer(task.orderId);
    const assignedTo = await this.getUser(task.assignedToUserId);
    const assignedBy = await this.getUser(task.assignedByUserId);
    
    if (!order || !assignedTo || !assignedBy) {
      return undefined;
    }

    return {
      ...task,
      order,
      assignedTo,
      assignedBy,
    };
  }

  async getDeliveryTasksByUserId(userId: string): Promise<DeliveryTaskWithDetails[]> {
    const tasks = await db.select()
      .from(deliveryTasks)
      .where(eq(deliveryTasks.assignedToUserId, userId))
      .orderBy(desc(deliveryTasks.createdAt));

    const tasksWithDetails = await Promise.all(tasks.map(async (task) => {
      const order = await this.getOrderWithCustomer(task.orderId);
      const assignedTo = await this.getUser(task.assignedToUserId);
      const assignedBy = await this.getUser(task.assignedByUserId);
      
      if (!order || !assignedTo || !assignedBy) {
        throw new Error("Task data incomplete");
      }

      return {
        ...task,
        order,
        assignedTo,
        assignedBy,
      };
    }));

    return tasksWithDetails;
  }

  async getAllDeliveryTasks(): Promise<DeliveryTaskWithDetails[]> {
    const tasks = await db.select()
      .from(deliveryTasks)
      .orderBy(desc(deliveryTasks.createdAt));

    const tasksWithDetails = await Promise.all(tasks.map(async (task) => {
      const order = await this.getOrderWithCustomer(task.orderId);
      const assignedTo = await this.getUser(task.assignedToUserId);
      const assignedBy = await this.getUser(task.assignedByUserId);
      
      if (!order || !assignedTo || !assignedBy) {
        throw new Error("Task data incomplete");
      }

      return {
        ...task,
        order,
        assignedTo,
        assignedBy,
      };
    }));

    return tasksWithDetails;
  }

  async updateDeliveryTask(id: string, updateTask: Partial<InsertDeliveryTask>): Promise<DeliveryTask | undefined> {
    const result = await db.update(deliveryTasks)
      .set({ ...updateTask, updatedAt: new Date() })
      .where(eq(deliveryTasks.id, id))
      .returning();
    return result[0];
  }

  async deleteDeliveryTask(id: string): Promise<boolean> {
    const result = await db.delete(deliveryTasks).where(eq(deliveryTasks.id, id)).returning();
    return result.length > 0;
  }

  async getShippingStaffUsers(): Promise<User[]> {
    return await db.select()
      .from(users)
      .where(and(eq(users.role, "shipping_staff"), eq(users.isActive, true)));
  }
}

export const storage = new PostgreSQLStorage();
