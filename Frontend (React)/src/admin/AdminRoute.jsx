import { useContext, useEffect, useState } from "react";
import { Navigate } from "react-router-dom";
import { AuthContext } from "../context/AuthContext";

const AdminRoute = ({ children }) => {
  const { isAuthenticated, isStaff } = useContext(AuthContext);
  const [checking, setChecking] = useState(true);

  useEffect(() => {
    // Give AuthContext a brief moment to finish loading from localStorage
    const t = setTimeout(() => setChecking(false), 300);
    return () => clearTimeout(t);
  }, []);

  if (checking) {
    return (
      <div className="d-flex justify-content-center align-items-center" style={{ height: "100vh" }}>
        <div className="spinner-border text-primary" role="status" />
      </div>
    );
  }

  if (!isAuthenticated || !isStaff) {
    return <Navigate to="/" replace />;
  }

  return children;
};

export default AdminRoute;
