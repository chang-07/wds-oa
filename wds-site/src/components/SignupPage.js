import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import './Auth.css'; // We'll create this CSS file

const SignupPage = () => {
  const [formData, setFormData] = useState({
    username: '',
    password: '',
  });
  const [message, setMessage] = useState('');
  const navigate = useNavigate();

  const { username, password } = formData;

  const onChange = (e) =>
    setFormData({ ...formData, [e.target.name]: e.target.value });

  const onSubmit = async (e) => {
    e.preventDefault();
    try {
      const res = await fetch('http://localhost:5001/api/auth/signup', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(formData),
      });

      const data = await res.json();

      if (res.ok) {
        setMessage('Signup successful! Redirecting to login...');
        // Optionally store token if you want to auto-login
        // localStorage.setItem('token', data.token);
        setTimeout(() => navigate('/login'), 2000);
      } else {
        setMessage(data.msg || 'Signup failed');
      }
    } catch (err) {
      console.error(err);
      setMessage('Server error during signup');
    }
  };

  return (
    <div className="auth-container">
      <h1>Sign Up</h1>
      <form onSubmit={onSubmit}>
        <div className="form-group">
          <label htmlFor="username">Username</label>
          <input
            type="text"
            id="username"
            name="username"
            value={username}
            onChange={onChange}
            required
          />
        </div>
        <div className="form-group">
          <label htmlFor="password">Password</label>
          <input
            type="password"
            id="password"
            name="password"
            value={password}
            onChange={onChange}
            required
          />
        </div>
        <button type="submit">Sign Up</button>
      </form>
      <p>
        Already have an account? <Link to="/login">Login</Link>
      </p>
      {message && <p className="message">{message}</p>}
    </div>
  );
};

export default SignupPage;