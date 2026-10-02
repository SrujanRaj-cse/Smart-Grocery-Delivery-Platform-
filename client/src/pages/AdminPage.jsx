import { useEffect, useState } from "react";
import toast from "react-hot-toast";
import api from "../api/client";

const emptyProduct = { name: "", description: "", price: "", stock: "", category: "Other", brand: "", unit: "each" };

const AdminPage = () => {
  const [products, setProducts] = useState([]);
  const [users, setUsers] = useState([]);
  const [orders, setOrders] = useState([]);
  const [form, setForm] = useState(emptyProduct);
  const [imageFile, setImageFile] = useState(null);
  const [creating, setCreating] = useState(false);
  const [overview, setOverview] = useState(null);
  const [copilot, setCopilot] = useState(null);
  const [forecast, setForecast] = useState(null);

  const loadAll = async () => {
    const [productsRes, usersRes, ordersRes, overviewRes, copilotRes] = await Promise.all([
      api.get("/products"),
      api.get("/users"),
      api.get("/orders"),
      api.get("/api/admin/analytics/overview"),
      api.get("/api/admin/copilot"),
    ]);
    setProducts(productsRes.data);
    setUsers(usersRes.data);
    setOrders(ordersRes.data);
    setOverview(overviewRes.data);
    setCopilot(copilotRes.data);
  };

  useEffect(() => {
    loadAll().catch(() => toast.error("Failed to load admin data"));
  }, []);

  const createProduct = async (e) => {
    e.preventDefault();
    if (!imageFile) {
      toast.error("Please select an image (PNG/JPG/WebP).");
      return;
    }
    setCreating(true);
    try {
      const fd = new FormData();
      fd.append("name", form.name);
      fd.append("description", form.description || "");
      fd.append("price", form.price);
      fd.append("stock", form.stock);
      fd.append("category", form.category);
      fd.append("brand", form.brand);
      fd.append("unit", form.unit);
      fd.append("image", imageFile);

      await api.post("/products", fd, {
        headers: { "Content-Type": "multipart/form-data" },
      });

      setForm(emptyProduct);
      setImageFile(null);
      toast.success("Product added");
      loadAll();
    } catch (error) {
      toast.error(error.response?.data?.message || "Failed to add product");
    } finally {
      setCreating(false);
    }
  };

  const editProduct = async (product) => {
    const name = window.prompt("Name", product.name);
    if (!name) return;
    const price = window.prompt("Price", product.price);
    const stock = window.prompt("Stock", product.stock);
    await api.patch(`/products/${product._id}`, {
      name,
      price: Number(price),
      stock: Number(stock),
      description: product.description,
      imageUrl: product.imageUrl || "",
    });
    toast.success("Product updated");
    loadAll();
  };

  const deleteProduct = async (productId) => {
    await api.delete(`/products/${productId}`);
    toast.success("Product deleted");
    loadAll();
  };

  const changeRole = async (userId, role) => {
    await api.patch(`/users/${userId}/role`, { role });
    loadAll();
  };

  const assignOrder = async (orderId, deliveryPartnerId) => {
    await api.patch(`/orders/${orderId}/assign`, { deliveryPartnerId });
    loadAll();
  };

  const assignBest = async (orderId) => {
    try {
      const response = await api.post(`/orders/${orderId}/assign-best`);
      toast.success(`Assigned to ${response.data.order.deliveryPartner}`);
      await loadAll();
    } catch (error) {
      toast.error(error.response?.data?.message || "Could not assign order");
    }
  };

  const refreshForecasts = async () => {
    try {
      const result = await api.post("/api/admin/analytics/forecast/refresh");
      toast.success(result.data.message || `${result.data.jobs} forecasts queued`);
    } catch (error) {
      toast.error(error.response?.data?.message || "Configure Redis to enable the forecast worker");
    }
  };

  const loadForecast = async (productId) => {
    try { setForecast((await api.get("/api/admin/analytics/forecast", { params: { productId } })).data); }
    catch { toast.error("Forecast could not be loaded"); }
  };

  const partners = users.filter((user) => user.role === "delivery_partner");
  const [previewUrl, setPreviewUrl] = useState(null);

  useEffect(() => {
    if (!imageFile) {
      setPreviewUrl(null);
      return;
    }
    const url = URL.createObjectURL(imageFile);
    setPreviewUrl(url);
    return () => URL.revokeObjectURL(url);
  }, [imageFile]);

  return (
    <div className="space-y-8">
      <section className="rounded-3xl bg-gradient-to-br from-slate-950 via-slate-900 to-emerald-950 p-6 text-white shadow-lg">
        <div className="flex flex-wrap items-end justify-between gap-4"><div><p className="text-xs font-semibold uppercase tracking-[0.24em] text-emerald-300">Operations overview</p><h1 className="mt-2 text-3xl font-bold">Admin workspace</h1><p className="mt-2 text-sm text-slate-300">Live commerce metrics, inventory signals, and delivery workload.</p></div><button onClick={refreshForecasts} className="rounded-xl bg-emerald-400 px-4 py-2.5 text-sm font-semibold text-emerald-950">Queue forecast refresh</button></div>
        {overview && <div className="mt-6 grid grid-cols-2 gap-3 md:grid-cols-4">{[["Orders", overview.orders], ["Customers", overview.customers], ["Delivery team", overview.deliveryPartners], ["Low stock", overview.lowStockProducts]].map(([label, value]) => <div key={label} className="rounded-2xl border border-white/10 bg-white/5 p-4"><p className="text-xs text-slate-300">{label}</p><p className="mt-1 text-2xl font-bold">{value}</p></div>)}</div>}
      </section>
      {copilot && <section className="rounded-2xl border border-amber-200 bg-amber-50 p-5"><div className="flex items-center justify-between"><h2 className="font-bold text-amber-950">Operations copilot</h2><span className="rounded-full bg-white px-2 py-1 text-[10px] uppercase tracking-wide text-amber-800">{copilot.mode === "llm_aggregate_summary" ? "AI summary · verified metrics" : "Verified metrics"}</span></div><p className="mt-2 text-sm font-medium text-amber-950">{copilot.recommendation}</p><ul className="mt-2 list-inside list-disc text-sm text-amber-900">{copilot.insights.map((insight) => <li key={insight}>{insight}</li>)}</ul></section>}

      <section className="rounded bg-white p-4 shadow">
        <h2 className="mb-3 text-xl font-bold">Add Product</h2>
        <form className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-4" onSubmit={createProduct}>
          <input className="rounded border p-2" placeholder="Name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
          <input className="rounded border p-2" placeholder="Price" value={form.price} onChange={(e) => setForm({ ...form, price: e.target.value })} />
          <input className="rounded border p-2" placeholder="Stock" value={form.stock} onChange={(e) => setForm({ ...form, stock: e.target.value })} />
          <input className="rounded border p-2" placeholder="Category" value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })} />
          <input className="rounded border p-2" placeholder="Brand" value={form.brand} onChange={(e) => setForm({ ...form, brand: e.target.value })} />
          <input className="rounded border p-2" placeholder="Unit (e.g. 1 kg)" value={form.unit} onChange={(e) => setForm({ ...form, unit: e.target.value })} />
          <input className="rounded border p-2" placeholder="Description" value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
          <div className="col-span-1 md:col-span-1">
            <input
              className="w-full rounded border p-2 text-sm"
              type="file"
              accept="image/png,image/jpeg,image/jpg,image/webp"
              onChange={(e) => setImageFile(e.target.files?.[0] || null)}
            />
            {previewUrl ? (
              <img src={previewUrl} alt="Preview" className="mt-2 h-16 w-full rounded object-cover" />
            ) : null}
          </div>
          <button className="rounded bg-emerald-600 p-2 text-white disabled:opacity-50" disabled={creating} type="submit">
            {creating ? "Adding..." : "Create"}
          </button>
        </form>
      </section>

      <section className="rounded bg-white p-4 shadow">
        <h2 className="mb-3 text-xl font-bold">Manage Products</h2>
        <div className="space-y-2">
          {products.map((product) => (
            <div key={product._id} className="flex items-center justify-between rounded border p-2">
              <span className="min-w-0"><strong>{product.name}</strong> <span className="text-xs text-slate-500">{product.category} · ₹{product.price} · stock {product.stock}</span></span>
              <div className="flex gap-2">
                <button className="rounded bg-blue-600 px-2 py-1 text-white" onClick={() => editProduct(product)}>
                  Edit
                </button>
                <button className="rounded bg-red-600 px-2 py-1 text-white" onClick={() => deleteProduct(product._id)}>
                  Delete
                </button>
                <button className="rounded bg-emerald-700 px-2 py-1 text-white" onClick={() => loadForecast(product._id)}>Forecast</button>
              </div>
            </div>
          ))}
        </div>
      </section>
      {forecast && <section className="rounded-xl border bg-emerald-50 p-4"><button className="float-right text-sm" onClick={() => setForecast(null)} aria-label="Close forecast">×</button><h2 className="font-bold">{forecast.product.name} demand outlook</h2><p className="mt-1 text-sm">{forecast.observedDays} observed demand days · {forecast.confidence.replaceAll("_", " ")} · {forecast.method}</p><p className="mt-1 text-sm">{forecast.averageDailyUnits} units/day average · {forecast.projectedUnits} projected over {forecast.horizonDays} days · stock {forecast.product.stock}</p>{forecast.reorderSuggested && <p className="mt-2 font-semibold text-amber-800">Reorder suggested based on the observed demand window.</p>}</section>}

      <section className="rounded bg-white p-4 shadow">
        <h2 className="mb-3 text-xl font-bold">Manage Users</h2>
        <div className="space-y-2">
          {users.map((user) => (
            <div key={user._id} className="flex items-center justify-between rounded border p-2">
              <span>{user.name} ({user.email})</span>
              <select className="rounded border p-1" value={user.role} onChange={(e) => changeRole(user._id, e.target.value)}>
                <option value="customer">Customer</option>
                <option value="delivery_partner">Delivery Partner</option>
                <option value="admin">Admin</option>
              </select>
            </div>
          ))}
        </div>
      </section>

      <section className="rounded bg-white p-4 shadow">
        <h2 className="mb-3 text-xl font-bold">Assign Orders</h2>
        <div className="space-y-2">
          {orders.map((order) => (
            <div key={order._id} className="rounded border p-3">
              <p className="font-semibold">Order {order._id.slice(-6)} - {order.status}</p>
              <p className="text-sm">Customer: {order.customer?.name}</p>
              {order.status === "confirmed" && (
                <div className="mt-2 flex flex-wrap items-center gap-2"><select className="rounded border p-1" defaultValue="" onChange={(e) => e.target.value && assignOrder(order._id, e.target.value)}>
                  <option value="">Assign delivery partner</option>
                  {partners.map((partner) => (
                    <option key={partner._id} value={partner._id}>{partner.name}</option>
                  ))}
                </select><button className="rounded bg-violet-700 px-3 py-1.5 text-sm text-white" onClick={() => assignBest(order._id)}>Assign least loaded</button></div>
              )}
            </div>
          ))}
        </div>
      </section>
    </div>
  );
};

export default AdminPage;
