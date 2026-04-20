import useCartData from '../../hooks/useCartData'
import OrderSummary from './OrderSummary'
import PaymentSection from './PaymentSection'

const CheckoutPage = ({ setNumCartItems }) => {

  const {cartItems, setCartItems, cartTotal, setCartTotal, tax, loading} = useCartData()

  return (
    <div className='container my-3' style={{ minHeight: "100vh", paddingTop: "100px" }}>
      <div className='row'>
        <OrderSummary cartItems={cartItems} cartTotal={cartTotal} tax={tax}/>
        <PaymentSection
          cartItems={cartItems}
          setCartItems={setCartItems}
          setCartTotal={setCartTotal}
          tax={tax}
          setNumCartItems={setNumCartItems}
          loading={loading}
        />
      </div>
    </div>
  )
}

export default CheckoutPage