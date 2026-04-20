import styles from "./UserInfo.module.css";

const UserInfo = ({
  userInfo,
  onProfileChange,
  onSaveProfile,
  profileSaving,
  passwordForm,
  onPasswordChange,
  onChangePassword,
  passwordSaving,
}) => {
  return (
    <div className={styles.container}>
      <div className={styles.leftSection}>
        <div className={styles.card}>
          <div className={styles.details}>
            <h2 className={styles.name}>Hi, {userInfo.first_name || userInfo.username}</h2>
            <p className={styles.email}>{userInfo.email}</p>
            <p className="text-muted mb-3">Manage your account details, password, and orders.</p>
            <span className="badge text-bg-light">Orders: account dashboard</span>
          </div>
        </div>

        <div className={`${styles.card} mt-4`}>
          <h5 className="mb-3">Change Password</h5>
          <form onSubmit={onChangePassword}>
            <div className="mb-3 text-start">
              <label className="form-label">Current Password</label>
              <input
                type="password"
                name="current_password"
                className="form-control"
                value={passwordForm.current_password}
                onChange={onPasswordChange}
                required
              />
            </div>
            <div className="mb-3 text-start">
              <label className="form-label">New Password</label>
              <input
                type="password"
                name="new_password"
                className="form-control"
                value={passwordForm.new_password}
                onChange={onPasswordChange}
                minLength={8}
                required
              />
            </div>
            <div className="mb-3 text-start">
              <label className="form-label">Confirm New Password</label>
              <input
                type="password"
                name="confirm_password"
                className="form-control"
                value={passwordForm.confirm_password}
                onChange={onPasswordChange}
                minLength={8}
                required
              />
            </div>
            <button className={styles.editButton} type="submit" disabled={passwordSaving}>
              {passwordSaving ? "Updating..." : "Reset Password"}
            </button>
          </form>
        </div>
      </div>

      <div className={styles.rightSection}>
        <div className="card" style={{ width: "100%" }}>
          <div
            className="card-header"
            style={{
              backgroundColor: "#6050DC",
              color: "white",
              textAlign: "center",
            }}
          >
            <h5 className="mb-0">Edit Profile</h5>
          </div>
          <div className="card-body">
            <form onSubmit={onSaveProfile}>
              <div className="row g-3">
                <div className="col-md-6">
                  <label className="form-label">Username</label>
                  <input
                    type="text"
                    className="form-control"
                    name="username"
                    value={userInfo.username || ""}
                    onChange={onProfileChange}
                    required
                  />
                </div>
                <div className="col-md-6">
                  <label className="form-label">Email</label>
                  <input
                    type="email"
                    className="form-control"
                    name="email"
                    value={userInfo.email || ""}
                    onChange={onProfileChange}
                    required
                  />
                </div>
                <div className="col-md-6">
                  <label className="form-label">First Name</label>
                  <input
                    type="text"
                    className="form-control"
                    name="first_name"
                    value={userInfo.first_name || ""}
                    onChange={onProfileChange}
                  />
                </div>
                <div className="col-md-6">
                  <label className="form-label">Last Name</label>
                  <input
                    type="text"
                    className="form-control"
                    name="last_name"
                    value={userInfo.last_name || ""}
                    onChange={onProfileChange}
                  />
                </div>
                <div className="col-md-6">
                  <label className="form-label">Phone</label>
                  <input
                    type="text"
                    className="form-control"
                    name="phone"
                    value={userInfo.phone || ""}
                    onChange={onProfileChange}
                  />
                </div>
                <div className="col-md-6">
                  <label className="form-label">City</label>
                  <input
                    type="text"
                    className="form-control"
                    name="city"
                    value={userInfo.city || ""}
                    onChange={onProfileChange}
                  />
                </div>
                <div className="col-md-6">
                  <label className="form-label">State</label>
                  <input
                    type="text"
                    className="form-control"
                    name="state"
                    value={userInfo.state || ""}
                    onChange={onProfileChange}
                  />
                </div>
                <div className="col-12">
                  <label className="form-label">Address</label>
                  <textarea
                    className="form-control"
                    rows="4"
                    name="address"
                    value={userInfo.address || ""}
                    onChange={onProfileChange}
                  />
                </div>
              </div>

              <div className="mt-4 d-flex justify-content-end">
                <button className={styles.editButton} type="submit" disabled={profileSaving}>
                  {profileSaving ? "Saving..." : "Save Profile"}
                </button>
              </div>
            </form>
          </div>
        </div>
      </div>
    </div>
  );
};

export default UserInfo;
