import type { Express } from "express";
import { createServer, type Server } from "http";
import passport from "passport";
import { Strategy as LocalStrategy } from "passport-local";
import session from "express-session";
import { storage } from "./storage";
import { hashPassword, verifyPassword } from "./auth";
import { requireAuth, requireOwner, requireOperational, requireDeliveryManager, requireShippingStaff, requireDeliveryAccess } from "./middleware";
import { ObjectStorageService } from "./objectStorage";
import { ObjectPermission } from "./objectAcl";
import {
  insertUserSchema,
  insertCustomerSchema,
  insertOrderSchema,
  insertOrderItemSchema,
  insertShippingRateSchema,
  insertCommissionRuleSchema,
  insertSettingSchema,
  insertMessageSchema,
  insertDeliveryTaskSchema,
  loginSchema,
} from "@shared/schema";

declare global {
  namespace Express {
    interface User {
      id: string;
      username: string;
      role: "owner" | "customer_service" | "receptionist" | "sorter" | "stock_manager" | "shipping_staff";
      firstName: string;
      lastName: string;
      email: string;
      isActive: boolean;
    }
  }
}

// Shared helper to compute order financials from items
async function computeOrderFinancials(orderId: string) {
  const allItems = await storage.getOrderItems(orderId);
  const order = await storage.getOrder(orderId);
  
  if (!order) {
    return null;
  }

  // Calculate items subtotal (customer pays original price)
  const itemsSubtotal = allItems.reduce((sum, i) => {
    const originalPrice = parseFloat(i.originalPrice || '0');
    const quantity = i.quantity;
    return sum + (originalPrice * quantity);
  }, 0);

  // Calculate items profit: (original - discounted) * quantity
  const itemsProfit = allItems.reduce((sum, i) => {
    const originalPrice = parseFloat(i.originalPrice || '0');
    const discountedPrice = parseFloat(i.discountedPrice || '0');
    const quantity = i.quantity;
    return sum + ((originalPrice - discountedPrice) * quantity);
  }, 0);

  const shippingCost = parseFloat(order.shippingCost || '0');
  const commission = parseFloat(order.commission || '0');
  const totalAmount = itemsSubtotal + shippingCost + commission;
  const shippingProfit = parseFloat(order.shippingProfit || '0');
  // Total Profit = Items Profit + Shipping Profit + Commission
  const totalProfit = itemsProfit + shippingProfit + commission;

  return {
    totalAmount: totalAmount.toFixed(2),
    itemsProfit: itemsProfit.toFixed(2),
    totalProfit: totalProfit.toFixed(2),
  };
}

