
import { Navigate, Outlet, useLocation } from "react-router-dom";

export default function RotaProtegida() {
  const token = localStorage.getItem("token");
  const location = useLocation();

  if (!token) {
    return <Navigate to="/" replace state={{ from: location }} />;
  }

  return <Outlet />;
}
