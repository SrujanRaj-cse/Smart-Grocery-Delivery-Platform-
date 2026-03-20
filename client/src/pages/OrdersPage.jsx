import { useEffect, useState } from "react";
import toast from "react-hot-toast";
import api from "../api/client";
import OrderTimeline from "../components/OrderTimeline";

const OrdersPage = () => {
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState("");

  useEffect(() => {
    api.get("/orders")
      .then((res) => setOrders(res.data))
      .catch((error) => {
        const msg = error.response?.data?.message || "Failed to load orders";
        setErrorMsg(msg);
        toast.error(msg);
      })
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="space-y-4">
        {Array.from({ length: 3 }).map((_, idx) => (
          <div key={idx} className="rounded-2xl border bg-white p-5 shadow-sm">
            <div className="h-6 w-48 animate-pulse rounded bg-slate-100" />
            <div className="mt-4 h-4 w-3/4 animate-pulse rounded bg-slate-100" />
            <div className="mt-2 space-y-2">
              <div className="h-4 w-full animate-pulse rounded bg-slate-100" />
              <div className="h-4 w-2/3 animate-pulse rounded bg-slate-100" />
            </div>
          </div>
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-col gap-2 md:flex-row md:items-end md:justify-between">
        <h1 className="text-2xl font-bold">My Orders</h1>
        <p className="text-sm text-slate-600">{orders.length} order(s)</p>
      </div>

      {errorMsg ? <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{errorMsg}</div> : null}

      {orders.length === 0 ? (
        <div className="rounded-2xl border bg-white p-6 text-center shadow-sm">
          <p className="text-lg font-semibold">No orders yet</p>
          <p className="mt-2 text-sm text-slate-600">Place your first order to start tracking delivery.</p>
        </div>
      ) : (
        <div className="space-y-4">
          {orders.map((order) => {
            const shortId = order._id ? String(order._id).slice(-6) : "";
            return (
              <div key={order._id} className="rounded-2xl border bg-white p-4 shadow-sm md:p-6">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <p className="text-sm font-semibold">Order #{shortId}</p>
                    <p className="mt-1 text-xs text-slate-500">Placed: {new Date(order.createdAt).toLocaleString()}</p>
                  </div>
                  <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-700">
                    {order.status}
                  </span>
                </div>

                <div className="mt-4 grid gap-4 md:grid-cols-2">
                  <div className="rounded-xl bg-slate-50 p-3">
                    <p className="text-sm font-semibold">Timeline</p>
                    <div className="mt-2">
                      <OrderTimeline status={order.status} />
                    </div>
                  </div>

                  <div className="rounded-xl bg-slate-50 p-3">
                    <p className="text-sm font-semibold">Delivery</p>
                    <p className="mt-2 text-sm text-slate-700">{order.address}</p>
                    <div className="mt-3">
                      <p className="text-xs text-slate-500">Delivery total</p>
                      <p className="text-2xl font-bold text-emerald-800">${Number(order.totalAmount).toFixed(2)}</p>
                    </div>
                  </div>
                </div>

                <div className="mt-4">
                  <p className="text-sm font-semibold">Items</p>
                  <div className="mt-3 space-y-2">
                    {order.items?.map((it, idx) => (
                      <div key={`${it.name}-${idx}`} className="flex items-center justify-between rounded-xl border bg-white p-3">
                        <div>
                          <p className="font-semibold text-sm">{it.name}</p>
                          <p className="text-xs text-slate-600">Qty: {it.quantity}</p>
                        </div>
                        <div className="text-sm font-semibold">${Number(it.price).toFixed(2)}</div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default OrdersPage;
