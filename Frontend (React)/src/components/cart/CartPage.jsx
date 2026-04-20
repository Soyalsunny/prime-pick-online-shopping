import { useEffect, useState } from "react";
import CartItem from "./CartItem";
import CartSummary from "./CartSummary";
import api from "../../api";
import Spinner from "../ui/Spinner";
import useCartData from "../../hooks/useCartData";

const CartPage = ({ setNumCartItems }) => {
 
  const {cartItems, setCartItems, cartTotal, setCartTotal, tax, loading} = useCartData()

  //Loading spinner
  if(loading){
    return <Spinner loading={loading} />
  }

  if (cartItems.length < 1) {
    return (
      <div
        className="d-flex justify-content-center align-items-start"
        style={{ minHeight: "85.5vh", paddingTop: "100px" }}
      >
        <div className="alert alert-primary" role="alert">
          You haven't added any item to your cart!
        </div>
      </div>
    );
  }

  return (
    <div
      className="d-flex justify-content-center align-items-start"
      style={{ minHeight: "100vh", paddingTop: "100px" }}
    >
      <div
        className="container my-3"
        style={{ height: "80vh", overflow: "scroll" }}
      >
        <h5
          className="mb-4"
          style={{
            fontSize: "2rem",
            fontWeight: "bold",
            color: "#6050DC",
            textAlign: "center",
            textTransform: "uppercase",
            letterSpacing: "2px",
            padding: "10px 0",
            borderBottom: "3px solid #6050DC",
            boxShadow: "0 4px 6px rgba(0,0,0,0.1)",
            textShadow: "2px 2px 4px rgba(0, 0, 0, 0.2)",
          }}
        >
          Shopping Cart
        </h5>

        <div className="row">
          <div className="col-md-8">
            {cartItems.map((item) => (
              <CartItem
                key={item.id}
                item={item}
                cartItems={cartItems}
                setCartTotal={setCartTotal}
                setNumCartItems={setNumCartItems}
                setCartItems={setCartItems}
              />
            ))}
          </div>
          <CartSummary cartTotal={cartTotal} tax={tax} />
        </div>
      </div>
    </div>
  );
};

export default CartPage;
