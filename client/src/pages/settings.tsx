import { useQuery, useMutation } from "@tanstack/react-query";
import { useState, useEffect } from "react";
import { useTranslation } from "react-i18next";
import { Settings as SettingsIcon, Database, Shield, Bell, Palette, Check, Truck, DollarSign, Plus, Edit, Trash2, Languages, User, Lock, Save } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Separator } from "@/components/ui/separator";
import { Header } from "@/components/header";
import { useAuth } from "@/components/auth-provider";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { insertShippingRateSchema, insertCommissionRuleSchema } from "@shared/schema";
import type { Setting, ShippingRate, CommissionRule, InsertShippingRate, InsertCommissionRule } from "@shared/schema";
import { z } from "zod";

// Shipping Commission Manager Component
function ShippingCommissionManager() {
  const { t } = useTranslation();
  const { toast } = useToast();
  const [isShippingDialogOpen, setIsShippingDialogOpen] = useState(false);
  const [isCommissionDialogOpen, setIsCommissionDialogOpen] = useState(false);
  const [editingShippingRate, setEditingShippingRate] = useState<ShippingRate | null>(null);
  const [editingCommissionRule, setEditingCommissionRule] = useState<CommissionRule | null>(null);

  // Fetch shipping rates
  const { data: shippingRates = [], isLoading: loadingShippingRates } = useQuery({
    queryKey: ["/api/shipping-rates"],
    queryFn: async () => {
      const response = await apiRequest("GET", "/api/shipping-rates");
      return response.json() as Promise<ShippingRate[]>;
    },
  });

  // Fetch commission rules
  const { data: commissionRules = [], isLoading: loadingCommissionRules } = useQuery({
    queryKey: ["/api/commission-rules"],
    queryFn: async () => {
      const response = await apiRequest("GET", "/api/commission-rules");
      return response.json() as Promise<CommissionRule[]>;
    },
  });

  // Shipping rate form
  const shippingForm = useForm<InsertShippingRate>({
    resolver: zodResolver(insertShippingRateSchema),
    defaultValues: {
      country: "",
      category: "normal",
      pricePerKg: "",
      currency: "USD",
    },
  });

  // Commission rule form
  const commissionForm = useForm<InsertCommissionRule>({
    resolver: zodResolver(insertCommissionRuleSchema),
    defaultValues: {
      country: "",
      minValue: "",
      maxValue: "",
      percentage: "",
      fixedFee: "0.00",
    },
  });

  // Shipping rate mutations
  const createShippingMutation = useMutation({
    mutationFn: async (data: InsertShippingRate) => {
      const response = await apiRequest("POST", "/api/shipping-rates", data);
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/shipping-rates"] });
      setIsShippingDialogOpen(false);
      shippingForm.reset();
      toast({ title: t('success'), description: t('shippingRateCreatedSuccess') });
    },
    onError: () => {
      toast({ title: t('error'), description: t('failedCreateShippingRate'), variant: "destructive" });
    },
  });

  const updateShippingMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: Partial<InsertShippingRate> }) => {
      const response = await apiRequest("PUT", `/api/shipping-rates/${id}`, data);
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/shipping-rates"] });
      setIsShippingDialogOpen(false);
      setEditingShippingRate(null);
      shippingForm.reset();
      toast({ title: t('success'), description: t('shippingRateUpdatedSuccess') });
    },
    onError: () => {
      toast({ title: t('error'), description: t('failedUpdateShippingRate'), variant: "destructive" });
    },
  });

  const deleteShippingMutation = useMutation({
    mutationFn: async (id: string) => {
      const response = await apiRequest("DELETE", `/api/shipping-rates/${id}`);
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/shipping-rates"] });
      toast({ title: t('success'), description: t('shippingRateDeletedSuccess') });
    },
    onError: () => {
      toast({ title: t('error'), description: t('failedDeleteShippingRate'), variant: "destructive" });
    },
  });

  // Commission rule mutations
  const createCommissionMutation = useMutation({
    mutationFn: async (data: InsertCommissionRule) => {
      const response = await apiRequest("POST", "/api/commission-rules", data);
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/commission-rules"] });
      setIsCommissionDialogOpen(false);
      commissionForm.reset();
      toast({ title: t('success'), description: t('commissionRuleCreatedSuccess') });
    },
    onError: () => {
      toast({ title: t('error'), description: t('failedCreateCommissionRule'), variant: "destructive" });
    },
  });

  const updateCommissionMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: Partial<InsertCommissionRule> }) => {
      const response = await apiRequest("PUT", `/api/commission-rules/${id}`, data);
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/commission-rules"] });
      setIsCommissionDialogOpen(false);
      setEditingCommissionRule(null);
      commissionForm.reset();
      toast({ title: t('success'), description: t('commissionRuleUpdatedSuccess') });
    },
    onError: () => {
      toast({ title: t('error'), description: t('failedUpdateCommissionRule'), variant: "destructive" });
    },
  });

  const deleteCommissionMutation = useMutation({
    mutationFn: async (id: string) => {
      const response = await apiRequest("DELETE", `/api/commission-rules/${id}`);
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/commission-rules"] });
      toast({ title: t('success'), description: t('commissionRuleDeletedSuccess') });
    },
    onError: () => {
      toast({ title: t('error'), description: t('failedDeleteCommissionRule'), variant: "destructive" });
    },
  });

  const handleCreateShipping = (data: InsertShippingRate) => {
    createShippingMutation.mutate(data);
  };

  const handleUpdateShipping = (data: InsertShippingRate) => {
    if (editingShippingRate) {
      updateShippingMutation.mutate({ id: editingShippingRate.id, data });
    }
  };

  const handleEditShipping = (rate: ShippingRate) => {
    setEditingShippingRate(rate);
    shippingForm.reset({
      country: rate.country,
      category: rate.category,
      pricePerKg: rate.pricePerKg,
      currency: rate.currency,
    });
    setIsShippingDialogOpen(true);
  };

  const handleCreateCommission = (data: InsertCommissionRule) => {
    createCommissionMutation.mutate(data);
  };

  const handleUpdateCommission = (data: InsertCommissionRule) => {
    if (editingCommissionRule) {
      updateCommissionMutation.mutate({ id: editingCommissionRule.id, data });
    }
  };

  const handleEditCommission = (rule: CommissionRule) => {
    setEditingCommissionRule(rule);
    commissionForm.reset({
      country: rule.country,
      minValue: rule.minValue,
      maxValue: rule.maxValue || "",
      percentage: rule.percentage,
      fixedFee: rule.fixedFee,
    });
    setIsCommissionDialogOpen(true);
  };

  const resetShippingForm = () => {
    setEditingShippingRate(null);
    shippingForm.reset({
      country: "",
      category: "normal",
      pricePerKg: "",
      currency: "USD",
    });
  };

  const resetCommissionForm = () => {
    setEditingCommissionRule(null);
    commissionForm.reset({
      country: "",
      minValue: "",
      maxValue: "",
      percentage: "",
      fixedFee: "0.00",
    });
  };

  return (
    <div className="space-y-6">
      {/* Shipping Rates */}
      <Card data-testid="card-shipping-rates">
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center">
              <Truck className="w-5 h-5 mr-2" />
              {t('shippingRates')}
            </CardTitle>
            <Dialog 
              open={isShippingDialogOpen} 
              onOpenChange={(open) => {
                setIsShippingDialogOpen(open);
                if (!open) resetShippingForm();
              }}
            >
              <DialogTrigger asChild>
                <Button data-testid="button-add-shipping-rate">
                  <Plus className="w-4 h-4 mr-2" />
                  {t('addRate')}
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>
                    {editingShippingRate ? t('editShippingRate') : t('addShippingRate')}
                  </DialogTitle>
                </DialogHeader>
                <Form {...shippingForm}>
                  <form 
                    onSubmit={shippingForm.handleSubmit(
                      editingShippingRate ? handleUpdateShipping : handleCreateShipping
                    )} 
                    className="space-y-4"
                  >
                    <FormField
                      control={shippingForm.control}
                      name="country"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>{t('country')}</FormLabel>
                          <FormControl>
                            <Input placeholder={t('countryPlaceholder')} {...field} data-testid="input-shipping-country" />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={shippingForm.control}
                      name="category"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>{t('category')}</FormLabel>
                          <Select onValueChange={field.onChange} defaultValue={field.value}>
                            <FormControl>
                              <SelectTrigger data-testid="select-shipping-category">
                                <SelectValue placeholder={t('selectCategory')} />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                              <SelectItem value="normal">{t('normal')}</SelectItem>
                              <SelectItem value="perfumes">{t('perfumes')}</SelectItem>
                              <SelectItem value="electronics">{t('electronics')}</SelectItem>
                              <SelectItem value="clothing">{t('clothing')}</SelectItem>
                            </SelectContent>
                          </Select>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={shippingForm.control}
                      name="pricePerKg"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>{t('pricePerKg')}</FormLabel>
                          <FormControl>
                            <Input type="number" step="0.01" placeholder={t('pricePlaceholder')} {...field} data-testid="input-shipping-price" />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={shippingForm.control}
                      name="currency"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>{t('currency')}</FormLabel>
                          <Select onValueChange={field.onChange} defaultValue={field.value}>
                            <FormControl>
                              <SelectTrigger data-testid="select-shipping-currency">
                                <SelectValue placeholder={t('selectCurrency')} />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                              <SelectItem value="USD">USD</SelectItem>
                              <SelectItem value="LYD">LYD</SelectItem>
                              <SelectItem value="EUR">EUR</SelectItem>
                              <SelectItem value="GBP">GBP</SelectItem>
                              <SelectItem value="CNY">CNY</SelectItem>
                            </SelectContent>
                          </Select>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <div className="flex justify-end gap-2">
                      <Button 
                        type="button" 
                        variant="outline" 
                        onClick={() => {
                          setIsShippingDialogOpen(false);
                          resetShippingForm();
                        }}
                        data-testid="button-cancel-shipping"
                      >
                        {t('cancel')}
                      </Button>
                      <Button 
                        type="submit" 
                        disabled={createShippingMutation.isPending || updateShippingMutation.isPending}
                        data-testid="button-save-shipping"
                      >
                        {editingShippingRate ? t('update') : t('create')}
                      </Button>
                    </div>
                  </form>
                </Form>
              </DialogContent>
            </Dialog>
          </div>
        </CardHeader>
        <CardContent>
          {loadingShippingRates ? (
            <div className="text-center py-4">{t('loading')}</div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{t('country')}</TableHead>
                  <TableHead>{t('category')}</TableHead>
                  <TableHead>{t('priceKg')}</TableHead>
                  <TableHead>{t('currency')}</TableHead>
                  <TableHead>{t('actions')}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {shippingRates.map((rate) => (
                  <TableRow key={rate.id} data-testid={`row-shipping-rate-${rate.id}`}>
                    <TableCell>{rate.country}</TableCell>
                    <TableCell>{rate.category}</TableCell>
                    <TableCell>{rate.pricePerKg}</TableCell>
                    <TableCell>{rate.currency}</TableCell>
                    <TableCell>
                      <div className="flex gap-2">
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => handleEditShipping(rate)}
                          data-testid={`button-edit-shipping-${rate.id}`}
                        >
                          <Edit className="w-4 h-4" />
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => deleteShippingMutation.mutate(rate.id)}
                          disabled={deleteShippingMutation.isPending}
                          data-testid={`button-delete-shipping-${rate.id}`}
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Commission Rules */}
      <Card data-testid="card-commission-rules">
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center">
              <DollarSign className="w-5 h-5 mr-2" />
              {t('commissionRules')}
            </CardTitle>
            <Dialog 
              open={isCommissionDialogOpen} 
              onOpenChange={(open) => {
                setIsCommissionDialogOpen(open);
                if (!open) resetCommissionForm();
              }}
            >
              <DialogTrigger asChild>
                <Button data-testid="button-add-commission-rule">
                  <Plus className="w-4 h-4 mr-2" />
                  {t('addRule')}
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>
                    {editingCommissionRule ? t('editCommissionRule') : t('addCommissionRule')}
                  </DialogTitle>
                </DialogHeader>
                <Form {...commissionForm}>
                  <form 
                    onSubmit={commissionForm.handleSubmit(
                      editingCommissionRule ? handleUpdateCommission : handleCreateCommission
                    )} 
                    className="space-y-4"
                  >
                    <FormField
                      control={commissionForm.control}
                      name="country"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Country</FormLabel>
                          <FormControl>
                            <Input placeholder="e.g., China, Turkey, UK" {...field} data-testid="input-commission-country" />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={commissionForm.control}
                      name="minValue"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>{t('minimumOrderValue')}</FormLabel>
                          <FormControl>
                            <Input type="number" step="0.01" placeholder={t('pricePlaceholder').replace('8', '0')} {...field} data-testid="input-commission-min" />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={commissionForm.control}
                      name="maxValue"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>{t('maximumOrderValue')}</FormLabel>
                          <FormControl>
                            <Input type="number" step="0.01" placeholder={t('leaveEmptyNoLimit')} {...field} value={field.value || ""} data-testid="input-commission-max" />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={commissionForm.control}
                      name="percentage"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>{t('commissionPercentage')}</FormLabel>
                          <FormControl>
                            <Input type="number" step="0.0001" placeholder={t('percentagePlaceholder')} {...field} data-testid="input-commission-percentage" />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={commissionForm.control}
                      name="fixedFee"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>{t('fixedFee')}</FormLabel>
                          <FormControl>
                            <Input type="number" step="0.01" placeholder="0.00" {...field} data-testid="input-commission-fixed" />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <div className="flex justify-end gap-2">
                      <Button 
                        type="button" 
                        variant="outline" 
                        onClick={() => {
                          setIsCommissionDialogOpen(false);
                          resetCommissionForm();
                        }}
                        data-testid="button-cancel-commission"
                      >
                        {t('cancel')}
                      </Button>
                      <Button 
                        type="submit" 
                        disabled={createCommissionMutation.isPending || updateCommissionMutation.isPending}
                        data-testid="button-save-commission"
                      >
                        {editingCommissionRule ? t('update') : t('create')}
                      </Button>
                    </div>
                  </form>
                </Form>
              </DialogContent>
            </Dialog>
          </div>
        </CardHeader>
        <CardContent>
          {loadingCommissionRules ? (
            <div className="text-center py-4">{t('loading')}</div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{t('country')}</TableHead>
                  <TableHead>{t('minValue')}</TableHead>
                  <TableHead>{t('maxValue')}</TableHead>
                  <TableHead>{t('percentage')}</TableHead>
                  <TableHead>{t('fixedFee')}</TableHead>
                  <TableHead>{t('actions')}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {commissionRules.map((rule) => (
                  <TableRow key={rule.id} data-testid={`row-commission-rule-${rule.id}`}>
                    <TableCell>{rule.country}</TableCell>
                    <TableCell>${rule.minValue}</TableCell>
                    <TableCell>{rule.maxValue ? `$${rule.maxValue}` : t('noLimit')}</TableCell>
                    <TableCell>{(parseFloat(rule.percentage) * 100).toFixed(2)}%</TableCell>
                    <TableCell>${rule.fixedFee}</TableCell>
                    <TableCell>
                      <div className="flex gap-2">
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => handleEditCommission(rule)}
                          data-testid={`button-edit-commission-${rule.id}`}
                        >
                          <Edit className="w-4 h-4" />
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => deleteCommissionMutation.mutate(rule.id)}
                          disabled={deleteCommissionMutation.isPending}
                          data-testid={`button-delete-commission-${rule.id}`}
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

// Default settings
const DEFAULT_SETTINGS = {
  emailNotifications: false,
  autoBackup: true,
  maintenanceMode: false,
  twoFactor: false,
  sessionTimeout: true,
  orderNotifications: true,
  inventoryAlerts: true,
  systemAlerts: true,
  darkMode: false,
};

const profileSchema = z.object({
  username: z.string().min(3, "Username must be at least 3 characters"),
  firstName: z.string().optional(),
  lastName: z.string().optional(),
});

const passwordSchema = z.object({
  currentPassword: z.string().min(1, "Current password is required"),
  newPassword: z.string().min(6, "New password must be at least 6 characters"),
  confirmPassword: z.string().min(1, "Please confirm your password"),
}).refine(data => data.newPassword === data.confirmPassword, {
  message: "Passwords do not match",
  path: ["confirmPassword"],
});

type ProfileForm = z.infer<typeof profileSchema>;
type PasswordForm = z.infer<typeof passwordSchema>;

export default function Settings() {
  const [settingsState, setSettingsState] = useState(DEFAULT_SETTINGS);
  const [lydExchangeRate, setLydExchangeRate] = useState<string>("");
  const { toast } = useToast();
  const { t, i18n } = useTranslation();
  const { user } = useAuth();

  const profileForm = useForm<ProfileForm>({
    resolver: zodResolver(profileSchema),
    defaultValues: {
      username: user?.username || "",
      firstName: user?.firstName || "",
      lastName: user?.lastName || "",
    },
  });

  const passwordForm = useForm<PasswordForm>({
    resolver: zodResolver(passwordSchema),
    defaultValues: {
      currentPassword: "",
      newPassword: "",
      confirmPassword: "",
    },
  });

  // Load settings from API
  const { data: settings = [], isLoading } = useQuery({
    queryKey: ["/api/settings"],
    queryFn: async () => {
      const response = await apiRequest("GET", "/api/settings");
      return response.json() as Promise<Setting[]>;
    },
  });

  // Process settings when data changes
  useEffect(() => {
    if (settings.length > 0) {
      // Convert settings array to state object
      const settingsObj = { ...DEFAULT_SETTINGS };
      settings.forEach((setting: Setting) => {
        if (setting.type === "boolean") {
          settingsObj[setting.key as keyof typeof DEFAULT_SETTINGS] = setting.value === "true";
        }
        // Handle LYD exchange rate
        if (setting.key === "lyd_exchange_rate") {
          setLydExchangeRate(setting.value);
        }
      });
      setSettingsState(settingsObj);
    }
  }, [settings]);

  // Apply dark mode to document
  useEffect(() => {
    if (settingsState.darkMode) {
      document.documentElement.classList.add("dark");
    } else {
      document.documentElement.classList.remove("dark");
    }
  }, [settingsState.darkMode]);

  // Update setting mutation
  const updateSettingMutation = useMutation({
    mutationFn: async ({ key, value }: { key: string; value: string }) => {
      const existingSetting = settings.find(s => s.key === key);
      if (existingSetting) {
        const response = await apiRequest("PUT", `/api/settings/${key}`, { value, type: "boolean" });
        return response.json();
      } else {
        const response = await apiRequest("POST", "/api/settings", {
          key,
          value,
          type: "boolean",
          description: `Setting for ${key}`
        });
        return response.json();
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/settings"] });
      toast({
        title: t('settingUpdated'),
        description: t('settingSavedSuccess'),
      });
    },
    onError: () => {
      toast({
        title: t('error'),
        description: t('failedUpdateSetting'),
        variant: "destructive",
      });
    },
  });

  const handleSettingChange = (key: keyof typeof DEFAULT_SETTINGS, checked: boolean) => {
    setSettingsState(prev => ({ ...prev, [key]: checked }));
    updateSettingMutation.mutate({ key, value: checked.toString() });
  };

  // Update LYD exchange rate mutation
  const updateExchangeRateMutation = useMutation({
    mutationFn: async (rate: string) => {
      const existingSetting = settings.find(s => s.key === "lyd_exchange_rate");
      if (existingSetting) {
        const response = await apiRequest("PUT", `/api/settings/lyd_exchange_rate`, { value: rate, type: "number" });
        return response.json();
      } else {
        const response = await apiRequest("POST", "/api/settings", {
          key: "lyd_exchange_rate",
          value: rate,
          type: "number",
          description: "LYD to USD exchange rate"
        });
        return response.json();
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/settings"] });
      toast({
        title: t('success'),
        description: t('exchangeRateUpdated'),
      });
    },
    onError: () => {
      toast({
        title: t('error'),
        description: t('failedUpdateExchangeRate'),
        variant: "destructive",
      });
    },
  });

  const handleExchangeRateSave = () => {
    if (lydExchangeRate && parseFloat(lydExchangeRate) > 0) {
      updateExchangeRateMutation.mutate(lydExchangeRate);
    } else {
      toast({
        title: t('error'),
        description: t('enterValidExchangeRate'),
        variant: "destructive",
      });
    }
  };

  const handleDatabaseBackup = () => {
    toast({
      title: t('backupInitiated'),
      description: t('backupStartedNotify'),
    });
  };

  const handleDatabaseOptimize = () => {
    toast({
      title: t('optimizationStarted'),
      description: t('optimizationRunning'),
    });
  };

  const handleViewSecurityLogs = () => {
    toast({
      title: t('securityLogs'),
      description: t('securityLogViewerFuture'),
    });
  };

  const handleResetPasswords = () => {
    toast({
      title: t('passwordReset'),
      description: t('passwordResetConfirmation'),
      variant: "destructive",
    });
  };

  const handleLanguageChange = (language: string) => {
    i18n.changeLanguage(language);
    
    // Manually save to localStorage since we removed LanguageDetector
    try {
      localStorage.setItem('i18nextLng', language);
    } catch (error) {
      console.warn('Failed to save language preference');
    }
    
    toast({
      title: t('languageUpdated'),
      description: language === 'en' ? t('languageChangedToEnglish') : t('languageChangedToArabic'),
    });
  };

  const updateProfileMutation = useMutation({
    mutationFn: async (data: ProfileForm) => {
      const response = await apiRequest("PATCH", "/api/profile", data);
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || "Failed to update profile");
      }
      return response.json();
    },
    onSuccess: async () => {
      // Refresh user data
      await queryClient.invalidateQueries({ queryKey: ["/api/auth/me"] });
      toast({
        title: t('success'),
        description: t('profileUpdatedSuccess') || "Profile updated successfully",
      });
    },
    onError: (error: Error) => {
      toast({
        variant: "destructive",
        title: t('error'),
        description: error.message,
      });
    },
  });

  const updatePasswordMutation = useMutation({
    mutationFn: async (data: PasswordForm) => {
      const response = await apiRequest("PATCH", "/api/profile/password", {
        currentPassword: data.currentPassword,
        newPassword: data.newPassword,
      });
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || "Failed to update password");
      }
      return response.json();
    },
    onSuccess: () => {
      passwordForm.reset();
      toast({
        title: t('success'),
        description: t('passwordUpdatedSuccess') || "Password updated successfully",
      });
    },
    onError: (error: Error) => {
      toast({
        variant: "destructive",
        title: t('error'),
        description: error.message,
      });
    },
  });

  const handleProfileSubmit = (data: ProfileForm) => {
    updateProfileMutation.mutate(data);
  };

  const handlePasswordSubmit = (data: PasswordForm) => {
    updatePasswordMutation.mutate(data);
  };

  return (
    <div className="flex-1 flex flex-col">
      <Header 
        title={t('settings')} 
        description={t('settingsDescription')} 
      />
      
      <div className="flex-1 p-6 space-y-6">
        {/* Profile Settings Card */}
        <Card data-testid="card-profile-settings">
          <CardHeader>
            <div className="flex items-center gap-2">
              <User className="h-5 w-5" />
              <CardTitle>{t('profileSettings') || "Profile Settings"}</CardTitle>
            </div>
            <CardDescription>{t('updateYourProfile') || "Update your profile information"}</CardDescription>
          </CardHeader>
          <CardContent>
            <Form {...profileForm}>
              <form onSubmit={profileForm.handleSubmit(handleProfileSubmit)} className="space-y-4">
                <FormField
                  control={profileForm.control}
                  name="username"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>{t('username')}</FormLabel>
                      <FormControl>
                        <Input 
                          {...field} 
                          data-testid="input-username" 
                          placeholder={t('enterUsername') || "Enter username"}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <FormField
                    control={profileForm.control}
                    name="firstName"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>{t('firstName')}</FormLabel>
                        <FormControl>
                          <Input 
                            {...field} 
                            data-testid="input-first-name" 
                            placeholder={t('enterFirstName') || "Enter first name"}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={profileForm.control}
                    name="lastName"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>{t('lastName')}</FormLabel>
                        <FormControl>
                          <Input 
                            {...field} 
                            data-testid="input-last-name" 
                            placeholder={t('enterLastName') || "Enter last name"}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                <div className="flex justify-end">
                  <Button 
                    type="submit" 
                    disabled={updateProfileMutation.isPending}
                    data-testid="button-save-profile"
                  >
                    <Save className="h-4 w-4 mr-2" />
                    {updateProfileMutation.isPending ? t('saving') || "Saving..." : t('saveChanges') || "Save Changes"}
                  </Button>
                </div>
              </form>
            </Form>
          </CardContent>
        </Card>

        {/* Password Settings Card */}
        <Card data-testid="card-password-settings">
          <CardHeader>
            <div className="flex items-center gap-2">
              <Lock className="h-5 w-5" />
              <CardTitle>{t('changePassword') || "Change Password"}</CardTitle>
            </div>
            <CardDescription>{t('updateYourPassword') || "Update your password"}</CardDescription>
          </CardHeader>
          <CardContent>
            <Form {...passwordForm}>
              <form onSubmit={passwordForm.handleSubmit(handlePasswordSubmit)} className="space-y-4">
                <FormField
                  control={passwordForm.control}
                  name="currentPassword"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>{t('currentPassword') || "Current Password"}</FormLabel>
                      <FormControl>
                        <Input 
                          {...field} 
                          type="password"
                          data-testid="input-current-password" 
                          placeholder={t('enterCurrentPassword') || "Enter current password"}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <Separator />

                <FormField
                  control={passwordForm.control}
                  name="newPassword"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>{t('newPassword') || "New Password"}</FormLabel>
                      <FormControl>
                        <Input 
                          {...field} 
                          type="password"
                          data-testid="input-new-password" 
                          placeholder={t('enterNewPassword') || "Enter new password"}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={passwordForm.control}
                  name="confirmPassword"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>{t('confirmPassword') || "Confirm Password"}</FormLabel>
                      <FormControl>
                        <Input 
                          {...field} 
                          type="password"
                          data-testid="input-confirm-password" 
                          placeholder={t('confirmNewPassword') || "Confirm new password"}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <div className="flex justify-end">
                  <Button 
                    type="submit" 
                    disabled={updatePasswordMutation.isPending}
                    data-testid="button-change-password"
                  >
                    <Lock className="h-4 w-4 mr-2" />
                    {updatePasswordMutation.isPending ? t('updating') || "Updating..." : t('changePassword') || "Change Password"}
                  </Button>
                </div>
              </form>
            </Form>
          </CardContent>
        </Card>

        {/* System Settings */}
        <Card data-testid="card-system-settings">
          <CardHeader>
            <CardTitle className="flex items-center">
              <SettingsIcon className="w-5 h-5 mr-2" />
              {t('systemSettings')}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label htmlFor="notifications">{t('emailNotifications')}</Label>
                <p className="text-sm text-muted-foreground">
                  {t('emailNotificationsDesc')}
                </p>
              </div>
              <Switch 
                id="notifications" 
                checked={settingsState.emailNotifications}
                onCheckedChange={(checked) => handleSettingChange('emailNotifications', checked)}
                disabled={updateSettingMutation.isPending}
                data-testid="switch-notifications" 
              />
            </div>

            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label htmlFor="auto-backup">{t('automaticBackup')}</Label>
                <p className="text-sm text-muted-foreground">
                  {t('automaticBackupDesc')}
                </p>
              </div>
              <Switch 
                id="auto-backup" 
                checked={settingsState.autoBackup}
                onCheckedChange={(checked) => handleSettingChange('autoBackup', checked)}
                disabled={updateSettingMutation.isPending}
                data-testid="switch-auto-backup" 
              />
            </div>

            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label htmlFor="maintenance">{t('maintenanceMode')}</Label>
                <p className="text-sm text-muted-foreground">
                  {t('maintenanceModeDesc')}
                </p>
              </div>
              <Switch 
                id="maintenance" 
                checked={settingsState.maintenanceMode}
                onCheckedChange={(checked) => handleSettingChange('maintenanceMode', checked)}
                disabled={updateSettingMutation.isPending}
                data-testid="switch-maintenance" 
              />
            </div>
          </CardContent>
        </Card>

        {/* Database Settings */}
        <Card data-testid="card-database-settings">
          <CardHeader>
            <CardTitle className="flex items-center">
              <Database className="w-5 h-5 mr-2" />
              {t('databaseManagement')}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <Button 
                variant="outline" 
                onClick={handleDatabaseBackup}
                data-testid="button-backup-database"
              >
                <Database className="w-4 h-4 mr-2" />
                {t('backupDatabase')}
              </Button>
              
              <Button 
                variant="outline" 
                onClick={handleDatabaseOptimize}
                data-testid="button-optimize-database"
              >
                <SettingsIcon className="w-4 h-4 mr-2" />
                {t('optimizeDatabase')}
              </Button>
            </div>
            
            <div className="p-4 bg-muted/20 rounded-lg">
              <h4 className="font-medium mb-2">{t('databaseStatus')}</h4>
              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span>{t('connectionStatus')}</span>
                  <span className="text-green-600 font-medium">{t('connected')}</span>
                </div>
                <div className="flex justify-between">
                  <span>{t('lastBackup')}</span>
                  <span>{t('todayAt3AM')}</span>
                </div>
                <div className="flex justify-between">
                  <span>{t('databaseSize')}</span>
                  <span>{t('databaseSizeValue')}</span>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Security Settings */}
        <Card data-testid="card-security-settings">
          <CardHeader>
            <CardTitle className="flex items-center">
              <Shield className="w-5 h-5 mr-2" />
              {t('securityAccessControl')}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label htmlFor="two-factor">{t('twoFactorAuth')}</Label>
                <p className="text-sm text-muted-foreground">
                  {t('twoFactorAuthDesc')}
                </p>
              </div>
              <Switch 
                id="two-factor" 
                checked={settingsState.twoFactor}
                onCheckedChange={(checked) => handleSettingChange('twoFactor', checked)}
                disabled={updateSettingMutation.isPending}
                data-testid="switch-two-factor" 
              />
            </div>

            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label htmlFor="session-timeout">{t('autoSessionTimeout')}</Label>
                <p className="text-sm text-muted-foreground">
                  {t('autoSessionTimeoutDesc')}
                </p>
              </div>
              <Switch 
                id="session-timeout" 
                checked={settingsState.sessionTimeout}
                onCheckedChange={(checked) => handleSettingChange('sessionTimeout', checked)}
                disabled={updateSettingMutation.isPending}
                data-testid="switch-session-timeout" 
              />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <Button 
                variant="outline" 
                onClick={handleViewSecurityLogs}
                data-testid="button-view-logs"
              >
                {t('viewSecurityLogs')}
              </Button>
              <Button 
                variant="outline" 
                onClick={handleResetPasswords}
                data-testid="button-reset-passwords"
              >
                {t('resetAllPasswords')}
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Notification Settings */}
        <Card data-testid="card-notification-settings">
          <CardHeader>
            <CardTitle className="flex items-center">
              <Bell className="w-5 h-5 mr-2" />
              {t('notificationPreferences')}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label htmlFor="order-notifications">{t('orderUpdates')}</Label>
                <p className="text-sm text-muted-foreground">
                  {t('orderUpdatesDesc')}
                </p>
              </div>
              <Switch 
                id="order-notifications" 
                checked={settingsState.orderNotifications}
                onCheckedChange={(checked) => handleSettingChange('orderNotifications', checked)}
                disabled={updateSettingMutation.isPending}
                data-testid="switch-order-notifications" 
              />
            </div>

            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label htmlFor="inventory-alerts">{t('lowStockAlerts')}</Label>
                <p className="text-sm text-muted-foreground">
                  {t('lowStockAlertsDesc')}
                </p>
              </div>
              <Switch 
                id="inventory-alerts" 
                checked={settingsState.inventoryAlerts}
                onCheckedChange={(checked) => handleSettingChange('inventoryAlerts', checked)}
                disabled={updateSettingMutation.isPending}
                data-testid="switch-inventory-alerts" 
              />
            </div>

            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label htmlFor="system-alerts">{t('systemAlerts')}</Label>
                <p className="text-sm text-muted-foreground">
                  {t('systemAlertsDesc')}
                </p>
              </div>
              <Switch 
                id="system-alerts" 
                checked={settingsState.systemAlerts}
                onCheckedChange={(checked) => handleSettingChange('systemAlerts', checked)}
                disabled={updateSettingMutation.isPending}
                data-testid="switch-system-alerts" 
              />
            </div>
          </CardContent>
        </Card>

        {/* Theme Settings */}
        <Card data-testid="card-theme-settings">
          <CardHeader>
            <CardTitle className="flex items-center">
              <Palette className="w-5 h-5 mr-2" />
              {t('appearance')}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label htmlFor="dark-mode">{t('darkMode')}</Label>
                <p className="text-sm text-muted-foreground">
                  {t('useDarkTheme')}
                </p>
              </div>
              <Switch 
                id="dark-mode" 
                checked={settingsState.darkMode}
                onCheckedChange={(checked) => handleSettingChange('darkMode', checked)}
                disabled={updateSettingMutation.isPending}
                data-testid="switch-dark-mode" 
              />
            </div>

            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label htmlFor="language">{t('language')}</Label>
                <p className="text-sm text-muted-foreground">
                  {t('choosePrefLanguage')}
                </p>
              </div>
              <Select value={i18n.language} onValueChange={handleLanguageChange}>
                <SelectTrigger className="w-[180px]" data-testid="select-language">
                  <SelectValue placeholder={t('selectLanguage')} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="en">{t('english')}</SelectItem>
                  <SelectItem value="ar">{t('arabicWithName')}</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <Separator />

            <div className="space-y-3">
              <div className="space-y-0.5">
                <Label htmlFor="lyd-rate">{t('lydExchangeRateSetting')}</Label>
                <p className="text-sm text-muted-foreground">
                  {t('lydExchangeRateDesc')}
                </p>
              </div>
              <div className="flex gap-2">
                <Input 
                  id="lyd-rate"
                  type="number"
                  step="0.01"
                  placeholder={t('enterExchangeRate')}
                  value={lydExchangeRate}
                  onChange={(e) => setLydExchangeRate(e.target.value)}
                  className="flex-1"
                  data-testid="input-lyd-exchange-rate"
                />
                <Button 
                  onClick={handleExchangeRateSave}
                  disabled={updateExchangeRateMutation.isPending}
                  data-testid="button-save-exchange-rate"
                >
                  <Save className="w-4 h-4 mr-2" />
                  {t('save')}
                </Button>
              </div>
              {lydExchangeRate && parseFloat(lydExchangeRate) > 0 && (
                <div className="p-3 bg-green-50 dark:bg-green-950/20 rounded-lg border border-green-200 dark:border-green-800">
                  <p className="text-sm text-green-800 dark:text-green-200">
                    {t('currentExchangeRate')}: 1 USD = {parseFloat(lydExchangeRate).toFixed(4)} LYD
                  </p>
                </div>
              )}
            </div>

            <div className="p-4 bg-muted/20 rounded-lg">
              <h4 className="font-medium mb-2">{t('currentTheme')}</h4>
              <p className="text-sm text-muted-foreground">
                {settingsState.darkMode ? t('darkThemeActive') : t('lightThemeActive')}
              </p>
              {updateSettingMutation.isPending && (
                <div className="flex items-center text-sm text-muted-foreground mt-2">
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-primary mr-2"></div>
                  {t('savingSettings')}
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Shipping & Commission Management */}
        <ShippingCommissionManager />
      </div>
    </div>
  );
}
