import { Link } from "react-router-dom";

const CartSummary = ({cartTotal, tax}) => {

  const subTotal = cartTotal.toFixed(2)
  const cartTax = tax.toFixed(2)
  const total = (cartTotal + tax).toFixed(2)

  return (
    <div className="col-md-4 align-self-start">
      <div
        className="card shadow-sm border-light rounded"
        style={{
          transition: "transform 0.3s ease, box-shadow 0.3s ease",
        }}
        onMouseEnter={(e) => {
          e.currentTarget.style.transform = "scale(1.05)";
          e.currentTarget.style.boxShadow = "0 8px 16px rgba(0, 0, 0, 0.15)";
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.transform = "scale(1)";
          e.currentTarget.style.boxShadow = "0 4px 8px rgba(0, 0, 0, 0.1)";
        }}
      >
        <div className="card-body p-4">
          <h5
            className="card-title mb-3"
            style={{
              fontSize: "1.25rem",
              fontWeight: "700",
              color: "#333",
            }}
          >
            Cart Summary
          </h5>
          <hr />
          <div className="d-flex justify-content-between mb-2">
            <span style={{ fontWeight: "500" }}>Subtotal:</span>
            <span style={{ fontWeight: "600", color: "#2d6a4f" }}>{`$${subTotal}`}</span>
          </div>
          <div className="d-flex justify-content-between mb-2">
            <span style={{ fontWeight: "500" }}>Tax:</span>
            <span style={{ fontWeight: "600", color: "#2d6a4f" }}>{`$${cartTax}`}</span>
          </div>
          <div className="d-flex justify-content-between mb-4">
            <span style={{ fontWeight: "500" }}>Total:</span>
            <span
              style={{
                fontWeight: "600",
                fontSize: "1.1rem",
                color: "#e63946",
              }}
            >
              {`$${total}`}
            </span>
          </div>
          <Link to="/checkout">
            <button
              className="btn w-100 py-3"
              style={{
                backgroundColor: "#6050DC",
                borderColor: "#6050DC",
                color: "#fff",
                fontWeight: "600",
                fontSize: "1rem",
                borderRadius: "8px",
                transition: "background-color 0.3s ease",
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.backgroundColor = "#4a3fbb";
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.backgroundColor = "#6050DC";
              }}
            >
              <i className="bi bi-cart-check me-2" style={{ fontSize: "1.2rem" }}></i>
              Proceed to Checkout
            </button>
          </Link>
        </div>
      </div>
    </div>
  );
};

export default CartSummary;
