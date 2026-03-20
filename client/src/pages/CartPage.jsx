import { useState } from "react";
import toast from "react-hot-toast";
import { useCart } from "../context/CartContext";
import api from "../api/client";

const CartPage = () => {
  const { items, total, updateQty, removeFromCart, clearCart, loading } = useCart();
  const [address, setAddress] = useState("");
  const [placing, setPlacing] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");
  const [updating, setUpdating] = useState(null);

  const checkout = async () => {
    setErrorMsg("");
    if (!address.trim()) return toast.error("Address is required");
    if (!items.length) return toast.error("Cart is empty");

    setPlacing(true);
    try {
      await api.post("/orders", {
        address,
        items: items.map((item) => ({
          productId: item.product._id,
          quantity: item.quantity,
        })),
      });
      clearCart();
      setAddress("");
      toast.success("Order placed");
    } catch (error) {
      const msg = error.response?.data?.message || "Checkout failed";
      setErrorMsg(msg);
      toast.error(msg);
    } finally {
      setPlacing(false);
    }
  };

  return (
    <div className="space-y-5">
      <div className="flex flex-col gap-2 md:flex-row md:items-end md:justify-between">
        <h1 className="text-2xl font-bold">Cart</h1>
        <p className="text-sm text-slate-600">{items.length} item(s)</p>
      </div>

      {errorMsg ? <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{errorMsg}</div> : null}

      {loading ? (
        <div className="space-y-3">
          {Array.from({ length: 4 }).map((_, idx) => (
            <div key={idx} className="flex items-center justify-between rounded-2xl border bg-white p-4 shadow-sm">
              <div className="h-6 w-48 animate-pulse rounded bg-slate-100" />
              <div className="h-8 w-32 animate-pulse rounded bg-slate-100" />
            </div>
          ))}
        </div>
      ) : items.length === 0 ? (
        <div className="rounded-2xl border bg-white p-6 text-center shadow-sm">
          <p className="text-lg font-semibold">Your cart is empty</p>
          <p className="mt-2 text-sm text-slate-600">Add products to start checkout.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {items.map((item) => {
            const stock = Number(item.product?.stock) || 0;
            const productId = item.product._id;
            const isUpdating = updating === productId;
            return (
              <div key={productId} className="flex flex-col gap-3 rounded-2xl border bg-white p-4 shadow-sm md:flex-row md:items-center md:justify-between">
                <div className="flex items-start gap-3">
                  {item.product.imageUrl ? (
                    <img
                      src={item.product.imageUrl}
                      alt={item.product.name}
                      className="h-16 w-16 rounded-xl object-cover"
                      onError={(e) => {
                        e.currentTarget.style.display = "none";
                      }}
                    />
                  ) : null}
                  <div>
                    <p className="font-semibold">{item.product.name}</p>
                    <p className="text-sm text-slate-600">${Number(item.product.price).toFixed(2)}</p>
                    <p className="text-xs text-slate-500">Stock: {stock}</p>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    className="rounded-lg border px-3 py-2 text-sm disabled:opacity-50"
                    disabled={item.quantity <= 1 || isUpdating}
                    onClick={async () => {
                      setUpdating(productId);
                      try {
                        await updateQty(productId, item.quantity - 1);
                      } finally {
                        setUpdating(null);
                      }
                    }}
                  >
                    -
                  </button>

                  <div className="min-w-[42px] text-center text-sm font-semibold">{item.quantity}</div>

                  <button
                    className="rounded-lg border px-3 py-2 text-sm disabled:opacity-50"
                    disabled={stock === 0 || item.quantity >= stock || isUpdating}
                    onClick={async () => {
                      setUpdating(productId);
                      try {
                        await updateQty(productId, item.quantity + 1);
                      } finally {
                        setUpdating(null);
                      }
                    }}
                  >
                    +
                  </button>
                </div>

                <div className="flex items-center justify-between gap-3 md:flex-col md:items-end">
                  <div className="text-sm font-semibold">${(Number(item.product.price) * item.quantity).toFixed(2)}</div>
                  <button
                    className="rounded-lg bg-red-600 px-3 py-2 text-sm text-white disabled:opacity-50"
                    disabled={isUpdating}
                    onClick={async () => {
                      setUpdating(productId);
                      try {
                        await removeFromCart(productId);
                      } finally {
                        setUpdating(null);
                      }
                    }}
                  >
                    Remove
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      <div className="rounded-2xl border bg-white p-4 shadow-sm md:p-6">
        <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
          <div>
            <p className="text-sm text-slate-600">Total</p>
            <p className="text-2xl font-bold text-emerald-800">${Number(total).toFixed(2)}</p>
          </div>
          <div className="text-xs text-slate-500">Checkout creates an order and reduces stock.</div>
        </div>

        <div className="mt-4">
          <label className="text-sm font-medium">Delivery address</label>
          <textarea
            className="mt-2 w-full rounded-xl border p-3 text-sm"
            placeholder="Enter delivery address"
            value={address}
            onChange={(e) => setAddress(e.target.value)}
          />
        </div>

        <button
          className="mt-4 w-full rounded-xl bg-emerald-600 px-4 py-3 text-white transition hover:bg-emerald-700 disabled:opacity-50 md:w-auto"
          onClick={checkout}
          disabled={placing || loading || items.length === 0}
        >
          {placing ? "Placing order..." : "Place Order"}
        </button>
      </div>
    </div>
  );
};

export default CartPage;
