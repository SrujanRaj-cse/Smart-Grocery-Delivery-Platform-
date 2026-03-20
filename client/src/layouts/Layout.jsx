import { Outlet } from "react-router-dom";
import Navbar from "../components/Navbar";
import { useAuth } from "../context/AuthContext";

const Layout = () => {
  const { loading } = useAuth();
  if (loading) {
    return <div className="p-8 text-center">Loading...</div>;
  }

  return (
    <div className="min-h-screen">
      <Navbar />
      <main className="mx-auto max-w-6xl px-4 py-4 md:px-10">
        <Outlet />
      </main>
    </div>
  );
};

export default Layout;
