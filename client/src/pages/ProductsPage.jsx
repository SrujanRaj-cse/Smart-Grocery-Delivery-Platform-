import { useMemo, useState } from "react";
import ProductCard from "../components/ProductCard";
import { useCart } from "../context/CartContext";
import { useProducts } from "../context/ProductsContext";
import EmptyState from "../components/EmptyState";
import InlineError from "../components/InlineError";

const ProductsPage = () => {
  const { products, loading, error } = useProducts();
  const { addToCart } = useCart();
  const [search, setSearch] = useState("");
  const [inStockOnly, setInStockOnly] = useState(false);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return products.filter((p) => {
      const matchesSearch = !q || p.name.toLowerCase().includes(q);
      const matchesStock = !inStockOnly || p.stock > 0;
      return matchesSearch && matchesStock;
    });
  }, [products, search, inStockOnly]);

  if (loading) {
    return (
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4">
        {Array.from({ length: 8 }).map((_, idx) => (
          <div key={idx} className="rounded-2xl border bg-white p-4 shadow-sm">
            <div className="h-28 w-full animate-pulse rounded-lg bg-slate-100" />
            <div className="mt-3 h-4 w-3/4 animate-pulse rounded bg-slate-100" />
            <div className="mt-2 h-3 w-full animate-pulse rounded bg-slate-100" />
            <div className="mt-4 h-8 w-1/2 animate-pulse rounded bg-slate-100" />
          </div>
        ))}
      </div>
    );
  }

  return (
    <div>
      <div className="mb-4 flex items-start justify-between gap-4">
        <h1 className="text-2xl font-bold">Products</h1>
      </div>

      <div className="mb-4 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <input
          className="w-full rounded border p-3 text-sm md:w-72 md:text-base"
          placeholder="Search products..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" checked={inStockOnly} onChange={(e) => setInStockOnly(e.target.checked)} />
          In-stock only
        </label>
      </div>

      {error ? (
        <InlineError message={error} />
      ) : filtered.length === 0 ? (
        <EmptyState title="No products found" description="Try changing search or stock filter." />
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4">
          {filtered.map((product) => (
            <ProductCard
              key={product._id}
              product={product}
              canEdit={false}
              onAdd={() => addToCart({ productId: product._id, quantity: 1 })}
              onDelete={() => {}}
              onEdit={() => {}}
            />
          ))}
        </div>
      )}
    </div>
  );
};

export default ProductsPage;
