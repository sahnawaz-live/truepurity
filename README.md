# True Purity - Water Purification E-Commerce

A full-stack e-commerce platform for **True Purity** water purification systems. Browse RO purifiers, create an account, and order online with Razorpay payments.

**Live:** [truepurity2025.web.app](https://truepurity2025.web.app)

---

## Tech Stack

| Layer    | Technology                          |
| -------- | ----------------------------------- |
| Frontend | HTML, CSS, JavaScript, Bootstrap 5  |
| Backend  | Node.js, Express                    |
| Database | SQLite (better-sqlite3)             |
| Payments | Razorpay                            |
| Auth     | JWT + Google OAuth 2.0              |
| Hosting  | Firebase Hosting                    |

---

## Quick Start

### Prerequisites

- **Node.js** v18+ &mdash; [download](https://nodejs.org/)
- **Git** &mdash; [download](https://git-scm.com/)

### Clone & Run

```bash
# 1. Clone the repo
git clone https://github.com/sahnawaz-live/truepurity.git
cd truepurity

# 2. Install server dependencies
cd public/server
npm install

# 3. Create your environment file
cat > .env << 'EOF'
PORT=3001
FRONTEND_BASE=http://localhost:3001

# Razorpay — get keys at https://dashboard.razorpay.com
RAZORPAY_KEY_ID=your_razorpay_key_id
RAZORPAY_KEY_SECRET=your_razorpay_key_secret

# JWT — generate a secret with: node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
JWT_SECRET=replace_with_a_random_64_char_hex_string
JWT_EXPIRES=365d

# Google OAuth — get from https://console.cloud.google.com
GOOGLE_CLIENT_ID=your_google_client_id
EOF

# 4. Start the development server
npm run dev
```

Open **http://localhost:3001** in your browser. Done!

---

## Project Structure

```
truepurity/
├── public/                  # Frontend (served by Express & Firebase)
│   ├── index.html           # Homepage — products, hero, contact form
│   ├── order.html           # Order placement + Razorpay payment
│   ├── orders.html          # Order history
│   ├── profile.html         # User profile management
│   ├── login.html           # Login page
│   ├── register.html        # Registration page
│   ├── howItWorks.html      # Multi-stage purification explained
│   ├── why-choose-us.html   # Product comparison & benefits
│   ├── style.css            # Global styles
│   ├── script.js            # Product catalog & UI logic
│   ├── auth.js              # Authentication helpers
│   ├── assets/              # Product images & media
│   └── server/
│       ├── server.js        # Express API (auth, orders, payments)
│       ├── package.json     # Server dependencies
│       └── .env             # Environment secrets (not committed)
├── firebase.json            # Firebase Hosting configuration
├── .firebaserc              # Firebase project ID
└── .github/workflows/
    └── deploy.yml           # CI/CD — auto-deploy on push to main
```

---

## API Reference

### Authentication
```
POST /api/auth/register     Register with email/password
POST /api/auth/login        Login
POST /api/auth/google       Google OAuth sign-in
GET  /api/auth/me           Get current user (requires token)
POST /api/auth/forgot       Request password reset email
POST /api/auth/reset        Reset password with token
POST /api/auth/verify       Verify email address
```

### Orders
```
POST /api/order             Place a COD/UPI order
GET  /api/my-orders         Get user's order history
POST /api/orders/:id/cancel Cancel a pending order
```

### Payments
```
POST /api/create-order      Create Razorpay payment order
POST /api/verify-payment    Verify Razorpay payment signature
```

---

## Deployment

Pushes to `main`/`master` auto-deploy to Firebase Hosting via GitHub Actions.

### CI/CD Setup (one-time)

1. Go to **Firebase Console > Project Settings > Service Accounts**
2. Click **Generate New Private Key** to download the JSON file
3. In your GitHub repo, go to **Settings > Secrets and variables > Actions**
4. Create a secret named `FIREBASE_SERVICE_ACCOUNT` and paste the full JSON content

### Manual Deploy

```bash
npm install -g firebase-tools
firebase login
firebase deploy --only hosting
```

---

## Products

| Model    | Storage | Stages | Key Technology                          |
| -------- | ------- | ------ | --------------------------------------- |
| TP-Prime | 12 L    | 8      | RO + UV + UF + Copper + Minerals       |
| TP-Royal | 12 L    | 9      | RO + UV + UF + TDS + Copper + Minerals |
| TP-Elite | 15 L    | 9      | RO + UV + UF + TDS + Copper + Alkaline |

---

## License

Proprietary. All rights reserved.
