import UserInfo from "./UserInfo";
import OrderHistoryItemContainer from "./OrderHistoryItemContainer";
import { useContext, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { toast } from "react-toastify";

import api from "../../api";
import Error from "../ui/Error";
import Spinner from "../ui/Spinner";
import { AuthContext } from "../../context/AuthContext";

const UserProfilePage = () => {
  const [userInfo, setUserInfo] = useState({});
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [profileSaving, setProfileSaving] = useState(false);
  const [passwordSaving, setPasswordSaving] = useState(false);
  const [cancellingOrderId, setCancellingOrderId] = useState(null);
  const [passwordForm, setPasswordForm] = useState({
    current_password: "",
    new_password: "",
    confirm_password: "",
  });
  const { setIsAuthenticated, get_username } = useContext(AuthContext);
  const navigate = useNavigate();

  const fetchProfileData = async () => {
    try {
      setLoading(true);
      setError("");
      const [userRes, ordersRes] = await Promise.all([
        api.get("user_info"),
        api.get("orders/"),
      ]);
      setUserInfo(userRes.data);
      setOrders(ordersRes.data);
    } catch (err) {
      console.log(err.message);
      setError("Failed to load your profile.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(function () {
    fetchProfileData();
  }, []);

  const handleProfileChange = (e) => {
    const { name, value } = e.target;
    setUserInfo((current) => ({ ...current, [name]: value }));
  };

  const handlePasswordChange = (e) => {
    const { name, value } = e.target;
    setPasswordForm((current) => ({ ...current, [name]: value }));
  };

  const handleSaveProfile = async (e) => {
    e.preventDefault();
    try {
      setProfileSaving(true);
      const res = await api.patch("user_info", userInfo);
      setUserInfo(res.data);
      get_username();
      toast.success("Profile updated successfully!");
    } catch (err) {
      const message = err.response?.data?.email?.[0] || "Failed to update profile.";
      toast.error(message);
    } finally {
      setProfileSaving(false);
    }
  };

  const handleChangePassword = async (e) => {
    e.preventDefault();
    try {
      setPasswordSaving(true);
      const res = await api.post("change_password/", passwordForm);
      toast.success(res.data.message || "Password updated successfully.");
      setPasswordForm({ current_password: "", new_password: "", confirm_password: "" });
      localStorage.removeItem("access");
      localStorage.removeItem("refresh");
      setIsAuthenticated(false);
      navigate("/login", { replace: true });
    } catch (err) {
      const message =
        err.response?.data?.current_password?.[0] ||
        err.response?.data?.confirm_password?.[0] ||
        err.response?.data?.new_password?.[0] ||
        "Failed to update password.";
      toast.error(message);
    } finally {
      setPasswordSaving(false);
    }
  };

  const handleCancelOrder = async (orderId) => {
    try {
      setCancellingOrderId(orderId);
      const res = await api.post(`orders/${orderId}/cancel/`);
      setOrders((current) =>
        current.map((order) => (order.id === orderId ? res.data.order : order))
      );
      toast.success(res.data.message || "Order cancelled successfully.");
    } catch (err) {
      const message = err.response?.data?.error || "Failed to cancel order.";
      toast.error(message);
    } finally {
      setCancellingOrderId(null);
    }
  };

  if (loading) {
    return <Spinner loading={loading} />;
  }

  return (
    <section style={{ backgroundColor: "#f4f4f9" }}>
      <div className="container">
        {error && <Error message={error} />}
        <UserInfo
          userInfo={userInfo}
          onProfileChange={handleProfileChange}
          onSaveProfile={handleSaveProfile}
          profileSaving={profileSaving}
          passwordForm={passwordForm}
          onPasswordChange={handlePasswordChange}
          onChangePassword={handleChangePassword}
          passwordSaving={passwordSaving}
        />

        <OrderHistoryItemContainer
          orders={orders}
          onCancelOrder={handleCancelOrder}
          cancellingOrderId={cancellingOrderId}
        />
      </div>
    </section>
  );
};

export default UserProfilePage;
