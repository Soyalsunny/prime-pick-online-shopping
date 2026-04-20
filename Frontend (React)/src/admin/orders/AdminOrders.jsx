import { useCallback, useEffect, useState } from "react";
import api from "../../api";
import styles from "./AdminOrders.module.css";

const STATUS_CHOICES = ["Pending", "Processing", "Shipped", "Delivered", "Cancelled"];

const STATUS_COLORS = {
  Pending: styles.statusPending,
  Processing: styles.statusProcessing,
  Shipped: styles.statusShipped,
  Delivered: styles.statusDelivered,
  Cancelled: styles.statusCancelled,
};

const formatDate = (d) => (d ? new Date(d).toLocaleDateString() : "—");
const formatCurrency = (v) => Number(v || 0).toFixed(2);

const AdminOrders = () => {
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [filter, setFilter] = useState("All");
  const [updatingId, setUpdatingId] = useState(null);
  const [expandedId, setExpandedId] = useState(null);

  const fetchOrders = useCallback(() => {
    setLoading(true);
    setError("");
    api
      .get("admin-api/orders")
      .then((res) => setOrders(res.data))
      .catch(() => setError("Failed to load orders."))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    fetchOrders();
  }, [fetchOrders]);

  const handleStatusChange = async (orderId, newStatus) => {
    setUpdatingId(orderId);
    try {
      const res = await api.patch(`admin-api/orders/${orderId}/status/`, {
        status: newStatus,
      });
      setOrders((prev) =>
        prev.map((o) => (o.id === orderId ? res.data : o))
      );
    } catch {
      alert("Failed to update status.");
    } finally {
      setUpdatingId(null);
    }
  };

  const filtered =
    filter === "All" ? orders : orders.filter((o) => o.status === filter);

  return (
    <div>
      <div className={styles.header}>
        <div>
          <h2 className={styles.pageTitle}>Orders</h2>
          <p className={styles.pageSubtitle}>{orders.length} total orders</p>
        </div>
        <div className={styles.filters}>
          {["All", ...STATUS_CHOICES].map((s) => (
            <button
              key={s}
              className={`${styles.filterBtn} ${filter === s ? styles.filterActive : ""}`}
              onClick={() => setFilter(s)}
            >
              {s}
              {s !== "All" && (
                <span className={styles.filterCount}>
                  {orders.filter((o) => o.status === s).length}
                </span>
              )}
            </button>
          ))}
        </div>
      </div>

      {error && <div className="alert alert-danger">{error}</div>}

      {loading ? (
        <div className="text-center py-5">
          <div className="spinner-border text-primary" />
        </div>
      ) : (
        <div className={styles.tableWrapper}>
          <table className={styles.table}>
            <thead>
              <tr>
                <th>Order #</th>
                <th>Customer</th>
                <th>Date</th>
                <th>Items</th>
                <th>Total</th>
                <th>Tracking #</th>
                <th>Status</th>
                <th>Update Status</th>
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 && (
                <tr>
                  <td colSpan={8} className={styles.empty}>
                    No orders found for this filter.
                  </td>
                </tr>
              )}
              {filtered.map((order) => (
                <>
                  <tr
                    key={order.id}
                    className={styles.row}
                    onClick={() =>
                      setExpandedId((prev) => (prev === order.id ? null : order.id))
                    }
                  >
                    <td className={styles.orderNum}>{order.order_number}</td>
                    <td>{order.full_name || "—"}</td>
                    <td>{formatDate(order.created_at)}</td>
                    <td>{order.items?.length || 0}</td>
                    <td>${formatCurrency(order.total_amount)}</td>
                    <td>
                      {order.tracking_number ? (
                        <span className={styles.trackNum}>{order.tracking_number}</span>
                      ) : (
                        <span className={styles.noTrack}>—</span>
                      )}
                    </td>
                    <td>
                      <span className={`${styles.statusBadge} ${STATUS_COLORS[order.status] || ""}`}>
                        {order.status}
                      </span>
                    </td>
                    <td onClick={(e) => e.stopPropagation()}>
                      <select
                        className={styles.statusSelect}
                        value={order.status}
                        disabled={updatingId === order.id}
                        onChange={(e) => handleStatusChange(order.id, e.target.value)}
                      >
                        {STATUS_CHOICES.map((s) => (
                          <option key={s} value={s}>
                            {s}
                          </option>
                        ))}
                      </select>
                    </td>
                  </tr>
                  {expandedId === order.id && (
                    <tr key={`${order.id}-expand`} className={styles.expandRow}>
                      <td colSpan={8}>
                        <div className={styles.expandContent}>
                          <div className={styles.expandLeft}>
                            <p className={styles.expandLabel}>Delivery Address</p>
                            <p>{order.full_name}</p>
                            <p>{order.address}</p>
                            <p>
                              {order.city}, {order.state}
                            </p>
                            <p>{order.phone}</p>
                            <p>{order.email}</p>
                          </div>
                          <div className={styles.expandRight}>
                            <p className={styles.expandLabel}>Items</p>
                            {order.items?.map((item) => (
                              <div key={item.id} className={styles.itemRow}>
                                <span className={styles.itemName}>{item.product_name}</span>
                                <span className={styles.itemQty}>×{item.quantity}</span>
                                <span>${formatCurrency(item.subtotal)}</span>
                              </div>
                            ))}
                            <div className={styles.itemTotal}>
                              Total: ${formatCurrency(order.total_amount)}
                            </div>
                          </div>
                        </div>
                      </td>
                    </tr>
                  )}
                </>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
};

export default AdminOrders;
