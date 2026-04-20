import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import api from "../../api";
import styles from "./AdminDashboard.module.css";

const StatCard = ({ label, value, sub, color }) => (
  <div className={styles.card} style={{ borderTopColor: color }}>
    <p className={styles.cardLabel}>{label}</p>
    <p className={styles.cardValue} style={{ color }}>
      {value}
    </p>
    {sub && <p className={styles.cardSub}>{sub}</p>}
  </div>
);

const AdminDashboard = () => {
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    api
      .get("admin-api/stats")
      .then((res) => setStats(res.data))
      .catch(() => setError("Failed to load stats."))
      .finally(() => setLoading(false));
  }, []);

  if (loading)
    return (
      <div className="text-center py-5">
        <div className="spinner-border text-primary" />
      </div>
    );

  if (error) return <div className="alert alert-danger">{error}</div>;

  return (
    <div>
      <h2 className={styles.pageTitle}>Dashboard</h2>
      <p className={styles.pageSubtitle}>Welcome back! Here&#39;s an overview of your store.</p>

      <div className={styles.grid}>
        <StatCard
          label="Total Products"
          value={stats.total_products}
          sub={`${stats.out_of_stock} out of stock`}
          color="#4f46e5"
        />
        <StatCard
          label="Total Orders"
          value={stats.total_orders}
          sub={`${stats.pending_orders} pending`}
          color="#0891b2"
        />
        <StatCard
          label="Total Revenue"
          value={`$${stats.revenue.toFixed(2)}`}
          sub="Excluding cancelled orders"
          color="#059669"
        />
        <StatCard
          label="Out of Stock"
          value={stats.out_of_stock}
          sub="Products with stock = 0"
          color="#dc2626"
        />
      </div>

      <div className={styles.quickLinks}>
        <h3 className={styles.sectionTitle}>Quick Actions</h3>
        <div className={styles.linkRow}>
          <Link to="/admin-panel/products" className={styles.quickBtn}>
            Manage Products
          </Link>
          <Link to="/admin-panel/orders" className={styles.quickBtn}>
            View All Orders
          </Link>
        </div>
      </div>
    </div>
  );
};

export default AdminDashboard;
