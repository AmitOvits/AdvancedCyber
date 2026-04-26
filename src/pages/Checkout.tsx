import { useState, useEffect } from "react";
import { useCart } from "@/context/CartContext";
import { useAuth } from "@/features/auth";
import { getCurrentSession } from "@/features/auth/api";
import { Header } from "@/components/Header";
import { CartDrawer } from "@/components/CartDrawer";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { motion } from "framer-motion";
import { ShoppingBag, CreditCard, MapPin, CheckCircle, Lightbulb, Skull } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";

async function readCheckoutError(response: Response) {
  try {
    const payload = (await response.json()) as { error?: string };
    return payload.error ?? `Checkout failed with status ${response.status}.`;
  } catch {
    return `Checkout failed with status ${response.status}.`;
  }
}

export default function Checkout() {
  const { items, clearCart } = useCart();
  const { user } = useAuth();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [orderPlaced, setOrderPlaced] = useState(false);
  // States חדשים בשביל החולשה
  const [hackedSuccess, setHackedSuccess] = useState(false);
  const [showHint, setShowHint] = useState(false);

  const [shipping, setShipping] = useState({
    fullName: "",
    address: "",
    city: "",
    state: "",
    zip: "",
    country: "",
  });

  const [payment, setPayment] = useState({
    cardNumber: "",
    expiry: "",
    cvv: "",
    nameOnCard: "",
  });

  useEffect(() => {
    if (hackedSuccess) {
      toast.success("Exploit successful! Price bypassed.", {
        description: "Insecure Deserialization vulnerability detected.",
        duration: 5000,
      });
    }
  }, [hackedSuccess]);

  // 1. PRIORITY 1: Success screen for the Hack
  if (hackedSuccess) {
    return (
      <div className="min-h-screen bg-background flex flex-col items-center justify-center p-4">
        <motion.div initial={{ scale: 0, rotate: -180 }} animate={{ scale: 1, rotate: 0 }} transition={{ type: "spring", damping: 12 }}>
          <Skull className="h-24 w-24 mx-auto mb-6 text-red-500" />
        </motion.div>
        <h1 className="text-4xl font-black text-red-500 mb-4 animate-pulse uppercase tracking-tighter">System Compromised</h1>
        <div className="glass rounded-xl p-8 max-w-lg text-center border-red-500/50 border-2 shadow-2xl shadow-red-500/20">
          <h2 className="text-2xl font-bold mb-2">Advanced Insecure Deserialization</h2>
          <p className="text-muted-foreground mb-4 leading-relaxed">
            Incredible! You didn't fall for the <code>isPremium</code> honeypot. 
            You discovered the hidden developer note, understood that the server handles 
            complex objects without validation, and successfully injected the admin configuration!
          </p>
          <Button variant="destructive" className="mt-4 w-full font-bold uppercase tracking-widest" onClick={() => window.location.href = "/"}>
            Return as a Victorious Hacker
          </Button>
        </div>
      </div>
    );
  }

  // 2. PRIORITY 2: Regular success screen
  if (orderPlaced) {
    return (
      <div className="min-h-screen bg-background">
        <Header />
        <CartDrawer />
        <div className="max-w-4xl mx-auto px-4 py-20 text-center">
          <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }} transition={{ type: "spring", damping: 15 }}>
            <CheckCircle className="h-20 w-20 mx-auto mb-6 text-primary" />
          </motion.div>
          <h1 className="text-3xl font-black text-foreground">Order Placed!</h1>
          <p className="text-muted-foreground mt-2">Thank you for your purchase. Your sneakers are on the way.</p>
          <Button className="mt-6 rounded-full" onClick={() => navigate("/")}>Continue Shopping</Button>
        </div>
      </div>
    );
  }

  // 3. PRIORITY 3: Empty Cart - ONLY IF NO SUCCESS OR HACK
  // שים לב לשינוי בתנאי כאן למטה - הוספנו !hackedSuccess ו- !orderPlaced
  if (items.length === 0 && !orderPlaced && !hackedSuccess) {
    return (
      <div className="min-h-screen bg-background">
        <Header />
        <CartDrawer />
        <div className="max-w-4xl mx-auto px-4 py-20 text-center">
          <ShoppingBag className="h-16 w-16 mx-auto mb-4 text-muted-foreground/30" />
          <h1 className="text-2xl font-bold text-foreground">Your cart is empty</h1>
          <p className="text-muted-foreground mt-2">Add some sneakers before checking out.</p>
          <Button className="mt-6 rounded-full" onClick={() => navigate("/")}>Continue Shopping</Button>
        </div>
      </div>
    );
  }

  const clientTotal = items.reduce((sum, i) => sum + i.product.price * i.quantity, 0);

  const handlePlaceOrder = async () => {
    if (!shipping.fullName || !shipping.address || !shipping.city || !shipping.zip) {
      toast.error("Please fill in all shipping fields");
      return;
    }
    if (!payment.cardNumber || !payment.expiry || !payment.cvv) {
      toast.error("Please fill in payment details");
      return;
    }

    setLoading(true);
    try {
      const {
        data: { session },
      } = await getCurrentSession();

      const response = await fetch("http://localhost:3001/api/checkout", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(session?.access_token ? { Authorization: `Bearer ${session.access_token}` } : {}),
        },
        credentials: "include",
        body: JSON.stringify({
          shipping,
          payment,
        }),
      });

      if (!response.ok) {
        throw new Error(await readCheckoutError(response));
      }

      // -- התחלת הקוד המעודכן --
      const responseData = await response.json();
      clearCart();

      if (responseData.isHacked) {
        setHackedSuccess(true);
      } else {
        setOrderPlaced(true);
        toast.success("Order placed successfully!");
      }
      // -- סוף הקוד המעודכן --
    } catch (error) {
      const message = error instanceof Error ? error.message : "Failed to place order";
      toast.error(message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-background">
      <Header />
      <CartDrawer />
      <div className="max-w-5xl mx-auto px-4 lg:px-8 py-10">
        <motion.h1
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-3xl lg:text-4xl font-black text-foreground tracking-tight mb-8"
        >
          Checkout
        </motion.h1>

        {/* Hidden developer note visible only via View Source */}
        <div 
          style={{ display: 'none' }} 
          dangerouslySetInnerHTML={{ __html: "<!-- This is a hidden developer note visible only via View Source -->" }} 
        />

        {/* Hints mechanism */}
        <div className="mb-8">
          <Button variant="outline" size="sm" onClick={() => setShowHint(!showHint)} className="text-amber-500 hover:text-amber-600 hover:bg-amber-500/10 border-amber-500/20">
          <Lightbulb className="h-4 w-4 mr-2" />
            Attack Hint (Hard Challenge)
          </Button>
          {showHint && (
            <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} className="mt-3 p-4 glass border-l-4 border-amber-500 text-sm space-y-3">
              <p><strong>Hint 1 (Honeypot):</strong> The cookie named <code>shop_session</code> appears to be simple Base64. If you decode it, you'll see <code>isPremium: false</code>. Will changing it to <code>true</code> work? Give it a try, but someone might have anticipated that.</p>
              <p><strong>Hint 2 (Reconnaissance):</strong> Developers often leave "leftovers" in the source code. Right-click in your browser -&gt; <em>Inspect</em> or <em>View Page Source</em>. Search for HTML comments (<code>&lt;!-- --&gt;</code>) near the "Checkout" header.</p>
              <p><strong>Hint 3 (Exploitation):</strong> Found the comment? Excellent. Take the Base64 from the cookie, decode it to JSON in Burp Suite, and inject the object mentioned in the QA note. Encode it back, send the request, and watch the cart total drop to 0!</p>
            </motion.div>
          )}
        </div>

        <div className="grid lg:grid-cols-5 gap-8">
          {/* Form */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="lg:col-span-3 space-y-8"
          >
            {/* Shipping */}
            <div className="glass rounded-2xl p-6 space-y-4">
              <div className="flex items-center gap-2 mb-2">
                <MapPin className="h-5 w-5 text-primary" />
                <h2 className="text-lg font-bold text-foreground">Shipping Address</h2>
              </div>
              <div className="grid sm:grid-cols-2 gap-4">
                <div className="sm:col-span-2">
                  <Label htmlFor="fullName">Full Name</Label>
                  <Input id="fullName" placeholder="John Doe" value={shipping.fullName} onChange={(e) => setShipping({ ...shipping, fullName: e.target.value })} className="mt-1 rounded-xl bg-background" />
                </div>
                <div className="sm:col-span-2">
                  <Label htmlFor="address">Street Address</Label>
                  <Input id="address" placeholder="123 Sneaker St" value={shipping.address} onChange={(e) => setShipping({ ...shipping, address: e.target.value })} className="mt-1 rounded-xl bg-background" />
                </div>
                <div>
                  <Label htmlFor="city">City</Label>
                  <Input id="city" placeholder="New York" value={shipping.city} onChange={(e) => setShipping({ ...shipping, city: e.target.value })} className="mt-1 rounded-xl bg-background" />
                </div>
                <div>
                  <Label htmlFor="state">State</Label>
                  <Input id="state" placeholder="NY" value={shipping.state} onChange={(e) => setShipping({ ...shipping, state: e.target.value })} className="mt-1 rounded-xl bg-background" />
                </div>
                <div>
                  <Label htmlFor="zip">ZIP Code</Label>
                  <Input id="zip" placeholder="10001" value={shipping.zip} onChange={(e) => setShipping({ ...shipping, zip: e.target.value })} className="mt-1 rounded-xl bg-background" />
                </div>
                <div>
                  <Label htmlFor="country">Country</Label>
                  <Input id="country" placeholder="US" value={shipping.country} onChange={(e) => setShipping({ ...shipping, country: e.target.value })} className="mt-1 rounded-xl bg-background" />
                </div>
              </div>
            </div>

            {/* Payment */}
            <div className="glass rounded-2xl p-6 space-y-4">
              <div className="flex items-center gap-2 mb-2">
                <CreditCard className="h-5 w-5 text-primary" />
                <h2 className="text-lg font-bold text-foreground">Payment Details</h2>
              </div>
              <div className="grid sm:grid-cols-2 gap-4">
                <div className="sm:col-span-2">
                  <Label htmlFor="nameOnCard">Name on Card</Label>
                  <Input id="nameOnCard" placeholder="John Doe" value={payment.nameOnCard} onChange={(e) => setPayment({ ...payment, nameOnCard: e.target.value })} className="mt-1 rounded-xl bg-background" />
                </div>
                <div className="sm:col-span-2">
                  <Label htmlFor="cardNumber">Card Number</Label>
                  <Input id="cardNumber" placeholder="4242 4242 4242 4242" value={payment.cardNumber} onChange={(e) => setPayment({ ...payment, cardNumber: e.target.value })} className="mt-1 rounded-xl bg-background" />
                </div>
                <div>
                  <Label htmlFor="expiry">Expiry</Label>
                  <Input id="expiry" placeholder="MM/YY" value={payment.expiry} onChange={(e) => setPayment({ ...payment, expiry: e.target.value })} className="mt-1 rounded-xl bg-background" />
                </div>
                <div>
                  <Label htmlFor="cvv">CVV</Label>
                  <Input id="cvv" placeholder="123" value={payment.cvv} onChange={(e) => setPayment({ ...payment, cvv: e.target.value })} className="mt-1 rounded-xl bg-background" />
                </div>
              </div>
            </div>
          </motion.div>

          {/* Order Summary */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
            className="lg:col-span-2"
          >
            <div className="glass rounded-2xl p-6 sticky top-24 space-y-4">
              <h2 className="text-lg font-bold text-foreground">Order Summary</h2>
              <div className="space-y-3 max-h-64 overflow-y-auto">
                {items.map((item) => (
                  <div key={`${item.product.id}-${item.size}`} className="flex justify-between text-sm">
                    <div className="min-w-0">
                      <p className="text-foreground truncate">{item.product.name}</p>
                      <p className="text-muted-foreground text-xs">Size {item.size} × {item.quantity}</p>
                    </div>
                    <span className="text-foreground font-medium ml-4">${(item.product.price * item.quantity).toFixed(2)}</span>
                  </div>
                ))}
              </div>
              <div className="border-t border-border pt-3 space-y-2">
                <div className="flex justify-between text-sm text-muted-foreground">
                  <span>Subtotal</span>
                  <span>${clientTotal.toFixed(2)}</span>
                </div>
                <div className="flex justify-between text-sm text-muted-foreground">
                  <span>Shipping</span>
                  <span>Free</span>
                </div>
                <div className="flex justify-between text-lg font-black text-foreground pt-2 border-t border-border" data-total={clientTotal}>
                  <span>Total</span>
                  <span>${clientTotal.toFixed(2)}</span>
                </div>
              </div>
              <Button
                className="w-full rounded-full font-semibold h-12"
                size="lg"
                onClick={handlePlaceOrder}
                disabled={loading}
              >
                {loading ? "Processing..." : `Place Order — $${clientTotal.toFixed(2)}`}
              </Button>
              {!user && (
                <p className="text-xs text-muted-foreground text-center">
                  You're checking out as a guest. <a href="/auth/sign-in" className="text-primary underline">Sign in</a> to track orders.
                </p>
              )}
            </div>
          </motion.div>
        </div>
      </div>
    </div>
  );
}
