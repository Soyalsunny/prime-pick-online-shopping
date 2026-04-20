import { useState } from "react";
import api, { BASE_URL } from "../../api";
import { toast } from "react-toastify";

const CartItem = ({
  item,
  setCartTotal,
  cartItems,
  setNumCartItems,
  setCartItems,
}) => {
  const [quantity, setQuantity] = useState(item.quantity);
  const [loading, setLoading] = useState(false);
  const cartCode = localStorage.getItem("cart_code");
  const itemData = { quantity: quantity, item_id: item.id, cart_code: cartCode };
  const itemId = { item_id: item.id };

  function deleteCartItem() {
    const confirmDelete = window.confirm(
      "Are you want to delete this cart item?"
    );
    console.log(itemId);

    if (confirmDelete) {
      api
        .post("delete_cartitem/", itemId)
        .then((res) => {
          console.log(res.data);
          toast.success("Cart Item deleted successfully!");
          
          setCartItems(cartItems.filter((CartItem) => CartItem.id != item.id)); //Filter cart items

          setCartTotal(
            cartItems
              .filter((CartItem) => CartItem.id != item.id)
              .reduce((acc, curr) => acc + curr.total, 0)
          );

          setNumCartItems(
            cartItems
              .filter((CartItem) => CartItem.id != item.id)
              .reduce((acc, curr) => acc + curr.quantity, 0)
          );
        })

        .catch((err) => {
          console.log(err.message);
        });
    }
  }

  function updateCartitem() {
    const parsedQuantity = Number.parseInt(quantity, 10);

    if (!cartCode) {
      toast.error("Cart not found. Please refresh and try again.");
      return;
    }

    if (Number.isNaN(parsedQuantity) || parsedQuantity < 1) {
      toast.error("Quantity must be at least 1.");
      return;
    }

    if (parsedQuantity === item.quantity) {
      toast.info("Quantity is unchanged.");
      return;
    }

    setLoading(true);
    api
      .patch("update_quantity/", { ...itemData, quantity: parsedQuantity })
      .then((res) => {
        setLoading(false);
        toast.success("Cart Item updated successfully!");

        const updatedCartItems = cartItems.map((CartItem) =>
          CartItem.id === item.id ? res.data.data : CartItem
        );

        setCartItems(updatedCartItems);

        setCartTotal(
          updatedCartItems.reduce((acc, curr) => acc + Number(curr.total), 0)
        );

        setNumCartItems(
          updatedCartItems.reduce((acc, curr) => acc + curr.quantity, 0)
        );
      })

      .catch((err) => {
        const message = err.response?.data?.error || "Failed to update cart item quantity.";
        toast.error(message);
        setLoading(false);
      });
  }

  return (
    <div
      className="cart-item d-flex align-items-center mb-3 p-3"
      style={{
        backgroundColor: "#ffffff",
        borderRadius: "10px",
        boxShadow: "0 4px 6px rgba(0, 0, 0, 0.1)",
        transition: "transform 0.2s ease, box-shadow 0.2s ease",
      }}
      onMouseEnter={(e) => {
        e.currentTarget.style.transform = "scale(1.02)";
        e.currentTarget.style.boxShadow = "0 6px 10px rgba(0, 0, 0, 0.15)";
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.transform = "scale(1)";
        e.currentTarget.style.boxShadow = "0 4px 6px rgba(0, 0, 0, 0.1)";
      }}
    >
      <img
        src={`${BASE_URL}${item.product.image}`}
        alt="Product"
        className="img-fluid"
        style={{
          width: "85px",
          height: "85px",
          objectFit: "cover",
          borderRadius: "8px",
          border: "2px solid #f0f0f0",
        }}
      />
      <div className="ms-3 flex-grow-1">
        <h5
          className="mb-1"
          style={{ fontSize: "1rem", fontWeight: "600", color: "#333" }}
        >
          {item.product.name}
        </h5>
        <p
          className="mb-0"
          style={{
            color: "#888",
            fontSize: "0.9rem",
            fontWeight: "500",
            padding: "2px 8px",
            backgroundColor: "#f8f8f8",
            borderRadius: "5px",
            display: "inline-block",
          }}
        >
          {`$${item.product.price}`}
        </p>
      </div>
      <div className="d-flex align-items-center">
        <input
          type="number"
          min="1"
          className="form-control me-3"
          value={quantity}
          onChange={(e) => setQuantity(e.target.value)} //Change quantity
          style={{
            width: "70px",
            textAlign: "center",
            border: "1px solid #ddd",
            borderRadius: "5px",
          }}
        />
        <button
          className="btn btn-primary btn-sm"
          onClick={updateCartitem} //Call updateCartitem function to update quantity
          style={{
            display: "flex",
            alignItems: "center",
            gap: "5px",
            fontSize: "0.85rem",
            padding: "5px 10px",
            marginRight: "10px",
          }}
          disabled={loading}
        >
          {loading ? (
            "Updating..."
          ) : (
            <>
              <i
                className="bi bi-arrow-repeat"
                style={{ fontSize: "1rem" }}
              ></i>{" "}
              Update Quantity
            </>
          )}
        </button>

        <button
          className="btn btn-danger btn-sm"
          onClick={deleteCartItem}
          style={{
            display: "flex",
            alignItems: "center",
            gap: "5px",
            fontSize: "0.85rem",
            padding: "5px 10px",
          }}
        >
          <i className="bi bi-trash" style={{ fontSize: "1rem" }}></i> Remove
        </button>
      </div>
    </div>
  );
};

export default CartItem;
