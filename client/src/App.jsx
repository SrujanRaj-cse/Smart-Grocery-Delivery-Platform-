import { Navigate, Route, Routes } from "react-router-dom";
import Layout from "./layouts/Layout.jsx";
import AdminPage from "./pages/AdminPage.jsx";
import CartPage from "./pages/CartPage.jsx";
import DeliveryPage from "./pages/DeliveryPage.jsx";
import LoginPage from "./pages/LoginPage.jsx";
import OrdersPage from "./pages/OrdersPage.jsx";
import ProductsPage from "./pages/ProductsPage.jsx";
import RegisterPage from "./pages/RegisterPage.jsx";
import RoleRoute from "./utils/RoleRoute.jsx";

function App() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route path="/register" element={<RegisterPage />} />
      <Route element={<Layout />}>
        <Route path="/" element={<ProductsPage />} />
        <Route path="/cart" element={<RoleRoute roles={["customer"]} element={<CartPage />} />} />
        <Route path="/orders" element={<RoleRoute roles={["customer"]} element={<OrdersPage />} />} />
        <Route path="/delivery" element={<RoleRoute roles={["delivery_partner"]} element={<DeliveryPage />} />} />
        <Route path="/admin" element={<RoleRoute roles={["admin"]} element={<AdminPage />} />} />
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}

export default App;
