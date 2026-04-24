import { useState } from "react"
import { Link, useNavigate } from "react-router-dom"
import { toast } from "react-toastify"

import api from "../../api"
import Error from "../ui/Error"
import styles from "./LoginPage.module.css"

const parseErrorMessage = (error, fallbackMessage) => {
  const data = error?.response?.data
  if (!data) return fallbackMessage

  if (typeof data.error === "string") return data.error

  const firstFieldError = Object.values(data).find((value) => Array.isArray(value) && value.length)
  if (firstFieldError) {
    return String(firstFieldError[0])
  }

  return fallbackMessage
}

const ResetPasswordPage = () => {
  const navigate = useNavigate()

  const [step, setStep] = useState("email")
  const [email, setEmail] = useState("")
  const [otp, setOtp] = useState("")
  const [newPassword, setNewPassword] = useState("")
  const [confirmPassword, setConfirmPassword] = useState("")
  const [challenge, setChallenge] = useState("")
  const [resetToken, setResetToken] = useState("")
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState("")

  const requestOtp = async (event) => {
    event.preventDefault()
    setLoading(true)
    setError("")

    try {
      const response = await api.post("auth/password-reset/request-otp/", { email: email.trim() })
      setChallenge(response.data.challenge || "")
      setStep("otp")
      toast.success(response.data.message || "OTP sent to your email.")
    } catch (err) {
      const message = parseErrorMessage(err, "Could not send OTP.")
      setError(message)
      toast.error(message)
    } finally {
      setLoading(false)
    }
  }

  const verifyOtp = async (event) => {
    event.preventDefault()
    setLoading(true)
    setError("")

    try {
      const response = await api.post("auth/password-reset/verify-otp/", {
        challenge,
        otp: otp.trim(),
      })
      setResetToken(response.data.reset_token || "")
      setStep("password")
      toast.success(response.data.message || "OTP verified.")
    } catch (err) {
      const message = parseErrorMessage(err, "OTP verification failed.")
      setError(message)
      toast.error(message)
    } finally {
      setLoading(false)
    }
  }

  const submitNewPassword = async (event) => {
    event.preventDefault()
    setLoading(true)
    setError("")

    try {
      const response = await api.post("auth/password-reset/confirm/", {
        reset_token: resetToken,
        new_password: newPassword,
        confirm_password: confirmPassword,
      })

      toast.success(response.data.message || "Password reset successful.")
      navigate("/login", { replace: true })
    } catch (err) {
      const message = parseErrorMessage(err, "Could not reset password.")
      setError(message)
      toast.error(message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className={styles.container}>
      <div className={styles.loginBox}>
        {error && <Error message={error} />}
        <h2 className={styles.title}>Reset Password</h2>
        <p className={styles.subtitle}>
          {step === "email" && "Enter your account email to receive an OTP."}
          {step === "otp" && "Enter the OTP sent to your email."}
          {step === "password" && "Set your new password."}
        </p>

        {step === "email" && (
          <form onSubmit={requestOtp} className={styles.form}>
            <div className={styles.inputGroup}>
              <label htmlFor="email" className={styles.label}>Email</label>
              <input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className={styles.input}
                placeholder="Enter your email"
                required
              />
            </div>
            <button type="submit" className={styles.button} disabled={loading}>
              {loading ? "Please wait..." : "Send OTP"}
            </button>
          </form>
        )}

        {step === "otp" && (
          <form onSubmit={verifyOtp} className={styles.form}>
            <div className={styles.inputGroup}>
              <label htmlFor="otp" className={styles.label}>One-Time Password</label>
              <input
                id="otp"
                type="text"
                value={otp}
                onChange={(e) => setOtp(e.target.value)}
                className={styles.input}
                placeholder="Enter 6-digit OTP"
                inputMode="numeric"
                required
              />
            </div>
            <button type="submit" className={styles.button} disabled={loading}>
              {loading ? "Please wait..." : "Verify OTP"}
            </button>
          </form>
        )}

        {step === "password" && (
          <form onSubmit={submitNewPassword} className={styles.form}>
            <div className={styles.inputGroup}>
              <label htmlFor="new-password" className={styles.label}>New Password</label>
              <input
                id="new-password"
                type="password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                className={styles.input}
                placeholder="Enter new password"
                required
              />
            </div>
            <div className={styles.inputGroup}>
              <label htmlFor="confirm-password" className={styles.label}>Confirm Password</label>
              <input
                id="confirm-password"
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                className={styles.input}
                placeholder="Re-enter new password"
                required
              />
            </div>
            <button type="submit" className={styles.button} disabled={loading}>
              {loading ? "Please wait..." : "Reset Password"}
            </button>
          </form>
        )}

        <div className={styles.extraLinks}>
          <p>
            Back to <Link to="/login" className={styles.link}>Login</Link>
          </p>
        </div>
      </div>
    </div>
  )
}

export default ResetPasswordPage
