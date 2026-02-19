# True Purity

A full-stack e-commerce platform for **True Purity** water purification systems. Customers can browse products, create accounts, place orders, and pay online via Razorpay.

**Live site:** [truepurity2025.web.app](https://truepurity2025.web.app)

---

## Tech Stack

| Layer      | Technology                                  |
| ---------- | ------------------------------------------- |
| Frontend   | HTML, CSS, JavaScript, Bootstrap 5          |
| Backend    | Node.js, Express                            |
| Database   | SQLite (better-sqlite3)                     |
| Payments   | Razorpay                                    |
| Auth       | JWT + Google OAuth 2.0                      |
| Hosting    | Firebase Hosting (frontend)                 |

---

## Project Structure

```
├── public/                 # Frontend served by Firebase Hosting
│   ├── index.html          # Homepage
│   ├── order.html          # Order placement page
│   ├── orders.html         # Order history
│   ├── profile.html        # User profile
│   ├── login.html          # Login page
│   ├── register.html       # Registration page
│   ├── style.css           # Global styles
│   ├── script.js           # Product catalog & UI logic
│   ├── auth.js             # Authentication handler
│   ├── assets/             # Product images & media
│   └── server/             # Backend API server
│       ├── server.js       # Express server (auth, orders, payments)
│       ├── package.json    # Server dependencies
│       └── .env            # Environment variables (not committed)
├── firebase.json           # Firebase Hosting configuration
├── .firebaserc             # Firebase project settings
└── .github/workflows/      # CI/CD pipeline
    └── deploy.yml          # Auto-deploy on push to main
```

---

## Running Locally

### Prerequisites

- [Node.js](https://nodejs.org/) v18 or later
- [Firebase CLI](https://firebase.google.com/docs/cli) (optional, for deploying)

### 1. Clone the repository

```bash
git clone https://github.com/sahnawaz-live/truepurity.git
cd truepurity
```

### 2. Install server dependencies

```bash
cd public/server
npm install
```

### 3. Configure environment variables

Create a `.env` file inside `public/server/`:

```env
PORT=3001
FRONTEND_BASE=http://localhost:3001

# Razorpay
RAZORPAY_KEY_ID=your_razorpay_key_id
RAZORPAY_KEY_SECRET=your_razorpay_key_secret

# JWT
JWT_SECRET=your_jwt_secret_key
JWT_EXPIRES=365d

# Google OAuth
GOOGLE_CLIENT_ID=your_google_client_id
```

### 4. Start the server

```bash
npm run dev
```

The app will be available at **http://localhost:3001**.

The Express server serves both the API (`/api/*`) and the static frontend files from the `public/` directory.

---

## Products

| Model       | Storage | Filtration Stages | Technology                                     |
| ----------- | ------- | ----------------- | ---------------------------------------------- |
| TP-Prime    | 12 L    | 8 stages          | RO + UV + UF + Copper + Minerals               |
| TP-Royal    | 12 L    | 9 stages          | RO + UV + UF + TDS + Copper + Minerals         |
| TP-Elite    | 15 L    | 9 stages          | RO + UV + UF + TDS + Copper + Alkaline         |

---

## API Endpoints

### Authentication
| Method | Route                  | Description                |
| ------ | ---------------------- | -------------------------- |
| POST   | `/api/auth/register`   | Register with email        |
| POST   | `/api/auth/login`      | Login with email/password  |
| POST   | `/api/auth/google`     | Google OAuth sign-in       |
| GET    | `/api/auth/me`         | Get current user           |
| POST   | `/api/auth/forgot`     | Request password reset     |
| POST   | `/api/auth/reset`      | Reset password             |
| POST   | `/api/auth/verify`     | Verify email               |

### Orders
| Method | Route                  | Description                |
| ------ | ---------------------- | -------------------------- |
| POST   | `/api/order`           | Place a COD/UPI order      |
| GET    | `/api/my-orders`       | Get user's order history   |
| POST   | `/api/orders/:id/cancel` | Cancel an order          |

### Payments
| Method | Route                  | Description                |
| ------ | ---------------------- | -------------------------- |
| POST   | `/api/create-order`    | Create Razorpay order      |
| POST   | `/api/verify-payment`  | Verify payment signature   |

---

## Deployment

The frontend is deployed to **Firebase Hosting**. A GitHub Actions workflow automatically deploys on every push to the `main` branch.

To deploy manually:

```bash
npm install -g firebase-tools
firebase login
firebase deploy --only hosting
```

---

## License

This project is proprietary. All rights reserved.
