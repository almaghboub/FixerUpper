import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useState, useEffect } from "react";
import { useTranslation } from "react-i18next";
import { Plus, Package, Search, Filter, Trash2, X, Printer, Copy, Check, ExternalLink } from "lucide-react";
import { useLydExchangeRate } from "@/hooks/use-lyd-exchange-rate";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Drawer, DrawerContent, DrawerHeader, DrawerTitle } from "@/components/ui/drawer";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Checkbox } from "@/components/ui/checkbox";
import { Calendar } from "@/components/ui/calendar";
import { Header } from "@/components/header";
import { useToast } from "@/hooks/use-toast";
import { useIsMobile } from "@/hooks/use-mobile";
import { apiRequest } from "@/lib/queryClient";
import { Invoice } from "@/components/invoice";
import { ImageUploader } from "@/components/image-uploader";
import type { OrderWithCustomer, Customer, InsertOrder, InsertOrderItem } from "@shared/schema";

interface OrderItem {
  productId: string;
  productName: string;
  productCode: string;
  productUrl: string;
  originalPrice: number;
  discountedPrice: number;
  quantity: number;
  unitPrice: number;
  totalPrice: number;
}

interface OrderImage {
  url: string;
  altText: string;
}

export default function Orders() {
  const { t, i18n } = useTranslation();
  const isMobile = useIsMobile();
  const [searchTerm, setSearchTerm] = useState("");
  const [isModalOpen, setIsModalOpen] = useState(false);

  const translateStatus = (status: string) => {
    const statusNormalized = status.toLowerCase().replace(/[\s_-]+/g, '');
    switch (statusNormalized) {
      case 'delivered':
        return t('statusDelivered');
      case 'completed':
        return t('statusCompleted');
      case 'cancelled':
        return t('statusCancelled');
      case 'partiallyarrived':
        return t('statusPartiallyArrived');
      case 'readytocollect':
        return t('statusReadyToCollect');
      case 'withshippingcompany':
        return t('statusWithShippingCompany');
      default:
        return status.charAt(0).toUpperCase() + status.slice(1).toLowerCase();
    }
  };
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [isViewModalOpen, setIsViewModalOpen] = useState(false);
  const [isFilterOpen, setIsFilterOpen] = useState(false);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [editingOrder, setEditingOrder] = useState<OrderWithCustomer | null>(null);
  const [viewingOrder, setViewingOrder] = useState<OrderWithCustomer | null>(null);
  const [deletingOrder, setDeletingOrder] = useState<OrderWithCustomer | null>(null);
  const [downPaymentLYDInput, setDownPaymentLYDInput] = useState<string>("");
  const [isPrintModalOpen, setIsPrintModalOpen] = useState(false);
  const [selectedOrderForPrint, setSelectedOrderForPrint] = useState<any>(null);
  const [selectedCustomerId, setSelectedCustomerId] = useState("");
  const [customerSearchQuery, setCustomerSearchQuery] = useState("");
  const [searchedCustomers, setSearchedCustomers] = useState<Customer[]>([]);
  const [searchedCustomer, setSearchedCustomer] = useState<Customer | null>(null);
  const [showCustomerForm, setShowCustomerForm] = useState(false);
  const [newCustomer, setNewCustomer] = useState({
    firstName: "",
    lastName: "",
    customerCode: "",
    city: "",
    phone: ""
  });
  const [customOrderCode, setCustomOrderCode] = useState("");
  const [orderImages, setOrderImages] = useState<OrderImage[]>([]);
  const [statusFilters, setStatusFilters] = useState<string[]>(["pending", "processing", "shipped", "delivered", "cancelled", "partially_arrived", "ready_to_collect", "with_shipping_company"]);
  const [countryFilters, setCountryFilters] = useState<string[]>([]);
  const [dateFrom, setDateFrom] = useState<Date | undefined>(undefined);
  const [dateTo, setDateTo] = useState<Date | undefined>(undefined);
  const [orderItems, setOrderItems] = useState<OrderItem[]>([]);
  const [editOrderStatus, setEditOrderStatus] = useState("");
  const [editableItems, setEditableItems] = useState<any[]>([]);
  const [shippingCost, setShippingCost] = useState(0);
  const [shippingCountry, setShippingCountry] = useState("");
  const [shippingCategory, setShippingCategory] = useState("normal");
  const [shippingWeight, setShippingWeight] = useState(0);
  const [clothingSize, setClothingSize] = useState("");
  const [downPayment, setDownPayment] = useState(0);
  const [shippingCalculation, setShippingCalculation] = useState<{
    base_shipping: number;
    commission: number;
    total: number;
    currency: string;
    orderValue: number;
    itemsHash: string;
  } | null>(null);
  const [calculatingShipping, setCalculatingShipping] = useState(false);
  const [notes, setNotes] = useState("");
  const [orderLydRate, setOrderLydRate] = useState<number>(0);
  const [copiedOrderLink, setCopiedOrderLink] = useState(false);
  
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: orders = [], isLoading } = useQuery({
    queryKey: ["/api/orders"],
    queryFn: async () => {
      const response = await apiRequest("GET", "/api/orders");
      return response.json() as Promise<OrderWithCustomer[]>;
    },
  });

  // Use shared LYD exchange rate hook
  const { exchangeRate, convertToLYD } = useLydExchangeRate();
  
  // Helper to convert using order-specific rate or fall back to global rate
  const convertOrderToLYD = (amount: number, orderRate?: string) => {
    const rate = orderRate ? parseFloat(orderRate) : exchangeRate;
    return rate > 0 ? (amount * rate).toFixed(2) : amount.toFixed(2);
  };

  // Pre-fill order LYD rate when modal first opens
  useEffect(() => {
    if (isModalOpen && exchangeRate > 0) {
      // Only set if orderLydRate hasn't been set (is 0 or undefined)
      // This allows user edits to persist within the same modal session
      if (orderLydRate === 0 || !orderLydRate) {
        setOrderLydRate(exchangeRate);
      }
    }
  }, [isModalOpen, exchangeRate]);

  // Handle highlight query parameter from Gallery or direct link navigation
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const highlightOrderId = params.get('highlight');
    
    if (highlightOrderId && orders.length > 0 && !isViewModalOpen) {
      const orderToHighlight = orders.find((order: OrderWithCustomer) => order.id === highlightOrderId);
      if (orderToHighlight) {
        setViewingOrder(orderToHighlight);
        setIsViewModalOpen(true);
        // Clear the highlight parameter from URL
        window.history.replaceState({}, '', window.location.pathname);
      }
    }
  }, [orders, isViewModalOpen]);

  const { data: customers = [] } = useQuery({
    queryKey: ["/api/customers"],
    queryFn: async () => {
      const response = await apiRequest("GET", "/api/customers");
      return response.json() as Promise<Customer[]>;
    },
  });

  const { data: shippingCountries = [] } = useQuery({
    queryKey: ["/api/shipping-countries"],
    queryFn: async () => {
      const response = await apiRequest("GET", "/api/shipping-countries");
      return response.json() as Promise<string[]>;
    },
  });

  const { data: commissionRules = [] } = useQuery({
    queryKey: ["/api/commission-rules"],
    queryFn: async () => {
      const response = await apiRequest("GET", "/api/commission-rules");
      return response.json();
    },
  });

  const createOrderMutation = useMutation({
    mutationFn: async (orderData: { order: InsertOrder; items: InsertOrderItem[]; images?: OrderImage[] }) => {
      const response = await apiRequest("POST", "/api/orders", orderData);
      if (!response.ok) {
        throw new Error(t('failedCreateOrder'));
      }
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/orders"] });
      queryClient.invalidateQueries({ queryKey: ["/api/analytics/dashboard"] });
      toast({
        title: t('success'),
        description: t('orderCreatedSuccess'),
      });
      setIsModalOpen(false);
      resetForm();
    },
    onError: (error) => {
      toast({
        title: t('error'),
        description: t('failedCreateOrder'),
        variant: "destructive",
      });
    },
  });

  const updateOrderMutation = useMutation({
    mutationFn: async ({ id, status, notes, downPayment, remainingBalance, shippingWeight, shippingCountry, shippingCategory, shippingCost, commission, totalAmount, lydExchangeRate, shippingLydExchangeRate, trackingNumber }: { 
      id: string; 
      status: string; 
      notes: string; 
      downPayment?: string;
      remainingBalance?: string;
      shippingWeight?: string;
      shippingCountry?: string;
      shippingCategory?: string;
      shippingCost?: string;
      commission?: string;
      totalAmount?: string;
      lydExchangeRate?: string;
      shippingLydExchangeRate?: string;
      trackingNumber?: string;
    }) => {
      const response = await apiRequest("PUT", `/api/orders/${id}`, { status, notes, downPayment, remainingBalance, shippingWeight, shippingCountry, shippingCategory, shippingCost, commission, totalAmount, lydExchangeRate, shippingLydExchangeRate, trackingNumber });
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || t('failedUpdateOrder'));
      }
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/orders"] });
      queryClient.invalidateQueries({ queryKey: ["/api/analytics/dashboard"] });
      toast({
        title: t('success'),
        description: t('orderUpdatedSuccess'),
      });
      setIsEditModalOpen(false);
      setEditingOrder(null);
      setEditOrderStatus("");
      setNotes("");
    },
    onError: (error: Error) => {
      toast({
        title: t('error'),
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const deleteOrderMutation = useMutation({
    mutationFn: async (id: string) => {
      const response = await apiRequest("DELETE", `/api/orders/${id}`);
      if (!response.ok) {
        throw new Error(t('failedDeleteOrder'));
      }
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/orders"] });
      queryClient.invalidateQueries({ queryKey: ["/api/analytics/dashboard"] });
      toast({
        title: t('success'),
        description: t('orderDeletedSuccess'),
      });
      setIsDeleteDialogOpen(false);
      setDeletingOrder(null);
    },
    onError: () => {
      toast({
        title: t('error'),
        description: t('failedDeleteOrder'),
        variant: "destructive",
      });
    },
  });

  const updateOrderItemMutation = useMutation({
    mutationFn: async ({ id, ...data }: { id: string; quantity?: number; originalPrice?: string; discountedPrice?: string; unitPrice?: string; productCode?: string }) => {
      const response = await apiRequest("PUT", `/api/order-items/${id}`, data);
      if (!response.ok) {
        throw new Error(t('failedUpdateOrderItem'));
      }
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/orders"] });
      queryClient.invalidateQueries({ queryKey: ["/api/analytics/dashboard"] });
    },
    onError: (error: Error) => {
      toast({
        title: t('error'),
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const createCustomerMutation = useMutation({
    mutationFn: async (customerData: typeof newCustomer) => {
      const payload = {
        firstName: customerData.firstName,
        lastName: customerData.lastName,
        phone: customerData.phone,
        city: customerData.city,
        shippingCode: customerData.customerCode || undefined,
        email: "",
        country: "",
        address: "",
        postalCode: ""
      };
      
      const response = await apiRequest("POST", "/api/customers", payload);
      if (!response.ok) {
        throw new Error("Failed to create customer");
      }
      return response.json();
    },
    onSuccess: (customer) => {
      queryClient.invalidateQueries({ queryKey: ["/api/customers"] });
      setSearchedCustomer(customer);
      setSelectedCustomerId(customer.id);
      if (customer.country) {
        handleCountryChange(customer.country);
      }
      setShowCustomerForm(false);
      setNewCustomer({
        firstName: "",
        lastName: "",
        customerCode: "",
        city: "",
        phone: ""
      });
      toast({
        title: t('success'),
        description: t('customerCreatedSuccess'),
      });
    },
    onError: () => {
      toast({
        title: t('error'),
        description: t('failedCreateCustomer'),
        variant: "destructive",
      });
    },
  });

  // Query for order details when printing
  const { data: orderWithItems, isLoading: isLoadingOrderItems } = useQuery({
    queryKey: ["/api/orders", selectedOrderForPrint?.id, "items"],
    queryFn: async () => {
      if (!selectedOrderForPrint?.id) return null;
      const [orderResponse, itemsResponse] = await Promise.all([
        apiRequest("GET", `/api/orders/${selectedOrderForPrint.id}`),
        apiRequest("GET", `/api/orders/${selectedOrderForPrint.id}/items`)
      ]);
      const order = await orderResponse.json();
      const items = await itemsResponse.json();
      return { ...order, items };
    },
    enabled: !!selectedOrderForPrint?.id && isPrintModalOpen,
  });

  // Query for order details when viewing
  const { data: viewOrderWithItems, isLoading: isLoadingViewOrder } = useQuery({
    queryKey: ["/api/orders", viewingOrder?.id, "view"],
    queryFn: async () => {
      if (!viewingOrder?.id) return null;
      const itemsResponse = await apiRequest("GET", `/api/orders/${viewingOrder.id}/items`);
      const items = await itemsResponse.json();
      return { ...viewingOrder, items };
    },
    enabled: !!viewingOrder?.id && isViewModalOpen,
  });

  const handlePrintInvoice = (order: any) => {
    setSelectedOrderForPrint(order);
    setIsPrintModalOpen(true);
  };

  const handlePrint = () => {
    if (!orderWithItems) return;
    
    // Create a new window for printing
    const printWindow = window.open('', '_blank', 'width=800,height=600');
    if (!printWindow) {
      alert('Please allow popups for printing');
      return;
    }
    
    // Get the invoice HTML
    const invoiceElement = document.querySelector('.invoice-container');
    if (!invoiceElement) return;
    
    // Write the HTML to the new window
    printWindow.document.write(`
      <!DOCTYPE html>
      <html lang="${i18n.language}">
      <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Invoice ${orderWithItems.orderNumber}</title>
        <style>
          * { margin: 0; padding: 0; box-sizing: border-box; }
          body { 
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            background: white;
            color: black;
            padding: 20px;
          }
          .invoice-container { max-width: 1000px; margin: 0 auto; }
          table { width: 100%; border-collapse: collapse; }
          th, td { padding: 12px; text-align: left; border: 1px solid #e5e7eb; }
          th { background: #b91c1c; color: white; font-weight: 600; }
          tr:nth-child(even) { background: #f9fafb; }
          .text-right { text-align: right; }
          .text-center { text-align: center; }
          .font-bold { font-weight: 700; }
          .font-semibold { font-weight: 600; }
          .text-red-700 { color: #b91c1c; }
          .text-green-600 { color: #16a34a; }
          .text-orange-600 { color: #ea580c; }
          .text-blue-800 { color: #1e40af; }
          .text-gray-600 { color: #4b5563; }
          .bg-gray-50 { background: #f9fafb; }
          .bg-blue-50 { background: #eff6ff; }
          .border-red-700 { border-color: #b91c1c; }
          .border-blue-500 { border-color: #3b82f6; }
          .border-amber-500 { border-color: #f59e0b; }
          img { max-height: 80px; }
          @media print {
            body { padding: 0; }
            @page { margin: 0.5cm; }
          }
        </style>
      </head>
      <body>
        ${invoiceElement.outerHTML}
        <script>
          window.onload = function() {
            window.print();
            window.onafterprint = function() {
              window.close();
            };
          };
        </script>
      </body>
      </html>
    `);
    
    printWindow.document.close();
  };

  const openEditModal = async (order: OrderWithCustomer) => {
    setEditingOrder(order);
    setEditOrderStatus(order.status);
    setNotes(order.notes || "");
    
    // Initialize down payment in LYD
    const downPaymentUSD = parseFloat(order.downPayment || "0");
    const rate = parseFloat(order.lydExchangeRate || "0") || exchangeRate;
    const downPaymentLYD = rate > 0 ? (downPaymentUSD * rate).toFixed(2) : downPaymentUSD.toFixed(2);
    setDownPaymentLYDInput(downPaymentLYD);
    
    // Fetch order items
    try {
      const itemsResponse = await apiRequest("GET", `/api/orders/${order.id}/items`);
      const items = await itemsResponse.json();
      setEditableItems(items);
    } catch (error) {
      console.error("Failed to fetch order items:", error);
      setEditableItems([]);
    }
    
    setIsEditModalOpen(true);
  };

  const openViewModal = (order: OrderWithCustomer) => {
    setViewingOrder(order);
    setIsViewModalOpen(true);
  };

  const copyOrderLink = async (orderId: string) => {
    const baseUrl = window.location.origin;
    const orderLink = `${baseUrl}/orders?highlight=${orderId}`;
    
    try {
      // Modern clipboard API
      if (navigator.clipboard && navigator.clipboard.writeText) {
        await navigator.clipboard.writeText(orderLink);
      } else {
        // Fallback for older browsers
        const textArea = document.createElement('textarea');
        textArea.value = orderLink;
        textArea.style.position = 'fixed';
        textArea.style.opacity = '0';
        document.body.appendChild(textArea);
        textArea.select();
        document.execCommand('copy');
        document.body.removeChild(textArea);
      }
      
      setCopiedOrderLink(true);
      toast({
        title: t('success'),
        description: t('orderLinkCopied'),
      });
      
      // Reset the copied state after 2 seconds
      setTimeout(() => setCopiedOrderLink(false), 2000);
    } catch (error) {
      toast({
        title: t('error'),
        description: t('failedToCopyLink'),
        variant: "destructive",
      });
    }
  };

  const openDeleteDialog = (order: OrderWithCustomer) => {
    setDeletingOrder(order);
    setIsDeleteDialogOpen(true);
  };

  const handleDelete = () => {
    if (!deletingOrder) return;
    deleteOrderMutation.mutate(deletingOrder.id);
  };

  const handleEditSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingOrder) return;
    
    try {
      // Update all modified order items
      await Promise.all(
        editableItems.map(item => 
          updateOrderItemMutation.mutateAsync({
            id: item.id,
            quantity: item.quantity,
            originalPrice: item.originalPrice?.toString(),
            discountedPrice: item.discountedPrice?.toString(),
            unitPrice: item.unitPrice?.toString(),
            productCode: item.productCode,
          })
        )
      );
      
      // Update the customer's shipping code if it changed
      if (editingOrder.customer.shippingCode !== undefined) {
        const updateCustomerResponse = await apiRequest("PUT", `/api/customers/${editingOrder.customerId}`, {
          shippingCode: editingOrder.customer.shippingCode
        });
        
        if (!updateCustomerResponse.ok) {
          throw new Error('Failed to update customer shipping code');
        }
        
        // Invalidate customers cache to reflect the updated shipping code
        queryClient.invalidateQueries({ queryKey: ["/api/customers"] });
      }
      
      // Update the order
      updateOrderMutation.mutate({
        id: editingOrder.id,
        status: editOrderStatus,
        downPayment: editingOrder.downPayment,
        remainingBalance: editingOrder.remainingBalance,
        shippingWeight: editingOrder.shippingWeight,
        shippingCountry: editingOrder.shippingCountry || undefined,
        shippingCategory: editingOrder.shippingCategory || undefined,
        shippingCost: editingOrder.shippingCost,
        commission: editingOrder.commission,
        totalAmount: editingOrder.totalAmount,
        lydExchangeRate: editingOrder.lydExchangeRate || undefined,
        shippingLydExchangeRate: editingOrder.shippingLydExchangeRate || undefined,
        trackingNumber: editingOrder.trackingNumber || undefined,
        notes: notes
      });
    } catch (error) {
      toast({
        title: t('error'),
        description: t('failedUpdateOrderItems'),
        variant: "destructive",
      });
    }
  };
  
  const handleItemChange = (index: number, field: string, value: any) => {
    const updatedItems = [...editableItems];
    updatedItems[index] = { ...updatedItems[index], [field]: value };
    setEditableItems(updatedItems);
  };

  const handleCustomerSearch = async () => {
    if (!customerSearchQuery.trim()) {
      toast({
        title: t('error'),
        description: "Please enter phone, name, or customer code",
        variant: "destructive",
      });
      return;
    }

    try {
      const response = await fetch(`/api/customers/search?query=${encodeURIComponent(customerSearchQuery)}`, {
        credentials: "include"
      });
      
      if (response.ok) {
        const customers = await response.json();
        if (customers.length === 0) {
          // No customers found - show creation form
          setSearchedCustomers([]);
          setSearchedCustomer(null);
          setShowCustomerForm(true);
          setNewCustomer(prev => ({ ...prev, phone: customerSearchQuery }));
          toast({
            title: "No customers found",
            description: "Fill in the details to create a new customer",
          });
        } else if (customers.length === 1) {
          // Single customer found - auto select
          const customer = customers[0];
          setSearchedCustomer(customer);
          setSelectedCustomerId(customer.id);
          if (customer.country) {
            handleCountryChange(customer.country);
          }
          setSearchedCustomers([]);
          setShowCustomerForm(false);
          toast({
            title: t('success'),
            description: `Customer found: ${customer.firstName} ${customer.lastName}`,
          });
        } else {
          // Multiple customers found - show list
          setSearchedCustomers(customers);
          setSearchedCustomer(null);
          setShowCustomerForm(false);
        }
      } else {
        throw new Error("Failed to search for customers");
      }
    } catch (error) {
      toast({
        title: t('error'),
        description: "Failed to search for customers",
        variant: "destructive",
      });
    }
  };

  const handleSelectCustomer = (customer: Customer) => {
    setSearchedCustomer(customer);
    setSelectedCustomerId(customer.id);
    if (customer.country) {
      handleCountryChange(customer.country);
    }
    setSearchedCustomers([]);
    setShowCustomerForm(false);
  };

  const handleCreateCustomer = (e: React.FormEvent) => {
    e.preventDefault();
    createCustomerMutation.mutate(newCustomer);
  };

  const resetForm = () => {
    setSelectedCustomerId("");
    setCustomerSearchQuery("");
    setSearchedCustomers([]);
    setSearchedCustomer(null);
    setShowCustomerForm(false);
    setOrderItems([]);
    setOrderImages([]);
    setShippingCost(0);
    setShippingCountry("");
    setShippingCategory("normal");
    setShippingWeight(0);
    setClothingSize("");
    setDownPayment(0);
    setShippingCalculation(null);
    setNotes("");
    setCustomOrderCode("");
    setOrderLydRate(0);
    setNewCustomer({
      firstName: "",
      lastName: "",
      customerCode: "",
      city: "",
      phone: ""
    });
  };

  const handleCloseModal = (open: boolean) => {
    if (!open) {
      resetForm();
    }
    setIsModalOpen(open);
  };

  // Generate hash of order items to detect changes
  const getItemsHash = () => {
    return JSON.stringify(orderItems.map(item => ({
      name: item.productName,
      qty: item.quantity,
      price: item.unitPrice
    })));
  };

  // Check if shipping calculation is stale
  const isShippingCalculationStale = () => {
    if (!shippingCalculation) return false;
    const currentItemsHash = getItemsHash();
    const currentOrderValue = orderItems.reduce((sum, item) => sum + item.totalPrice, 0);
    
    return (
      shippingCalculation.itemsHash !== currentItemsHash ||
      Math.abs(shippingCalculation.orderValue - currentOrderValue) > 0.01
    );
  };

  const calculateShippingCost = async () => {
    if (!shippingCountry || !shippingCategory || !shippingWeight || orderItems.length === 0) {
      return;
    }

    setCalculatingShipping(true);
    try {
      const orderValue = orderItems.reduce((sum, item) => sum + item.totalPrice, 0);
      const itemsHash = getItemsHash();
      
      const response = await apiRequest("POST", "/api/calculate-shipping", {
        country: shippingCountry,
        category: shippingCategory,
        weight: shippingWeight,
        orderValue: orderValue
      });

      if (response.ok) {
        const calculation = await response.json();
        setShippingCalculation({
          ...calculation,
          orderValue,
          itemsHash
        });
        setShippingCost(calculation.base_shipping);
      } else {
        toast({
          title: t('error'),
          description: t('failedCalculateShipping'),
          variant: "destructive",
        });
      }
    } catch (error) {
      toast({
        title: t('error'),
        description: t('failedCalculateShipping'),
        variant: "destructive",
      });
    } finally {
      setCalculatingShipping(false);
    }
  };

  const fetchNextOrderNumber = async (country: string) => {
    if (!country) return;
    try {
      const response = await apiRequest("GET", `/api/next-order-number/${encodeURIComponent(country)}`);
      if (response.ok) {
        const data = await response.json();
        setCustomOrderCode(data.orderNumber);
      }
    } catch (error) {
      console.error("Failed to fetch next order number:", error);
    }
  };

  const handleCountryChange = async (country: string) => {
    setShippingCountry(country);
    await fetchNextOrderNumber(country);
  };

  const addOrderItem = () => {
    setOrderItems([...orderItems, {
      productId: "",
      productName: "",
      productCode: "",
      productUrl: "",
      originalPrice: 0,
      discountedPrice: 0,
      quantity: 1,
      unitPrice: 0,
      totalPrice: 0,
    }]);
  };

  const updateOrderItem = (index: number, field: keyof OrderItem, value: any) => {
    const newItems = [...orderItems];
    newItems[index] = { ...newItems[index], [field]: value };
    
    // Always recalculate total when any price-related field changes
    // Total Customer Pays = Original Price × Quantity (NOT discounted price!)
    if (field === "quantity" || field === "originalPrice" || field === "discountedPrice") {
      const originalPrice = newItems[index].originalPrice || 0;
      const discountedPrice = newItems[index].discountedPrice || 0;
      const quantity = newItems[index].quantity || 0;
      
      // Customer pays the ORIGINAL price
      newItems[index].totalPrice = quantity * originalPrice;
      
      // Update unitPrice to match originalPrice for backward compatibility
      newItems[index].unitPrice = originalPrice;
    }
    
    setOrderItems(newItems);
  };

  const removeOrderItem = (index: number) => {
    setOrderItems(orderItems.filter((_, i) => i !== index));
  };

  const calculateTotals = () => {
    const subtotal = orderItems.reduce((sum, item) => sum + item.totalPrice, 0);
    
    // Calculate items profit (original price minus discounted price)
    const itemsProfit = orderItems.reduce((sum, item) => {
      const markupProfit = (item.originalPrice - item.discountedPrice) * item.quantity;
      return sum + markupProfit;
    }, 0);
    
    // Use dynamic shipping calculation if available
    if (shippingCalculation) {
      // Convert shipping amounts to USD if needed (simplified conversion for demo)
      const exchangeRates = { USD: 1, EUR: 1.1, GBP: 1.25, CNY: 0.14 }; // Simplified rates
      const usdRate = exchangeRates[shippingCalculation.currency as keyof typeof exchangeRates] || 1;
      
      const shippingInUSD = shippingCalculation.base_shipping * usdRate;
      const commissionInUSD = shippingCalculation.commission * usdRate;
      
      const total = subtotal + shippingInUSD + commissionInUSD;
      const shippingProfit = commissionInUSD;
      const totalProfit = itemsProfit + shippingProfit;
      
      return { 
        subtotal, 
        total, 
        commission: commissionInUSD, 
        profit: totalProfit,
        itemsProfit,
        shippingProfit,
        shippingCost: shippingInUSD,
        currency: 'USD', // Normalize to USD
        originalCurrency: shippingCalculation.currency,
        originalShipping: shippingCalculation.base_shipping,
        originalCommission: shippingCalculation.commission
      };
    } else {
      // Fallback to manual calculation using commission rules
      const orderValue = subtotal + shippingCost;
      
      // Find matching commission rule for the country and order value
      let commission = 0;
      if (shippingCountry && commissionRules.length > 0) {
        const matchingRule = commissionRules.find((rule: any) => {
          const minValue = parseFloat(rule.minValue);
          const maxValue = rule.maxValue ? parseFloat(rule.maxValue) : Infinity;
          return rule.country === shippingCountry && 
                 orderValue >= minValue && 
                 orderValue <= maxValue;
        });
        
        if (matchingRule) {
          const percentage = parseFloat(matchingRule.percentage);
          const fixedFee = parseFloat(matchingRule.fixedFee || "0");
          commission = (orderValue * percentage) + fixedFee;
        } else {
          // If no matching rule found, use 15% default
          commission = orderValue * 0.15;
        }
      } else {
        // If no country or rules, use 15% default
        commission = orderValue * 0.15;
      }
      
      const total = subtotal + shippingCost + commission;
      const shippingProfit = commission;
      const totalProfit = itemsProfit + shippingProfit;
      
      return { 
        subtotal, 
        total, 
        commission, 
        profit: totalProfit,
        itemsProfit,
        shippingProfit,
        shippingCost,
        currency: 'USD'
      };
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!selectedCustomerId || orderItems.length === 0) {
      toast({
        title: t('validationError'),
        description: t('selectCustomerAndItem'),
        variant: "destructive",
      });
      return;
    }

    const totals = calculateTotals();
    
    // Calculate items profit (original price minus discounted price)
    const itemsProfit = orderItems.reduce((sum, item) => {
      const markupProfit = (item.originalPrice - item.discountedPrice) * item.quantity;
      return sum + markupProfit;
    }, 0);
    
    // Only include shipping profit if shipping is actually calculated
    const shippingProfit = shippingCalculation ? totals.commission : 0;
    const totalProfit = itemsProfit + shippingProfit;
    
    // Convert down payment from LYD to USD
    const rate = orderLydRate > 0 ? orderLydRate : exchangeRate;
    const downPaymentUSD = rate > 0 ? downPayment / rate : downPayment;
    
    // Validate down payment doesn't exceed total
    if (downPaymentUSD > totals.total) {
      toast({
        title: t('validationError'),
        description: "Down payment cannot exceed order total",
        variant: "destructive",
      });
      return;
    }
    
    // Calculate remaining balance
    const remainingBalance = totals.total - downPaymentUSD;
    
    // Add clothing size to notes if provided
    let finalNotes = notes;
    if (clothingSize && shippingCategory === "clothing") {
      finalNotes = finalNotes ? `${finalNotes} | Size: ${clothingSize}` : `Size: ${clothingSize}`;
    }
    
    const order: InsertOrder = {
      customerId: selectedCustomerId,
      status: "pending",
      totalAmount: totals.total.toFixed(2),
      downPayment: downPaymentUSD.toFixed(2),
      remainingBalance: remainingBalance.toFixed(2),
      shippingCost: totals.shippingCost.toFixed(2),
      shippingWeight: shippingWeight.toFixed(2),
      shippingCountry: shippingCountry || undefined,
      shippingCategory: shippingCategory || undefined,
      commission: totals.commission.toFixed(2),
      shippingProfit: shippingProfit.toFixed(2),
      itemsProfit: itemsProfit.toFixed(2),
      totalProfit: totalProfit.toFixed(2),
      lydExchangeRate: (orderLydRate > 0 ? orderLydRate : exchangeRate > 0 ? exchangeRate : undefined)?.toFixed(4),
      shippingLydExchangeRate: (orderLydRate > 0 ? orderLydRate : exchangeRate > 0 ? exchangeRate : undefined)?.toFixed(4),
      notes: finalNotes || undefined,
      orderNumber: customOrderCode || undefined,
    };

    const items: InsertOrderItem[] = orderItems.map(item => {
      const markupProfit = ((item.originalPrice - item.discountedPrice) * item.quantity).toFixed(2);
      return {
        orderId: "", // Will be set by the backend
        productName: item.productName,
        productCode: item.productCode || null,
        productUrl: item.productUrl || null,
        originalPrice: item.originalPrice.toFixed(2),
        discountedPrice: item.discountedPrice.toFixed(2),
        markupProfit: markupProfit,
        quantity: item.quantity,
        unitPrice: item.originalPrice.toFixed(2),
        totalPrice: item.totalPrice.toFixed(2),
      };
    });

    // Include images
    const validImages = orderImages.filter(img => img.url.trim() !== "");

    createOrderMutation.mutate({ 
      order, 
      items,
      images: validImages
    });
  };

  const toggleStatusFilter = (status: string) => {
    setStatusFilters(prev =>
      prev.includes(status)
        ? prev.filter(s => s !== status)
        : [...prev, status]
    );
  };

  const filteredOrders = orders.filter(order => {
    const matchesSearch = order.orderNumber.toLowerCase().includes(searchTerm.toLowerCase()) ||
      `${order.customer.firstName} ${order.customer.lastName}`.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (order.customer.shippingCode && order.customer.shippingCode.toLowerCase().includes(searchTerm.toLowerCase())) ||
      (order.trackingNumber && order.trackingNumber.toLowerCase().includes(searchTerm.toLowerCase()));
    const matchesStatus = statusFilters.includes(order.status);
    const matchesCountry = countryFilters.length === 0 || (order.shippingCountry && countryFilters.includes(order.shippingCountry));
    
    // Date filtering
    let matchesDate = true;
    if (dateFrom || dateTo) {
      const orderDate = new Date(order.createdAt);
      if (dateFrom && dateTo) {
        const fromDate = new Date(dateFrom);
        fromDate.setHours(0, 0, 0, 0);
        const toDate = new Date(dateTo);
        toDate.setHours(23, 59, 59, 999);
        matchesDate = orderDate >= fromDate && orderDate <= toDate;
      } else if (dateFrom) {
        const fromDate = new Date(dateFrom);
        fromDate.setHours(0, 0, 0, 0);
        matchesDate = orderDate >= fromDate;
      } else if (dateTo) {
        const toDate = new Date(dateTo);
        toDate.setHours(23, 59, 59, 999);
        matchesDate = orderDate <= toDate;
      }
    }
    
    return matchesSearch && matchesStatus && matchesCountry && matchesDate;
  });
  
  const toggleCountryFilter = (country: string) => {
    setCountryFilters(prev =>
      prev.includes(country)
        ? prev.filter(c => c !== country)
        : [...prev, country]
    );
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case "delivered":
        return "bg-green-100 text-green-800";
      case "shipped":
        return "bg-blue-100 text-blue-800";
      case "processing":
        return "bg-yellow-100 text-yellow-800";
      case "pending":
        return "bg-gray-100 text-gray-800";
      case "cancelled":
        return "bg-red-100 text-red-800";
      case "partially_arrived":
        return "bg-purple-100 text-purple-800";
      case "ready_to_collect":
        return "bg-cyan-100 text-cyan-800";
      case "with_shipping_company":
        return "bg-indigo-100 text-indigo-800";
      default:
        return "bg-gray-100 text-gray-800";
    }
  };

  return (
    <div className="flex-1 flex flex-col">
      <Header 
        title={t('ordersTitle')} 
        description={t('ordersDescription')} 
      />
      
      <div className="flex-1 p-6 space-y-6">
        {/* Actions and Search */}
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-4">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                placeholder={t('searchOrders')}
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10 w-64"
                data-testid="input-search-orders"
              />
            </div>
            <Popover open={isFilterOpen} onOpenChange={setIsFilterOpen}>
              <PopoverTrigger asChild>
                <Button variant="outline" data-testid="button-filter-orders">
                  <Filter className="w-4 h-4 mr-2" />
                  {t('filter')}
                  {statusFilters.length < 8 && (
                    <Badge variant="secondary" className="ml-2">
                      {statusFilters.length}
                    </Badge>
                  )}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-64 max-h-96 overflow-y-auto" data-testid="popover-filter-orders">
                <div className="space-y-4">
                  <div>
                    <h4 className="font-semibold mb-3">{t('filterByStatus')}</h4>
                    <div className="space-y-2">
                      {["pending", "processing", "shipped", "delivered", "cancelled", "partially_arrived", "ready_to_collect", "with_shipping_company"].map((status) => (
                        <div key={status} className="flex items-center space-x-2">
                          <Checkbox
                            id={`filter-${status}`}
                            checked={statusFilters.includes(status)}
                            onCheckedChange={() => toggleStatusFilter(status)}
                            data-testid={`checkbox-filter-${status}`}
                          />
                          <Label
                            htmlFor={`filter-${status}`}
                            className="text-sm font-normal cursor-pointer capitalize"
                          >
                            {t(status)}
                          </Label>
                        </div>
                      ))}
                    </div>
                  </div>
                  {shippingCountries.length > 0 && (
                    <div className="border-t pt-3">
                      <h4 className="font-semibold mb-3">Filter by Country</h4>
                      <div className="space-y-2">
                        {shippingCountries.map((country) => (
                          <div key={country} className="flex items-center space-x-2">
                            <Checkbox
                              id={`filter-country-${country}`}
                              checked={countryFilters.includes(country)}
                              onCheckedChange={() => toggleCountryFilter(country)}
                              data-testid={`checkbox-filter-country-${country}`}
                            />
                            <Label
                              htmlFor={`filter-country-${country}`}
                              className="text-sm font-normal cursor-pointer"
                            >
                              {country}
                            </Label>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                  <div className="border-t pt-3">
                    <h4 className="font-semibold mb-3">Filter by Date</h4>
                    {(dateFrom || dateTo) && (
                      <div className="mb-3 p-2 bg-blue-50 rounded text-sm">
                        {dateFrom && <div>From: {dateFrom.toLocaleDateString()}</div>}
                        {dateTo && <div>To: {dateTo.toLocaleDateString()}</div>}
                      </div>
                    )}
                    <div className="space-y-3">
                      <div>
                        <Label className="text-sm">From Date</Label>
                        <div className="mt-1">
                          <Calendar
                            mode="single"
                            selected={dateFrom}
                            onSelect={setDateFrom}
                            className="border rounded-md"
                            data-testid="calendar-from-date"
                          />
                        </div>
                      </div>
                      <div>
                        <Label className="text-sm">To Date</Label>
                        <div className="mt-1">
                          <Calendar
                            mode="single"
                            selected={dateTo}
                            onSelect={setDateTo}
                            className="border rounded-md"
                            data-testid="calendar-to-date"
                          />
                        </div>
                      </div>
                    </div>
                  </div>
                  <div className="flex justify-between pt-2 border-t">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => {
                        setStatusFilters(["pending", "processing", "shipped", "delivered", "cancelled", "partially_arrived", "ready_to_collect", "with_shipping_company"]);
                        setCountryFilters([]);
                        setDateFrom(undefined);
                        setDateTo(undefined);
                      }}
                      data-testid="button-reset-filters"
                    >
                      {t('reset')}
                    </Button>
                    <Button
                      size="sm"
                      onClick={() => setIsFilterOpen(false)}
                      data-testid="button-apply-filters"
                    >
                      {t('apply')}
                    </Button>
                  </div>
                </div>
              </PopoverContent>
            </Popover>
          </div>
          <Button onClick={() => setIsModalOpen(true)} data-testid="button-new-order">
            <Plus className="w-4 h-4 sm:ltr:mr-2 sm:rtl:ml-2" />
            <span className="hidden sm:inline">{t('newOrder')}</span>
          </Button>
        </div>

        {/* Orders Table */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center">
              <Package className="w-5 h-5 mr-2" />
              {t('ordersCount')} ({filteredOrders.length})
            </CardTitle>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="text-center py-8">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto"></div>
                <p className="text-muted-foreground mt-2">{t('loadingOrders')}</p>
              </div>
            ) : filteredOrders.length === 0 ? (
              <div className="text-center py-8">
                <Package className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
                <h3 className="text-lg font-medium text-foreground mb-2">{t('noOrdersFound')}</h3>
                <p className="text-muted-foreground">
                  {searchTerm ? t('noOrdersMatch') : t('getStartedFirstOrder')}
                </p>
                {!searchTerm && (
                  <Button className="mt-4" onClick={() => setIsModalOpen(true)} data-testid="button-create-first-order">
                    <Plus className="w-4 h-4 mr-2" />
                    {t('createFirstOrder')}
                  </Button>
                )}
              </div>
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>{t('orderNumber')}</TableHead>
                      <TableHead>{t('trackingNumber')}</TableHead>
                      <TableHead>{t('customer')}</TableHead>
                      <TableHead>{t('shippingCodeLabel')}</TableHead>
                      <TableHead>{t('status')}</TableHead>
                      <TableHead>{t('total')}</TableHead>
                      <TableHead>{t('downPaymentLabel')}</TableHead>
                      <TableHead>{t('remainingLabel')}</TableHead>
                      <TableHead>{t('profit')}</TableHead>
                      <TableHead>{t('createdAt')}</TableHead>
                      <TableHead>{t('actions')}</TableHead>
                    </TableRow>
                  </TableHeader>
                <TableBody>
                  {filteredOrders.map((order) => (
                    <TableRow key={order.id} data-testid={`row-order-${order.id}`}>
                      <TableCell className="font-mono text-sm" data-testid={`text-order-number-${order.id}`}>
                        {order.orderNumber}
                      </TableCell>
                      <TableCell className="font-mono text-sm text-blue-600" data-testid={`text-tracking-number-${order.id}`}>
                        {order.trackingNumber || "-"}
                      </TableCell>
                      <TableCell data-testid={`text-customer-${order.id}`}>
                        {order.customer.firstName} {order.customer.lastName}
                      </TableCell>
                      <TableCell className="font-medium" data-testid={`text-shipping-code-${order.id}`}>
                        <span className="font-semibold text-primary">{order.customer.shippingCode || "-"}</span>
                      </TableCell>
                      <TableCell>
                        <Badge className={getStatusColor(order.status)} data-testid={`badge-status-${order.id}`}>
                          {translateStatus(order.status)}
                        </Badge>
                      </TableCell>
                      <TableCell data-testid={`text-total-${order.id}`}>
                        <div className="font-medium">${parseFloat(order.totalAmount).toFixed(2)}</div>
                        {(order.lydExchangeRate || exchangeRate > 0) && (
                          <div className="text-sm text-green-600 font-semibold">{convertOrderToLYD(parseFloat(order.totalAmount), order.lydExchangeRate || undefined)} LYD</div>
                        )}
                      </TableCell>
                      <TableCell data-testid={`text-down-payment-${order.id}`}>
                        <div className="font-semibold text-green-600">${parseFloat(order.downPayment || "0").toFixed(2)}</div>
                        {(order.lydExchangeRate || exchangeRate > 0) && parseFloat(order.downPayment || "0") > 0 && (
                          <div className="text-sm text-blue-600 font-medium">{convertOrderToLYD(parseFloat(order.downPayment || "0"), order.lydExchangeRate || undefined)} LYD</div>
                        )}
                      </TableCell>
                      <TableCell data-testid={`text-remaining-${order.id}`}>
                        <div>${parseFloat(order.remainingBalance || "0").toFixed(2)}</div>
                        {(order.lydExchangeRate || exchangeRate > 0) && (
                          <div className="text-sm text-orange-600 font-medium">{convertOrderToLYD(parseFloat(order.remainingBalance || "0"), order.lydExchangeRate || undefined)} LYD</div>
                        )}
                      </TableCell>
                      <TableCell data-testid={`text-profit-${order.id}`}>
                        <div className="font-medium text-green-600">${parseFloat(order.totalProfit).toFixed(2)}</div>
                        {(order.lydExchangeRate || exchangeRate > 0) && (
                          <div className="text-sm text-purple-600 font-semibold">{convertOrderToLYD(parseFloat(order.totalProfit), order.lydExchangeRate || undefined)} LYD</div>
                        )}
                      </TableCell>
                      <TableCell data-testid={`text-date-${order.id}`}>
                        {new Date(order.createdAt).toLocaleDateString()}
                      </TableCell>
                      <TableCell>
                        <div className="flex space-x-2">
                          <Button 
                            variant="outline" 
                            size="sm" 
                            onClick={() => openEditModal(order)}
                            data-testid={`button-edit-order-${order.id}`}
                          >
                            {t('edit')}
                          </Button>
                          <Button 
                            variant="outline" 
                            size="sm" 
                            onClick={() => openViewModal(order)}
                            data-testid={`button-view-order-${order.id}`}
                          >
                            {t('view')}
                          </Button>
                          <Button 
                            variant="outline" 
                            size="sm" 
                            onClick={() => handlePrintInvoice(order)}
                            data-testid={`button-print-invoice-${order.id}`}
                          >
                            <Printer className="w-4 h-4 mr-1" />
                            {t('print')}
                          </Button>
                          <Button 
                            variant="destructive" 
                            size="sm" 
                            onClick={() => openDeleteDialog(order)}
                            data-testid={`button-delete-order-${order.id}`}
                          >
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Order Creation Modal */}
        <Dialog open={isModalOpen} onOpenChange={handleCloseModal}>
          <DialogContent className="max-w-4xl max-h-[90dvh] overflow-y-auto" data-testid="modal-create-order">
            <DialogHeader>
              <DialogTitle>{t('createNewOrder')}</DialogTitle>
            </DialogHeader>
            <form onSubmit={handleSubmit} className="space-y-6">
              {/* Customer Search */}
              <div className="space-y-4">
                <div>
                  <Label htmlFor="customerSearch">{t('searchCustomerPhoneNameCode')}</Label>
                  <div className="flex gap-2">
                    <Input
                      id="customerSearch"
                      value={customerSearchQuery}
                      onChange={(e) => setCustomerSearchQuery(e.target.value)}
                      placeholder={t('enterPhoneNameCode')}
                      data-testid="input-customer-search"
                      onKeyPress={(e) => e.key === 'Enter' && handleCustomerSearch()}
                    />
                    <Button
                      type="button"
                      onClick={handleCustomerSearch}
                      data-testid="button-search-customer"
                    >
                      <Search className="w-4 h-4 mr-2" />
                      {t('search')}
                    </Button>
                  </div>
                </div>

                {/* Multiple Search Results */}
                {searchedCustomers.length > 0 && (
                  <div className="border rounded-lg divide-y max-h-60 overflow-y-auto" data-testid="customer-search-results">
                    {searchedCustomers.map((customer) => (
                      <div
                        key={customer.id}
                        className="p-3 hover:bg-gray-50 dark:hover:bg-gray-800 cursor-pointer transition-colors"
                        onClick={() => handleSelectCustomer(customer)}
                        data-testid={`customer-result-${customer.id}`}
                      >
                        <p className="font-semibold">
                          {customer.firstName} {customer.lastName}
                        </p>
                        <p className="text-sm text-muted-foreground">
                          {customer.phone} • {customer.shippingCode || 'No code'} • {customer.country || 'No country'}
                        </p>
                      </div>
                    ))}
                  </div>
                )}

                {/* Found Customer Display */}
                {searchedCustomer && !showCustomerForm && (
                  <div className="p-4 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg" data-testid="customer-found">
                    <p className="font-semibold text-green-800 dark:text-green-200">
                      Customer Found: {searchedCustomer.firstName} {searchedCustomer.lastName}
                    </p>
                    <p className="text-sm text-green-700 dark:text-green-300">
                      {searchedCustomer.phone} • {searchedCustomer.shippingCode || 'No code'} • {searchedCustomer.country}
                    </p>
                  </div>
                )}

                {/* Inline Customer Creation Form */}
                {showCustomerForm && (
                  <div className="p-4 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg space-y-4" data-testid="form-create-customer">
                    <div className="flex items-center justify-between">
                      <p className="font-semibold text-blue-800 dark:text-blue-200">Create New Customer</p>
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() => setShowCustomerForm(false)}
                        data-testid="button-cancel-customer"
                      >
                        <X className="w-4 h-4" />
                      </Button>
                    </div>
                    <div className="space-y-4">
                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <Label htmlFor="firstName">First Name*</Label>
                          <Input
                            id="firstName"
                            value={newCustomer.firstName}
                            onChange={(e) => setNewCustomer({...newCustomer, firstName: e.target.value})}
                            required
                            placeholder="Enter first name"
                            data-testid="input-first-name"
                          />
                        </div>
                        <div>
                          <Label htmlFor="lastName">Last Name*</Label>
                          <Input
                            id="lastName"
                            value={newCustomer.lastName}
                            onChange={(e) => setNewCustomer({...newCustomer, lastName: e.target.value})}
                            required
                            placeholder="Enter last name"
                            data-testid="input-last-name"
                          />
                        </div>
                      </div>
                      <div>
                        <Label htmlFor="customerCode">Customer Code*</Label>
                        <Input
                          id="customerCode"
                          value={newCustomer.customerCode}
                          onChange={(e) => setNewCustomer({...newCustomer, customerCode: e.target.value})}
                          required
                          placeholder="Enter customer code"
                          data-testid="input-customer-code"
                        />
                      </div>
                      <div>
                        <Label htmlFor="phone">Phone*</Label>
                        <Input
                          id="phone"
                          value={newCustomer.phone}
                          onChange={(e) => setNewCustomer({...newCustomer, phone: e.target.value})}
                          required
                          placeholder={t('enterPhone')}
                          data-testid="input-phone"
                        />
                      </div>
                      <div>
                        <Label htmlFor="city">City*</Label>
                        <Input
                          id="city"
                          value={newCustomer.city}
                          onChange={(e) => setNewCustomer({...newCustomer, city: e.target.value})}
                          required
                          placeholder={t('enterCity')}
                          data-testid="input-city"
                        />
                      </div>
                    </div>
                    <Button
                      type="button"
                      onClick={handleCreateCustomer}
                      disabled={createCustomerMutation.isPending || !newCustomer.firstName || !newCustomer.lastName || !newCustomer.customerCode || !newCustomer.city || !newCustomer.phone}
                      data-testid="button-create-customer"
                    >
                      {createCustomerMutation.isPending ? t('creating') : t('createCustomer')}
                    </Button>
                  </div>
                )}

                {/* Custom Order Code */}
                {selectedCustomerId && (
                  <div className="mt-4">
                    <Label htmlFor="orderCode">{t('orderCode')}</Label>
                    <Input
                      id="orderCode"
                      value={customOrderCode}
                      onChange={(e) => setCustomOrderCode(e.target.value)}
                      placeholder={shippingCountry ? `${shippingCountry.toUpperCase().slice(0, 2)}0001` : t('selectCountryFirst')}
                      data-testid="input-order-code"
                    />
                    <p className="text-sm text-muted-foreground mt-1">
                      {t('orderCodeAutoGenerated')}
                    </p>
                  </div>
                )}
              </div>

              {/* Order Items */}
              <div>
                <div className="flex items-center justify-between mb-4">
                  <Label>{t('orderItems')}</Label>
                  <Button 
                    type="button" 
                    onClick={addOrderItem} 
                    size="sm"
                    data-testid="button-add-item"
                  >
                    <Plus className="w-4 h-4 mr-2" />
                    {t('addItem')}
                  </Button>
                </div>

                {orderItems.length === 0 ? (
                  <div className="text-center py-4 border-2 border-dashed border-gray-300 rounded-lg">
                    <p className="text-muted-foreground">{t('noItemsAdded')}</p>
                    <Button 
                      type="button" 
                      variant="outline" 
                      onClick={addOrderItem}
                      className="mt-2"
                      data-testid="button-add-first-item"
                    >
                      {t('addFirstItem')}
                    </Button>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {orderItems.map((item, index) => (
                      <div key={index} className="border rounded-lg p-4 bg-muted/30" data-testid={`order-item-${index}`}>
                        <div className="space-y-4">
                          {/* First row: Shipping Code, Product Code */}
                          <div className="grid grid-cols-12 gap-4">
                            <div className="col-span-11">
                              <Label htmlFor={`product-name-${index}`}>Shipping Code (Optional)</Label>
                              <Input
                                id={`product-name-${index}`}
                                value={item.productName}
                                onChange={(e) => updateOrderItem(index, "productName", e.target.value)}
                                placeholder={t('enterShippingCode')}
                                data-testid={`input-product-name-${index}`}
                              />
                            </div>
                            <div className="col-span-1 flex items-end">
                              <Button
                                type="button"
                                variant="destructive"
                                size="icon"
                                onClick={() => removeOrderItem(index)}
                                data-testid={`button-remove-item-${index}`}
                              >
                                <Trash2 className="w-4 h-4" />
                              </Button>
                            </div>
                          </div>

                          {/* Second row: Product URL */}
                          <div className="grid grid-cols-1 gap-4">
                            <div>
                              <Label htmlFor={`product-url-${index}`}>Product Link</Label>
                              <Input
                                id={`product-url-${index}`}
                                value={item.productUrl}
                                onChange={(e) => updateOrderItem(index, "productUrl", e.target.value)}
                                placeholder="https://..."
                                data-testid={`input-product-url-${index}`}
                              />
                            </div>
                          </div>

                          {/* Third row: Prices, Quantity, Total */}
                          <div className="grid grid-cols-4 gap-4">
                            <div>
                              <Label htmlFor={`original-price-${index}`}>Original Price ($)*</Label>
                              <Input
                                id={`original-price-${index}`}
                                type="number"
                                step="0.01"
                                min="0"
                                value={item.originalPrice}
                                onChange={(e) => updateOrderItem(index, "originalPrice", parseFloat(e.target.value) || 0)}
                                placeholder="0.00"
                                required
                                data-testid={`input-original-price-${index}`}
                              />
                            </div>
                            <div>
                              <Label htmlFor={`discounted-price-${index}`}>After Discount ($)*</Label>
                              <Input
                                id={`discounted-price-${index}`}
                                type="number"
                                step="0.01"
                                min="0"
                                value={item.discountedPrice}
                                onChange={(e) => updateOrderItem(index, "discountedPrice", parseFloat(e.target.value) || 0)}
                                placeholder="0.00"
                                required
                                data-testid={`input-discounted-price-${index}`}
                              />
                            </div>
                            <div>
                              <Label htmlFor={`quantity-${index}`}>Quantity*</Label>
                              <Input
                                id={`quantity-${index}`}
                                type="number"
                                min="1"
                                value={item.quantity}
                                onChange={(e) => updateOrderItem(index, "quantity", parseInt(e.target.value) || 1)}
                                required
                                data-testid={`input-quantity-${index}`}
                              />
                            </div>
                            <div>
                              <Label>Total (Customer Pays)</Label>
                              <div className="h-10 px-3 py-2 border rounded-md bg-muted font-semibold flex items-center" data-testid={`text-item-total-${index}`}>
                                ${item.totalPrice.toFixed(2)}
                              </div>
                            </div>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Order Images Upload */}
              <div className="space-y-4">
                <Label>{t('orderImages')} ({t('optional')} - {t('upTo3Photos')})</Label>
                <div className="grid grid-cols-3 gap-4">
                  {[0, 1, 2].map((index) => (
                    <div key={index} className="space-y-2">
                      <Label>{t('image')} {index + 1}</Label>
                      <ImageUploader
                        index={index}
                        currentImageUrl={orderImages[index]?.url}
                        onImageUploaded={(url) => {
                          const newImages = [...orderImages];
                          newImages[index] = { 
                            url, 
                            altText: `Order image ${index + 1}` 
                          };
                          setOrderImages(newImages);
                        }}
                        onRemove={() => {
                          const newImages = orderImages.filter((_, i) => i !== index);
                          setOrderImages(newImages);
                        }}
                      />
                    </div>
                  ))}
                </div>
              </div>

              {/* Shipping Configuration and Notes */}
              <div className="space-y-4">
                <div className="grid grid-cols-3 gap-4">
                  <div>
                    <Label htmlFor="shipping-country">{t('shippingCountry')}</Label>
                    <Select value={shippingCountry} onValueChange={handleCountryChange}>
                      <SelectTrigger data-testid="select-shipping-country">
                        <SelectValue placeholder={t('selectCountry')} />
                      </SelectTrigger>
                      <SelectContent>
                        {shippingCountries.map((country) => (
                          <SelectItem key={country} value={country}>
                            {country}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label htmlFor="shipping-category">{t('shippingCategory')}</Label>
                    <Select value={shippingCategory} onValueChange={setShippingCategory}>
                      <SelectTrigger data-testid="select-shipping-category">
                        <SelectValue placeholder={t('selectCategory')} />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="normal">{t('normal')}</SelectItem>
                        <SelectItem value="perfumes">{t('perfumes')}</SelectItem>
                        <SelectItem value="electronics">{t('electronics')}</SelectItem>
                        <SelectItem value="clothing">{t('clothing')}</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label htmlFor="shipping-weight">{t('weightKg')}</Label>
                    <Input
                      id="shipping-weight"
                      type="number"
                      inputMode="decimal"
                      step="0.1"
                      min="0"
                      value={shippingWeight}
                      onChange={(e) => setShippingWeight(parseFloat(e.target.value) || 0)}
                      data-testid="input-shipping-weight"
                    />
                  </div>
                </div>
                
                {shippingCategory === "clothing" && (
                  <div>
                    <Label htmlFor="clothing-size">Clothing Size (Optional)</Label>
                    <Input
                      id="clothing-size"
                      value={clothingSize}
                      onChange={(e) => setClothingSize(e.target.value)}
                      placeholder="e.g., S, M, L, XL, 42, etc."
                      data-testid="input-clothing-size"
                    />
                  </div>
                )}
                
                <div className="flex items-center gap-4">
                  <Button
                    type="button"
                    onClick={calculateShippingCost}
                    disabled={calculatingShipping || !shippingCountry || !shippingCategory || orderItems.length === 0}
                    data-testid="button-calculate-shipping"
                  >
                    {calculatingShipping ? t('calculating') : t('calculateShipping')}
                  </Button>
                  
                  {shippingCalculation && (
                    <div className="text-sm text-green-600 font-medium" data-testid="text-shipping-calculated">
                      {t('calculatedShipping')} {shippingCalculation.currency} {shippingCalculation.base_shipping.toFixed(2)}, 
                      {t('calculatedCommission')} {shippingCalculation.currency} {shippingCalculation.commission.toFixed(2)}
                      {shippingCalculation.currency !== 'USD' && (
                        <span className="text-blue-600"> {t('convertedToUsd')}</span>
                      )}
                    </div>
                  )}
                </div>

                <div>
                  <Label htmlFor="lyd-exchange-rate">
                    {t('lydExchangeRate') || 'LYD Exchange Rate'} (1 USD = ? LYD)
                  </Label>
                  <Input
                    id="lyd-exchange-rate"
                    type="number"
                    step="0.0001"
                    min="0"
                    value={orderLydRate > 0 ? orderLydRate : ''}
                    onChange={(e) => {
                      const val = e.target.value === '' ? 0 : parseFloat(e.target.value);
                      setOrderLydRate(isNaN(val) ? 0 : val);
                    }}
                    placeholder={exchangeRate > 0 ? exchangeRate.toFixed(4) : "0.0000"}
                    data-testid="input-lyd-rate"
                  />
                  <p className="text-sm text-muted-foreground mt-1">
                    {orderLydRate > 0 
                      ? `${t('orderRate') || 'This Order'}: 1 USD = ${orderLydRate.toFixed(4)} LYD`
                      : `${t('globalRate') || 'Global Rate'}: ${exchangeRate > 0 ? `1 USD = ${exchangeRate.toFixed(4)} LYD` : 'Not set'}`
                    }
                  </p>
                </div>

                <div>
                  <Label htmlFor="notes">{t('notesOptional')}</Label>
                  <Input
                    id="notes"
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    placeholder={t('orderNotes')}
                    data-testid="input-notes"
                  />
                </div>
              </div>

              {/* Order Summary */}
              {orderItems.length > 0 && (
                <div className="border-t pt-4">
                  <h4 className="font-medium mb-4">{t('orderSummary')}</h4>
                  <div className="space-y-2 text-sm">
                    <div className="flex justify-between">
                      <span>{t('subtotal')}</span>
                      <span data-testid="text-subtotal">${calculateTotals().subtotal.toFixed(2)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span>{t('shipping')}</span>
                      <span data-testid="text-shipping">
                        {calculateTotals().currency} {calculateTotals().shippingCost.toFixed(2)}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span>{t('commission')}</span>
                      <span data-testid="text-commission">
                        {calculateTotals().currency} {calculateTotals().commission.toFixed(2)}
                      </span>
                    </div>
                    <div className="flex justify-between font-medium text-lg border-t pt-2">
                      <span>{t('total')}:</span>
                      <span data-testid="text-total">
                        {calculateTotals().currency} {calculateTotals().total.toFixed(2)}
                      </span>
                    </div>
                    <div className="border-t pt-3 space-y-3">
                      <div>
                        <Label htmlFor="down-payment" className="text-sm">
                          {t('downPaymentOptional')} (LYD)
                        </Label>
                        <Input
                          id="down-payment"
                          type="number"
                          step="0.01"
                          min="0"
                          max={(() => {
                            const rate = orderLydRate > 0 ? orderLydRate : exchangeRate;
                            return rate > 0 ? calculateTotals().total * rate : calculateTotals().total;
                          })()}
                          value={downPayment}
                          onChange={(e) => setDownPayment(parseFloat(e.target.value) || 0)}
                          placeholder="0.00"
                          className="mt-1"
                          data-testid="input-down-payment"
                        />
                      </div>
                      {downPayment > 0 && (
                        <div className="flex justify-between text-orange-600 font-medium">
                          <span>{t('remainingBalance')}:</span>
                          <span data-testid="text-payment-remaining">
                            {(() => {
                              const rate = orderLydRate > 0 ? orderLydRate : exchangeRate;
                              const downPaymentUSD = rate > 0 ? downPayment / rate : 0;
                              const remainingUSD = calculateTotals().total - downPaymentUSD;
                              const remainingLYD = rate > 0 ? remainingUSD * rate : 0;
                              return (
                                <>
                                  ${remainingUSD.toFixed(2)}
                                  {rate > 0 && <span className="text-sm"> ({remainingLYD.toFixed(2)} LYD)</span>}
                                </>
                              );
                            })()}
                          </span>
                        </div>
                      )}
                    </div>
                    <div className="flex justify-between text-green-600 font-medium border-t pt-2">
                      <span>{t('estimatedProfit')}</span>
                      <span data-testid="text-profit">
                        {calculateTotals().currency} {(shippingCalculation ? calculateTotals().profit : calculateTotals().itemsProfit).toFixed(2)}
                      </span>
                    </div>
                  </div>
                </div>
              )}

              {/* Form Actions */}
              <div className="space-y-2">
                {!shippingCalculation && orderItems.length > 0 && (
                  <div className="text-sm text-blue-600 bg-blue-50 p-2 rounded" data-testid="text-shipping-optional">
                    {t('shippingOptional') || 'Shipping calculation is optional. You can add shipping details later.'}
                  </div>
                )}
                {shippingCalculation && isShippingCalculationStale() && (
                  <div className="text-sm text-amber-600 bg-amber-50 p-2 rounded" data-testid="text-shipping-stale">
                    {t('recalculateShipping') || 'Items have changed. Consider recalculating shipping.'}
                  </div>
                )}
                <div className="flex justify-end space-x-2 pt-2">
                  <Button 
                    type="button" 
                    variant="outline" 
                    onClick={() => handleCloseModal(false)}
                    data-testid="button-cancel"
                  >
                    {t('cancel')}
                  </Button>
                  <Button 
                    type="submit" 
                    disabled={
                      createOrderMutation.isPending || 
                      !selectedCustomerId || 
                      orderItems.length === 0
                    }
                    data-testid="button-create-order"
                  >
                    {createOrderMutation.isPending ? t('creating') : t('createOrder')}
                  </Button>
                </div>
              </div>
            </form>
          </DialogContent>
        </Dialog>

        {/* Edit Order Modal */}
        <Dialog open={isEditModalOpen} onOpenChange={setIsEditModalOpen}>
          <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto" data-testid="modal-edit-order">
            <DialogHeader>
              <DialogTitle>{t('editOrderTitle')}</DialogTitle>
            </DialogHeader>
            {editingOrder && (
              <form onSubmit={handleEditSubmit} className="space-y-6">
                {/* Order Details (Read-only) */}
                <div className="bg-muted/50 p-4 rounded-lg space-y-2">
                  <div className="grid grid-cols-2 gap-4 text-sm">
                    <div>
                      <span className="font-medium">{t('orderId')}</span>
                      <span className="ml-2">{editingOrder.id.substring(0, 8)}</span>
                    </div>
                    <div>
                      <span className="font-medium">{t('customerLabel')}</span>
                      <span className="ml-2">{editingOrder.customer.firstName} {editingOrder.customer.lastName}</span>
                    </div>
                    <div>
                      <span className="font-medium">{t('totalAmountLabel')}</span>
                      <span className="ml-2">${parseFloat(editingOrder.totalAmount).toFixed(2)}</span>
                    </div>
                    <div>
                      <span className="font-medium">{t('created')}</span>
                      <span className="ml-2">{new Date(editingOrder.createdAt).toLocaleDateString()}</span>
                    </div>
                  </div>
                </div>

                {/* Editable Fields */}
                <div className="space-y-4">
                  {/* Tracking Number and Shipping Code */}
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <Label htmlFor="edit-tracking-number">{t('trackingNumber')}</Label>
                      <Input
                        id="edit-tracking-number"
                        type="text"
                        value={editingOrder.trackingNumber || ''}
                        onChange={(e) => {
                          setEditingOrder(prev => {
                            if (!prev) return null;
                            return {
                              ...prev,
                              trackingNumber: e.target.value
                            };
                          });
                        }}
                        placeholder={t('trackingNumberPlaceholder')}
                        data-testid="input-edit-tracking-number"
                      />
                    </div>
                    <div>
                      <Label htmlFor="edit-shipping-code">{t('shippingCodeLabel')}</Label>
                      <Input
                        id="edit-shipping-code"
                        type="text"
                        value={editingOrder.customer.shippingCode || ''}
                        onChange={(e) => {
                          const newShippingCode = e.target.value;
                          setEditingOrder(prev => {
                            if (!prev) return null;
                            return {
                              ...prev,
                              customer: {
                                ...prev.customer,
                                shippingCode: newShippingCode
                              }
                            };
                          });
                        }}
                        placeholder={t('enterShippingCode')}
                        data-testid="input-edit-shipping-code"
                      />
                    </div>
                  </div>

                  {!editingOrder.shippingCountry && (
                    <div className="bg-yellow-50 border border-yellow-200 rounded p-3 text-sm text-yellow-800">
                      {t('shippingRecalculationNote')}
                    </div>
                  )}

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <Label htmlFor="edit-status">{t('orderStatus')}</Label>
                      <Select value={editOrderStatus} onValueChange={setEditOrderStatus}>
                        <SelectTrigger id="edit-status" data-testid="select-edit-status">
                          <SelectValue placeholder={t('selectStatus')} />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="pending">{t('pending')}</SelectItem>
                          <SelectItem value="processing">{t('processing')}</SelectItem>
                          <SelectItem value="shipped">{t('shipped')}</SelectItem>
                          <SelectItem value="delivered">{t('delivered')}</SelectItem>
                          <SelectItem value="cancelled">{t('cancelled')}</SelectItem>
                          <SelectItem value="partially_arrived">{t('partially_arrived')}</SelectItem>
                          <SelectItem value="ready_to_collect">{t('ready_to_collect')}</SelectItem>
                          <SelectItem value="with_shipping_company">{t('with_shipping_company')}</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>

                  {/* Exchange Rate Fields - Separate for Items and Shipping */}
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <Label htmlFor="edit-items-lyd-rate" className="text-sm font-medium">
                        {t('itemsExchangeRate') || 'Items Exchange Rate (LYD)'}
                      </Label>
                      <Input
                        id="edit-items-lyd-rate"
                        type="number"
                        step="0.0001"
                        min="0"
                        value={editingOrder.lydExchangeRate || ''}
                        readOnly
                        disabled
                        className="bg-gray-100 cursor-not-allowed"
                        placeholder={t('originalRateFromCreation') || 'Original rate'}
                        data-testid="input-edit-items-lyd-rate"
                      />
                      <p className="text-xs text-gray-500 mt-1">
                        {t('lockedAtCreation') || 'Locked at order creation'}
                      </p>
                    </div>
                    <div>
                      <Label htmlFor="edit-shipping-lyd-rate" className="text-sm font-medium">
                        {t('shippingExchangeRate') || 'Shipping Exchange Rate (LYD)'}
                      </Label>
                      <Input
                        id="edit-shipping-lyd-rate"
                        type="number"
                        step="0.0001"
                        min="0"
                        value={editingOrder.shippingLydExchangeRate || editingOrder.lydExchangeRate || ''}
                        onChange={(e) => {
                          const newRate = e.target.value;
                          setEditingOrder(prev => {
                            if (!prev) return null;
                            return {
                              ...prev,
                              shippingLydExchangeRate: newRate
                            };
                          });
                        }}
                        placeholder={t('enterShippingExchangeRate') || 'Current shipping rate'}
                        data-testid="input-edit-shipping-lyd-rate"
                      />
                      <p className="text-xs text-blue-600 mt-1">
                        {t('shippingRateEditable') || 'Used for shipping cost calculation'}
                      </p>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <Label htmlFor="edit-down-payment">{t('downPaymentLabel')} (LYD)</Label>
                      <Input
                        id="edit-down-payment"
                        type="number"
                        step="0.01"
                        min="0"
                        value={downPaymentLYDInput}
                        onChange={(e) => {
                          // Just update the local input state while typing
                          setDownPaymentLYDInput(e.target.value);
                        }}
                        onBlur={(e) => {
                          // Convert to USD when user finishes typing
                          const downPaymentLYD = parseFloat(e.target.value) || 0;
                          const rate = parseFloat(editingOrder.lydExchangeRate || "0") || exchangeRate;
                          const downPaymentUSD = rate > 0 ? downPaymentLYD / rate : downPaymentLYD;
                          const total = parseFloat(editingOrder.totalAmount || "0");
                          const newRemaining = total - downPaymentUSD;
                          setEditingOrder(prev => {
                            if (!prev) return null;
                            return {
                              ...prev,
                              downPayment: downPaymentUSD.toFixed(2),
                              remainingBalance: newRemaining.toFixed(2)
                            };
                          });
                        }}
                        data-testid="input-edit-down-payment"
                      />
                    </div>
                    <div>
                      <Label htmlFor="edit-shipping-weight">{t('shippingWeightKg')}</Label>
                      <Input
                        id="edit-shipping-weight"
                        type="number"
                        step="0.1"
                        min="0"
                        value={editingOrder.shippingWeight || 0}
                        onChange={async (e) => {
                          const newWeight = parseFloat(e.target.value) || 0;

                          // Always update the weight first
                          setEditingOrder(prev => {
                            if (!prev) return null;
                            return { ...prev, shippingWeight: newWeight.toFixed(2) };
                          });

                          // Then recalculate shipping if country and category are available
                          if (editingOrder.shippingCountry && editingOrder.shippingCategory && editableItems.length > 0) {
                            try {
                              const itemsTotal = editableItems.reduce((sum, item) => 
                                sum + (parseFloat(item.totalPrice as any) || 0), 0
                              );
                              
                              const response = await fetch('/api/calculate-shipping', {
                                method: 'POST',
                                headers: { 'Content-Type': 'application/json' },
                                credentials: 'include',
                                body: JSON.stringify({
                                  country: editingOrder.shippingCountry,
                                  category: editingOrder.shippingCategory,
                                  weight: newWeight,
                                  orderValue: itemsTotal
                                })
                              });

                              if (response.ok) {
                                const calc = await response.json();
                                const newShippingCost = parseFloat(calc.base_shipping);
                                const newCommission = parseFloat(calc.commission);
                                const newTotal = itemsTotal + newShippingCost + newCommission;
                                
                                setEditingOrder(prev => {
                                  if (!prev) return null;
                                  return {
                                    ...prev,
                                    shippingWeight: newWeight.toFixed(2),
                                    shippingCost: newShippingCost.toFixed(2),
                                    commission: newCommission.toFixed(2),
                                    totalAmount: newTotal.toFixed(2),
                                  };
                                });
                                
                                toast({
                                  title: t('shippingRecalculated'),
                                  description: `Weight: ${newWeight}kg, Shipping: $${newShippingCost.toFixed(2)}, Total: $${newTotal.toFixed(2)}`,
                                });
                              }
                            } catch (error) {
                              console.error('Error recalculating shipping:', error);
                            }
                          }
                        }}
                        data-testid="input-edit-shipping-weight"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <Label htmlFor="edit-shipping-country">{t('shippingCountry')}</Label>
                      <Select 
                        value={editingOrder.shippingCountry || ""} 
                        onValueChange={async (value) => {
                          setEditingOrder(prev => {
                            if (!prev) return null;
                            return { ...prev, shippingCountry: value };
                          });

                          // Trigger recalculation if all data available
                          if (value && editingOrder.shippingCategory && editableItems.length > 0) {
                            try {
                              const itemsTotal = editableItems.reduce((sum, item) => 
                                sum + (parseFloat(item.totalPrice as any) || 0), 0
                              );
                              const weight = parseFloat(editingOrder.shippingWeight || "1");
                              
                              const response = await fetch('/api/calculate-shipping', {
                                method: 'POST',
                                headers: { 'Content-Type': 'application/json' },
                                credentials: 'include',
                                body: JSON.stringify({
                                  country: value,
                                  category: editingOrder.shippingCategory,
                                  weight: weight,
                                  orderValue: itemsTotal
                                })
                              });

                              if (response.ok) {
                                const calc = await response.json();
                                const newShippingCost = parseFloat(calc.base_shipping);
                                const newCommission = parseFloat(calc.commission);
                                const newTotal = itemsTotal + newShippingCost + newCommission;
                                
                                setEditingOrder(prev => {
                                  if (!prev) return null;
                                  return {
                                    ...prev,
                                    shippingCountry: value,
                                    shippingCost: newShippingCost.toFixed(2),
                                    commission: newCommission.toFixed(2),
                                    totalAmount: newTotal.toFixed(2),
                                  };
                                });
                                
                                toast({
                                  title: t('shippingRecalculated'),
                                  description: `Shipping: $${newShippingCost.toFixed(2)}, Total: $${newTotal.toFixed(2)}`,
                                });
                              }
                            } catch (error) {
                              console.error('Error recalculating shipping:', error);
                            }
                          }
                        }}
                      >
                        <SelectTrigger id="edit-shipping-country" data-testid="select-edit-shipping-country">
                          <SelectValue placeholder={t('selectCountry')} />
                        </SelectTrigger>
                        <SelectContent>
                          {shippingCountries.map((country) => (
                            <SelectItem key={country} value={country}>
                              {country}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div>
                      <Label htmlFor="edit-shipping-category">{t('shippingCategory')}</Label>
                      <Select 
                        value={editingOrder.shippingCategory || ""} 
                        onValueChange={async (value) => {
                          // Always update category first
                          setEditingOrder(prev => {
                            if (!prev) return null;
                            return { ...prev, shippingCategory: value };
                          });

                          // Trigger recalculation if all data available
                          if (editingOrder.shippingCountry && value && editableItems.length > 0) {
                            try {
                              const itemsTotal = editableItems.reduce((sum, item) => 
                                sum + (parseFloat(item.totalPrice as any) || 0), 0
                              );
                              const weight = parseFloat(editingOrder.shippingWeight || "1");
                              
                              const response = await fetch('/api/calculate-shipping', {
                                method: 'POST',
                                headers: { 'Content-Type': 'application/json' },
                                credentials: 'include',
                                body: JSON.stringify({
                                  country: editingOrder.shippingCountry,
                                  category: value,
                                  weight: weight,
                                  orderValue: itemsTotal
                                })
                              });

                              if (response.ok) {
                                const calc = await response.json();
                                const newShippingCost = parseFloat(calc.base_shipping);
                                const newCommission = parseFloat(calc.commission);
                                const newTotal = itemsTotal + newShippingCost + newCommission;
                                
                                setEditingOrder(prev => {
                                  if (!prev) return null;
                                  return {
                                    ...prev,
                                    shippingCategory: value,
                                    shippingCost: newShippingCost.toFixed(2),
                                    commission: newCommission.toFixed(2),
                                    totalAmount: newTotal.toFixed(2),
                                  };
                                });
                                
                                toast({
                                  title: t('shippingRecalculated'),
                                  description: `Shipping: $${newShippingCost.toFixed(2)}, Total: $${newTotal.toFixed(2)}`,
                                });
                              }
                            } catch (error) {
                              console.error('Error recalculating shipping:', error);
                            }
                          }
                        }}
                      >
                        <SelectTrigger id="edit-shipping-category" data-testid="select-edit-shipping-category">
                          <SelectValue placeholder={t('selectCategory')} />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="normal">{t('normalShipping')}</SelectItem>
                          <SelectItem value="express">{t('expressShipping')}</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>

                  {editingOrder.shippingCountry && editingOrder.shippingCategory && (
                    <div className="bg-blue-50 p-3 rounded text-sm space-y-1">
                      <div className="font-medium">Shipping Details:</div>
                      <div>Country: {editingOrder.shippingCountry}, Category: {editingOrder.shippingCategory}</div>
                      <div className="flex justify-between">
                        <span>Shipping Cost:</span>
                        <div className="text-right">
                          <div>${parseFloat(editingOrder.shippingCost || "0").toFixed(2)}</div>
                          {(editingOrder.shippingLydExchangeRate || editingOrder.lydExchangeRate || exchangeRate > 0) && (
                            <div className="text-xs text-blue-600 font-semibold">{convertOrderToLYD(parseFloat(editingOrder.shippingCost || "0"), (editingOrder.shippingLydExchangeRate || editingOrder.lydExchangeRate || undefined))} LYD</div>
                          )}
                        </div>
                      </div>
                      <div>Commission: ${parseFloat(editingOrder.commission || "0").toFixed(2)}</div>
                      <div className="font-medium pt-1 border-t border-blue-200">Total: ${parseFloat(editingOrder.totalAmount || "0").toFixed(2)}</div>
                    </div>
                  )}

                  <div>
                    <Label htmlFor="edit-notes">{t('orderNotesLabel')}</Label>
                    <textarea
                      id="edit-notes"
                      value={notes}
                      onChange={(e) => setNotes(e.target.value)}
                      className="w-full min-h-[100px] p-3 border rounded-md resize-none"
                      placeholder={t('addOrderNotes')}
                      data-testid="textarea-edit-notes"
                    />
                  </div>
                </div>

                <div className="flex justify-end space-x-2 pt-4 border-t">
                  <Button 
                    type="button" 
                    variant="outline" 
                    onClick={() => setIsEditModalOpen(false)}
                    data-testid="button-cancel-edit"
                  >
                    {t('cancel')}
                  </Button>
                  <Button 
                    type="submit" 
                    disabled={updateOrderMutation.isPending}
                    data-testid="button-update-order"
                  >
                    {updateOrderMutation.isPending ? t('updating') : t('updateOrder')}
                  </Button>
                </div>
              </form>
            )}
          </DialogContent>
        </Dialog>

        {/* View Order Modal */}
        <Dialog open={isViewModalOpen} onOpenChange={(open) => {
          setIsViewModalOpen(open);
          if (!open) {
            setViewingOrder(null);
            setCopiedOrderLink(false);
          }
        }}>
          <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto" data-testid="modal-view-order">
            <DialogHeader>
              <DialogTitle>{t('orderDetailsTitle')}</DialogTitle>
            </DialogHeader>
            {viewingOrder && (
              <div className="space-y-6">
                {/* Order Summary */}
                <div className="bg-muted/50 p-4 rounded-lg space-y-3">
                  <h3 className="font-semibold text-lg mb-3">{t('orderInformation')}</h3>
                  <div className="grid grid-cols-2 gap-4 text-sm">
                    <div>
                      <span className="font-medium text-muted-foreground">{t('orderNumberLabel')}</span>
                      <p className="mt-1" data-testid="text-view-order-number">{viewingOrder.orderNumber}</p>
                    </div>
                    <div>
                      <span className="font-medium text-muted-foreground">{t('orderIdLabel')}</span>
                      <p className="mt-1" data-testid="text-view-order-id">{viewingOrder.id.substring(0, 8)}...</p>
                    </div>
                    <div>
                      <span className="font-medium text-muted-foreground">{t('statusLabel')}</span>
                      <div className="mt-1">
                        <Badge className={getStatusColor(viewingOrder.status)} data-testid="badge-view-status">
                          {t(viewingOrder.status)}
                        </Badge>
                      </div>
                    </div>
                    <div>
                      <span className="font-medium text-muted-foreground">{t('createdDate')}</span>
                      <p className="mt-1" data-testid="text-view-created">{new Date(viewingOrder.createdAt).toLocaleString(i18n.language === 'ar' ? 'ar-SA' : 'en-US')}</p>
                    </div>
                  </div>
                  
                  {/* Order Link */}
                  <div className="pt-3 border-t mt-3">
                    <span className="font-medium text-muted-foreground block mb-2">{t('orderLink')}</span>
                    <div className="flex items-center gap-2">
                      <Input
                        value={`${window.location.origin}/orders?highlight=${viewingOrder.id}`}
                        readOnly
                        className="flex-1 bg-background text-sm"
                        data-testid="input-order-link"
                      />
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => copyOrderLink(viewingOrder.id)}
                        data-testid="button-copy-order-link"
                      >
                        {copiedOrderLink ? (
                          <>
                            <Check className="w-4 h-4 mr-1" />
                            {t('copied')}
                          </>
                        ) : (
                          <>
                            <Copy className="w-4 h-4 mr-1" />
                            {t('copy')}
                          </>
                        )}
                      </Button>
                    </div>
                  </div>
                </div>

                {/* Customer Information */}
                <div className="bg-muted/50 p-4 rounded-lg space-y-3">
                  <h3 className="font-semibold text-lg mb-3">{t('customerInformation')}</h3>
                  <div className="grid grid-cols-2 gap-4 text-sm">
                    <div>
                      <span className="font-medium text-muted-foreground">{t('nameLabel')}</span>
                      <p className="mt-1" data-testid="text-view-customer-name">
                        {viewingOrder.customer.firstName} {viewingOrder.customer.lastName}
                      </p>
                    </div>
                    <div>
                      <span className="font-medium text-muted-foreground">{t('emailLabel')}</span>
                      <p className="mt-1" data-testid="text-view-customer-email">{viewingOrder.customer.email}</p>
                    </div>
                    <div>
                      <span className="font-medium text-muted-foreground">{t('phoneLabel')}</span>
                      <p className="mt-1" data-testid="text-view-customer-phone">{viewingOrder.customer.phone || t('naLabel')}</p>
                    </div>
                    <div>
                      <span className="font-medium text-muted-foreground">{t('countryLabel')}</span>
                      <p className="mt-1" data-testid="text-view-customer-country">{viewingOrder.customer.country}</p>
                    </div>
                  </div>
                </div>

                {/* Order Items */}
                {isLoadingViewOrder ? (
                  <div className="text-center py-8">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto"></div>
                    <p className="text-muted-foreground mt-2">{t('loadingOrderItems')}</p>
                  </div>
                ) : viewOrderWithItems?.items && viewOrderWithItems.items.length > 0 ? (
                  <div className="space-y-3">
                    <h3 className="font-semibold text-lg">{t('orderItemsTitle')}</h3>
                    <div className="border rounded-lg overflow-hidden">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>{t('product')}</TableHead>
                            <TableHead>{t('productLink') || 'Product Link'}</TableHead>
                            <TableHead className="text-right">{t('quantity')}</TableHead>
                            <TableHead className="text-right">{t('unitPriceLabel')}</TableHead>
                            <TableHead className="text-right">{t('total')}</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {viewOrderWithItems.items.map((item: any, index: number) => (
                            <TableRow key={index} data-testid={`row-view-item-${index}`}>
                              <TableCell data-testid={`text-view-product-${index}`}>{item.productName}</TableCell>
                              <TableCell data-testid={`text-view-product-url-${index}`}>
                                {item.productUrl ? (
                                  <a
                                    href={item.productUrl.startsWith('http') ? item.productUrl : `https://${item.productUrl}`}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="text-blue-600 hover:text-blue-800 hover:underline flex items-center gap-1 max-w-[200px] truncate"
                                    onClick={(e) => e.stopPropagation()}
                                    data-testid={`link-product-url-${index}`}
                                  >
                                    <ExternalLink className="w-3 h-3 flex-shrink-0" />
                                    <span className="truncate">{item.productUrl}</span>
                                  </a>
                                ) : (
                                  <span className="text-muted-foreground text-sm">-</span>
                                )}
                              </TableCell>
                              <TableCell className="text-right" data-testid={`text-view-quantity-${index}`}>
                                {item.quantity}
                              </TableCell>
                              <TableCell className="text-right" data-testid={`text-view-unit-price-${index}`}>
                                ${parseFloat(item.unitPrice).toFixed(2)}
                              </TableCell>
                              <TableCell className="text-right" data-testid={`text-view-item-total-${index}`}>
                                ${parseFloat(item.totalPrice).toFixed(2)}
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </div>
                  </div>
                ) : (
                  <div className="text-center py-4 text-muted-foreground">
                    {t('noItemsFound')}
                  </div>
                )}

                {/* Order Totals */}
                <div className="bg-muted/50 p-4 rounded-lg space-y-3">
                  <h3 className="font-semibold text-lg mb-3">{t('orderSummary')}</h3>
                  <div className="space-y-2 text-sm">
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">{t('subtotalLabel')}</span>
                      <div className="text-right">
                        <div data-testid="text-view-subtotal">${(parseFloat(viewingOrder.totalAmount) - parseFloat(viewingOrder.shippingCost)).toFixed(2)}</div>
                        {(viewingOrder.lydExchangeRate || exchangeRate > 0) && (
                          <div className="text-xs text-green-600">{convertOrderToLYD(parseFloat(viewingOrder.totalAmount) - parseFloat(viewingOrder.shippingCost), viewingOrder.lydExchangeRate || undefined)} LYD</div>
                        )}
                      </div>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">{t('shippingCostLabel')}</span>
                      <div className="text-right">
                        <div data-testid="text-view-shipping">${parseFloat(viewingOrder.shippingCost).toFixed(2)}</div>
                        {(viewingOrder.shippingLydExchangeRate || viewingOrder.lydExchangeRate || exchangeRate > 0) && (
                          <div className="text-xs text-blue-600 font-semibold">{convertOrderToLYD(parseFloat(viewingOrder.shippingCost), (viewingOrder.shippingLydExchangeRate || viewingOrder.lydExchangeRate || undefined))} LYD</div>
                        )}
                      </div>
                    </div>
                    <div className="flex justify-between pt-2 border-t font-semibold text-base">
                      <span>{t('totalAmountLabelColon')}</span>
                      <div className="text-right">
                        <div data-testid="text-view-total">${parseFloat(viewingOrder.totalAmount).toFixed(2)}</div>
                        {(viewingOrder.lydExchangeRate || exchangeRate > 0) && (
                          <div className="text-sm text-green-600 font-semibold">{convertOrderToLYD(parseFloat(viewingOrder.totalAmount), viewingOrder.lydExchangeRate || undefined)} LYD</div>
                        )}
                      </div>
                    </div>
                    <div className="flex justify-between text-green-600">
                      <span>{t('downPaymentLabel')}:</span>
                      <div className="text-right">
                        <div data-testid="text-view-down-payment">${parseFloat(viewingOrder.downPayment || "0").toFixed(2)}</div>
                        {(viewingOrder.lydExchangeRate || exchangeRate > 0) && parseFloat(viewingOrder.downPayment || "0") > 0 && (
                          <div className="text-sm text-blue-600">{convertOrderToLYD(parseFloat(viewingOrder.downPayment || "0"), viewingOrder.lydExchangeRate || undefined)} LYD</div>
                        )}
                      </div>
                    </div>
                    <div className="flex justify-between font-semibold text-orange-600">
                      <span>{t('remainingBalance')}:</span>
                      <div className="text-right">
                        <div data-testid="text-view-remaining-balance">${parseFloat(viewingOrder.remainingBalance || "0").toFixed(2)}</div>
                        {(viewingOrder.lydExchangeRate || exchangeRate > 0) && (
                          <div className="text-sm">{convertOrderToLYD(parseFloat(viewingOrder.remainingBalance || "0"), viewingOrder.lydExchangeRate || undefined)} LYD</div>
                        )}
                      </div>
                    </div>
                    <div className="flex justify-between text-muted-foreground border-t pt-2">
                      <span>{t('estimatedProfitLabel')}</span>
                      <div className="text-right">
                        <div data-testid="text-view-profit">${parseFloat(viewingOrder.totalProfit).toFixed(2)}</div>
                        {(viewingOrder.lydExchangeRate || exchangeRate > 0) && (
                          <div className="text-sm text-purple-600">{convertOrderToLYD(parseFloat(viewingOrder.totalProfit), viewingOrder.lydExchangeRate || undefined)} LYD</div>
                        )}
                      </div>
                    </div>
                  </div>
                </div>

                {/* Order Notes */}
                {viewingOrder.notes && (
                  <div className="bg-muted/50 p-4 rounded-lg space-y-3">
                    <h3 className="font-semibold text-lg">{t('notesTitle')}</h3>
                    <p className="text-sm whitespace-pre-wrap" data-testid="text-view-notes">{viewingOrder.notes}</p>
                  </div>
                )}

                <div className="flex justify-end pt-4 border-t">
                  <Button 
                    variant="outline" 
                    onClick={() => setIsViewModalOpen(false)}
                    data-testid="button-close-view"
                  >
                    {t('close')}
                  </Button>
                </div>
              </div>
            )}
          </DialogContent>
        </Dialog>

        {/* Print Invoice Modal */}
        <Dialog open={isPrintModalOpen} onOpenChange={setIsPrintModalOpen}>
          <DialogContent className="max-w-6xl max-h-[90vh] overflow-y-auto invoice-dialog" data-testid="modal-print-invoice">
            <DialogHeader className="print-hide">
              <div className="flex justify-between items-center">
                <DialogTitle>{t('invoicePreview')}</DialogTitle>
                <div className="flex space-x-2">
                  <Button onClick={handlePrint} data-testid="button-print">
                    <Printer className="w-4 h-4 mr-2" />
                    {t('print')}
                  </Button>
                  <Button variant="outline" onClick={() => setIsPrintModalOpen(false)}>
                    {t('close')}
                  </Button>
                </div>
              </div>
            </DialogHeader>
            {isLoadingOrderItems ? (
              <div className="text-center py-8">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto"></div>
                <p className="text-muted-foreground mt-2">{t('loadingOrderDetails')}</p>
              </div>
            ) : orderWithItems ? (
              <Invoice order={orderWithItems} onPrint={handlePrint} />
            ) : (
              <div className="text-center py-8">
                <p className="text-muted-foreground">{t('failedLoadDetails')}</p>
              </div>
            )}
          </DialogContent>
        </Dialog>


        {/* Delete Confirmation Dialog */}
        <AlertDialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
          <AlertDialogContent data-testid="dialog-delete-order">
            <AlertDialogHeader>
              <AlertDialogTitle>{t('deleteOrderTitle')}</AlertDialogTitle>
              <AlertDialogDescription>
                {t('deleteOrderConfirmation')}
                {deletingOrder && (
                  <div className="mt-2 p-2 bg-muted rounded text-sm">
                    <strong>{t('orderHash')}{deletingOrder.orderNumber}</strong> - {deletingOrder.customer.firstName} {deletingOrder.customer.lastName}
                  </div>
                )}
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel data-testid="button-cancel-delete">{t('cancel')}</AlertDialogCancel>
              <Button
                onClick={(e) => {
                  e.preventDefault();
                  handleDelete();
                  setIsDeleteDialogOpen(false);
                }}
                className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                data-testid="button-confirm-delete"
              >
                {t('delete')}
              </Button>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
    </div>
  );
}