export async function registerRoutes(app: Express): Promise<Server> {
  // Session configuration
  app.use(
    session({
      secret: process.env.SESSION_SECRET || "your-secret-key",
      resave: false,
      saveUninitialized: false,
      cookie: {
        secure: false,
        maxAge: 24 * 60 * 60 * 1000, // 24 hours
      },
    })
  );

  // Passport configuration
  passport.use(
    new LocalStrategy(async (username, password, done) => {
      try {
        const user = await storage.getUserByUsername(username);
        if (!user) {
          return done(null, false, { message: "Invalid username or password" });
        }

        const isValid = await verifyPassword(password, user.password);
        if (!isValid) {
          return done(null, false, { message: "Invalid username or password" });
        }

        if (!user.isActive) {
          return done(null, false, { message: "Account is disabled" });
        }

        return done(null, {
          id: user.id,
          username: user.username,
          role: user.role,
          firstName: user.firstName,
          lastName: user.lastName,
          email: user.email,
          isActive: user.isActive,
        });
      } catch (error) {
        return done(error);
      }
    })
  );

  passport.serializeUser((user, done) => {
    done(null, user.id);
  });

  passport.deserializeUser(async (id: string, done) => {
    try {
      const user = await storage.getUser(id);
      if (!user) {
        return done(null, false);
      }
      done(null, {
        id: user.id,
        username: user.username,
        role: user.role,
        firstName: user.firstName,
        lastName: user.lastName,
        email: user.email,
        isActive: user.isActive,
      });
    } catch (error) {
      done(error);
    }
  });

  app.use(passport.initialize());
  app.use(passport.session());

  // Authentication routes
  app.post("/api/auth/login", (req, res, next) => {
    const result = loginSchema.safeParse(req.body);
    if (!result.success) {
      return res.status(400).json({ message: "Invalid credentials format" });
    }

    passport.authenticate("local", (err: any, user: any, info: any) => {
      if (err) {
        return next(err);
      }
      if (!user) {
        return res.status(401).json({ message: info.message || "Authentication failed" });
      }
      req.logIn(user, (err) => {
        if (err) {
          return next(err);
        }
        res.json({ user });
      });
    })(req, res, next);
  });

  app.post("/api/auth/logout", (req, res) => {
    req.logout((err) => {
      if (err) {
        return res.status(500).json({ message: "Logout failed" });
      }
      res.json({ message: "Logged out successfully" });
    });
  });

  app.get("/api/auth/me", (req, res) => {
    if (req.isAuthenticated()) {
      res.json({ user: req.user });
    } else {
      res.status(401).json({ message: "Not authenticated" });
    }
  });

  // User management routes
  app.get("/api/users", requireOwner, async (req, res) => {
    try {
      const users = await storage.getAllUsers();
      const safeUsers = users.map(({ password, ...user }) => user);
      res.json(safeUsers);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch users" });
    }
  });

  app.post("/api/users", requireOwner, async (req, res) => {
    try {
      const result = insertUserSchema.safeParse(req.body);
      if (!result.success) {
        return res.status(400).json({ message: "Invalid user data", errors: result.error.errors });
      }

      const hashedPassword = await hashPassword(result.data.password);
      const user = await storage.createUser({
        ...result.data,
        password: hashedPassword,
      });

      const { password, ...safeUser } = user;
      res.status(201).json(safeUser);
    } catch (error) {
      res.status(500).json({ message: "Failed to create user" });
    }
  });

  app.put("/api/users/:id", requireOwner, async (req, res) => {
    try {
      const { id } = req.params;
      const result = insertUserSchema.partial().safeParse(req.body);
      if (!result.success) {
        return res.status(400).json({ message: "Invalid user data", errors: result.error.errors });
      }

      let updateData = result.data;
      if (updateData.password) {
        updateData.password = await hashPassword(updateData.password);
      }

      const user = await storage.updateUser(id, updateData);
      if (!user) {
        return res.status(404).json({ message: "User not found" });
      }

      const { password, ...safeUser } = user;
      res.json(safeUser);
    } catch (error) {
      res.status(500).json({ message: "Failed to update user" });
    }
  });

  app.delete("/api/users/:id", requireOwner, async (req, res) => {
    try {
      const { id } = req.params;
      const success = await storage.deleteUser(id);
      if (!success) {
        return res.status(404).json({ message: "User not found" });
      }
      res.json({ message: "User deleted successfully" });
    } catch (error) {
      res.status(500).json({ message: "Failed to delete user" });
    }
  });

  // Customer routes
  app.get("/api/customers", requireOperational, async (req, res) => {
    try {
      const customers = await storage.getAllCustomers();
      res.json(customers);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch customers" });
    }
  });

  app.get("/api/customers/search/phone", requireOperational, async (req, res) => {
    try {
      const { phone } = req.query;
      if (!phone || typeof phone !== "string") {
        return res.status(400).json({ message: "Phone number is required" });
      }
      const customer = await storage.getCustomerByPhone(phone);
      if (!customer) {
        return res.status(404).json({ message: "Customer not found" });
      }
      res.json(customer);
    } catch (error) {
      res.status(500).json({ message: "Failed to search customer" });
    }
  });

  app.get("/api/customers/search", requireOperational, async (req, res) => {
    try {
      const { query } = req.query;
      if (!query || typeof query !== "string") {
        return res.status(400).json({ message: "Search query is required" });
      }
      const customers = await storage.searchCustomers(query);
      res.json(customers);
    } catch (error) {
      res.status(500).json({ message: "Failed to search customers" });
    }
  });

  app.get("/api/customers/:id", requireOperational, async (req, res) => {
    try {
      const customer = await storage.getCustomerWithOrders(req.params.id);
      if (!customer) {
        return res.status(404).json({ message: "Customer not found" });
      }
      res.json(customer);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch customer" });
    }
  });

  app.post("/api/customers", requireOperational, async (req, res) => {
    try {
      const result = insertCustomerSchema.safeParse(req.body);
      if (!result.success) {
        return res.status(400).json({ message: "Invalid customer data", errors: result.error.errors });
      }

      const customer = await storage.createCustomer(result.data);
      res.status(201).json(customer);
    } catch (error) {
      res.status(500).json({ message: "Failed to create customer" });
    }
  });

  app.put("/api/customers/:id", requireOperational, async (req, res) => {
    try {
      const result = insertCustomerSchema.partial().safeParse(req.body);
      if (!result.success) {
        return res.status(400).json({ message: "Invalid customer data", errors: result.error.errors });
      }

      const customer = await storage.updateCustomer(req.params.id, result.data);
      if (!customer) {
        return res.status(404).json({ message: "Customer not found" });
      }
      res.json(customer);
    } catch (error) {
      console.error("Error updating customer:", error);
      res.status(500).json({ message: "Failed to update customer", error: error instanceof Error ? error.message : String(error) });
    }
  });

  app.put("/api/customers/:id/update-with-payment", requireOperational, async (req, res) => {
    try {
      const { customerData, totalDownPayment } = req.body;
      
      const result = insertCustomerSchema.partial().safeParse(customerData);
      if (!result.success) {
        return res.status(400).json({ message: "Invalid customer data", errors: result.error.errors });
      }

      if (typeof totalDownPayment !== 'number' || totalDownPayment < 0 || isNaN(totalDownPayment)) {
        return res.status(400).json({ message: "Invalid down payment value" });
      }

      const customerOrders = await storage.getOrdersByCustomerId(req.params.id);
      
      if (customerOrders.length > 0) {
        const totalOrderAmount = customerOrders.reduce((sum: number, order) => sum + parseFloat(order.totalAmount), 0);
        
        if (totalOrderAmount <= 0 || isNaN(totalOrderAmount)) {
          return res.status(400).json({ message: "No valid orders to distribute payment to" });
        }
      }

      const customer = await storage.updateCustomer(req.params.id, result.data);
      if (!customer) {
        return res.status(404).json({ message: "Customer not found" });
      }

      if (customerOrders.length > 0) {
        const totalOrderAmount = customerOrders.reduce((sum: number, order) => sum + parseFloat(order.totalAmount), 0);
        const cappedDownPayment = Math.min(totalDownPayment, totalOrderAmount);
        
        let distributedSoFar = 0;
        
        for (let i = 0; i < customerOrders.length; i++) {
          const order = customerOrders[i];
          const orderAmount = parseFloat(order.totalAmount);
          
          let orderDownPayment: number;
          if (i === customerOrders.length - 1) {
            orderDownPayment = Math.min(cappedDownPayment - distributedSoFar, orderAmount);
          } else {
            const proportion = orderAmount / totalOrderAmount;
            orderDownPayment = Math.min(cappedDownPayment * proportion, orderAmount);
            distributedSoFar += orderDownPayment;
          }
          
          const orderRemaining = Math.max(0, orderAmount - orderDownPayment);
          
          await storage.updateOrder(order.id, {
            downPayment: orderDownPayment.toFixed(2),
            remainingBalance: orderRemaining.toFixed(2)
          });
        }
      }

      res.json({ customer, message: "Customer and payments updated successfully" });
    } catch (error) {
      console.error("Error updating customer with payment:", error);
      res.status(500).json({ message: "Failed to update customer", error: error instanceof Error ? error.message : String(error) });
    }
  });

  app.delete("/api/customers/:id", requireOperational, async (req, res) => {
    try {
      const success = await storage.deleteCustomer(req.params.id);
      if (!success) {
        return res.status(404).json({ message: "Customer not found" });
      }
      res.json({ message: "Customer deleted successfully" });
    } catch (error) {
      res.status(500).json({ message: "Failed to delete customer" });
    }
  });

  // Order routes
  app.get("/api/orders", requireAuth, async (req, res) => {
    try {
      const orders = await storage.getAllOrders();
      res.json(orders);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch orders" });
    }
  });

  app.get("/api/orders/:id", requireAuth, async (req, res) => {
    try {
      const order = await storage.getOrderWithCustomer(req.params.id);
      if (!order) {
        return res.status(404).json({ message: "Order not found" });
      }
      res.json(order);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch order" });
    }
  });

  app.post("/api/orders", requireOperational, async (req, res) => {
    try {
      // Check if request contains order and items data (new format)
      if (req.body.order && req.body.items) {
        const orderResult = insertOrderSchema.safeParse(req.body.order);
        if (!orderResult.success) {
          return res.status(400).json({ message: "Invalid order data", errors: orderResult.error.errors });
        }

        const itemsResult = req.body.items.map((item: any) => 
          insertOrderItemSchema.omit({ orderId: true }).safeParse(item)
        );
        
        const invalidItems = itemsResult.filter((result: any) => !result.success);
        if (invalidItems.length > 0) {
          return res.status(400).json({ message: "Invalid order items data", errors: invalidItems });
        }

        // Create order first
        const order = await storage.createOrder(orderResult.data);
        
        // Create order items
        const items = [];
        for (const itemData of req.body.items) {
          const item = await storage.createOrderItem({
            ...itemData,
            orderId: order.id,
          });
          items.push(item);
        }

        // Create order images if provided
        if (req.body.images && Array.isArray(req.body.images)) {
          for (let i = 0; i < Math.min(req.body.images.length, 3); i++) {
            const imageData = req.body.images[i];
            if (imageData.url) {
              await storage.createOrderImage({
                orderId: order.id,
                url: imageData.url,
                altText: imageData.altText || null,
                position: i,
              });
            }
          }
        }

        // Recalculate profit from items
        const financials = await computeOrderFinancials(order.id);
        if (financials) {
          await storage.updateOrder(order.id, financials);
        }

        // Return order with items
        const orderWithItems = await storage.getOrderWithCustomer(order.id);
        res.status(201).json(orderWithItems);
      } else {
        // Legacy format - just order data
        const result = insertOrderSchema.safeParse(req.body);
        if (!result.success) {
          return res.status(400).json({ message: "Invalid order data", errors: result.error.errors });
        }

        const order = await storage.createOrder(result.data);
        res.status(201).json(order);
      }
    } catch (error) {
      console.error("Order creation error:", error);
      res.status(500).json({ message: "Failed to create order" });
    }
  });

  app.put("/api/orders/:id", requireOperational, async (req, res) => {
    try {
      const result = insertOrderSchema.partial().safeParse(req.body);
      if (!result.success) {
        return res.status(400).json({ message: "Invalid order data", errors: result.error.errors });
      }

      // Update order first
      const order = await storage.updateOrder(req.params.id, result.data);
      if (!order) {
        return res.status(404).json({ message: "Order not found" });
      }

      // Recalculate profit from current items
      const financials = await computeOrderFinancials(req.params.id);
      if (financials) {
        await storage.updateOrder(req.params.id, financials);
      }

      // Return updated order
      const updatedOrder = await storage.getOrder(req.params.id);
      res.json(updatedOrder);
    } catch (error) {
      res.status(500).json({ message: "Failed to update order" });
    }
  });

  app.delete("/api/orders/:id", requireOperational, async (req, res) => {
    try {
      const success = await storage.deleteOrder(req.params.id);
      if (!success) {
        return res.status(404).json({ message: "Order not found" });
      }
      res.json({ message: "Order deleted successfully" });
    } catch (error) {
      res.status(500).json({ message: "Failed to delete order" });
    }
  });

  // Order Items routes
  app.get("/api/orders/:orderId/items", requireAuth, async (req, res) => {
    try {
      const items = await storage.getOrderItems(req.params.orderId);
      res.json(items);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch order items" });
    }
  });

  app.post("/api/orders/:orderId/items", requireOperational, async (req, res) => {
    try {
      const result = insertOrderItemSchema.safeParse({
        ...req.body,
        orderId: req.params.orderId,
      });
      if (!result.success) {
        return res.status(400).json({ message: "Invalid order item data", errors: result.error.errors });
      }

      const item = await storage.createOrderItem(result.data);
      res.status(201).json(item);
    } catch (error) {
      res.status(500).json({ message: "Failed to create order item" });
    }
  });

  app.put("/api/order-items/:id", requireOperational, async (req, res) => {
    try {
      const result = insertOrderItemSchema.partial().safeParse(req.body);
      if (!result.success) {
        return res.status(400).json({ message: "Invalid order item data", errors: result.error.errors });
      }

      const item = await storage.updateOrderItem(req.params.id, result.data);
      if (!item) {
        return res.status(404).json({ message: "Order item not found" });
      }

      // Recalculate order totals using shared helper
      const financials = await computeOrderFinancials(item.orderId);
      if (financials) {
        await storage.updateOrder(item.orderId, financials);
      }

      res.json(item);
    } catch (error) {
      console.error("Failed to update order item:", error);
      res.status(500).json({ message: "Failed to update order item" });
    }
  });

  // Order Images route - Get all images with order details for gallery (paginated)
  app.get("/api/order-images", requireAuth, async (req, res) => {
    try {
      // Parse and validate pagination parameters
      let page = parseInt(req.query.page as string) || 1;
      let limit = parseInt(req.query.limit as string) || 20;
      
      // Clamp values to reasonable ranges
      page = Math.max(1, page);
      limit = Math.max(1, Math.min(100, limit)); // Max 100 items per page

      const { images, total } = await storage.getAllOrderImagesWithOrders(page, limit);

      res.json({
        images,
        pagination: {
          page,
          limit,
          total,
          totalPages: Math.ceil(total / limit),
          hasNext: (page * limit) < total,
          hasPrevious: page > 1
        }
      });
    } catch (error) {
      console.error("Failed to fetch order images:", error);
      res.status(500).json({ message: "Failed to fetch order images" });
    }
  });

  // Delete order image
  app.delete("/api/order-images/:id", requireAuth, async (req, res) => {
    try {
      const { id } = req.params;
      const success = await storage.deleteOrderImage(id);
      
      if (!success) {
        return res.status(404).json({ message: "Image not found" });
      }
      
      res.json({ message: "Image deleted successfully" });
    } catch (error) {
      console.error("Failed to delete order image:", error);
      res.status(500).json({ message: "Failed to delete order image" });
    }
  });

  // Shipping rates routes
  app.get("/api/shipping-rates", requireAuth, async (req, res) => {
    try {
      const rates = await storage.getAllShippingRates();
      res.json(rates);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch shipping rates" });
    }
  });

  app.post("/api/shipping-rates", requireOwner, async (req, res) => {
    try {
      const result = insertShippingRateSchema.safeParse(req.body);
      if (!result.success) {
        return res.status(400).json({ message: "Invalid shipping rate data", errors: result.error.errors });
      }

      const rate = await storage.createShippingRate(result.data);
      res.status(201).json(rate);
    } catch (error) {
      res.status(500).json({ message: "Failed to create shipping rate" });
    }
  });

  // Analytics routes
  app.get("/api/analytics/dashboard", requireAuth, async (req, res) => {
    try {
      const [totalProfit, totalRevenue, activeOrders] = await Promise.all([
        storage.getTotalProfit(),
        storage.getTotalRevenue(),
        storage.getActiveOrdersCount(),
      ]);

      const profitMargin = totalRevenue > 0 ? (totalProfit / totalRevenue) * 100 : 0;

      res.json({
        totalProfit,
        totalRevenue,
        activeOrders,
        profitMargin,
      });
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch analytics data" });
    }
  });

  // Settings routes
  app.get("/api/settings", requireOwner, async (req, res) => {
    try {
      const settings = await storage.getAllSettings();
      res.json(settings);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch settings" });
    }
  });

  app.get("/api/settings/:key", requireOwner, async (req, res) => {
    try {
      const setting = await storage.getSetting(req.params.key);
      if (!setting) {
        return res.status(404).json({ message: "Setting not found" });
      }
      res.json(setting);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch setting" });
    }
  });

  app.post("/api/settings", requireOwner, async (req, res) => {
    try {
      const result = insertSettingSchema.safeParse(req.body);
      if (!result.success) {
        return res.status(400).json({ message: "Invalid setting data", errors: result.error.errors });
      }

      const setting = await storage.createSetting(result.data);
      res.status(201).json(setting);
    } catch (error) {
      res.status(500).json({ message: "Failed to create setting" });
    }
  });

  app.put("/api/settings/:key", requireOwner, async (req, res) => {
    try {
      const { value, type } = req.body;
      if (!value) {
        return res.status(400).json({ message: "Value is required" });
      }

      const setting = await storage.updateSetting(req.params.key, value, type);
      if (!setting) {
        return res.status(404).json({ message: "Setting not found" });
      }
      res.json(setting);
    } catch (error) {
      res.status(500).json({ message: "Failed to update setting" });
    }
  });

  app.delete("/api/settings/:key", requireOwner, async (req, res) => {
    try {
      const success = await storage.deleteSetting(req.params.key);
      if (!success) {
        return res.status(404).json({ message: "Setting not found" });
      }
      res.json({ message: "Setting deleted successfully" });
    } catch (error) {
      res.status(500).json({ message: "Failed to delete setting" });
    }
  });

  // Shipping Rates routes
  app.get("/api/shipping-rates", requireOwner, async (req, res) => {
    try {
      const shippingRates = await storage.getAllShippingRates();
      res.json(shippingRates);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch shipping rates" });
    }
  });

  app.post("/api/shipping-rates", requireOwner, async (req, res) => {
    try {
      const result = insertShippingRateSchema.safeParse(req.body);
      if (!result.success) {
        return res.status(400).json({ message: "Invalid shipping rate data", errors: result.error.errors });
      }

      const shippingRate = await storage.createShippingRate(result.data);
      res.status(201).json(shippingRate);
    } catch (error) {
      console.error("Error creating shipping rate:", error);
      res.status(500).json({ message: "Failed to create shipping rate" });
    }
  });

  app.put("/api/shipping-rates/:id", requireOwner, async (req, res) => {
    try {
      const result = insertShippingRateSchema.partial().safeParse(req.body);
      if (!result.success) {
        return res.status(400).json({ message: "Invalid shipping rate data", errors: result.error.errors });
      }

      const shippingRate = await storage.updateShippingRate(req.params.id, result.data);
      if (!shippingRate) {
        return res.status(404).json({ message: "Shipping rate not found" });
      }
      res.json(shippingRate);
    } catch (error) {
      res.status(500).json({ message: "Failed to update shipping rate" });
    }
  });

  app.delete("/api/shipping-rates/:id", requireOwner, async (req, res) => {
    try {
      const success = await storage.deleteShippingRate(req.params.id);
      if (!success) {
        return res.status(404).json({ message: "Shipping rate not found" });
      }
      res.json({ message: "Shipping rate deleted successfully" });
    } catch (error) {
      res.status(500).json({ message: "Failed to delete shipping rate" });
    }
  });

  app.get("/api/shipping-countries", requireAuth, async (req, res) => {
    try {
      const shippingRates = await storage.getAllShippingRates();
      const countriesSet = new Set(shippingRates.map(rate => rate.country));
      const uniqueCountries = Array.from(countriesSet);
      res.json(uniqueCountries);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch shipping countries" });
    }
  });

  // Commission Rules routes
  app.get("/api/commission-rules", requireOwner, async (req, res) => {
    try {
      const commissionRules = await storage.getAllCommissionRules();
      res.json(commissionRules);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch commission rules" });
    }
  });

  app.post("/api/commission-rules", requireOwner, async (req, res) => {
    try {
      // Handle empty maxValue by converting to null
      const processedData = {
        ...req.body,
        maxValue: req.body.maxValue === "" || req.body.maxValue === null || req.body.maxValue === undefined ? null : req.body.maxValue,
      };

      const result = insertCommissionRuleSchema.safeParse(processedData);
      if (!result.success) {
        return res.status(400).json({ message: "Invalid commission rule data", errors: result.error.errors });
      }

      const commissionRule = await storage.createCommissionRule(result.data);
      res.status(201).json(commissionRule);
    } catch (error) {
      console.error("Error creating commission rule:", error);
      res.status(500).json({ message: "Failed to create commission rule" });
    }
  });

  app.put("/api/commission-rules/:id", requireOwner, async (req, res) => {
    try {
      // Handle empty maxValue by converting to null
      const processedData = {
        ...req.body,
        maxValue: req.body.maxValue === "" || req.body.maxValue === null || req.body.maxValue === undefined ? null : req.body.maxValue,
      };

      const result = insertCommissionRuleSchema.partial().safeParse(processedData);
      if (!result.success) {
        return res.status(400).json({ message: "Invalid commission rule data", errors: result.error.errors });
      }

      const commissionRule = await storage.updateCommissionRule(req.params.id, result.data);
      if (!commissionRule) {
        return res.status(404).json({ message: "Commission rule not found" });
      }
      res.json(commissionRule);
    } catch (error) {
      console.error("Error updating commission rule:", error);
      res.status(500).json({ message: "Failed to update commission rule" });
    }
  });

  app.delete("/api/commission-rules/:id", requireOwner, async (req, res) => {
    try {
      const success = await storage.deleteCommissionRule(req.params.id);
      if (!success) {
        return res.status(404).json({ message: "Commission rule not found" });
      }
      res.json({ message: "Commission rule deleted successfully" });
    } catch (error) {
      res.status(500).json({ message: "Failed to delete commission rule" });
    }
  });

  // Shipping Calculation route
  app.post("/api/calculate-shipping", requireAuth, async (req, res) => {
    try {
      const { country, category, weight, orderValue } = req.body;
      
      if (!country || !category || !weight || !orderValue) {
        return res.status(400).json({ 
          message: "Missing required fields: country, category, weight, orderValue" 
        });
      }

      const calculation = await storage.calculateShipping(country, category, weight, orderValue);
      res.json(calculation);
    } catch (error) {
      res.status(500).json({ 
        message: error instanceof Error ? error.message : "Failed to calculate shipping" 
      });
    }
  });

  // Messages routes
  app.get("/api/messages/recipients", requireAuth, async (req, res) => {
    try {
      const users = await storage.getAllUsers();
      // Return minimal user data for recipient selection (exclude passwords and sensitive info)
      const recipients = users
        .filter(u => u.id !== req.user?.id) // Exclude current user
        .map(({ id, firstName, lastName, role }) => ({
          id,
          firstName,
          lastName,
          role,
        }));
      res.json(recipients);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch recipients" });
    }
  });

  app.post("/api/messages", requireAuth, async (req, res) => {
    try {
      const result = insertMessageSchema.safeParse(req.body);
      if (!result.success) {
        return res.status(400).json({ message: "Invalid message data", errors: result.error.errors });
      }

      const message = await storage.createMessage(result.data);
      res.status(201).json(message);
    } catch (error) {
      res.status(500).json({ message: "Failed to send message" });
    }
  });

  app.get("/api/messages", requireAuth, async (req, res) => {
    try {
      if (!req.user) {
        return res.status(401).json({ message: "Not authenticated" });
      }

      const messages = await storage.getMessagesByUserId(req.user.id);
      res.json(messages);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch messages" });
    }
  });

  app.get("/api/messages/unread-count", requireAuth, async (req, res) => {
    try {
      if (!req.user) {
        return res.status(401).json({ message: "Not authenticated" });
      }

      const count = await storage.getUnreadMessageCount(req.user.id);
      res.json({ count });
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch unread count" });
    }
  });

  app.patch("/api/messages/:id/read", requireAuth, async (req, res) => {
    try {
      const message = await storage.markMessageAsRead(req.params.id);
      if (!message) {
        return res.status(404).json({ message: "Message not found" });
      }
      res.json(message);
    } catch (error) {
      res.status(500).json({ message: "Failed to mark message as read" });
    }
  });

  app.delete("/api/messages/:id", requireAuth, async (req, res) => {
    try {
      const success = await storage.deleteMessage(req.params.id);
      if (!success) {
        return res.status(404).json({ message: "Message not found" });
      }
      res.json({ message: "Message deleted successfully" });
    } catch (error) {
      res.status(500).json({ message: "Failed to delete message" });
    }
  });

  // Profile management routes (for users to edit their own profile)
  app.patch("/api/profile", requireAuth, async (req, res) => {
    try {
      if (!req.user) {
        return res.status(401).json({ message: "Not authenticated" });
      }

      const { username, firstName, lastName } = req.body;
      
      // Validate input
      if (!username || username.trim().length === 0) {
        return res.status(400).json({ message: "Username is required" });
      }

      // Check if username is already taken by another user
      const existingUser = await storage.getUserByUsername(username);
      if (existingUser && existingUser.id !== req.user.id) {
        return res.status(400).json({ message: "Username already taken" });
      }

      const updatedUser = await storage.updateUser(req.user.id, {
        username: username.trim(),
        firstName: firstName?.trim(),
        lastName: lastName?.trim(),
      });

      if (!updatedUser) {
        return res.status(404).json({ message: "User not found" });
      }

      const { password, ...safeUser } = updatedUser;
      res.json(safeUser);
    } catch (error) {
      res.status(500).json({ message: "Failed to update profile" });
    }
  });

  app.patch("/api/profile/password", requireAuth, async (req, res) => {
    try {
      if (!req.user) {
        return res.status(401).json({ message: "Not authenticated" });
      }

      const { currentPassword, newPassword } = req.body;
      
      // Validate input
      if (!currentPassword || !newPassword) {
        return res.status(400).json({ message: "Current and new passwords are required" });
      }

      if (newPassword.length < 6) {
        return res.status(400).json({ message: "New password must be at least 6 characters" });
      }

      // Get current user from database
      const user = await storage.getUser(req.user.id);
      if (!user) {
        return res.status(404).json({ message: "User not found" });
      }

      // Verify current password
      const isValidPassword = await verifyPassword(currentPassword, user.password);
      if (!isValidPassword) {
        return res.status(401).json({ message: "Current password is incorrect" });
      }

      // Hash new password and update
      const hashedPassword = await hashPassword(newPassword);
      const updatedUser = await storage.updateUser(req.user.id, {
        password: hashedPassword,
      });

      if (!updatedUser) {
        return res.status(404).json({ message: "User not found" });
      }

      res.json({ message: "Password updated successfully" });
    } catch (error) {
      res.status(500).json({ message: "Failed to update password" });
    }
  });

  // Delivery Tasks routes
  // Create a new delivery task (assign task to shipping staff) - managers only
  app.post("/api/delivery-tasks", requireDeliveryManager, async (req, res) => {
    try {
      const result = insertDeliveryTaskSchema.safeParse(req.body);
      if (!result.success) {
        return res.status(400).json({ message: "Invalid task data", errors: result.error.errors });
      }

      const task = await storage.createDeliveryTask(result.data);
      res.status(201).json(task);
    } catch (error) {
      console.error("Error creating delivery task:", error);
      res.status(500).json({ message: "Failed to create delivery task" });
    }
  });

  // Get all delivery tasks (for managers/admins) or user's tasks (for shipping staff)
  app.get("/api/delivery-tasks", requireDeliveryAccess, async (req, res) => {
    try {
      if (!req.user) {
        return res.status(401).json({ message: "Not authenticated" });
      }

      // If user is shipping staff, only show their tasks
      if (req.user.role === "shipping_staff") {
        const tasks = await storage.getDeliveryTasksByUserId(req.user.id);
        return res.json(tasks);
      }

      // For other roles, show all tasks
      const tasks = await storage.getAllDeliveryTasks();
      res.json(tasks);
    } catch (error) {
      console.error("Error fetching delivery tasks:", error);
      res.status(500).json({ message: "Failed to fetch delivery tasks" });
    }
  });

  // Get a specific delivery task
  app.get("/api/delivery-tasks/:id", requireDeliveryAccess, async (req, res) => {
    try {
      const task = await storage.getDeliveryTask(req.params.id);
      if (!task) {
        return res.status(404).json({ message: "Task not found" });
      }
      
      // Shipping staff can only view their own tasks
      if (req.user!.role === "shipping_staff" && task.assignedToUserId !== req.user!.id) {
        return res.status(403).json({ message: "Insufficient permissions" });
      }
      
      res.json(task);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch delivery task" });
    }
  });

  // Update delivery task (change status, add notes, etc.)
  app.patch("/api/delivery-tasks/:id", requireDeliveryAccess, async (req, res) => {
    try {
      // First, get the task to check ownership
      const existingTask = await storage.getDeliveryTask(req.params.id);
      if (!existingTask) {
        return res.status(404).json({ message: "Task not found" });
      }
      
      // Shipping staff can only update their own tasks
      if (req.user!.role === "shipping_staff" && existingTask.assignedToUserId !== req.user!.id) {
        return res.status(403).json({ message: "Insufficient permissions" });
      }
      
      const { status, customerCode, paymentAmount, notes, completedAt } = req.body;
      
      const updateData: any = {};
      if (status) updateData.status = status;
      if (customerCode !== undefined) updateData.customerCode = customerCode;
      if (paymentAmount !== undefined) updateData.paymentAmount = paymentAmount;
      if (notes !== undefined) updateData.notes = notes;
      if (completedAt !== undefined) {
        // Convert ISO string to Date object for Drizzle timestamp column
        updateData.completedAt = typeof completedAt === 'string' ? new Date(completedAt) : completedAt;
      }
      
      const task = await storage.updateDeliveryTask(req.params.id, updateData);
      if (!task) {
        return res.status(404).json({ message: "Task not found" });
      }
      res.json(task);
    } catch (error) {
      console.error("Error updating delivery task:", error);
      res.status(500).json({ message: "Failed to update delivery task", error: error instanceof Error ? error.message : String(error) });
    }
  });

  // Delete delivery task - managers only
  app.delete("/api/delivery-tasks/:id", requireDeliveryManager, async (req, res) => {
    try {
      const success = await storage.deleteDeliveryTask(req.params.id);
      if (!success) {
        return res.status(404).json({ message: "Task not found" });
      }
      res.json({ message: "Task deleted successfully" });
    } catch (error) {
      res.status(500).json({ message: "Failed to delete delivery task" });
    }
  });

  // Get all shipping staff users (for task assignment) - managers only
  app.get("/api/shipping-staff", requireDeliveryManager, async (req, res) => {
    try {
      const shippingStaff = await storage.getShippingStaffUsers();
      const staffList = shippingStaff.map(({ id, firstName, lastName, username }) => ({
        id,
        firstName,
        lastName,
        username,
      }));
      res.json(staffList);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch shipping staff" });
    }
  });

  // Get task history for a specific shipping staff member - managers only
  app.get("/api/delivery-tasks/history/:userId", requireDeliveryManager, async (req, res) => {
    try {
      const tasks = await storage.getDeliveryTasksByUserId(req.params.userId);
      res.json(tasks);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch task history" });
    }
  });

  // Performance Report endpoint - owner only
  app.get("/api/reports/performance", requireOwner, async (req, res) => {
    try {
      const { range = 'daily', dateFrom, dateTo } = req.query;
      const countryFilters = req.query.country ? (Array.isArray(req.query.country) ? req.query.country : [req.query.country]) : [];
      
      // Calculate date ranges
      const now = new Date();
      let startDate: Date, endDate: Date, prevStartDate: Date, prevEndDate: Date;
      
      // Use custom date range if provided
      if (dateFrom && dateTo) {
        startDate = new Date(dateFrom as string);
        startDate.setHours(0, 0, 0, 0);
        endDate = new Date(dateTo as string);
        endDate.setHours(23, 59, 59, 999);
        
        // Calculate previous period with same duration
        const duration = endDate.getTime() - startDate.getTime();
        prevEndDate = new Date(startDate.getTime() - 1);
        prevStartDate = new Date(prevEndDate.getTime() - duration);
      } else if (range === 'daily') {
        // Today
        startDate = new Date(now.getFullYear(), now.getMonth(), now.getDate());
        endDate = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59);
        // Yesterday
        prevStartDate = new Date(startDate);
        prevStartDate.setDate(prevStartDate.getDate() - 1);
        prevEndDate = new Date(prevStartDate.getFullYear(), prevStartDate.getMonth(), prevStartDate.getDate(), 23, 59, 59);
      } else if (range === 'weekly') {
        // This week (last 7 days)
        endDate = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59);
        startDate = new Date(endDate);
        startDate.setDate(startDate.getDate() - 6);
        startDate.setHours(0, 0, 0, 0);
        // Previous week
        prevEndDate = new Date(startDate);
        prevEndDate.setDate(prevEndDate.getDate() - 1);
        prevEndDate.setHours(23, 59, 59);
        prevStartDate = new Date(prevEndDate);
        prevStartDate.setDate(prevStartDate.getDate() - 6);
        prevStartDate.setHours(0, 0, 0, 0);
      } else {
        // This month
        startDate = new Date(now.getFullYear(), now.getMonth(), 1);
        endDate = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59);
        // Previous month
        prevStartDate = new Date(now.getFullYear(), now.getMonth() - 1, 1);
        prevEndDate = new Date(now.getFullYear(), now.getMonth(), 0, 23, 59, 59);
      }
      
      // Get all orders
      const allOrders = await storage.getAllOrders();
      
      // Filter orders for current period
      const currentOrders = allOrders.filter(order => {
        const orderDate = new Date(order.createdAt);
        const matchesDate = orderDate >= startDate && orderDate <= endDate;
        const matchesCountry = countryFilters.length === 0 || countryFilters.includes(order.shippingCountry || "");
        return matchesDate && matchesCountry;
      });
      
      // Filter orders for previous period
      const previousOrders = allOrders.filter(order => {
        const orderDate = new Date(order.createdAt);
        const matchesDate = orderDate >= prevStartDate && orderDate <= prevEndDate;
        const matchesCountry = countryFilters.length === 0 || countryFilters.includes(order.shippingCountry || "");
        return matchesDate && matchesCountry;
      });
      
      // Calculate metrics for current period
      const totalOrders = currentOrders.length;
      const totalSales = currentOrders.reduce((sum, order) => sum + parseFloat(order.totalAmount || "0"), 0);
      const totalProfit = currentOrders.reduce((sum, order) => sum + parseFloat(order.totalProfit || "0"), 0);
      const discountedOrders = currentOrders.filter(order => parseFloat(order.downPayment || "0") > 0).length;
      const avgOrderValue = totalOrders > 0 ? totalSales / totalOrders : 0;
      const avgProfitPerOrder = totalOrders > 0 ? totalProfit / totalOrders : 0;
      
      // Calculate average exchange rate
      const ordersWithRate = currentOrders.filter(order => order.lydExchangeRate && parseFloat(order.lydExchangeRate) > 0);
      const avgExchangeRate = ordersWithRate.length > 0
        ? ordersWithRate.reduce((sum, order) => sum + parseFloat(order.lydExchangeRate || "0"), 0) / ordersWithRate.length
        : 0;
      
      // Calculate metrics for previous period
      const prevTotalOrders = previousOrders.length;
      const prevTotalSales = previousOrders.reduce((sum, order) => sum + parseFloat(order.totalAmount || "0"), 0);
      const prevTotalProfit = previousOrders.reduce((sum, order) => sum + parseFloat(order.totalProfit || "0"), 0);
      
      // Calculate growth percentages
      const orderGrowth = prevTotalOrders > 0 
        ? ((totalOrders - prevTotalOrders) / prevTotalOrders) * 100 
        : totalOrders > 0 ? 100 : 0;
      const salesGrowth = prevTotalSales > 0 
        ? ((totalSales - prevTotalSales) / prevTotalSales) * 100 
        : totalSales > 0 ? 100 : 0;
      const profitGrowth = prevTotalProfit > 0 
        ? ((totalProfit - prevTotalProfit) / prevTotalProfit) * 100 
        : totalProfit > 0 ? 100 : 0;
      
      res.json({
        range,
        period: {
          start: startDate.toISOString(),
          end: endDate.toISOString(),
        },
        previousPeriod: {
          start: prevStartDate.toISOString(),
          end: prevEndDate.toISOString(),
        },
        metrics: {
          totalOrders,
          totalSales: totalSales.toFixed(2),
          totalProfit: totalProfit.toFixed(2),
          discountedOrders,
          avgOrderValue: avgOrderValue.toFixed(2),
          avgProfitPerOrder: avgProfitPerOrder.toFixed(2),
          avgExchangeRate: avgExchangeRate.toFixed(4),
          orderGrowth: orderGrowth.toFixed(2),
          salesGrowth: salesGrowth.toFixed(2),
          profitGrowth: profitGrowth.toFixed(2),
        },
        previousMetrics: {
          totalOrders: prevTotalOrders,
          totalSales: prevTotalSales.toFixed(2),
          totalProfit: prevTotalProfit.toFixed(2),
        }
      });
    } catch (error) {
      console.error("Performance report error:", error);
      res.status(500).json({ message: "Failed to generate performance report" });
    }
  });

  // Direct base64 image upload (works everywhere)
  app.post("/api/upload-image", requireAuth, async (req, res) => {
    try {
      const { imageData, contentType } = req.body;
      
      // Validate content type - include mobile formats (HEIC/HEIF)
      const validImageTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/webp', 'image/heic', 'image/heif'];
      if (!contentType || !validImageTypes.includes(contentType.toLowerCase())) {
        return res.status(400).json({ message: "Invalid file type. Only JPG, PNG, GIF, WEBP, HEIC, and HEIF images are allowed." });
      }
      
      // Validate base64 data
      if (!imageData || !imageData.startsWith('data:image/')) {
        return res.status(400).json({ message: "Invalid image data" });
      }
      
      // Check size (max 10MB for base64 - increased for mobile photos)
      const sizeInBytes = (imageData.length * 3) / 4;
      const maxSize = 10 * 1024 * 1024; // 10MB
      if (sizeInBytes > maxSize) {
        return res.status(400).json({ message: "File size must be less than 10MB" });
      }
      
      console.log(`[Upload] Image uploaded by user ${req.user?.id}: ${contentType}, ${Math.round(sizeInBytes / 1024)}KB`);
      
      // Return the base64 data URL directly (it's already in the right format)
      res.json({ imageUrl: imageData });
    } catch (error: any) {
      console.error("Image upload error:", error);
      res.status(500).json({ message: error.message || "Failed to upload image" });
    }
  });

  // Confirm upload and set ACL to public
  app.post("/api/upload-confirm", requireAuth, async (req, res) => {
    try {
      const { uploadUrl } = req.body;
      
      if (!uploadUrl) {
        return res.status(400).json({ message: "Upload URL is required" });
      }
      
      const objectStorage = new ObjectStorageService();
      
      // Normalize the path and set ACL to public
      const normalizedPath = await objectStorage.trySetObjectEntityAclPolicy(
        uploadUrl,
        {
          owner: req.user!.id,
          visibility: "public",
        }
      );
      
      console.log(`[Upload] Confirmed by user ${req.user?.id}: ${normalizedPath}`);
      
      res.json({ path: normalizedPath });
    } catch (error: any) {
      console.error("Upload confirmation error:", error);
      res.status(500).json({ message: error.message || "Failed to confirm upload" });
    }
  });

  // Serve uploaded object
  app.get("/objects/*", requireAuth, async (req, res) => {
    try {
      const objectPath = `/${req.params[0]}`;
      const fullPath = `/objects/${objectPath}`;
      
      const objectStorage = new ObjectStorageService();
      const objectFile = await objectStorage.getObjectEntityFile(fullPath);
      
      // Check access permissions
      const canAccess = await objectStorage.canAccessObjectEntity({
        userId: req.user?.id,
        objectFile,
        requestedPermission: ObjectPermission.READ,
      });
      
      if (!canAccess) {
        return res.status(403).json({ message: "Access denied" });
      }
      
      await objectStorage.downloadObject(objectFile, res);
    } catch (error: any) {
      if (error.name === "ObjectNotFoundError") {
        return res.status(404).json({ message: "Object not found" });
      }
      console.error("Object download error:", error);
      res.status(500).json({ message: "Failed to download object" });
    }
  });

  // Admin endpoint to recalculate all orders' profits
  app.post("/api/admin/recalculate-profits", requireOwner, async (req, res) => {
    try {
      const orders = await storage.getAllOrders();
      let updated = 0;
      
      for (const order of orders) {
        const financials = await computeOrderFinancials(order.id);
        if (financials) {
          await storage.updateOrder(order.id, financials);
          updated++;
        }
      }
      
      res.json({ message: `Successfully recalculated profits for ${updated} orders` });
    } catch (error) {
      console.error("Profit recalculation error:", error);
      res.status(500).json({ message: "Failed to recalculate profits" });
    }
  });

  const httpServer = createServer(app);
  return httpServer;
}
