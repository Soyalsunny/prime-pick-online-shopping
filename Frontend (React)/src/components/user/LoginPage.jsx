import { useContext, useState } from 'react';
import { Link } from 'react-router-dom';
import styles from './LoginPage.module.css';
import api from '../../api';
import Error from '../ui/Error';
import { useLocation, useNavigate } from 'react-router-dom';
import { toast } from 'react-toastify';
import { AuthContext } from '../../context/AuthContext';

const LoginPage = () => {

    const { setIsAuthenticated, get_username }  = useContext(AuthContext)

    const location = useLocation()
    const navigate = useNavigate()

    const [username, setUsername] = useState("")
    const [password, setPassword] = useState("")
    const [otp, setOtp] = useState("")
    const [loginChallenge, setLoginChallenge] = useState("")
    const [step, setStep] = useState("credentials")
    const [loading, setLoading] = useState(false)
    const [error, setError] = useState("")

    const userInfo = {username, password}

    async function completeLogin(access, refresh) {
      localStorage.setItem("access", access)
      localStorage.setItem("refresh", refresh)
      setIsAuthenticated(true)

      const me = await get_username()
      const staffUser = Boolean(me?.is_staff)
      toast.success("Logged in successfully!")

      if (staffUser) {
        navigate("/admin-panel", { replace: true })
      } else {
        const from = location?.state?.from?.pathname || "/"
        navigate(from, { replace: true })
      }
    }

    function resetToCredentials() {
      setStep("credentials")
      setOtp("")
      setLoginChallenge("")
    }

    function handleSubmit(e){
        e.preventDefault()
        setLoading(true)
        setError("")

        if (step === "credentials") {
          api.post("auth/login/request-otp/", userInfo)
          .then((res) => {
            setLoading(false)
            setStep("otp")
            setLoginChallenge(res.data.challenge)
            toast.success("OTP sent to your email.")
          })
          .catch(err => {
            const message = err?.response?.data?.error || "Username or password incorrect!"
            setError(message)
            setLoading(false)
            toast.error(message)
          })
          return
        }

        api.post("auth/login/verify-otp/", { challenge: loginChallenge, otp })
        .then(async (res) => {
          setLoading(false)
          setError("")
          setUsername("")
          setPassword("")
          setOtp("")
          setLoginChallenge("")
          setStep("credentials")
          await completeLogin(res.data.access, res.data.refresh)
        })
        .catch(err => {
          const message = err?.response?.data?.error || "Invalid OTP."
          setError(message)
          setLoading(false)
          toast.error(message)
        })
    }


  return (
    <div className={styles.container}>
      <div className={styles.loginBox}>
         {error && <Error message={error} />}
        <h2 className={styles.title}>Welcome</h2>
        <p className={styles.subtitle}>
          {step === "credentials" ? "Please login to your account" : "Enter the OTP sent to your email"}
        </p>
        <form onSubmit={handleSubmit} className={styles.form}>
          {step === "credentials" && (
            <>
              <div className={styles.inputGroup}>
                <label htmlFor="username" className={styles.label}>Username</label>
                <input type="text" value={username} 
                onChange={(e) => setUsername(e.target.value)} 
                id="username" className={styles.input} placeholder="Enter your username" required />
              </div>
              <div className={styles.inputGroup}>
                <label htmlFor="password" className={styles.label}>Password</label>
                <input type="password" value={password} 
                onChange={(e) => setPassword(e.target.value)}
                id="password" className={styles.input} placeholder="Enter your password" required />
              </div>
            </>
          )}

          {step === "otp" && (
            <>
              <div className={styles.inputGroup}>
                <label htmlFor="otp" className={styles.label}>One-Time Password</label>
                <input
                  type="text"
                  value={otp}
                  onChange={(e) => setOtp(e.target.value)}
                  id="otp"
                  className={styles.input}
                  placeholder="Enter 6-digit OTP"
                  inputMode="numeric"
                  required
                />
              </div>
            </>
          )}

          <button type="submit" className={styles.button} disabled={loading}>
            {loading ? "Please wait..." : step === "credentials" ? "Send OTP" : "Verify OTP"}
          </button>
          {step === "otp" && (
            <button type="button" className={styles.secondaryButton} onClick={resetToCredentials} disabled={loading}>
              Back
            </button>
          )}
        </form>
        <div className={styles.extraLinks}>
          <Link to="/profile" className={styles.link}>Reset Password</Link>
          <p>
            Don't have an account? <Link to="/register" className={styles.link}>Sign Up</Link>
          </p>
        </div>
      </div>
    </div>
  );
};

export default LoginPage;
