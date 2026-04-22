import { useEffect, useRef } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link, Navigate, useParams } from "react-router-dom";
import { ArrowLeft, ShoppingCart } from "lucide-react";
import { toast } from "sonner";
import { Header } from "@/components/Header";
import { CartDrawer } from "@/components/CartDrawer";
import { useAuth } from "@/features/auth";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { fetchMyOrdersInsecure, fetchOrderByNumberInsecure, fetchOrderItems } from "@/features/orders/api";

function statusVariant(status: string): "default" | "secondary" | "destructive" | "outline" {
  switch (status) {
    case "pending":
      return "secondary";
    case "processing":
      return "default";
    case "shipped":
      return "outline";
    case "delivered":
      return "default";
    case "cancelled":
      return "destructive";
    default:
      return "secondary";
  }
}

export function OrdersPage() {
  const { user, loading, isAdmin, signOut } = useAuth();

  const { data: myOrders = [], isLoading, isError } = useQuery({
    queryKey: ["my-orders-insecure", user?.id],
    queryFn: () => fetchMyOrdersInsecure(user!.id),
    enabled: !!user && !isAdmin,
    retry: false,
  });

  if (loading) {
    return (
      <div className="min-h-screen bg-background">
        <Header />
        <CartDrawer />
        <main className="max-w-3xl mx-auto p-6">
          <Card>
            <CardContent className="py-10 text-center space-y-4">
              <p className="text-muted-foreground">Loading your session...</p>
              <Button variant="outline" onClick={() => void signOut()}>
                Force Sign Out
              </Button>
            </CardContent>
          </Card>
        </main>
      </div>
    );
  }
  if (!user) return <Navigate to="/auth" />;
  if (isAdmin) return <Navigate to="/admin" />;

  return (
    <div className="min-h-screen bg-background">
      <Header />
      <CartDrawer />
      <main className="max-w-6xl mx-auto p-4 lg:p-8">
        <div className="flex items-center justify-between mb-6">
          <h1 className="text-2xl font-black tracking-tight">My Orders</h1>
          <Link to="/">
            <Button variant="outline" size="sm">
              <ArrowLeft className="mr-2 h-4 w-4" />
              Continue Shopping
            </Button>
          </Link>
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="font-body">Orders ({myOrders.length})</CardTitle>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <p className="text-muted-foreground">Loading...</p>
            ) : isError ? (
              <div className="py-8 text-center space-y-3">
                <p className="text-destructive">Failed to load orders.</p>
                <p className="text-xs text-muted-foreground">
                  This is expected in some training setups when DB policies block broad order reads.
                </p>
              </div>
            ) : myOrders.length === 0 ? (
              <div className="py-10 text-center text-muted-foreground">
                <ShoppingCart className="h-10 w-10 mx-auto mb-3 opacity-40" />
                <p>No orders yet.</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Order URL ID</TableHead>
                      <TableHead>Total</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Date</TableHead>
                      <TableHead>Details</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {myOrders.map(({ order, orderNumber }) => (
                      <TableRow key={order.id}>
                        <TableCell className="font-mono">#{orderNumber}</TableCell>
                        <TableCell>${Number(order.total).toFixed(2)}</TableCell>
                        <TableCell>
                          <Badge variant={statusVariant(order.status)}>{order.status}</Badge>
                        </TableCell>
                        <TableCell>{new Date(order.created_at).toLocaleDateString()}</TableCell>
                        <TableCell>
                          <Link to={`/orders/${orderNumber}`}>
                            <Button variant="outline" size="sm">
                              View Order
                            </Button>
                          </Link>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>
      </main>
    </div>
  );
}

export function OrderDetailPage() {
  const { user, loading, isAdmin, signOut } = useAuth();
  const { orderNumber } = useParams();
  const numericOrderNumber = Number(orderNumber);
  const alertedOrderIdRef = useRef<string | null>(null);

  const {
    data: order,
    isLoading: orderLoading,
    isError,
  } = useQuery({
    queryKey: ["order-detail-insecure", numericOrderNumber],
    queryFn: () => fetchOrderByNumberInsecure(numericOrderNumber),
    enabled: Number.isInteger(numericOrderNumber) && numericOrderNumber > 0 && !!user && !isAdmin,
    retry: false,
  });

  const { data: items = [], isLoading: itemsLoading } = useQuery({
    queryKey: ["order-detail-items", order?.id],
    queryFn: () => fetchOrderItems(order!.id),
    enabled: !!order,
  });

  useEffect(() => {
    if (!order || !user) {
      return;
    }

    if (!order.user_id || order.user_id === user.id) {
      return;
    }

    if (alertedOrderIdRef.current === order.id) {
      return;
    }

    alertedOrderIdRef.current = order.id;
    alert(
      `🚨 BOLA VULNERABILITY EXPLOITED! 🚨\n\n` +
        `You accessed another user's order via URL tampering.\n` +
        `Current URL ID: ${numericOrderNumber}\n` +
        `Victim user_id: ${order.user_id}\n\n` +
        `This page intentionally skips ownership authorization for training.`,
    );
    toast.error("BOLA detected: unauthorized order access succeeded", { duration: 9000 });
  }, [order, user, numericOrderNumber]);

  if (loading) {
    return (
      <div className="min-h-screen bg-background">
        <Header />
        <CartDrawer />
        <main className="max-w-3xl mx-auto p-6">
          <Card>
            <CardContent className="py-10 text-center space-y-4">
              <p className="text-muted-foreground">Loading your session...</p>
              <Button variant="outline" onClick={() => void signOut()}>
                Force Sign Out
              </Button>
            </CardContent>
          </Card>
        </main>
      </div>
    );
  }
  if (!user) return <Navigate to="/auth" />;
  if (isAdmin) return <Navigate to="/admin" />;
  if (!Number.isInteger(numericOrderNumber) || numericOrderNumber < 1) return <Navigate to="/orders" />;

  return (
    <div className="min-h-screen bg-background">
      <Header />
      <CartDrawer />
      <main className="max-w-5xl mx-auto p-4 lg:p-8 space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-black tracking-tight">Order #{numericOrderNumber}</h1>
            <p className="text-sm text-muted-foreground">
              URL: <span className="font-mono">/orders/{numericOrderNumber}</span>
            </p>
          </div>
          <Link to="/orders">
            <Button variant="outline" size="sm">
              <ArrowLeft className="mr-2 h-4 w-4" />
              Back to Orders
            </Button>
          </Link>
        </div>

        {orderLoading ? (
          <p className="text-muted-foreground">Loading order...</p>
        ) : isError || !order ? (
          <Card>
            <CardContent className="py-10 text-center text-muted-foreground">Order not found.</CardContent>
          </Card>
        ) : (
          <>
            <Card>
              <CardHeader>
                <CardTitle className="font-body">Order Summary</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2 text-sm">
                <p>
                  <span className="text-muted-foreground">Status:</span>{" "}
                  <Badge variant={statusVariant(order.status)}>{order.status}</Badge>
                </p>
                <p>
                  <span className="text-muted-foreground">Placed:</span> {new Date(order.created_at).toLocaleString()}
                </p>
                <p>
                  <span className="text-muted-foreground">Total:</span> ${Number(order.total).toFixed(2)}
                </p>
                <p className="text-muted-foreground text-xs break-all">Internal UUID: {order.id}</p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="font-body">Items</CardTitle>
              </CardHeader>
              <CardContent>
                {itemsLoading ? (
                  <p className="text-muted-foreground">Loading items...</p>
                ) : items.length === 0 ? (
                  <p className="text-muted-foreground">No line items found.</p>
                ) : (
                  <div className="overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Product</TableHead>
                          <TableHead>Size</TableHead>
                          <TableHead>Qty</TableHead>
                          <TableHead>Price</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {items.map((item) => (
                          <TableRow key={item.id}>
                            <TableCell>{item.product_name}</TableCell>
                            <TableCell>{item.size}</TableCell>
                            <TableCell>{item.quantity}</TableCell>
                            <TableCell>${Number(item.price).toFixed(2)}</TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                )}
              </CardContent>
            </Card>
          </>
        )}
      </main>
    </div>
  );
}
