import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { useCart } from "../context/CartContext";

const Navbar = () => {
  const { user, logout } = useAuth();
  const { cartCount } = useCart();
  const navigate = useNavigate();
  const [mobileOpen, setMobileOpen] = useState(false);

  useEffect(() => {
    setMobileOpen(false);
  }, [user?._id]);

  const logoutAndClose = () => {
    logout();
    setMobileOpen(false);
    navigate("/login");
  };

  return (
    <header className="bg-white shadow-sm">
      <nav className="mx-auto flex max-w-6xl items-center justify-between px-4 py-3 md:px-10">
        <Link className="font-bold text-emerald-700" to="/">
          Smart Grocery
        </Link>

        <button
          className="rounded border px-3 py-2 text-sm md:hidden"
          aria-label="Toggle menu"
          onClick={() => setMobileOpen((v) => !v)}
        >
          Menu
        </button>

        <div className="hidden items-center gap-3 text-sm md:flex">
          <Link to="/">Products</Link>
          {user?.role === "customer" && (
            <>
              <Link to="/cart">Cart ({cartCount})</Link>
              <Link to="/orders">Orders</Link>
            </>
          )}
          {user?.role === "delivery_partner" && <Link to="/delivery">Assigned Orders</Link>}
          {user?.role === "admin" && <Link to="/admin">Admin</Link>}
          {!user ? (
            <>
              <Link to="/login">Login</Link>
              <Link to="/register">Register</Link>
            </>
          ) : (
            <button onClick={logoutAndClose} className="rounded bg-slate-900 px-3 py-1 text-white">
              Logout
            </button>
          )}
        </div>
      </nav>

      {mobileOpen && (
        <div className="border-t bg-white md:hidden">
          <div className="mx-auto flex max-w-6xl flex-col gap-2 px-4 py-3 text-sm md:px-10">
            <Link onClick={() => setMobileOpen(false)} to="/">
              Products
            </Link>
            {user?.role === "customer" && (
              <>
                <Link onClick={() => setMobileOpen(false)} to="/cart">
                  Cart ({cartCount})
                </Link>
                <Link onClick={() => setMobileOpen(false)} to="/orders">
                  Orders
                </Link>
              </>
            )}
            {user?.role === "delivery_partner" && (
              <Link onClick={() => setMobileOpen(false)} to="/delivery">
                Assigned Orders
              </Link>
            )}
            {user?.role === "admin" && (
              <Link onClick={() => setMobileOpen(false)} to="/admin">
                Admin
              </Link>
            )}
            {!user ? (
              <>
                <Link onClick={() => setMobileOpen(false)} to="/login">
                  Login
                </Link>
                <Link onClick={() => setMobileOpen(false)} to="/register">
                  Register
                </Link>
              </>
            ) : (
              <button onClick={logoutAndClose} className="rounded bg-slate-900 px-3 py-2 text-left text-white">
                Logout
              </button>
            )}
          </div>
        </div>
      )}
    </header>
  );
};

export default Navbar;
