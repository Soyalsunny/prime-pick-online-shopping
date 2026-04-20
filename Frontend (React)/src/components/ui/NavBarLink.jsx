import { NavLink } from "react-router-dom";
import styles from "./NavBar.module.css";
import { useContext, useState } from "react";
import { AuthContext } from "../../context/AuthContext";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faSignOutAlt, faUser } from "@fortawesome/free-solid-svg-icons";
import { toast } from "react-toastify";
import { generateCartCode } from "../../GenerateCartCode";

const NavBarLink = ({ setNumCartItems }) => {
  const { isAuthenticated, isStaff, setIsAuthenticated, username } =
    useContext(AuthContext);
  const [showLogoutConfirm, setShowLogoutConfirm] = useState(false);
  const showStoreNav = !isAuthenticated || !isStaff;

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
    if (setNumCartItems) {
      setNumCartItems(0);
    }
    setShowLogoutConfirm(false);
    toast.success("Logged out successfully!");
  };

  return (
    <ul className={`navbar-nav ms-auto mb-2 mb-lg-0 ${styles.navbarNav}`}>
      {showStoreNav && (
        <>
          <li className="nav-item">
            <NavLink
              to="/"
              className={({ isActive }) =>
                isActive ? styles.navLinkActive : styles.navLink
              }
            >
              Home
            </NavLink>
          </li>

          <li className="nav-item">
            <NavLink
              to="/shop"
              className={({ isActive }) =>
                isActive ? styles.navLinkActive : styles.navLink
              }
            >
              Shop
            </NavLink>
          </li>
        </>
      )}

      {isAuthenticated ? (
        <>
          {!isStaff && (
            <li className="nav-item">
              <NavLink
                to="/profile"
                className={({ isActive }) =>
                  isActive ? styles.navLinkActive : styles.navLink
                }
              >
                <FontAwesomeIcon icon={faUser} style={{ marginRight: "5px" }} />
                {username}
              </NavLink>
            </li>
          )}

          {isStaff && (
            <li className="nav-item">
              <NavLink
                to="/admin-panel"
                className={({ isActive }) =>
                  isActive ? styles.navLinkActive : styles.navLink
                }
              >
                Admin Panel
              </NavLink>
            </li>
          )}

          <li className="nav-item">
            <button
              type="button"
              onClick={requestLogout}
              className={styles.logoutLinkBtn}
            >
              <FontAwesomeIcon
                icon={faSignOutAlt}
                style={{ marginRight: "5px" }}
              />
              Logout
            </button>
          </li>
        </>
      ) : (
        <>
          <li className="nav-item">
            <NavLink
              to="/login"
              className={({ isActive }) =>
                isActive ? styles.navLinkActive : styles.navLink
              }
            >
              Login
            </NavLink>
          </li>

          <li className="nav-item">
            <NavLink
              to="/register"
              className={({ isActive }) =>
                isActive ? styles.navLinkActive : styles.navLink
              }
            >
              Register
            </NavLink>
          </li>
        </>
      )}

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
    </ul>
  );
};

export default NavBarLink;
