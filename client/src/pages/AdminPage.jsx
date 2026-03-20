import { useEffect, useState } from "react";
import toast from "react-hot-toast";
import api from "../api/client";

const emptyProduct = { name: "", description: "", price: "", stock: "" };

const AdminPage = () => {
  const [products, setProducts] = useState([]);
  const [users, setUsers] = useState([]);
  const [orders, setOrders] = useState([]);
  const [form, setForm] = useState(emptyProduct);
  const [imageFile, setImageFile] = useState(null);
  const [creating, setCreating] = useState(false);

  const loadAll = async () => {
    const [productsRes, usersRes, ordersRes] = await Promise.all([
      api.get("/products"),
      api.get("/users"),
      api.get("/orders"),
    ]);
    setProducts(productsRes.data);
    setUsers(usersRes.data);
    setOrders(ordersRes.data);
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
      <section className="rounded bg-white p-4 shadow">
        <h2 className="mb-3 text-xl font-bold">Add Product</h2>
        <form className="grid grid-cols-1 gap-2 md:grid-cols-5" onSubmit={createProduct}>
          <input className="rounded border p-2" placeholder="Name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
          <input className="rounded border p-2" placeholder="Price" value={form.price} onChange={(e) => setForm({ ...form, price: e.target.value })} />
          <input className="rounded border p-2" placeholder="Stock" value={form.stock} onChange={(e) => setForm({ ...form, stock: e.target.value })} />
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
              <span>{product.name} (${product.price}) stock: {product.stock}</span>
              <div className="flex gap-2">
                <button className="rounded bg-blue-600 px-2 py-1 text-white" onClick={() => editProduct(product)}>
                  Edit
                </button>
                <button className="rounded bg-red-600 px-2 py-1 text-white" onClick={() => deleteProduct(product._id)}>
                  Delete
                </button>
              </div>
            </div>
          ))}
        </div>
      </section>

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
                <select className="mt-2 rounded border p-1" defaultValue="" onChange={(e) => e.target.value && assignOrder(order._id, e.target.value)}>
                  <option value="">Assign delivery partner</option>
                  {partners.map((partner) => (
                    <option key={partner._id} value={partner._id}>{partner.name}</option>
                  ))}
                </select>
              )}
            </div>
          ))}
        </div>
      </section>
    </div>
  );
};

export default AdminPage;
