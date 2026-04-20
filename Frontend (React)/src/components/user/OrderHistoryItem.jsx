import { Link } from 'react-router-dom';

import { BASE_URL } from '../../api';
import api from '../../api';
import styles from './OrderHistoryItem.module.css';

const formatDate = (dateValue) => {
  if (!dateValue) {
    return 'N/A';
  }

  return new Date(dateValue).toLocaleString();
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

const OrderHistoryItem = ({ order, onCancelOrder, isCancelling }) => {
  const statusClassName = styles[order.status?.toLowerCase()] || '';
  const paymentClassName = styles[`payment_${order.payment_status}`] || styles.payment_not_required;

  const handleDownloadInvoice = async () => {
    try {
      const response = await api.get(`orders/${order.id}/invoice/`, {
        responseType: 'blob',
      });

      const blob = new Blob([response.data], { type: 'application/pdf' });
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `invoice-${order.order_number}.pdf`;
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
    } catch (error) {
      console.error('Failed to download invoice:', error);
    }
  };

  return (
    <div className={styles.container}>
      <div className={styles.card}>
        <div className={styles.header}>
          <div>
            <h2 className={styles.orderId}>Order ID: {order.order_number}</h2>
            {order.tracking_number && (
              <p className={styles.trackingNumber}>Tracking #: {order.tracking_number}</p>
            )}
            <p className={styles.date}>{formatDate(order.created_at)}</p>
          </div>
          <div className="text-end">
            <span className={`${styles.status} ${statusClassName}`}>
              {order.status}
            </span>
            <div className="mt-2">
              <span className={`${styles.paymentBadge} ${paymentClassName}`}>
                Payment: {getPaymentLabel(order.payment_status)}
              </span>
            </div>
            <div className="mt-2 fw-semibold">Total: ${formatCurrency(order.total_amount)}</div>
          </div>
        </div>

        <div className={styles.timelinePreview}>
          {order.tracking_steps?.map((step) => (
            <div key={step.key} className={styles.timelineStep}>
              <div
                className={`${styles.timelineDot} ${step.completed ? styles.timelineDotCompleted : ''} ${step.active ? styles.timelineDotActive : ''}`}
              />
              <span className={styles.timelineLabel}>{step.label}</span>
            </div>
          ))}
        </div>

        {order.items.map((item) => (
          <div className={styles.content} key={item.id}>
            <div className={styles.productImage}>
              <img
                src={item.product_image ? `${BASE_URL}/${item.product_image}` : 'https://via.placeholder.com/100x100?text=Item'}
                alt={item.product_name}
                className={styles.image}
              />
            </div>
            <div className={styles.details}>
              <p className={styles.itemName}>
                Item:{' '}
                {item.product_slug ? (
                  <Link to={`/products/${item.product_slug}`}>{item.product_name}</Link>
                ) : (
                  item.product_name
                )}
              </p>
              <p className={styles.quantity}>Quantity: {item.quantity}</p>
              <p className={styles.price}>Price: ${formatCurrency(item.product_price)}</p>
              <p className={styles.price}>Subtotal: ${formatCurrency(item.subtotal)}</p>
            </div>
          </div>
        ))}

        <div className={styles.footer}>
          <div className={styles.actionGroup}>
            <Link to={`/orders/${order.id}/track`} className="btn btn-outline-primary btn-sm">
              Track Order
            </Link>
            <button
              type="button"
              className="btn btn-outline-secondary btn-sm"
              onClick={handleDownloadInvoice}
            >
              Download Invoice
            </button>
          </div>
          {order.can_cancel && (
            <button
              className="btn btn-outline-danger btn-sm"
              onClick={() => onCancelOrder(order.id)}
              disabled={isCancelling}
            >
              {isCancelling ? 'Cancelling...' : 'Cancel Order'}
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

export default OrderHistoryItem;
