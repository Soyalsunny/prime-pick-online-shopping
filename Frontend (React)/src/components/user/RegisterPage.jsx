import { useState } from 'react';
import { Link } from 'react-router-dom';
import styles from './LoginPage.module.css';
import api from '../../api';
import Error from '../ui/Error';
import { useNavigate } from 'react-router-dom';
import { toast } from 'react-toastify';

const RegisterPage = () => {
    const navigate = useNavigate();

    const [formData, setFormData] = useState({
        username: "",
        email: "",
        password: "",
        confirmPassword: "",
        firstName: "",
        lastName: ""
    });

    const [loading, setLoading] = useState(false);
    const [error, setError] = useState("");
    const [step, setStep] = useState('register');
    const [registeredEmail, setRegisteredEmail] = useState('');
    const [otp, setOtp] = useState('');
    const [resendingOtp, setResendingOtp] = useState(false);
    const [debugOtp, setDebugOtp] = useState('');

    function handleChange(e) {
        setFormData({
            ...formData,
            [e.target.name]: e.target.value
        });
    }

    function handleSubmit(e) {
        e.preventDefault();
        setError("");

        // Validate password match
        if (formData.password !== formData.confirmPassword) {
            setError("Passwords do not match!");
            toast.error("Passwords do not match!");
            return;
        }

        // Validate password length
        if (formData.password.length < 6) {
            setError("Password must be at least 6 characters long!");
            toast.error("Password must be at least 6 characters long!");
            return;
        }

        setLoading(true);

        const userData = {
            username: formData.username,
            email: formData.email,
            password: formData.password,
            first_name: formData.firstName,
            last_name: formData.lastName
        };

        api.post("register/", userData)
            .then(res => {
                setLoading(false);
                setRegisteredEmail(userData.email);
                setStep('verify');
                setOtp('');
                setDebugOtp(res.data?.debug_otp || '');
                toast.success("Registration successful! Check your email for OTP.");
            })
            .catch(err => {
                const errorMessage = err.response?.data?.error || "Registration failed. Please try again.";
                setError(errorMessage);
                setLoading(false);
                toast.error(errorMessage);
            });
    }

    function handleVerifyOtp(e) {
        e.preventDefault();
        setError('');

        if (!otp.trim()) {
            setError('OTP is required.');
            toast.error('OTP is required.');
            return;
        }

        setLoading(true);
        api.post('verify-email-otp/', { email: registeredEmail, otp: otp.trim() })
            .then(res => {
                setLoading(false);
                toast.success(res.data?.message || 'Email verified successfully.');
                navigate('/login');
            })
            .catch(err => {
                setLoading(false);
                const errorMessage = err.response?.data?.error || 'OTP verification failed.';
                setError(errorMessage);
                toast.error(errorMessage);
            });
    }

    function handleResendOtp() {
        if (!registeredEmail) return;
        setResendingOtp(true);
        setError('');

        api.post('resend-email-otp/', { email: registeredEmail })
            .then(res => {
                setResendingOtp(false);
                setDebugOtp(res.data?.debug_otp || '');
                toast.success(res.data?.message || 'OTP resent successfully.');
            })
            .catch(err => {
                setResendingOtp(false);
                const errorMessage = err.response?.data?.error || 'Failed to resend OTP.';
                setError(errorMessage);
                toast.error(errorMessage);
            });
    }

    return (
        <div className={styles.container}>
            <div className={styles.loginBox}>
                {error && <Error message={error} />}
                <h2 className={styles.title}>{step === 'register' ? 'Create Account' : 'Verify Email OTP'}</h2>
                <p className={styles.subtitle}>
                    {step === 'register'
                        ? 'Sign up to get started'
                        : `Enter the OTP sent to ${registeredEmail}`}
                </p>

                {step === 'register' ? (
                    <form onSubmit={handleSubmit} className={styles.form}>
                        <div className={styles.inputGroup}>
                            <label htmlFor="username" className={styles.label}>Username *</label>
                            <input
                                type="text"
                                name="username"
                                value={formData.username}
                                onChange={handleChange}
                                id="username"
                                className={styles.input}
                                placeholder="Choose a username"
                                required
                            />
                        </div>

                        <div className={styles.inputGroup}>
                            <label htmlFor="email" className={styles.label}>Email *</label>
                            <input
                                type="email"
                                name="email"
                                value={formData.email}
                                onChange={handleChange}
                                id="email"
                                className={styles.input}
                                placeholder="Enter your email"
                                required
                            />
                        </div>

                        <div className={styles.inputGroup}>
                            <label htmlFor="firstName" className={styles.label}>First Name</label>
                            <input
                                type="text"
                                name="firstName"
                                value={formData.firstName}
                                onChange={handleChange}
                                id="firstName"
                                className={styles.input}
                                placeholder="Enter your first name"
                            />
                        </div>

                        <div className={styles.inputGroup}>
                            <label htmlFor="lastName" className={styles.label}>Last Name</label>
                            <input
                                type="text"
                                name="lastName"
                                value={formData.lastName}
                                onChange={handleChange}
                                id="lastName"
                                className={styles.input}
                                placeholder="Enter your last name"
                            />
                        </div>

                        <div className={styles.inputGroup}>
                            <label htmlFor="password" className={styles.label}>Password *</label>
                            <input
                                type="password"
                                name="password"
                                value={formData.password}
                                onChange={handleChange}
                                id="password"
                                className={styles.input}
                                placeholder="Create a password (min 6 characters)"
                                required
                            />
                        </div>

                        <div className={styles.inputGroup}>
                            <label htmlFor="confirmPassword" className={styles.label}>Confirm Password *</label>
                            <input
                                type="password"
                                name="confirmPassword"
                                value={formData.confirmPassword}
                                onChange={handleChange}
                                id="confirmPassword"
                                className={styles.input}
                                placeholder="Confirm your password"
                                required
                            />
                        </div>

                        <button type="submit" className={styles.button} disabled={loading}>
                            {loading ? 'Creating Account...' : 'Sign Up'}
                        </button>
                    </form>
                ) : (
                    <form onSubmit={handleVerifyOtp} className={styles.form}>
                        <div className={styles.inputGroup}>
                            <label htmlFor="otp" className={styles.label}>OTP *</label>
                            <input
                                type="text"
                                id="otp"
                                className={styles.input}
                                placeholder="Enter 6-digit OTP"
                                value={otp}
                                onChange={(e) => setOtp(e.target.value)}
                                required
                            />
                        </div>

                        {debugOtp ? (
                            <p style={{ color: '#8b5cf6', fontSize: '0.85rem', marginBottom: '12px' }}>
                                Dev OTP: <strong>{debugOtp}</strong>
                            </p>
                        ) : null}

                        <button type="submit" className={styles.button} disabled={loading}>
                            {loading ? 'Verifying...' : 'Verify OTP'}
                        </button>

                        <button
                            type="button"
                            className={styles.button}
                            style={{ marginTop: '10px', backgroundColor: '#e5e7eb', color: '#111827' }}
                            onClick={handleResendOtp}
                            disabled={resendingOtp}
                        >
                            {resendingOtp ? 'Resending...' : 'Resend OTP'}
                        </button>
                    </form>
                )}
                <div className={styles.extraLinks}>
                    <p>
                        Already have an account? <Link to="/login" className={styles.link}>Login</Link>
                    </p>
                </div>
            </div>
        </div>
    );
};

export default RegisterPage;
