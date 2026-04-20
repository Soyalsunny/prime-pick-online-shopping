import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";

import api, { BASE_URL } from "../../api";
import Error from "../ui/Error";
import Spinner from "../ui/Spinner";
import styles from "./OrderTrackingPage.module.css";

const formatDate = (value) => {
  if (!value) {
    return "Pending update";
  }

  return new Date(value).toLocaleString();
};

const formatCurrency = (value) => Number(value || 0).toFixed(2);

const getPaymentLabel = (paymentStatus) => {
  switch (paymentStatus) {
    case "succeeded":
      return "Paid";
    case "failed":
      return "Failed";
    case "expired":
      return "Expired";
    case "created":
      return "Pending";
    default:
      return "N/A";
  }
};

const OrderTrackingPage = () => {
  const { orderId } = useParams();
  const [order, setOrder] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    const fetchOrder = async () => {
      try {
        setLoading(true);
        setError("");
        const res = await api.get(`orders/${orderId}/`);
        setOrder(res.data);
      } catch (err) {
        console.error(err);
        setError("Failed to load tracking details.");
      } finally {
        setLoading(false);
      }
    };

    fetchOrder();
  }, [orderId]);

  if (loading) {
    return <Spinner loading={loading} />;
  }

  return (
    <section className={styles.page}>
      <div className="container">
        {error && <Error message={error} />}

        {order && (
          <>
            <div className={styles.headerCard}>
              <div>
                <p className={styles.eyebrow}>Track your order</p>
                <h1 className={styles.title}>{order.order_number}</h1>
                <p className={styles.subtitle}>
                  Current status: <strong>{order.status}</strong>
                </p>
                <p className={styles.paymentLine}>
                  Payment:
                  <span className={`${styles.paymentBadge} ${styles[`payment_${order.payment_status}`] || styles.payment_not_required}`}>
                    {getPaymentLabel(order.payment_status)}
                  </span>
                </p>
                {order.tracking_number && (
                  <p className={styles.trackingBadge}>
                    Tracking #: <strong>{order.tracking_number}</strong>
                  </p>
                )}
              </div>
              <div className={styles.headerMeta}>
                <p>Placed on {formatDate(order.created_at)}</p>
                <p>Total: ${formatCurrency(order.total_amount)}</p>
                <Link to="/profile" className="btn btn-outline-dark btn-sm">
                  Back to Profile
                </Link>
              </div>
            </div>

            <div className={styles.progressCard}>
              <div className={styles.progressBarTrack}>
                <div
                  className={styles.progressBarFill}
                  style={{ width: `${order.progress_percent || 0}%` }}
                />
              </div>

              <div className={styles.steps}>
                {order.tracking_steps?.map((step) => (
                  <div key={step.key} className={styles.step}>
                    <div
                      className={`${styles.dot} ${step.completed ? styles.dotCompleted : ""} ${step.active ? styles.dotActive : ""}`}
                    />
                    <h5 className={styles.stepLabel}>{step.label}</h5>
                    <p className={styles.stepDate}>{formatDate(step.timestamp)}</p>
                  </div>
                ))}
              </div>
            </div>

            <div className="row g-4 mt-1">
              <div className="col-lg-8">
                <div className={styles.card}>
                  <h3 className={styles.cardTitle}>Items in this order</h3>
                  {order.items.map((item) => (
                    <div className={styles.itemRow} key={item.id}>
                      <img
                        src={item.product_image ? `${BASE_URL}/${item.product_image}` : "https://via.placeholder.com/100x100?text=Item"}
                        alt={item.product_name}
                        className={styles.itemImage}
                      />
                      <div className={styles.itemInfo}>
                        <Link to={`/products/${item.product_slug}`} className={styles.itemName}>
                          {item.product_name}
                        </Link>
                        <p>Quantity: {item.quantity}</p>
                        <p>Unit Price: ${formatCurrency(item.product_price)}</p>
                        <p>Subtotal: ${formatCurrency(item.subtotal)}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <div className="col-lg-4">
                <div className={styles.card}>
                  <h3 className={styles.cardTitle}>Delivery details</h3>
                  <p><strong>Name:</strong> {order.full_name}</p>
                  <p><strong>Email:</strong> {order.email}</p>
                  <p><strong>Phone:</strong> {order.phone || "-"}</p>
                  <p><strong>Address:</strong> {order.address || "-"}</p>
                  <p><strong>City:</strong> {order.city || "-"}</p>
                  <p><strong>State:</strong> {order.state || "-"}</p>
                </div>
              </div>
            </div>
          </>
        )}
      </div>
    </section>
  );
};

export default OrderTrackingPage;
