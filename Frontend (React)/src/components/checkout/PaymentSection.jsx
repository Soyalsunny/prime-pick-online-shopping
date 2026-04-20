import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { toast } from 'react-toastify'

import api from '../../api'
import styles from './PaymentSection.module.css'

const PaymentSection = ({ cartItems, setCartItems, setCartTotal, tax, setNumCartItems, loading }) => {
    const MAX_PAYMENT_RETRIES = 2
    const [placingOrder, setPlacingOrder] = useState(false)
    const [retryCount, setRetryCount] = useState(0)
    const [paymentNotice, setPaymentNotice] = useState('')
    const [confirmingPayment, setConfirmingPayment] = useState(false)
    const [addresses, setAddresses] = useState([])
    const [addressLoading, setAddressLoading] = useState(false)
    const [addressMode, setAddressMode] = useState('saved')
    const [selectedAddressId, setSelectedAddressId] = useState(null)
    const [saveNewAddress, setSaveNewAddress] = useState(true)
    const [setAsDefault, setSetAsDefault] = useState(true)
    const [newAddress, setNewAddress] = useState({
        label: '',
        full_name: '',
        phone: '',
        address_line1: '',
        address_line2: '',
        town_city: '',
        county: '',
        eircode: '',
        country: 'Ireland',
    })
    const [addressErrors, setAddressErrors] = useState({})

    const navigate = useNavigate()
    const cartCode = localStorage.getItem('cart_code')
    const retryStorageKey = cartCode ? `stripe_retry_${cartCode}` : null

    const getStoredRetryCount = () => {
        if (!retryStorageKey) return 0
        const parsed = Number(localStorage.getItem(retryStorageKey) || 0)
        return Number.isNaN(parsed) ? 0 : parsed
    }

    const getIdempotencyKey = () => {
        if (window.crypto && window.crypto.randomUUID) {
            return window.crypto.randomUUID()
        }
        return `${Date.now()}-${Math.random().toString(36).slice(2)}`
    }

    const orderTotal = useMemo(
        () => (Number(tax) + cartItems.reduce((sum, item) => sum + Number(item.total), 0)).toFixed(2),
        [cartItems, tax]
    )

    useEffect(() => {
        if (!retryStorageKey) return
        setRetryCount(getStoredRetryCount())
    }, [retryStorageKey])

    useEffect(() => {
        const params = new URLSearchParams(window.location.search)
        const paymentResult = params.get('payment')
        const sessionId = params.get('session_id')

        if (!paymentResult) return

        const clearQueryParams = () => {
            window.history.replaceState({}, document.title, '/checkout')
        }

        if (paymentResult === 'failed') {
            const currentRetry = getStoredRetryCount()
            const updatedRetry = Math.min(currentRetry + 1, MAX_PAYMENT_RETRIES)
            if (retryStorageKey) {
                localStorage.setItem(retryStorageKey, String(updatedRetry))
            }
            setRetryCount(updatedRetry)

            if (updatedRetry >= MAX_PAYMENT_RETRIES) {
                const message = 'Payment failed 2 times. Order was not placed. Items remain in your cart.'
                setPaymentNotice(message)
                toast.error(message)
            } else {
                const message = `Payment failed. Retry ${updatedRetry}/${MAX_PAYMENT_RETRIES}.`
                setPaymentNotice(message)
                toast.warning(message)
            }
            clearQueryParams()
            return
        }

        if (paymentResult === 'success' && sessionId) {
            const confirmStatus = async () => {
                try {
                    setConfirmingPayment(true)
                    const res = await api.get(`payments/stripe/session-status/?session_id=${encodeURIComponent(sessionId)}`)
                    if (res.data?.order_created) {
                        if (retryStorageKey) {
                            localStorage.removeItem(retryStorageKey)
                        }
                        setRetryCount(0)
                        setCartItems([])
                        setCartTotal(0)
                        setNumCartItems(0)
                        setPaymentNotice('Transaction successful. Order placed successfully.')
                        toast.success('Transaction successful. Order placed successfully.')
                        clearQueryParams()
                        navigate('/', { replace: true })
                        return
                    }

                    setPaymentNotice('Payment is processing. Please refresh this page in a few seconds.')
                    toast.info('Payment is processing. Order confirmation will appear shortly.')
                    clearQueryParams()
                } catch (err) {
                    setPaymentNotice('Unable to verify payment status right now. Please retry from checkout.')
                    toast.error('Unable to verify payment status.')
                    clearQueryParams()
                } finally {
                    setConfirmingPayment(false)
                }
            }

            confirmStatus()
        }
    }, [navigate, retryStorageKey, setCartItems, setCartTotal, setNumCartItems])

    useEffect(() => {
        const fetchAddresses = async () => {
            try {
                setAddressLoading(true)
                const res = await api.get('addresses/')
                const fetched = Array.isArray(res.data) ? res.data : []
                setAddresses(fetched)

                if (fetched.length === 0) {
                    setAddressMode('new')
                    setSelectedAddressId(null)
                    return
                }

                const defaultAddress = fetched.find((item) => item.is_default) || fetched[0]
                setSelectedAddressId(defaultAddress.id)
                setAddressMode('saved')
            } catch (err) {
                toast.error('Failed to load saved addresses.')
                setAddressMode('new')
            } finally {
                setAddressLoading(false)
            }
        }

        fetchAddresses()
    }, [])

    const handleNewAddressChange = (event) => {
        const { name, value } = event.target
        setNewAddress((prev) => ({ ...prev, [name]: value }))
        setAddressErrors((prev) => ({ ...prev, [name]: '' }))
    }

    const validateNewAddress = () => {
        const errors = {}
        if (!newAddress.full_name.trim()) errors.full_name = 'Full name is required.'
        if (!newAddress.phone.trim()) errors.phone = 'Phone is required.'
        if (!newAddress.address_line1.trim()) errors.address_line1 = 'Address line 1 is required.'
        if (!newAddress.town_city.trim()) errors.town_city = 'Town / City is required.'
        if (!newAddress.county.trim()) errors.county = 'County is required.'

        const normalizedEircode = newAddress.eircode.replace(/\s+/g, '').toUpperCase()
        if (!normalizedEircode) {
            errors.eircode = 'Eircode is required.'
        } else if (normalizedEircode.length < 6 || normalizedEircode.length > 7) {
            errors.eircode = 'Enter a valid Eircode.'
        }

        setAddressErrors(errors)
        return Object.keys(errors).length === 0
    }

    const markAddressAsDefault = async () => {
        if (!selectedAddressId) return
        try {
            await api.patch(`addresses/${selectedAddressId}/set_default/`)
            setAddresses((prev) =>
                prev.map((item) => ({ ...item, is_default: item.id === selectedAddressId }))
            )
            toast.success('Default address updated.')
        } catch (err) {
            toast.error('Failed to set default address.')
        }
    }

    const handlePlaceOrder = async (paymentMethod) => {
        if (!cartItems.length || !cartCode) {
            toast.error('Your cart is empty.')
            return
        }

        const payload = {
            cart_code: cartCode,
            payment_method: paymentMethod,
        }

        if (addressMode === 'saved') {
            if (!selectedAddressId) {
                toast.error('Please select a saved address or add a new address.')
                return
            }
            payload.address_id = selectedAddressId
        } else {
            if (!validateNewAddress()) {
                toast.error('Please complete the delivery address form.')
                return
            }

            payload.shipping_address = {
                ...newAddress,
                country: 'Ireland',
                eircode: newAddress.eircode.replace(/\s+/g, '').toUpperCase(),
                is_default: setAsDefault,
            }
            payload.save_shipping_address = saveNewAddress
        }

        try {
            setPlacingOrder(true)

            if (paymentMethod === 'Card') {
                const effectiveRetryCount = getStoredRetryCount()
                if (effectiveRetryCount >= MAX_PAYMENT_RETRIES) {
                    toast.error('Maximum payment retries reached. Order not placed, items remain in cart.')
                    return
                }
                const idempotencyKey = getIdempotencyKey()
                const res = await api.post('payments/stripe/create-session/', payload, {
                    headers: {
                        'Idempotency-Key': idempotencyKey,
                    },
                })

                if (res.data?.checkout_url) {
                    setPaymentNotice('Redirecting to secure payment...')
                    window.location.href = res.data.checkout_url
                    return
                }

                toast.error('Unable to start secure card checkout.')
                return
            }

            const res = await api.post('checkout/', payload)
            setCartItems([])
            setCartTotal(0)
            setNumCartItems(0)
            toast.success(res.data.message || 'Order placed successfully!')
            navigate('/')
        } catch (err) {
            const message = err.response?.data?.error || err.response?.data?.detail || 'Failed to place order.'
            toast.error(message)
        } finally {
            setPlacingOrder(false)
        }
    }

  return (
    <div className='col-md-4'>
        <div className={`card ${styles.card}`}>
            <div className='card-header' style={{ backgroundColor: '#6050DC', color: 'white' }}>
                <h5>Delivery & Payment</h5>
            </div>
            <div className='card-body'>
                <p className='text-muted small'>Ireland delivery address is required before payment.</p>

                <div className='mb-3'>
                    <div className={styles.addressModeRow}>
                        <button
                            type='button'
                            className={`btn btn-sm ${addressMode === 'saved' ? 'btn-primary' : 'btn-outline-primary'}`}
                            disabled={addresses.length === 0}
                            onClick={() => setAddressMode('saved')}
                        >
                            Saved Address
                        </button>
                        <button
                            type='button'
                            className={`btn btn-sm ${addressMode === 'new' ? 'btn-primary' : 'btn-outline-primary'}`}
                            onClick={() => setAddressMode('new')}
                        >
                            Add Address
                        </button>
                    </div>
                </div>

                {addressLoading && (
                    <div className='text-center py-2'>
                        <div className='spinner-border spinner-border-sm text-primary' role='status' />
                    </div>
                )}

                {!addressLoading && addressMode === 'saved' && (
                    <div className={styles.savedAddressWrap}>
                        {addresses.length === 0 ? (
                            <p className='text-muted small mb-2'>No saved addresses found. Please add a new address.</p>
                        ) : (
                            <>
                                {addresses.map((address) => (
                                    <label key={address.id} className={styles.addressCard}>
                                        <input
                                            type='radio'
                                            name='saved-address'
                                            checked={selectedAddressId === address.id}
                                            onChange={() => setSelectedAddressId(address.id)}
                                        />
                                        <div>
                                            <p className={styles.addressName}>
                                                {address.label || 'Address'} {address.is_default ? <span className={styles.defaultPill}>Default</span> : null}
                                            </p>
                                            <p className='mb-1 small'>{address.full_name} • {address.phone}</p>
                                            <p className='mb-0 small text-muted'>
                                                {address.address_line1}
                                                {address.address_line2 ? `, ${address.address_line2}` : ''}, {address.town_city}, {address.county}, {address.eircode}, Ireland
                                            </p>
                                        </div>
                                    </label>
                                ))}

                                <button
                                    type='button'
                                    className='btn btn-link btn-sm p-0 mt-1'
                                    onClick={markAddressAsDefault}
                                    disabled={!selectedAddressId}
                                >
                                    Set selected as default
                                </button>
                            </>
                        )}
                    </div>
                )}

                {!addressLoading && addressMode === 'new' && (
                    <div className={styles.newAddressWrap}>
                        <div className='mb-2'>
                            <label className='form-label mb-1'>Label (optional)</label>
                            <input
                                type='text'
                                name='label'
                                className='form-control form-control-sm'
                                placeholder='Home / Work'
                                value={newAddress.label}
                                onChange={handleNewAddressChange}
                            />
                        </div>

                        <div className='mb-2'>
                            <label className='form-label mb-1'>Full Name *</label>
                            <input
                                type='text'
                                name='full_name'
                                className={`form-control form-control-sm ${addressErrors.full_name ? 'is-invalid' : ''}`}
                                value={newAddress.full_name}
                                onChange={handleNewAddressChange}
                            />
                            {addressErrors.full_name ? <div className='invalid-feedback'>{addressErrors.full_name}</div> : null}
                        </div>

                        <div className='mb-2'>
                            <label className='form-label mb-1'>Phone *</label>
                            <input
                                type='text'
                                name='phone'
                                className={`form-control form-control-sm ${addressErrors.phone ? 'is-invalid' : ''}`}
                                value={newAddress.phone}
                                onChange={handleNewAddressChange}
                            />
                            {addressErrors.phone ? <div className='invalid-feedback'>{addressErrors.phone}</div> : null}
                        </div>

                        <div className='mb-2'>
                            <label className='form-label mb-1'>Address Line 1 *</label>
                            <input
                                type='text'
                                name='address_line1'
                                className={`form-control form-control-sm ${addressErrors.address_line1 ? 'is-invalid' : ''}`}
                                value={newAddress.address_line1}
                                onChange={handleNewAddressChange}
                            />
                            {addressErrors.address_line1 ? <div className='invalid-feedback'>{addressErrors.address_line1}</div> : null}
                        </div>

                        <div className='mb-2'>
                            <label className='form-label mb-1'>Address Line 2</label>
                            <input
                                type='text'
                                name='address_line2'
                                className='form-control form-control-sm'
                                value={newAddress.address_line2}
                                onChange={handleNewAddressChange}
                            />
                        </div>

                        <div className='row g-2'>
                            <div className='col-6'>
                                <label className='form-label mb-1'>Town / City *</label>
                                <input
                                    type='text'
                                    name='town_city'
                                    className={`form-control form-control-sm ${addressErrors.town_city ? 'is-invalid' : ''}`}
                                    value={newAddress.town_city}
                                    onChange={handleNewAddressChange}
                                />
                                {addressErrors.town_city ? <div className='invalid-feedback'>{addressErrors.town_city}</div> : null}
                            </div>
                            <div className='col-6'>
                                <label className='form-label mb-1'>County *</label>
                                <input
                                    type='text'
                                    name='county'
                                    className={`form-control form-control-sm ${addressErrors.county ? 'is-invalid' : ''}`}
                                    value={newAddress.county}
                                    onChange={handleNewAddressChange}
                                />
                                {addressErrors.county ? <div className='invalid-feedback'>{addressErrors.county}</div> : null}
                            </div>
                            <div className='col-6'>
                                <label className='form-label mb-1'>Eircode *</label>
                                <input
                                    type='text'
                                    name='eircode'
                                    className={`form-control form-control-sm ${addressErrors.eircode ? 'is-invalid' : ''}`}
                                    value={newAddress.eircode}
                                    onChange={handleNewAddressChange}
                                />
                                {addressErrors.eircode ? <div className='invalid-feedback'>{addressErrors.eircode}</div> : null}
                            </div>
                            <div className='col-6'>
                                <label className='form-label mb-1'>Country</label>
                                <input type='text' className='form-control form-control-sm' value='Ireland' readOnly />
                            </div>
                        </div>

                        <div className='form-check mt-2'>
                            <input
                                type='checkbox'
                                className='form-check-input'
                                id='save-address'
                                checked={saveNewAddress}
                                onChange={(e) => setSaveNewAddress(e.target.checked)}
                            />
                            <label className='form-check-label small' htmlFor='save-address'>
                                Save this address for next checkout
                            </label>
                        </div>

                        {saveNewAddress && (
                            <div className='form-check mt-1'>
                                <input
                                    type='checkbox'
                                    className='form-check-input'
                                    id='set-default-address'
                                    checked={setAsDefault}
                                    onChange={(e) => setSetAsDefault(e.target.checked)}
                                />
                                <label className='form-check-label small' htmlFor='set-default-address'>
                                    Set as default delivery address
                                </label>
                            </div>
                        )}
                    </div>
                )}

                <hr />

                <p className='text-muted small'>Place the order now and track it from your profile page.</p>

                {paymentNotice && (
                    <div className='alert alert-info py-2'>{paymentNotice}</div>
                )}

                                <button
                                        className={`btn btn-primary w-100 mb-3 ${styles.paypalButton}`}
                                        id='paypal-button'
                                        onClick={() => handlePlaceOrder('PayPal')}
                                        disabled={loading || placingOrder || addressLoading || cartItems.length === 0}
                                >
                                        <i className='bi bi-paypal'></i> {placingOrder ? 'Placing Order...' : 'Pay with PayPal'}
                </button>

                                <button
                                    className={`btn w-100 mb-3 ${styles.codButton}`}
                                    id='cod-button'
                                    onClick={() => handlePlaceOrder('Cash on Delivery')}
                                    disabled={loading || placingOrder || confirmingPayment || addressLoading || cartItems.length === 0}
                                >
                                    <i className='bi bi-cash-stack'></i> {placingOrder ? 'Placing Order...' : 'Cash on Delivery'}
                        </button>

                                <button
                                        className={`btn btn-warning w-100 mb-3 ${styles.flutterwaveButton}`}
                                        id='flutterwave-button'
                                        onClick={() => handlePlaceOrder('Card')}
                                        disabled={loading || placingOrder || confirmingPayment || addressLoading || cartItems.length === 0 || retryCount >= MAX_PAYMENT_RETRIES}
                                >
                                        <i className='bi bi-credit-card'></i> {placingOrder || confirmingPayment ? 'Processing...' : 'Pay with Credit Card'}
                </button>

                            <p className='small text-muted mb-2'>Card payment retries used: {retryCount}/{MAX_PAYMENT_RETRIES}</p>

                                    <p className='mb-0 fw-semibold'>Order total: ${orderTotal}</p>
            </div>
        </div>
    </div>
  )
}

export default PaymentSection