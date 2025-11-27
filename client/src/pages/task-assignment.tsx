import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Plus, UserCheck, Package, Search } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Header } from "@/components/header";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { useAuth } from "@/components/auth-provider";
import type { OrderWithCustomer, DeliveryTaskWithDetails } from "@shared/schema";

interface ShippingStaff {
  id: string;
  firstName: string;
  lastName: string;
  username: string;
}

export default function TaskAssignment() {
  const { t } = useTranslation();
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [isAssignModalOpen, setIsAssignModalOpen] = useState(false);
  const [selectedOrderId, setSelectedOrderId] = useState("");
  const [assignedToUserId, setAssignedToUserId] = useState("");
  const [taskType, setTaskType] = useState<"task" | "receive_payment" | "receive_shipments">("task");
  const [pickupLocation, setPickupLocation] = useState("");
  const [deliveryLocation, setDeliveryLocation] = useState("");
  const [taskAddress, setTaskAddress] = useState("");
  const [taskValue, setTaskValue] = useState("");
  const [taskWeight, setTaskWeight] = useState("");
  const [customerCode, setCustomerCode] = useState("");
  const [paymentType, setPaymentType] = useState<"collect" | "delivered">("delivered");
  const [paymentAmount, setPaymentAmount] = useState("");
  const [taskNotes, setTaskNotes] = useState("");
  const [searchTerm, setSearchTerm] = useState("");

  const { data: orders = [], isLoading: isLoadingOrders } = useQuery({
    queryKey: ["/api/orders"],
    queryFn: async () => {
      const response = await apiRequest("GET", "/api/orders");
      return response.json() as Promise<OrderWithCustomer[]>;
    },
  });

  const { data: shippingStaff = [] } = useQuery({
    queryKey: ["/api/shipping-staff"],
    queryFn: async () => {
      const response = await apiRequest("GET", "/api/shipping-staff");
      return response.json() as Promise<ShippingStaff[]>;
    },
  });

  const { data: tasks = [] } = useQuery({
    queryKey: ["/api/delivery-tasks"],
    queryFn: async () => {
      const response = await apiRequest("GET", "/api/delivery-tasks");
      return response.json() as Promise<DeliveryTaskWithDetails[]>;
    },
  });

  const assignTaskMutation = useMutation({
    mutationFn: async (taskData: any) => {
      const response = await apiRequest("POST", "/api/delivery-tasks", taskData);
      if (!response.ok) {
        const errorData = await response.json();
        console.error("Task creation error:", errorData);
        throw new Error(errorData.message || "Failed to assign task");
      }
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/delivery-tasks"] });
      setIsAssignModalOpen(false);
      resetForm();
      toast({
        title: t('success'),
        description: t('taskAssignedSuccess'),
      });
    },
    onError: (error: Error) => {
      console.error("Task assignment error:", error);
      toast({
        variant: "destructive",
        title: t('error'),
        description: error.message || t('failedAssignTask'),
      });
    },
  });

  const handleOpenAssignModal = (order: OrderWithCustomer) => {
    setSelectedOrderId(order.id);
    setDeliveryLocation(order.customer.address || order.customer.city || "");
    setCustomerCode(order.customer.shippingCode || "");
    setPaymentAmount(order.remainingBalance);
    setIsAssignModalOpen(true);
  };

  const handleAssignTask = () => {
    if (!assignedToUserId) {
      toast({
        variant: "destructive",
        title: t('error'),
        description: "Please fill in all required fields",
      });
      return;
    }

    if (taskType === "task" && (!selectedOrderId || !pickupLocation || !deliveryLocation)) {
      toast({
        variant: "destructive",
        title: t('error'),
        description: "Please fill in all required fields",
      });
      return;
    }

    const taskData: any = {
      assignedToUserId,
      assignedByUserId: user?.id,
      taskType,
      status: "pending",
    };

    if (taskType === "task") {
      taskData.orderId = selectedOrderId;
      taskData.pickupLocation = pickupLocation;
      taskData.deliveryLocation = deliveryLocation;
      taskData.customerCode = customerCode || undefined;
      taskData.paymentType = paymentType || undefined;
      taskData.paymentAmount = paymentAmount ? parseFloat(paymentAmount) : undefined;
    } else {
      taskData.address = taskAddress || undefined;
      taskData.value = taskValue ? parseFloat(taskValue) : undefined;
      taskData.weight = taskWeight ? parseFloat(taskWeight) : undefined;
    }

    taskData.notes = taskNotes || undefined;

    assignTaskMutation.mutate(taskData);
  };

  const resetForm = () => {
    setSelectedOrderId("");
    setAssignedToUserId("");
    setTaskType("task");
    setPickupLocation("");
    setDeliveryLocation("");
    setTaskAddress("");
    setTaskValue("");
    setTaskWeight("");
    setCustomerCode("");
    setPaymentType("delivered");
    setPaymentAmount("");
    setTaskNotes("");
  };

  const filteredOrders = orders.filter(order => {
    const searchLower = searchTerm.toLowerCase();
    return (
      order.orderNumber.toLowerCase().includes(searchLower) ||
      (order.customer.shippingCode && order.customer.shippingCode.toLowerCase().includes(searchLower)) ||
      order.customer.firstName.toLowerCase().includes(searchLower) ||
      order.customer.lastName.toLowerCase().includes(searchLower) ||
      order.customer.phone.includes(searchTerm)
    );
  });

  const selectedOrder = orders.find(o => o.id === selectedOrderId);

  return (
    <div className="min-h-screen bg-gray-50">
      <Header title={t('taskAssignment')} description={t('assignDeliveryTasksStaff')} />
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">

        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">{t('totalTasks')}</CardTitle>
              <Package className="h-4 w-4 text-gray-600" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{tasks.length}</div>
              <p className="text-xs text-muted-foreground">{t('activeDeliveryTasks')}</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">{t('shippingStaff')}</CardTitle>
              <UserCheck className="h-4 w-4 text-gray-600" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{shippingStaff.length}</div>
              <p className="text-xs text-muted-foreground">{t('availableStaffMembers')}</p>
            </CardContent>
          </Card>
        </div>

        {/* Create Task Button */}
        <div className="mb-6">
          <Button onClick={() => setIsAssignModalOpen(true)} data-testid="button-create-task">
            <Plus className="w-4 h-4 ltr:mr-2 rtl:ml-2" />
            {t('assignTask')}
          </Button>
        </div>

        {/* Orders Available for Assignment */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle>{t('ordersAvailableAssignment')}</CardTitle>
              <div className="relative">
                <Search className="absolute left-2 top-2.5 h-4 w-4 text-gray-400" />
                <Input
                  placeholder={t('searchOrders')}
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-8 w-64"
                  data-testid="input-search-orders"
                />
              </div>
            </div>
          </CardHeader>
          <CardContent>
            {isLoadingOrders ? (
              <div className="text-center py-8">{t('loadingOrders')}</div>
            ) : filteredOrders.length === 0 ? (
              <div className="text-center py-8 text-gray-500">
                <Package className="w-12 h-12 mx-auto mb-4 opacity-50" />
                <p>{t('noOrdersFound')}</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>{t('customerCode')}</TableHead>
                      <TableHead>{t('customer')}</TableHead>
                      <TableHead>{t('phone')}</TableHead>
                      <TableHead>{t('city')}</TableHead>
                      <TableHead>{t('status')}</TableHead>
                      <TableHead>{t('total')}</TableHead>
                      <TableHead>{t('actions')}</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredOrders.map((order) => (
                      <TableRow key={order.id} data-testid={`order-row-${order.id}`}>
                        <TableCell className="font-medium">{order.customer.shippingCode || order.orderNumber}</TableCell>
                        <TableCell>
                          {order.customer.firstName} {order.customer.lastName}
                        </TableCell>
                        <TableCell>{order.customer.phone}</TableCell>
                        <TableCell>{order.customer.city || "N/A"}</TableCell>
                        <TableCell>
                          <span className="capitalize">{order.status.replace("_", " ")}</span>
                        </TableCell>
                        <TableCell>${parseFloat(order.totalAmount).toFixed(2)}</TableCell>
                        <TableCell>
                          <Button
                            size="sm"
                            onClick={() => handleOpenAssignModal(order)}
                            data-testid={`button-assign-${order.id}`}
                          >
                            <Plus className="w-4 h-4 mr-1" />
                            {t('assignTask')}
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Assign Task Modal */}
        <Dialog open={isAssignModalOpen} onOpenChange={setIsAssignModalOpen}>
          <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto" data-testid="modal-assign-task">
            <DialogHeader>
              <DialogTitle>{t('assignDeliveryTask')}</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              {/* Order Info - Only show if task type is "task" and order is selected */}
              {taskType === "task" && selectedOrder && (
                <div className="bg-muted/50 p-4 rounded-lg">
                  <h4 className="font-medium mb-2">{t('orderDetails')}</h4>
                  <div className="grid grid-cols-2 gap-2 text-sm">
                    <div>
                      <span className="font-medium">{t('orderNumber')}:</span> {selectedOrder.orderNumber}
                    </div>
                    <div>
                      <span className="font-medium">{t('total')}:</span> ${parseFloat(selectedOrder.totalAmount).toFixed(2)}
                    </div>
                    <div className="col-span-2">
                      <span className="font-medium">{t('customer')}:</span> {selectedOrder.customer.firstName} {selectedOrder.customer.lastName}
                    </div>
                  </div>
                </div>
              )}

              {/* Assignment Form */}
              <div className="grid grid-cols-2 gap-4">
                {/* Task Type Selector */}
                <div className="col-span-2">
                  <Label htmlFor="task-type">{t('taskType')} *</Label>
                  <Select value={taskType} onValueChange={(value: any) => setTaskType(value)}>
                    <SelectTrigger id="task-type" data-testid="select-task-type">
                      <SelectValue placeholder={t('selectTaskType')} />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="task">{t('taskTypeTask')}</SelectItem>
                      <SelectItem value="receive_payment">{t('taskTypeReceivePayment')}</SelectItem>
                      <SelectItem value="receive_shipments">{t('taskTypeReceiveShipments')}</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                {/* Assign To Staff */}
                <div className="col-span-2">
                  <Label htmlFor="assign-to">{t('assignToShippingStaff')}</Label>
                  <Select value={assignedToUserId} onValueChange={setAssignedToUserId}>
                    <SelectTrigger id="assign-to" data-testid="select-shipping-staff">
                      <SelectValue placeholder={t('selectShippingStaff')} />
                    </SelectTrigger>
                    <SelectContent>
                      {shippingStaff.map((staff) => (
                        <SelectItem key={staff.id} value={staff.id}>
                          {staff.firstName} {staff.lastName} ({staff.username})
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {/* Conditional Fields based on Task Type */}
                {taskType === "task" ? (
                  <>
                    <div>
                      <Label htmlFor="pickup-location">{t('pickupLocationRequired')}</Label>
                      <Input
                        id="pickup-location"
                        value={pickupLocation}
                        onChange={(e) => setPickupLocation(e.target.value)}
                        placeholder={t('enterPickupLocation')}
                        data-testid="input-pickup-location"
                      />
                    </div>

                    <div>
                      <Label htmlFor="delivery-location">{t('deliveryLocationRequired')}</Label>
                      <Input
                        id="delivery-location"
                        value={deliveryLocation}
                        onChange={(e) => setDeliveryLocation(e.target.value)}
                        placeholder={t('enterDeliveryLocation')}
                        data-testid="input-delivery-location"
                      />
                    </div>

                    <div>
                      <Label htmlFor="payment-type">{t('paymentType')}</Label>
                      <Select value={paymentType} onValueChange={(value: any) => setPaymentType(value)}>
                        <SelectTrigger id="payment-type" data-testid="select-payment-type">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="delivered">{t('deliveredNoCollection')}</SelectItem>
                          <SelectItem value="collect">{t('collectPayment')}</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>

                    {paymentType === "collect" && (
                      <>
                        <div>
                          <Label htmlFor="customer-code">{t('customerCode')}</Label>
                          <Input
                            id="customer-code"
                            value={customerCode}
                            onChange={(e) => setCustomerCode(e.target.value)}
                            placeholder={t('enterCustomerCode')}
                            data-testid="input-customer-code"
                          />
                        </div>

                        <div className="col-span-2">
                          <Label htmlFor="payment-amount">{t('paymentAmountDollar')}</Label>
                          <Input
                            id="payment-amount"
                            type="number"
                            step="0.01"
                            value={paymentAmount}
                            onChange={(e) => setPaymentAmount(e.target.value)}
                            placeholder={t('enterPaymentAmount')}
                            data-testid="input-payment-amount"
                          />
                        </div>
                      </>
                    )}
                  </>
                ) : (
                  <>
                    {/* Fields for receive_payment and receive_shipments */}
                    <div className="col-span-2">
                      <Label htmlFor="task-address">{t('taskAddress')}</Label>
                      <Input
                        id="task-address"
                        value={taskAddress}
                        onChange={(e) => setTaskAddress(e.target.value)}
                        placeholder={t('enterTaskAddress')}
                        data-testid="input-task-address"
                      />
                    </div>

                    <div>
                      <Label htmlFor="task-value">{t('taskValue')}</Label>
                      <Input
                        id="task-value"
                        type="number"
                        step="0.01"
                        value={taskValue}
                        onChange={(e) => setTaskValue(e.target.value)}
                        placeholder={t('enterTaskValue')}
                        data-testid="input-task-value"
                      />
                    </div>

                    <div>
                      <Label htmlFor="task-weight">{t('taskWeight')}</Label>
                      <Input
                        id="task-weight"
                        type="number"
                        step="0.01"
                        value={taskWeight}
                        onChange={(e) => setTaskWeight(e.target.value)}
                        placeholder={t('enterTaskWeight')}
                        data-testid="input-task-weight"
                      />
                    </div>
                  </>
                )}

                {/* Notes field - always shown */}
                <div className="col-span-2">
                  <Label htmlFor="task-notes">{t('notes')}</Label>
                  <textarea
                    id="task-notes"
                    value={taskNotes}
                    onChange={(e) => setTaskNotes(e.target.value)}
                    className="w-full min-h-[100px] p-3 border rounded-md resize-none"
                    placeholder={t('addAdditionalNotes')}
                    data-testid="textarea-task-notes"
                  />
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-4 border-t">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setIsAssignModalOpen(false)}
                  data-testid="button-cancel"
                >
                  {t('cancel')}
                </Button>
                <Button
                  onClick={handleAssignTask}
                  disabled={assignTaskMutation.isPending}
                  data-testid="button-assign"
                >
                  {assignTaskMutation.isPending ? t('creating') : t('assignTask')}
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      </main>
    </div>
  );
}
