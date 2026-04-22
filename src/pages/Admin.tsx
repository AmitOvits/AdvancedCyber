import { useState } from "react";
import { useAuth } from "@/features/auth";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { Link, Navigate } from "react-router-dom";
import { Package, ShoppingCart, Plus, ArrowLeft } from "lucide-react";
import {
  createProduct,
  deleteProduct,
  fetchProductRows,
  type ProductInsert,
  type ProductRow,
} from "@/features/products/api";
import { fetchOrders, updateOrderStatus } from "@/features/orders/api";

export default function Admin() {
  const { isAdmin, loading, user } = useAuth();

  if (loading) return <div className="flex items-center justify-center min-h-screen text-muted-foreground">Loading...</div>;
  if (!user) return <Navigate to="/auth" />;
  if (!isAdmin) return (
    <div className="flex flex-col items-center justify-center min-h-screen gap-4">
      <p className="text-muted-foreground text-lg">Access denied. Admin privileges required.</p>
      <Link to="/"><Button variant="outline"><ArrowLeft className="mr-2 h-4 w-4" />Back to Shop</Button></Link>
    </div>
  );

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b bg-card/80 backdrop-blur-md sticky top-0 z-40">
        <div className="flex items-center justify-between h-16 px-4 lg:px-8">
          <div className="flex items-center gap-4">
            <Link to="/">
              <h1 className="font-heading text-2xl text-foreground">SOLE<span className="text-primary">.</span></h1>
            </Link>
            <Badge variant="secondary">Admin</Badge>
          </div>
          <Link to="/"><Button variant="outline" size="sm"><ArrowLeft className="mr-2 h-4 w-4" />Shop</Button></Link>
        </div>
      </header>

      <main className="p-4 lg:p-8 max-w-7xl mx-auto">
        <Tabs defaultValue="products">
          <TabsList className="mb-6">
            <TabsTrigger value="products" className="gap-2"><Package className="h-4 w-4" />Products</TabsTrigger>
            <TabsTrigger value="orders" className="gap-2"><ShoppingCart className="h-4 w-4" />Orders</TabsTrigger>
          </TabsList>

          <TabsContent value="products"><ProductsTab /></TabsContent>
          <TabsContent value="orders"><OrdersTab /></TabsContent>
        </Tabs>
      </main>
    </div>
  );
}

