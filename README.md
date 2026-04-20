# 🛒 E-Commerce Website

A full-featured **E-commerce web application** built with a **React.js frontend** and a **Django backend**, providing a scalable and responsive online shopping experience.

---

## 🚀 Tech Stack

### 🔧 Backend

* **Python**
* **Django** – Web framework for APIs and business logic
* **Django REST Framework (DRF)** – For building RESTful APIs
* **PostgreSQL** – Recommended production database
* **SQLite** – Development fallback database

### 🎨 Frontend

* **React.js** – For interactive UI
* **Axios** – For API calls
* **React Router** – For navigation

---

## 📦 Features

### 👨‍💻 Customer Features

* Product listing and detail view
* Add to cart and checkout
* User registration and login
* Order history and profile management
* Fully responsive UI

### 🔐 Admin Features

* Admin login/dashboard
* Add, edit, or delete products
* Manage users and orders
* View sales and product statistics

---

## 🗄️ Database Notes

* The backend can be switched between SQLite and PostgreSQL through the `DB_ENGINE` setting in `Backend (Django)/.env`.
* For production or final submission, PostgreSQL is the better choice because it gives stronger reliability, concurrency, and isolation.
* After changing the database engine, create the new database, install backend requirements, and run Django migrations again.
