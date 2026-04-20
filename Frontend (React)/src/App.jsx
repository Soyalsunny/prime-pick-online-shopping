import { BrowserRouter, Routes, Route } from "react-router-dom"
import MainLayout from "./layout/MainLayout"
import HomePage from "./components/home/HomePage"
import NotFoundPage from "./components/ui/NotFoundPage"
import ProductPage from "./components/product/ProductPage"
import { useEffect, useState } from "react"
import api from "./api"
import CartPage from "./components/cart/CartPage"
import CheckoutPage from "./components/checkout/CheckoutPage"
import LoginPage from "./components/user/LoginPage"
import RegisterPage from "./components/user/RegisterPage"
import ProtectedRoute from "./components/ui/ProtectedRoute"
import { AuthProvider } from "./context/AuthContext"
import UserProfilePage from "./components/user/UserProfilePage"
import OrderTrackingPage from "./components/user/OrderTrackingPage"
import ShopPage from "./components/shop/ShopPage"
import AdminRoute from "./admin/AdminRoute"
import AdminLayout from "./admin/AdminLayout"
import AdminDashboard from "./admin/dashboard/AdminDashboard"
import AdminProducts from "./admin/products/AdminProducts"
import AdminOrders from "./admin/orders/AdminOrders"
import { ToastContainer } from "react-toastify"
import "react-toastify/ReactToastify.css"
import "./layout/ToastTheme.css"

const App = () => {

  const [numCartItems, setNumCartItems] = useState(0);
  const cart_code = localStorage.getItem("cart_code")

  useEffect(function(){
    if(cart_code){
      api.get(`get_cart_stat?cart_code=${cart_code}`)
      .then(res => {
        setNumCartItems(res.data.num_of_items)
      })

      .catch(err => {
        console.log(err.message)
        setNumCartItems(0)
      })
    } else {
      setNumCartItems(0)
    }
    
  }, [cart_code])

  return (
    <AuthProvider>
      <BrowserRouter>
      <ToastContainer
        position="top-center"
        autoClose={2500}
        hideProgressBar={false}
        newestOnTop
        closeOnClick
        pauseOnFocusLoss
        draggable
        pauseOnHover
        limit={3}
        theme="light"
      />
      <Routes>
          <Route path="/" element={<MainLayout numCartItems={numCartItems} setNumCartItems={setNumCartItems} />}>
            <Route index element={<HomePage />} />
            <Route path="shop" element={<ShopPage setNumCartItems={setNumCartItems} />} />
            <Route path="products/:slug" element={<ProductPage setNumCartItems={setNumCartItems} />} />
            <Route path="cart" element={<CartPage setNumCartItems={setNumCartItems} />} />
            <Route path="checkout" element={<ProtectedRoute><CheckoutPage setNumCartItems={setNumCartItems} /></ProtectedRoute>} />
            <Route path="login" element={<LoginPage />} />
            <Route path="register" element={<RegisterPage />} />
            <Route path="profile" element={<ProtectedRoute><UserProfilePage /></ProtectedRoute>} />
            <Route path="orders/:orderId/track" element={<ProtectedRoute><OrderTrackingPage /></ProtectedRoute>} />

            <Route path="*" element={<NotFoundPage />}></Route>
          </Route>

          {/* Admin Panel — own layout, no main navbar */}
          <Route
            path="admin-panel"
            element={
              <AdminRoute>
                <AdminLayout />
              </AdminRoute>
            }
          >
            <Route index element={<AdminDashboard />} />
            <Route path="products" element={<AdminProducts />} />
            <Route path="orders" element={<AdminOrders />} />
          </Route>
      </Routes>
      </BrowserRouter>
    </AuthProvider>
  )
}

export default App