function ProductsTab() {
  const queryClient = useQueryClient();
  const [dialogOpen, setDialogOpen] = useState(false);

  const { data: products = [], isLoading } = useQuery({
    queryKey: ["admin-products"],
    queryFn: fetchProductRows,
  });

  const deleteMutation = useMutation({
    mutationFn: deleteProduct,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-products"] });
      toast.success("Product deleted");
    },
  });

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle className="font-body">Products ({products.length})</CardTitle>
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger asChild>
            <Button size="sm"><Plus className="mr-2 h-4 w-4" />Add Product</Button>
          </DialogTrigger>
          <DialogContent className="max-w-lg max-h-[80vh] overflow-y-auto">
            <DialogHeader><DialogTitle>Add New Product</DialogTitle></DialogHeader>
            <AddProductForm onSuccess={() => { setDialogOpen(false); queryClient.invalidateQueries({ queryKey: ["admin-products"] }); }} />
          </DialogContent>
        </Dialog>
      </CardHeader>
      <CardContent>
        {isLoading ? <p className="text-muted-foreground">Loading...</p> : (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Brand</TableHead>
                  <TableHead>Price</TableHead>
                  <TableHead>Stock</TableHead>
                  <TableHead>Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {products.map((p) => (
                  <TableRow key={p.id}>
                    <TableCell className="font-medium">{p.name}</TableCell>
                    <TableCell>{p.brand}</TableCell>
                    <TableCell>${Number(p.price).toFixed(2)}</TableCell>
                    <TableCell><Badge variant={p.stock && p.stock > 0 ? "default" : "destructive"}>{p.stock ?? 0}</Badge></TableCell>
                    <TableCell>
                      <Button variant="destructive" size="sm" onClick={() => deleteMutation.mutate(p.id)}>Delete</Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function AddProductForm({ onSuccess }: { onSuccess: () => void }) {
  const [form, setForm] = useState<Partial<ProductInsert>>({
    name: "", brand: "", price: 0, image: "", category: "", description: "", stock: 0, sizes: [], is_new: false,
  });

  const mutation = useMutation({
    mutationFn: async () => {
      await createProduct({
        name: form.name!,
        brand: form.brand!,
        price: form.price!,
        original_price: form.original_price || null,
        image: form.image!,
        category: form.category!,
        description: form.description || null,
        stock: form.stock || 0,
        sizes: form.sizes || [],
        is_new: form.is_new || false,
      });
    },
    onSuccess: () => {
      toast.success("Product added!");
      onSuccess();
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const set = (key: string, value: unknown) => setForm((prev) => ({ ...prev, [key]: value }));

  return (
    <form onSubmit={(e) => { e.preventDefault(); mutation.mutate(); }} className="space-y-4">
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2"><Label>Name</Label><Input required value={form.name} onChange={(e) => set("name", e.target.value)} /></div>
        <div className="space-y-2"><Label>Brand</Label><Input required value={form.brand} onChange={(e) => set("brand", e.target.value)} /></div>
      </div>
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2"><Label>Price</Label><Input type="number" step="0.01" required value={form.price} onChange={(e) => set("price", +e.target.value)} /></div>
        <div className="space-y-2"><Label>Original Price</Label><Input type="number" step="0.01" value={form.original_price ?? ""} onChange={(e) => set("original_price", +e.target.value || null)} /></div>
      </div>
      <div className="space-y-2"><Label>Image URL</Label><Input required value={form.image} onChange={(e) => set("image", e.target.value)} /></div>
      <div className="space-y-2"><Label>Category</Label><Input required value={form.category} onChange={(e) => set("category", e.target.value)} /></div>
      <div className="space-y-2"><Label>Description</Label><Input value={form.description ?? ""} onChange={(e) => set("description", e.target.value)} /></div>
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2"><Label>Stock</Label><Input type="number" value={form.stock} onChange={(e) => set("stock", +e.target.value)} /></div>
        <div className="space-y-2"><Label>Sizes (comma-sep)</Label><Input placeholder="7,8,9,10" onChange={(e) => set("sizes", e.target.value.split(",").map(Number).filter(Boolean))} /></div>
      </div>
      <Button type="submit" className="w-full" disabled={mutation.isPending}>{mutation.isPending ? "Adding..." : "Add Product"}</Button>
    </form>
  );
}

function OrdersTab() {
  const { data: orders = [], isLoading } = useQuery({
    queryKey: ["admin-orders"],
    queryFn: fetchOrders,
  });

  const queryClient = useQueryClient();

  const updateStatus = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: string }) => {
      await updateOrderStatus(id, status);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-orders"] });
      toast.success("Order status updated");
    },
  });

  const statusColor = (s: string) => {
    switch (s) {
      case "pending": return "secondary";
      case "processing": return "default";
      case "shipped": return "outline";
      case "delivered": return "default";
      case "cancelled": return "destructive";
      default: return "secondary";
    }
  };

  return (
    <Card>
      <CardHeader><CardTitle className="font-body">Orders ({orders.length})</CardTitle></CardHeader>
      <CardContent>
        {isLoading ? <p className="text-muted-foreground">Loading...</p> : orders.length === 0 ? (
          <p className="text-muted-foreground text-center py-8">No orders yet</p>
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Order ID</TableHead>
                  <TableHead>Total</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Date</TableHead>
                  <TableHead>Update Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {orders.map((o) => (
                  <TableRow key={o.id}>
                    <TableCell className="font-mono text-xs">{o.id.slice(0, 8)}...</TableCell>
                    <TableCell>${Number(o.total).toFixed(2)}</TableCell>
                    <TableCell><Badge variant={statusColor(o.status)}>{o.status}</Badge></TableCell>
                    <TableCell>{new Date(o.created_at).toLocaleDateString()}</TableCell>
                    <TableCell>
                      <Select value={o.status} onValueChange={(v) => updateStatus.mutate({ id: o.id, status: v })}>
                        <SelectTrigger className="w-[130px]"><SelectValue /></SelectTrigger>
                        <SelectContent>
                          {["pending", "processing", "shipped", "delivered", "cancelled"].map((s) => (
                            <SelectItem key={s} value={s}>{s}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
