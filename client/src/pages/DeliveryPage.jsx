import { useEffect, useState } from "react";
import toast from "react-hot-toast";
import api from "../api/client";
import OrderTimeline from "../components/OrderTimeline";
import { formatCurrency } from "../utils/currency";

const DeliveryPage = () => {
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [updatingOrderId, setUpdatingOrderId] = useState(null);
  const [errorMsg, setErrorMsg] = useState("");
  const [routePlan, setRoutePlan] = useState(null);
  const [planningRoute, setPlanningRoute] = useState(false);

  const loadOrders = () => {
    setLoading(true);
    setErrorMsg("");
    api.get("/orders")
      .then((res) => setOrders(res.data))
      .catch((error) => {
        const msg = error.response?.data?.message || "Failed to load assigned orders";
        setErrorMsg(msg);
        toast.error(msg);
      })
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    loadOrders();
  }, []);

  const updateStatus = async (orderId, status) => {
    try {
      setUpdatingOrderId(orderId);
      await api.patch(`/orders/${orderId}/status`, { status });
      loadOrders();
      toast.success("Status updated");
    } catch (error) {
      toast.error(error.response?.data?.message || "Update failed");
    } finally {
      setUpdatingOrderId(null);
    }
  };

  const planRoute = () => {
    if (!navigator.geolocation) return toast.error("Location is not available in this browser");
    setPlanningRoute(true);
    navigator.geolocation.getCurrentPosition(async ({ coords }) => {
      try {
        const result = await api.get("/api/delivery/route", { params: { latitude: coords.latitude, longitude: coords.longitude } });
        setRoutePlan(result.data);
      } catch (error) {
        toast.error(error.response?.data?.message || "Could not plan route");
      } finally { setPlanningRoute(false); }
    }, () => {
      setPlanningRoute(false);
      toast.error("Location permission was not granted");
    }, { timeout: 10000 });
  };

  const canMarkPicked = (s) => s === "assigned";
  const canMarkDelivered = (s) => s === "picked";

  return (
    <div className="space-y-5">
      <section className="rounded-2xl border bg-white p-5 shadow-sm"><div className="flex flex-wrap items-center justify-between gap-3"><div><p className="text-xs font-semibold uppercase tracking-wider text-emerald-700">Delivery tools</p><h2 className="text-lg font-bold">Stop planner</h2><p className="mt-1 text-sm text-slate-600">Order geotagged deliveries from your current location.</p></div><button onClick={planRoute} disabled={planningRoute} className="rounded-xl bg-emerald-700 px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-60">{planningRoute ? "Planning…" : "Plan my route"}</button></div>{routePlan && <div className="mt-4 rounded-xl bg-slate-50 p-3"><p className="text-sm font-semibold">{routePlan.route.length} stops · {routePlan.totalDistanceKm} km straight-line estimate</p><p className="text-xs text-slate-500">{routePlan.note} {routePlan.omittedOrdersWithoutCoordinates ? `${routePlan.omittedOrdersWithoutCoordinates} orders have no location pin.` : ""}</p><ol className="mt-3 space-y-2">{routePlan.route.map((stop, index) => <li key={stop.orderId} className="flex gap-2 text-sm"><span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-emerald-700 text-xs font-bold text-white">{index + 1}</span><span><strong>Order {String(stop.orderId).slice(-6)}</strong> · {stop.address}</span></li>)}</ol></div>}</section>
      <div className="flex flex-col gap-2 md:flex-row md:items-end md:justify-between">
        <h1 className="text-2xl font-bold">Assigned Orders</h1>
        <p className="text-sm text-slate-600">{orders.length} order(s)</p>
      </div>

      {errorMsg ? <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{errorMsg}</div> : null}

      {loading ? (
        <div className="space-y-4">
          {Array.from({ length: 2 }).map((_, idx) => (
            <div key={idx} className="rounded-2xl border bg-white p-5 shadow-sm">
              <div className="h-6 w-48 animate-pulse rounded bg-slate-100" />
              <div className="mt-4 space-y-2">
                <div className="h-4 w-2/3 animate-pulse rounded bg-slate-100" />
                <div className="h-4 w-1/2 animate-pulse rounded bg-slate-100" />
              </div>
            </div>
          ))}
        </div>
      ) : orders.length === 0 ? (
        <div className="rounded-2xl border bg-white p-6 text-center shadow-sm">
          <p className="text-lg font-semibold">No assigned orders</p>
          <p className="mt-2 text-sm text-slate-600">When an admin assigns orders, they will appear here.</p>
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
                    <p className="mt-1 text-xs text-slate-500">Customer: {order.customer?.name}</p>
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
                    <p className="mt-3 text-xs text-slate-500">Total</p>
                      <p className="text-2xl font-bold text-emerald-800">{formatCurrency(order.totalAmount)}</p>
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
                        <p className="text-sm font-semibold">{formatCurrency(it.price)}</p>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="mt-4 flex flex-col gap-2 md:flex-row md:justify-end">
                  {canMarkPicked(order.status) ? (
                    <button
                      className="rounded-xl bg-indigo-600 px-4 py-3 text-white transition hover:bg-indigo-700 disabled:opacity-50"
                      disabled={updatingOrderId === order._id}
                      onClick={() => updateStatus(order._id, "picked")}
                    >
                      {updatingOrderId === order._id ? "Updating..." : "Mark Picked"}
                    </button>
                  ) : null}
                  {canMarkDelivered(order.status) ? (
                    <button
                      className="rounded-xl bg-emerald-600 px-4 py-3 text-white transition hover:bg-emerald-700 disabled:opacity-50"
                      disabled={updatingOrderId === order._id}
                      onClick={() => updateStatus(order._id, "delivered")}
                    >
                      {updatingOrderId === order._id ? "Updating..." : "Mark Delivered"}
                    </button>
                  ) : null}
                  {order.status === "delivered" ? (
                    <div className="rounded-xl border bg-slate-50 px-4 py-3 text-sm text-slate-700">
                      Delivered. Thank you.
                    </div>
                  ) : null}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default DeliveryPage;
