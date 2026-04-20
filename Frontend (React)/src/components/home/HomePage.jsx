import Header from "./Header";
import CardContainer from "./CardContainer";
import api from "../../api";
import { useEffect, useState } from "react";
import PlaceHolderContainer from "../ui/PlaceHolderContainer";
import Error from "../ui/Error";
import { randomValue } from "../../GenerateCartCode";

const HomePage = () => {

  const [products, setProducts] = useState([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState("")

  useEffect(function(){
    if(localStorage.getItem("cart_code") === null){
      localStorage.setItem("cart_code", randomValue)
    }
  }, [])

  useEffect(function () {
    setLoading(true)
    setError("") // Clear previous errors
    api.get("/products")
    .then((res) => {
      setProducts(res.data)
      setError("") // Clear any errors on success
      setLoading(false)
    })
    .catch(err => {
      const statusCode = err?.response?.status
      const responseError = err?.response?.data?.error
      const details = responseError || err?.message || "Unknown error"
      console.error('Failed to load products:', { statusCode, details, url: err?.config?.url, baseURL: err?.config?.baseURL })
      setLoading(false)
      setError(`Failed to load products. ${statusCode ? `Status ${statusCode}: ` : ''}${details}`)
    })
  }, []);

  return (
    <>
      <Header />
      {error && <Error error={error} />}
      {loading && <PlaceHolderContainer />}
      {!loading && !error && products.length > 0 && <CardContainer products={products} />}
      {!loading && !error && products.length === 0 && <div className="container my-5"><p className="text-center">No products available yet.</p></div>}
    </>
  );
};

export default HomePage;
