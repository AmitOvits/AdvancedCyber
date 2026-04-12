import { useState, useMemo } from "react";
import { products } from "@/data/products";
import { ProductCard } from "@/components/ProductCard";
import { FilterSidebar, type Filters } from "@/components/FilterSidebar";
import { Header } from "@/components/Header";
import { CartDrawer } from "@/components/CartDrawer";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { SlidersHorizontal, ArrowRight } from "lucide-react";
import { motion } from "framer-motion";

const defaultFilters: Filters = {
  brands: [],
  categories: [],
  sizes: [],
  priceRange: [0, 300],
};

function HeroSection() {
  return (
    <section className="relative overflow-hidden rounded-3xl mb-10">
      <div className="absolute inset-0 bg-gradient-to-br from-primary/20 via-background to-accent/30" />
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_70%_50%,hsl(var(--primary)/0.15),transparent_60%)]" />
      <div className="relative grid lg:grid-cols-2 gap-8 items-center p-8 lg:p-16 min-h-[400px]">
        <motion.div
          initial={{ opacity: 0, x: -40 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.7, ease: [0.25, 0.46, 0.45, 0.94] }}
          className="space-y-6"
        >
          <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full glass text-xs font-medium text-muted-foreground">
            <span className="h-1.5 w-1.5 rounded-full bg-primary animate-pulse" />
            New Collection 2026
          </div>
          <h2 className="text-4xl lg:text-6xl font-black text-foreground leading-[1.05] tracking-tight">
            Step Into<br />
            <span className="text-primary">The Future</span>
          </h2>
          <p className="text-muted-foreground max-w-md text-base leading-relaxed">
            Discover premium sneakers crafted for performance and style. Curated from the world's top brands.
          </p>
          <div className="flex gap-3">
            <Button size="lg" className="rounded-full px-8 font-semibold h-12">
              Shop Now <ArrowRight className="ml-2 h-4 w-4" />
            </Button>
            <Button size="lg" variant="outline" className="rounded-full px-8 font-semibold h-12 border-border">
              View Lookbook
            </Button>
          </div>
        </motion.div>
        <motion.div
          initial={{ opacity: 0, scale: 0.9, rotate: -5 }}
          animate={{ opacity: 1, scale: 1, rotate: 0 }}
          transition={{ duration: 0.8, delay: 0.2, ease: [0.25, 0.46, 0.45, 0.94] }}
          className="hidden lg:flex justify-center"
        >
          <div className="relative">
            <div className="absolute inset-0 bg-primary/20 rounded-full blur-[80px]" />
            <img
              src="https://images.unsplash.com/photo-1542291026-7eec264c27ff?w=800&h=600&fit=crop"
              alt="Featured sneaker"
              className="relative w-full max-w-lg rounded-2xl shadow-2xl"
            />
          </div>
        </motion.div>
      </div>
    </section>
  );
}

function ShopContent() {
  const [filters, setFilters] = useState<Filters>(defaultFilters);
  const [sortBy, setSortBy] = useState("featured");
  const [showMobileFilters, setShowMobileFilters] = useState(false);

  const filtered = useMemo(() => {
    let result = products.filter((p) => {
      if (filters.brands.length && !filters.brands.includes(p.brand)) return false;
      if (filters.categories.length && !filters.categories.includes(p.category)) return false;
      if (filters.sizes.length && !p.sizes.some((s) => filters.sizes.includes(s))) return false;
      if (p.price < filters.priceRange[0] || p.price > filters.priceRange[1]) return false;
      return true;
    });

    switch (sortBy) {
      case "price-asc":
        result.sort((a, b) => a.price - b.price);
        break;
      case "price-desc":
        result.sort((a, b) => b.price - a.price);
        break;
      case "rating":
        result.sort((a, b) => b.rating - a.rating);
        break;
      case "newest":
        result.sort((a, b) => (b.isNew ? 1 : 0) - (a.isNew ? 1 : 0));
        break;
    }

    return result;
  }, [filters, sortBy]);

  return (
    <div className="min-h-screen bg-background">
      <Header onToggleSidebar={() => setShowMobileFilters(!showMobileFilters)} />
      <CartDrawer />

      <div className="max-w-7xl mx-auto px-4 lg:px-8 py-6">
        <HeroSection />

        <div className="flex gap-8">
          {/* Desktop Sidebar */}
          <aside className="hidden lg:block w-64 shrink-0">
            <div className="sticky top-24 glass rounded-2xl p-6">
              <FilterSidebar filters={filters} onChange={setFilters} />
            </div>
          </aside>

          {/* Mobile Sidebar Overlay */}
          {showMobileFilters && (
            <div className="fixed inset-0 z-50 lg:hidden">
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="absolute inset-0 bg-background/60 backdrop-blur-sm"
                onClick={() => setShowMobileFilters(false)}
              />
              <motion.aside
                initial={{ x: -320 }}
                animate={{ x: 0 }}
                transition={{ type: "spring", damping: 30, stiffness: 300 }}
                className="absolute left-0 top-0 h-full w-80 glass-strong p-6 overflow-y-auto"
              >
                <FilterSidebar filters={filters} onChange={setFilters} onClose={() => setShowMobileFilters(false)} />
              </motion.aside>
            </div>
          )}

          {/* Main Content */}
          <main className="flex-1 min-w-0">
            {/* Toolbar */}
            <div className="flex items-center justify-between mb-6">
              <div className="flex items-center gap-3">
                <Button
                  variant="outline"
                  size="sm"
                  className="lg:hidden rounded-full"
                  onClick={() => setShowMobileFilters(true)}
                >
                  <SlidersHorizontal className="h-4 w-4 mr-2" />
                  Filters
                </Button>
                <p className="text-sm text-muted-foreground">
                  {filtered.length} {filtered.length === 1 ? "product" : "products"}
                </p>
              </div>
              <Select value={sortBy} onValueChange={setSortBy}>
                <SelectTrigger className="w-44 rounded-full border-border bg-card">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="glass-strong rounded-xl">
                  <SelectItem value="featured">Featured</SelectItem>
                  <SelectItem value="newest">Newest</SelectItem>
                  <SelectItem value="price-asc">Price: Low → High</SelectItem>
                  <SelectItem value="price-desc">Price: High → Low</SelectItem>
                  <SelectItem value="rating">Top Rated</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Product Grid */}
            {filtered.length === 0 ? (
              <div className="text-center py-20 text-muted-foreground">
                <p className="text-lg font-medium">No products match your filters</p>
                <p className="text-sm mt-1">Try adjusting your selection</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-5">
                {filtered.map((product, i) => (
                  <ProductCard key={product.id} product={product} index={i} />
                ))}
              </div>
            )}
          </main>
        </div>
      </div>
    </div>
  );
}

export default function Index() {
  return <ShopContent />;
}
