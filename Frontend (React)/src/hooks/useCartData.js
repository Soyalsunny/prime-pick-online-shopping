import { useState, useEffect } from "react";
import api from "../api";

function useCartData() {
  const cart_token = localStorage.getItem("cart_token");
  const [cartItems, setCartItems] = useState([]);
  const [cartTotal, setCartTotal] = useState(0.0);
  const tax = 4.0;
  const [loading, setLoading] = useState(false);

  useEffect(function () {
    setLoading(true);
    api
      .get(`get_cart`)
      .then((res) => {
        console.log(res.data);
        setLoading(false);
        setCartItems(res.data.items);
        setCartTotal(res.data.sum_total);
      })

      .catch((err) => {
        console.log(err.message);
        setLoading(false);
      });
  }, [cart_token]);

  return {cartItems, setCartItems, cartTotal, setCartTotal, tax, loading}
}

export default useCartData
