import { FaCartShopping } from "react-icons/fa6";
import { Link } from "react-router-dom";
import { useContext } from "react";
import styles from "./NavBar.module.css";
import NavBarLink from "./NavBarLink";
import { AuthContext } from "../../context/AuthContext";

const NavBar = ({numCartItems, setNumCartItems}) => {
  const { isAuthenticated, isStaff } = useContext(AuthContext);

  return (
    <nav
      className={`navbar navbar-expand-lg bg-white shadow-sm py-3 fixed-top ${styles.stickyNavbar}`}
      style={{
        borderBottom: "2px solid #f0f0f0",
      }}
    >
      <div className="container">
        {/* Brand Name */}
        <Link
          className="navbar-brand fw-bold text-uppercase"
          to="/"
          style={{
            fontSize: "1.6rem",
            fontWeight: "bold",
            color: "black",
            letterSpacing: "1px",
            textShadow: "1px 1px 2px rgba(0, 0, 0, 0.3)", 
            transition: "color 0.3s ease, transform 0.3s ease",
          }}
          onMouseEnter={(e) => {
            e.target.style.color = "#6050DC";
            e.target.style.transform = "scale(1.1)";
            e.target.style.textShadow = "2px 2px 4px rgba(96, 80, 220, 0.5)";
          }}
          onMouseLeave={(e) => {
            e.target.style.color = "black";
            e.target.style.transform = "scale(1)";
            e.target.style.textShadow = "1px 1px 2px rgba(0, 0, 0, 0.3)";
          }}
        >
          Prime Pick
        </Link>

        {/* Toggler */}
        <button
          className="navbar-toggler"
          type="button"
          data-bs-toggle="collapse"
          data-bs-target="#navbarContent"
          aria-controls="navbarContent"
          aria-expanded="false"
          aria-label="Toggle navigation"
        >
          <span className="navbar-toggler-icon"></span>
        </button>

        {/* Navbar Content */}
        <div className="collapse navbar-collapse" id="navbarContent">
          {/* Navigation Links */}
          <NavBarLink setNumCartItems={setNumCartItems} />

          {/* Cart Icon */}
          {!(isAuthenticated && isStaff) && (
            <Link
              to="/cart"
              className={`btn ms-3 rounded-pill position-relative ${styles.responsiveCart}`}
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                color: "white",
                backgroundColor: "#000003",
                border: "none",
                padding: "0.5rem 1.2rem",
                fontSize: "1rem",
                fontWeight: "bold",
                transition: "transform 0.3s ease, box-shadow 0.3s ease",
              }}
              onMouseEnter={(e) => {
                e.target.style.transform = "scale(1.1)";
                e.target.style.boxShadow = "0 5px 15px rgba(0, 0, 0, 0.2)";
              }}
              onMouseLeave={(e) => {
                e.target.style.transform = "scale(1)";
                e.target.style.boxShadow = "none";
              }}
            >
              <FaCartShopping
                style={{ fontSize: "1.3rem", marginRight: "0.1rem" }}
              />
              {numCartItems == 0 || <span
                className="position-absolute top-0 start-100 translate-middle badge rounded-pill"
                style={{
                  fontSize: "0.85rem",
                  padding: "0.4em 0.6em",
                  backgroundColor: "#6050DC",
                }}
              >
                {numCartItems}
              </span> }
              
            </Link>
          )}
        </div>
      </div>
    </nav>
  );
};

export default NavBar;
