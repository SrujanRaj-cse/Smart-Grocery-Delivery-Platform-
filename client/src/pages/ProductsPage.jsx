import { useEffect, useMemo, useState } from "react";
import ProductCard from "../components/ProductCard";
import { useCart } from "../context/CartContext";
import { useProducts } from "../context/ProductsContext";
import EmptyState from "../components/EmptyState";
import InlineError from "../components/InlineError";
import { useAuth } from "../context/AuthContext";
import api from "../api/client";
import toast from "react-hot-toast";
import { formatCurrency } from "../utils/currency";

const ProductsPage = () => {
  const { products, loading, error } = useProducts();
  const { addToCart } = useCart();
  const { user } = useAuth();
  const [search, setSearch] = useState("");
  const [inStockOnly, setInStockOnly] = useState(false);
  const [assistantQuery, setAssistantQuery] = useState("");
  const [assistantResult, setAssistantResult] = useState(null);
  const [assistantLoading, setAssistantLoading] = useState(false);
  const [recommendationMode, setRecommendationMode] = useState("personalized");
  const [recommendations, setRecommendations] = useState([]);
  const [substitutions, setSubstitutions] = useState({});
  const [together, setTogether] = useState({});

  useEffect(() => {
    if (user?.role !== "customer") return;
    api.get("/api/recommendations", { params: { mode: recommendationMode } })
      .then((response) => setRecommendations(response.data))
      .catch(() => setRecommendations([]));
  }, [user?.role, recommendationMode]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return products.filter((p) => {
      const matchesSearch = !q || p.name.toLowerCase().includes(q);
      const matchesStock = !inStockOnly || p.stock > 0;
      return matchesSearch && matchesStock;
    });
  }, [products, search, inStockOnly]);

  const searchWithAssistant = async (event) => {
    event.preventDefault();
    if (!assistantQuery.trim()) return;
    setAssistantLoading(true);
    try {
      setAssistantResult(await api.post("/api/assistant/grocery", { message: assistantQuery.trim() }).then((response) => response.data));
    } catch (requestError) {
      toast.error(requestError.response?.data?.message || "The grocery assistant is unavailable");
    } finally {
      setAssistantLoading(false);
    }
  };

  const loadSubstitutions = async (productId) => {
    if (substitutions[productId]) return;
    try {
      const response = await api.get(`/api/products/${productId}/substitutions`);
      setSubstitutions((current) => ({ ...current, [productId]: response.data }));
    } catch {
      toast.error("Could not load alternatives");
    }
  };

  const loadTogether = async (productId) => {
    if (together[productId]) return;
    try {
      const response = await api.get("/api/recommendations", { params: { mode: "frequently-bought-together", productId } });
      setTogether((current) => ({ ...current, [productId]: response.data }));
    } catch { toast.error("Could not load related basket items"); }
  };

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
    <div className="space-y-8">
      <section className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-emerald-900 via-emerald-800 to-teal-700 p-6 text-white shadow-lg md:p-9">
        <div className="absolute -right-8 -top-14 h-56 w-56 rounded-full bg-white/10 blur-2xl" />
        <p className="text-xs font-semibold uppercase tracking-[0.25em] text-emerald-100">Smart Grocery · Fresh picks, faster</p>
        <h1 className="mt-3 max-w-2xl text-3xl font-bold md:text-4xl">Your everyday basket, made smarter.</h1>
        <p className="mt-3 max-w-xl text-sm text-emerald-50 md:text-base">Search the live catalogue, see stock as it changes, and get suggestions grounded in products we actually carry.</p>
        <form className="mt-6 flex max-w-2xl flex-col gap-2 sm:flex-row" onSubmit={searchWithAssistant}>
          <input aria-label="Ask the grocery assistant" className="min-w-0 flex-1 rounded-xl border border-white/30 bg-white px-4 py-3 text-slate-900 placeholder:text-slate-400" placeholder="Try “breakfast under ₹300”" value={assistantQuery} onChange={(event) => setAssistantQuery(event.target.value)} />
          <button disabled={assistantLoading || user?.role !== "customer"} className="rounded-xl bg-lime-300 px-5 py-3 font-semibold text-emerald-950 disabled:opacity-60">{assistantLoading ? "Searching…" : "Ask assistant"}</button>
        </form>
        {user?.role !== "customer" && <p className="mt-2 text-xs text-emerald-100">Sign in as a customer to use the grocery assistant and personal recommendations.</p>}
      </section>

      {assistantResult && <section className="rounded-2xl border border-emerald-200 bg-emerald-50 p-4" aria-live="polite"><p className="font-semibold text-emerald-950">{assistantResult.message}</p><p className="mt-1 text-xs text-emerald-800">{assistantResult.mode === "llm_intent_with_catalog_grounding" ? "AI intent · verified live catalogue" : "Catalogue search · AI provider not configured"}</p><div className="mt-3 flex flex-wrap gap-2">{assistantResult.products.map((item) => <button key={item._id} onClick={() => addToCart({ productId: item._id, quantity: 1 })} className="rounded-full border border-emerald-200 bg-white px-3 py-1.5 text-sm hover:bg-emerald-100">{item.name} · {formatCurrency(item.price)}</button>)}</div></section>}

      {user?.role === "customer" && <section>
        <div className="mb-3 flex flex-wrap items-end justify-between gap-3"><div><p className="text-xs font-semibold uppercase tracking-wider text-emerald-700">Picked for your basket</p><h2 className="text-xl font-bold">Recommendations</h2></div><select aria-label="Recommendation type" className="rounded-lg border bg-white px-3 py-2 text-sm" value={recommendationMode} onChange={(event) => setRecommendationMode(event.target.value)}><option value="personalized">For you</option><option value="buy-again">Buy again</option></select></div>
        {recommendations.length ? <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4">{recommendations.slice(0, 4).map((product) => <ProductCard key={product._id} product={product} canEdit={false} onAdd={() => addToCart({ productId: product._id, quantity: 1 })} />)}</div> : <p className="rounded-xl border border-dashed p-4 text-sm text-slate-500">Place a few orders and in-stock recommendations will appear here.</p>}
      </section>}

      <section>
      <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between"><div><p className="text-xs font-semibold uppercase tracking-wider text-emerald-700">Shop the catalogue</p><h2 className="text-2xl font-bold">Fresh groceries</h2></div><div className="flex flex-col gap-3 sm:flex-row sm:items-center"><input aria-label="Filter products" className="w-full rounded-xl border bg-white p-3 text-sm sm:w-72" placeholder="Filter loaded products…" value={search} onChange={(event) => setSearch(event.target.value)} /><label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={inStockOnly} onChange={(event) => setInStockOnly(event.target.checked)} /> In stock</label></div></div>

      {error ? (
        <InlineError message={error} />
      ) : filtered.length === 0 ? (
        <EmptyState title="No products found" description="Try changing search or stock filter." />
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4">
          {filtered.map((product) => (
            <div key={product._id}>
              <ProductCard product={product} canEdit={false} onAdd={() => addToCart({ productId: product._id, quantity: 1 })} />
              <div className="mt-2"><button className="mr-3 text-xs font-medium text-emerald-800 underline" onClick={() => loadSubstitutions(product._id)}>Find alternatives</button>{user?.role === "customer" && <button className="text-xs font-medium text-emerald-800 underline" onClick={() => loadTogether(product._id)}>Often bought with</button>}{substitutions[product._id] && <div className="mt-1 text-xs text-slate-600">{substitutions[product._id].length ? substitutions[product._id].map((item) => <button key={item.product._id} className="mr-2 rounded-full bg-slate-100 px-2 py-1" title={item.reason} onClick={() => addToCart({ productId: item.product._id, quantity: 1 })}>{item.product.name} · {formatCurrency(item.product.price)}</button>) : "No in-stock alternatives"}</div>}{together[product._id] && <div className="mt-1 text-xs text-slate-600">{together[product._id].length ? together[product._id].map((item) => <button key={item._id} className="mr-2 rounded-full bg-amber-50 px-2 py-1" onClick={() => addToCart({ productId: item._id, quantity: 1 })}>{item.name} · {formatCurrency(item.price)}</button>) : "No frequent basket pairings yet"}</div>}</div>
            </div>
          ))}
        </div>
      )}
      </section>
    </div>
  );
};

export default ProductsPage;
