import { NavLink, Outlet, useNavigate } from "react-router-dom";
import { useContext, useState } from "react";
import { AuthContext } from "../context/AuthContext";
import styles from "./AdminLayout.module.css";
import { generateCartCode } from "../GenerateCartCode";
import { toast } from "react-toastify";

const AdminLayout = () => {
  const { username, setIsAuthenticated } = useContext(AuthContext);
  const navigate = useNavigate();
  const [showLogoutConfirm, setShowLogoutConfirm] = useState(false);

  const requestLogout = () => {
    setShowLogoutConfirm(true);
  };

  const cancelLogout = () => {
    setShowLogoutConfirm(false);
  };

  const confirmLogout = () => {
    localStorage.removeItem("access");
    localStorage.removeItem("refresh");
    localStorage.setItem("cart_code", generateCartCode());
    setIsAuthenticated(false);
    setShowLogoutConfirm(false);
    toast.success("Logged out successfully!");
    navigate("/login");
  };

  return (
    <div className={styles.wrapper}>
      <aside className={styles.sidebar}>
        <div className={styles.brand}>
          <span className={styles.brandIcon}>★</span>
          <span>Prime Pick</span>
          <span className={styles.adminBadge}>Admin</span>
        </div>

        <nav className={styles.nav}>
          <NavLink
            to="/admin-panel"
            end
            className={({ isActive }) =>
              `${styles.link} ${isActive ? styles.linkActive : ""}`
            }
          >
            <span className={styles.icon}>▦</span> Dashboard
          </NavLink>
          <NavLink
            to="/admin-panel/products"
            className={({ isActive }) =>
              `${styles.link} ${isActive ? styles.linkActive : ""}`
            }
          >
            <span className={styles.icon}>◈</span> Products
          </NavLink>
          <NavLink
            to="/admin-panel/orders"
            className={({ isActive }) =>
              `${styles.link} ${isActive ? styles.linkActive : ""}`
            }
          >
            <span className={styles.icon}>◉</span> Orders
          </NavLink>
        </nav>

        <div className={styles.sidebarFooter}>
          <p className={styles.staffLabel}>{username}</p>
          <button className={styles.logoutBtn} onClick={requestLogout}>
            Logout
          </button>
        </div>
      </aside>

      <main className={styles.main}>
        <Outlet />
      </main>

      {showLogoutConfirm && (
        <div className={styles.confirmOverlay}>
          <div className={styles.confirmModal}>
            <h5 className={styles.confirmTitle}>Logout Confirmation</h5>
            <p className={styles.confirmText}>Are you sure you want to logout?</p>
            <div className={styles.confirmActions}>
              <button
                type="button"
                className={styles.cancelBtn}
                onClick={cancelLogout}
              >
                Cancel
              </button>
              <button
                type="button"
                className={styles.confirmBtn}
                onClick={confirmLogout}
              >
                Logout
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default AdminLayout;
