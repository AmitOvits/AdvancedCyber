import { useState, useMemo } from "react";
import { products } from "@/data/products";
import { ProductCard } from "@/components/ProductCard";
import { FilterSidebar, type Filters } from "@/components/FilterSidebar";
import { Header } from "@/components/Header";
import { CartDrawer } from "@/components/CartDrawer";

import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { SlidersHorizontal } from "lucide-react";
import { Button } from "@/components/ui/button";

const defaultFilters: Filters = {
  brands: [],
  categories: [],
  sizes: [],
  priceRange: [0, 300],
};

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

      <div className="flex">
        {/* Desktop Sidebar */}
        <aside className="hidden lg:block w-72 shrink-0 border-r bg-card p-6 sticky top-16 h-[calc(100vh-4rem)] overflow-y-auto">
          <FilterSidebar filters={filters} onChange={setFilters} />
        </aside>

        {/* Mobile Sidebar Overlay */}
        {showMobileFilters && (
          <div className="fixed inset-0 z-50 lg:hidden">
            <div className="absolute inset-0 bg-foreground/20" onClick={() => setShowMobileFilters(false)} />
            <aside className="absolute left-0 top-0 h-full w-80 bg-card p-6 overflow-y-auto shadow-xl">
              <FilterSidebar filters={filters} onChange={setFilters} onClose={() => setShowMobileFilters(false)} />
            </aside>
          </div>
        )}

        {/* Main Content */}
        <main className="flex-1 p-4 lg:p-8">
          {/* Hero Section */}
          <div className="mb-8 rounded-xl bg-gradient-to-br from-primary/10 to-accent p-8 lg:p-12">
            <h2 className="font-heading text-3xl lg:text-5xl text-foreground mb-2">Step Into Style</h2>
            <p className="text-muted-foreground max-w-md">
              Discover the latest collection from top brands. Premium sneakers for every occasion.
            </p>
          </div>

          {/* Toolbar */}
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-3">
              <Button
                variant="outline"
                size="sm"
                className="lg:hidden"
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
              <SelectTrigger className="w-40">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
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
              <p className="text-sm">Try adjusting your selection</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4 gap-5">
              {filtered.map((product) => (
                <ProductCard key={product.id} product={product} />
              ))}
            </div>
          )}
        </main>
      </div>
    </div>
  );
}

export default function Index() {
  return <ShopContent />;
}
