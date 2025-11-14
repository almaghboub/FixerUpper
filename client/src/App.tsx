import { Switch, Route, Redirect } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AuthProvider, useAuth } from "@/components/auth-provider";
import { ThemeProvider } from "@/components/theme-provider";
import { Sidebar } from "@/components/sidebar";
import { useIsMobile } from "@/hooks/use-mobile";
import NotFound from "@/pages/not-found";
import Login from "@/pages/login";
import Dashboard from "@/pages/dashboard";
import Orders from "@/pages/orders";
import Customers from "@/pages/customers";
import Gallery from "@/pages/gallery";
import Profits from "@/pages/profits";
import Users from "@/pages/users";
import Messages from "@/pages/messages";
import Settings from "@/pages/settings";
import DeliveryTasks from "@/pages/delivery-tasks";
import TaskAssignment from "@/pages/task-assignment";
import TaskHistory from "@/pages/task-history";

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { isAuthenticated, isLoading } = useAuth();
  const isMobile = useIsMobile();

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return <Redirect to="/login" />;
  }

  return (
    <div className="min-h-screen flex bg-background app-shell">
      {/* Desktop sidebar - hidden on mobile */}
      {!isMobile && <Sidebar />}
      
      {/* Mobile sidebar (hamburger menu) - rendered by Sidebar component itself */}
      {isMobile && <Sidebar />}
      
      {/* Main content */}
      <main className="flex-1 overflow-x-hidden">
        {children}
      </main>
    </div>
  );
}

function RoleProtectedRoute({ children, allowedRoles }: { children: React.ReactNode; allowedRoles: string[] }) {
  const { user, isAuthenticated, isLoading } = useAuth();
  const isMobile = useIsMobile();

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return <Redirect to="/login" />;
  }

  if (user && !allowedRoles.includes(user.role)) {
    return <Redirect to="/dashboard" />;
  }

  return (
    <div className="min-h-screen flex bg-background app-shell">
      {/* Desktop sidebar - hidden on mobile */}
      {!isMobile && <Sidebar />}
      
      {/* Mobile sidebar (hamburger menu) - rendered by Sidebar component itself */}
      {isMobile && <Sidebar />}
      
      {/* Main content */}
      <main className="flex-1 overflow-x-hidden">
        {children}
      </main>
    </div>
  );
}

function PublicRoute({ children }: { children: React.ReactNode }) {
  const { isAuthenticated, isLoading } = useAuth();

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  if (isAuthenticated) {
    return <Redirect to="/dashboard" />;
  }

  return <>{children}</>;
}

function Router() {
  return (
    <Switch>
      {/* Public routes */}
      <Route path="/login">
        <PublicRoute>
          <Login />
        </PublicRoute>
      </Route>

      {/* Root redirect */}
      <Route path="/">
        {() => <Redirect to="/dashboard" />}
      </Route>

      {/* Protected routes */}
      <Route path="/dashboard">
        <ProtectedRoute>
          <Dashboard />
        </ProtectedRoute>
      </Route>

      <Route path="/orders">
        <ProtectedRoute>
          <Orders />
        </ProtectedRoute>
      </Route>

      <Route path="/customers">
        <ProtectedRoute>
          <Customers />
        </ProtectedRoute>
      </Route>

      <Route path="/gallery">
        <ProtectedRoute>
          <Gallery />
        </ProtectedRoute>
      </Route>

      <Route path="/profits">
        <ProtectedRoute>
          <Profits />
        </ProtectedRoute>
      </Route>

      <Route path="/users">
        <ProtectedRoute>
          <Users />
        </ProtectedRoute>
      </Route>

      <Route path="/messages">
        <ProtectedRoute>
          <Messages />
        </ProtectedRoute>
      </Route>

      <Route path="/settings">
        <ProtectedRoute>
          <Settings />
        </ProtectedRoute>
      </Route>

      <Route path="/delivery-tasks">
        <RoleProtectedRoute allowedRoles={["shipping_staff"]}>
          <DeliveryTasks />
        </RoleProtectedRoute>
      </Route>

      <Route path="/task-assignment">
        <RoleProtectedRoute allowedRoles={["owner", "customer_service", "receptionist"]}>
          <TaskAssignment />
        </RoleProtectedRoute>
      </Route>

      <Route path="/task-history">
        <RoleProtectedRoute allowedRoles={["owner", "customer_service", "receptionist"]}>
          <TaskHistory />
        </RoleProtectedRoute>
      </Route>

      {/* Fallback to 404 */}
      <Route>
        <NotFound />
      </Route>
    </Switch>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <ThemeProvider>
        <AuthProvider>
          <TooltipProvider>
            <Toaster />
            <Router />
          </TooltipProvider>
        </AuthProvider>
      </ThemeProvider>
    </QueryClientProvider>
  );
}

export default App;
