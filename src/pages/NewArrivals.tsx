import { products } from "@/data/products";
import { ProductCard } from "@/components/ProductCard";
import { Header } from "@/components/Header";
import { CartDrawer } from "@/components/CartDrawer";
import { motion } from "framer-motion";

export default function NewArrivals() {
  const newProducts = products.filter((p) => p.isNew);

  return (
    <div className="min-h-screen bg-background">
      <Header />
      <CartDrawer />
      <div className="max-w-7xl mx-auto px-4 lg:px-8 py-10">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-10"
        >
          <h1 className="text-4xl lg:text-5xl font-black text-foreground tracking-tight">
            New <span className="text-primary">Arrivals</span>
          </h1>
          <p className="text-muted-foreground mt-2 max-w-lg">
            The latest drops from the world's top sneaker brands. Be the first to cop.
          </p>
        </motion.div>

        {newProducts.length === 0 ? (
          <p className="text-muted-foreground text-center py-20">No new arrivals right now. Check back soon!</p>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-5">
            {newProducts.map((product, i) => (
              <ProductCard key={product.id} product={product} index={i} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
