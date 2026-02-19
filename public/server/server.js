// server/server.js
require( 'dotenv' ).config();

const path = require( 'path' );
const express = require( 'express' );
const cors = require( 'cors' );
const crypto = require( 'crypto' );
const Database = require( 'better-sqlite3' );
const Razorpay = require( 'razorpay' );

// Auth deps
const bcrypt = require( 'bcrypt' );
const jwt = require( 'jsonwebtoken' );
const { OAuth2Client } = require( 'google-auth-library' );

const app = express();

/* -----------------------------------
   Config
----------------------------------- */
const PORT = Number( process.env.PORT || 3001 );
const FRONTEND_BASE = process.env.FRONTEND_BASE || `http://localhost:${ PORT }`;
const { RAZORPAY_KEY_ID, RAZORPAY_KEY_SECRET, JWT_SECRET, JWT_EXPIRES, GOOGLE_CLIENT_ID } = process.env;

const JWT_SECRET_FALLBACK = JWT_SECRET || 'dev-secret-change-me';
const JWT_EXPIRES_FALLBACK = JWT_EXPIRES || '7d';

/* -----------------------------------
   Middleware & static
----------------------------------- */
app.use( express.json() );
app.use( express.urlencoded( { extended: true } ) );
app.use( cors( { origin: ( o, cb ) => cb( null, true ), credentials: false } ) );

// Serve the frontend from the project root (index.html, order.html, review.html, assets, etc.)
const documentRoot = path.resolve( __dirname, '..' );
app.use( express.static( documentRoot ) );

/* -----------------------------------
   DB + schema
----------------------------------- */
const DB_FILE = path.join( __dirname, 'orders.db' );
const db = new Database( DB_FILE );
db.pragma( 'journal_mode = WAL' );

db.exec( `
CREATE TABLE IF NOT EXISTS users (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  email TEXT UNIQUE,
  name TEXT,
  password_hash TEXT,
  google_sub TEXT,
  phone TEXT,
  city TEXT,
  address TEXT,
  email_verified INTEGER DEFAULT 0,
  created_at TEXT DEFAULT (datetime('now','localtime'))
);

CREATE TABLE IF NOT EXISTS password_resets (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER,
  token TEXT UNIQUE,
  expires_at INTEGER,
  used INTEGER DEFAULT 0
);

CREATE TABLE IF NOT EXISTS verify_tokens (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL,
  token TEXT UNIQUE NOT NULL,
  expires_at INTEGER NOT NULL,
  used INTEGER DEFAULT 0
);
`);


// Tiny migration helpers (safe no-ops if already present)
function ensureColumn ( table, col, type )
{
    try
    {
        const cols = db.prepare( `PRAGMA table_info(${ table })` ).all();
        if ( !cols.some( c => c.name === col ) )
        {
            db.prepare( `ALTER TABLE ${ table } ADD COLUMN ${ col } ${ type }` ).run();
        }
    } catch ( _ ) { }
}
ensureColumn( 'orders', 'user_id', 'INTEGER' );

const insertOrder = db.prepare( `
  INSERT INTO orders
  (order_no, user_id, model, variant, unit_price, qty, total, name, phone, address, city, pincode, payment_mode, status, razorpay_order_id)
  VALUES
  (@order_no, @user_id, @model, @variant, @unit_price, @qty, @total, @name, @phone, @address, @city, @pincode, @payment_mode, @status, @razorpay_order_id)
`);

const updatePayment = db.prepare( `
  UPDATE orders
  SET status=@status, razorpay_payment_id=@razorpay_payment_id, razorpay_signature=@razorpay_signature
  WHERE razorpay_order_id=@razorpay_order_id
`);

const getOrderById = db.prepare( `SELECT * FROM orders WHERE id=?` );
const getOrderByRz = db.prepare( `SELECT * FROM orders WHERE razorpay_order_id=?` );
const getOrdersByUser = db.prepare( `SELECT * FROM orders WHERE user_id=? ORDER BY id DESC` );
const cancelOrderSql = db.prepare( `UPDATE orders SET status='cancelled' WHERE id=? AND user_id=? AND status IN ('cod','created')` );

/* -----------------------------------
   Razorpay
----------------------------------- */
function mask ( s ) { if ( !s ) return '(empty)'; return s.length <= 6 ? '****' : s.slice( 0, 4 ) + '****' + s.slice( -2 ); }
console.log( 'RZP key present:', Boolean( RAZORPAY_KEY_ID ), 'id:', mask( RAZORPAY_KEY_ID ) );
console.log( 'RZP secret present:', Boolean( RAZORPAY_KEY_SECRET ) );

let razorpay = null;
if ( RAZORPAY_KEY_ID && RAZORPAY_KEY_SECRET )
{
    razorpay = new Razorpay( { key_id: RAZORPAY_KEY_ID, key_secret: RAZORPAY_KEY_SECRET, timeout: 60000 } );
} else
{
    console.warn( '⚠️ Razorpay keys missing – online payments disabled' );
}

/* -----------------------------------
   Auth helpers
----------------------------------- */
const googleClient = GOOGLE_CLIENT_ID ? new OAuth2Client( GOOGLE_CLIENT_ID ) : null;

function signToken ( user )
{
    return jwt.sign(
        { uid: user.id, email: user.email, name: user.name },
        JWT_SECRET_FALLBACK,
        { expiresIn: JWT_EXPIRES_FALLBACK }
    );
}

function authRequired ( req, res, next )
{
    const hdr = req.headers.authorization || '';
    const token = hdr.startsWith( 'Bearer ' ) ? hdr.slice( 7 ) : null;
    if ( !token ) return res.status( 401 ).json( { error: 'Unauthorized' } );
    try
    {
        req.user = jwt.verify( token, JWT_SECRET_FALLBACK );
        next();
    } catch
    {
        return res.status( 401 ).json( { error: 'Invalid token' } );
    }
}

/* -----------------------------------
   Public config for frontend
----------------------------------- */
app.get( '/api/auth/config', ( _req, res ) =>
{
    res.json( {
        googleClientId: GOOGLE_CLIENT_ID || null,
        hasRazorpay: Boolean( RAZORPAY_KEY_ID && RAZORPAY_KEY_SECRET )
    } );
} );

/* -----------------------------------
   Health
----------------------------------- */
app.get( '/api/ping', ( _req, res ) =>
{
    res.json( {
        ok: true,
        frontend: FRONTEND_BASE,
        routes: [
            // auth
            'POST /api/auth/register',
            'POST /api/auth/login',
            'POST /api/auth/google',
            'POST /api/auth/forgot',
            'POST /api/auth/reset',
            'GET  /api/auth/me',
            'GET  /api/auth/config',
            // orders
            'GET  /api/my-orders',
            'POST /api/orders/:id/cancel',
            // payments
            'POST /api/order',
            'POST /api/create-order',
            'POST /api/verify-payment',
            'ALL  /api/verify-return',
            'GET  /api/orders/:id',
            'GET  /api/orders/by-rp/:rzpId'
        ]
    } );
} );

/* -----------------------------------
   AUTH
----------------------------------- */
// Register (email/password) with email verification
app.post( '/api/auth/register', async ( req, res ) =>
{
    try
    {
        const { email, name, password, phone, city, address } = req.body || {};
        if ( !email || !password ) return res.status( 400 ).json( { error: 'Missing email/password' } );

        const hash = await bcrypt.hash( password, 10 );
        const insert = db.prepare( `
      INSERT INTO users (email, name, password_hash, phone, city, address, email_verified)
      VALUES (?, ?, ?, ?, ?, ?, 0)
    `);

        try
        {
            const info = insert.run( email.toLowerCase(), name || '', hash, phone || '', city || '', address || '' );
            // create verify token (24h)
            const token = crypto.randomBytes( 24 ).toString( 'hex' );
            const expires = Date.now() + 1000 * 60 * 60 * 24;
            db.prepare( `INSERT INTO verify_tokens (user_id, token, expires_at) VALUES (?, ?, ?)` )
                .run( info.lastInsertRowid, token, expires );

            // In prod: email this link. Dev: return it so you can click.
            const verify_url = `${ FRONTEND_BASE }/verify.html?token=${ token }`;
            return res.json( { ok: true, verify_url } );
        } catch ( e )
        {
            if ( String( e ).includes( 'UNIQUE' ) ) return res.status( 409 ).json( { error: 'Email already exists' } );
            throw e;
        }
    } catch ( e )
    {
        console.error( 'register error', e );
        res.status( 500 ).json( { error: 'Server error' } );
    }
} );

// Login (email/password)
app.post( '/api/auth/login', async ( req, res ) =>
{
    const { email, password } = req.body || {};
    if ( !email || !password ) return res.status( 400 ).json( { error: 'Missing email/password' } );

    const row = db.prepare( `SELECT * FROM users WHERE email=?` ).get( email.toLowerCase() );
    if ( !row || !row.password_hash ) return res.status( 401 ).json( { error: 'Invalid credentials' } );

    // Require email verified
    if ( !row.email_verified )
    {
        return res.status( 403 ).json( { error: 'Please verify your email before logging in' } );
    }

    const ok = await bcrypt.compare( password, row.password_hash );
    if ( !ok ) return res.status( 401 ).json( { error: 'Invalid credentials' } );

    const user = { id: row.id, email: row.email, name: row.name };
    return res.json( { ok: true, token: signToken( user ), user } );
} );

// Google sign-in (front end sends id_token)
app.post( '/api/auth/google', async ( req, res ) =>
{
    try
    {
        const { id_token } = req.body || {};
        if ( !id_token ) return res.status( 400 ).json( { error: 'Missing id_token' } );

        const ticket = await googleClient.verifyIdToken( {
            idToken: id_token,
            audience: process.env.GOOGLE_CLIENT_ID
        } );
        const payload = ticket.getPayload();
        const email = ( payload.email || '' ).toLowerCase();
        const sub = payload.sub;

        db.prepare( `
      INSERT INTO users (email, name, google_sub, email_verified)
      VALUES (?, ?, ?, 1)
      ON CONFLICT(email) DO UPDATE SET
        name=excluded.name,
        google_sub=excluded.google_sub,
        email_verified=1
    `).run( email, payload.name || '', sub );

        const user = db.prepare( `SELECT * FROM users WHERE email=?` ).get( email );
        return res.json( { ok: true, token: signToken( user ), user: { id: user.id, email: user.email, name: user.name } } );
    } catch ( e )
    {
        console.error( 'google auth error', e );
        res.status( 401 ).json( { error: 'Invalid Google token' } );
    }
} );

// Who am I
app.get( '/api/auth/me', authRequired, ( req, res ) =>
{
    res.json( { ok: true, user: req.user } );
} );

// Forgot password (issue token)
app.post( '/api/auth/forgot', ( req, res ) =>
{
    const { email } = req.body || {};
    if ( !email ) return res.status( 400 ).json( { error: 'Missing email' } );
    const user = db.prepare( `SELECT * FROM users WHERE email=?` ).get( email.toLowerCase() );
    if ( !user || !user.password_hash )
    {
        // don't reveal existence
        return res.json( { ok: true } );
    }
    const token = crypto.randomBytes( 24 ).toString( 'hex' );
    const expires = Date.now() + 1000 * 60 * 30; // 30 min
    db.prepare( `INSERT INTO password_resets (user_id, token, expires_at) VALUES (?, ?, ?)` )
        .run( user.id, token, expires );
    // In production: send email. Dev: return the link
    res.json( { ok: true, reset_url: `${ FRONTEND_BASE }/reset.html?token=${ token }` } );
} );

// Reset password
app.post( '/api/auth/reset', async ( req, res ) =>
{
    const { token, password } = req.body || {};
    if ( !token || !password ) return res.status( 400 ).json( { error: 'Missing token/password' } );
    const row = db.prepare( `SELECT * FROM password_resets WHERE token=? AND used=0` ).get( token );
    if ( !row || row.expires_at < Date.now() ) return res.status( 400 ).json( { error: 'Invalid/expired token' } );
    const hash = await bcrypt.hash( password, 10 );
    db.prepare( `UPDATE users SET password_hash=? WHERE id=?` ).run( hash, row.user_id );
    db.prepare( `UPDATE password_resets SET used=1 WHERE id=?` ).run( row.id );
    res.json( { ok: true } );
} );

app.post( '/api/auth/verify', ( req, res ) =>
{
    const { token } = req.body || {};
    if ( !token ) return res.status( 400 ).json( { error: 'Missing token' } );
    const row = db.prepare( `SELECT * FROM verify_tokens WHERE token=? AND used=0` ).get( token );
    if ( !row || row.expires_at < Date.now() ) return res.status( 400 ).json( { error: 'Invalid/expired token' } );

    db.prepare( `UPDATE users SET email_verified=1 WHERE id=?` ).run( row.user_id );
    db.prepare( `UPDATE verify_tokens SET used=1 WHERE id=?` ).run( row.id );

    const user = db.prepare( `SELECT id,email,name FROM users WHERE id=?` ).get( row.user_id );
    const tokenJwt = signToken( user );
    return res.json( { ok: true, token: tokenJwt, user } );
} );

app.post( '/api/auth/google', async ( req, res ) =>
{
    try
    {
        const { id_token } = req.body || {};
        if ( !id_token ) return res.status( 400 ).json( { error: 'Missing id_token' } );

        const ticket = await googleClient.verifyIdToken( {
            idToken: id_token,
            audience: process.env.GOOGLE_CLIENT_ID
        } );
        const payload = ticket.getPayload(); // {sub, email, name,...}
        const email = ( payload.email || '' ).toLowerCase();
        const sub = payload.sub;

        db.prepare( `
      INSERT INTO users (email, name, google_sub, email_verified)
      VALUES (?, ?, ?, 1)
      ON CONFLICT(email) DO UPDATE SET name=excluded.name, google_sub=excluded.google_sub, email_verified=1
    `).run( email, payload.name || '', sub );

        const user = db.prepare( `SELECT id,email,name FROM users WHERE email=?` ).get( email );
        return res.json( { ok: true, token: signToken( user ), user } );
    } catch ( e )
    {
        console.error( 'google auth error', e );
        res.status( 401 ).json( { error: 'Invalid Google token' } );
    }
} );


/* -----------------------------------
   Orders (user scoped)
----------------------------------- */
// current user's orders
app.get( '/api/my-orders', authRequired, ( req, res ) =>
{
    const rows = getOrdersByUser.all( req.user.uid );
    res.json( { ok: true, orders: rows } );
} );

// cancel (only if yours and still pending)
app.post( '/api/orders/:id/cancel', authRequired, ( req, res ) =>
{
    const id = Number( req.params.id );
    const info = cancelOrderSql.run( id, req.user.uid );
    if ( info.changes === 0 ) return res.status( 400 ).json( { ok: false, error: 'Cannot cancel this order' } );
    res.json( { ok: true } );
} );

/* -----------------------------------
   Existing payment flow
----------------------------------- */
// Single order for review.html
app.get( '/api/orders/:id', ( req, res ) =>
{
    const row = getOrderById.get( req.params.id );
    if ( !row ) return res.status( 404 ).json( { error: 'Not found' } );
    res.json( row );
} );

// Poll by Razorpay order id (UPI fallback)
app.get( '/api/orders/by-rp/:rzpId', ( req, res ) =>
{
    const row = getOrderByRz.get( req.params.rzpId );
    if ( !row ) return res.status( 404 ).end();
    res.json( row );
} );

// Verify email from link
app.get( '/api/auth/verify', ( req, res ) =>
{
    const { token } = req.query || {};
    if ( !token ) return res.status( 400 ).json( { ok: false, error: 'Missing token' } );

    const row = db.prepare( `SELECT * FROM verify_tokens WHERE token=? AND used=0` ).get( token );
    if ( !row ) return res.status( 400 ).json( { ok: false, error: 'Invalid/used token' } );
    if ( row.expires_at < Date.now() ) return res.status( 400 ).json( { ok: false, error: 'Token expired' } );

    db.prepare( `UPDATE users SET email_verified=1 WHERE id=?` ).run( row.user_id );
    db.prepare( `UPDATE verify_tokens SET used=1 WHERE id=?` ).run( row.id );

    return res.json( { ok: true } );
} );


// Save COD / UPI-intent order  (auth required)
app.post( '/api/order', authRequired, ( req, res ) =>
{
    try
    {
        const { model, variant, price, qty, total, name, phone, address, city, pincode,
            payment_mode = 'cod', status = payment_mode } = req.body || {};

        if ( !model || !variant || !price || !qty || !total || !name || !phone || !address || !city || !pincode )
        {
            return res.status( 400 ).json( { error: 'Missing fields' } );
        }

        const order_no = 'TP' + new Date().toISOString().replace( /[-:TZ.]/g, '' ).slice( 0, 14 );
        const info = insertOrder.run( {
            order_no,
            user_id: req.user.uid,
            model, variant,
            unit_price: +price,
            qty: +qty,
            total: +total,
            name, phone, address, city, pincode,
            payment_mode,
            status,
            razorpay_order_id: null
        } );

        res.json( { ok: true, id: info.lastInsertRowid, order_no } );
    } catch ( e )
    {
        console.error( 'create local order error:', e );
        res.status( 500 ).json( { error: 'Server error' } );
    }
} );

// Create Razorpay order (gateway)  (auth required)
app.post( '/api/create-order', authRequired, async ( req, res ) =>
{
    if ( !razorpay ) return res.status( 503 ).json( { error: 'Razorpay not configured' } );
    try
    {
        const { amount, currency = 'INR', productId = 'tp', notes = {},
            model, variant, price, qty, total,
            name, phone, address, city, pincode } = req.body || {};

        if ( !Number.isInteger( amount ) || amount < 100 ) return res.status( 400 ).json( { error: 'Invalid amount (paise >= 100)' } );
        if ( currency !== 'INR' ) return res.status( 400 ).json( { error: 'Invalid currency (INR only)' } );

        let rpOrder;
        try
        {
            rpOrder = await razorpay.orders.create( { amount, currency, receipt: `tp_${ productId }_${ Date.now() }`, notes } );
        } catch ( err )
        {
            const code = err?.error?.code || err?.code || 'RZP_ERR';
            const desc = err?.error?.description || err?.message || 'Order create failed';
            const status = err?.status || err?.error?.statusCode || err?.response?.status;
            console.error( 'Razorpay order create failed:', { code, status, desc, err: String( err ) } );
            return res.status( 502 ).json( { error: 'Razorpay order create failed', code, status, desc } );
        }

        const order_no = 'TP' + new Date().toISOString().replace( /[-:TZ.]/g, '' ).slice( 0, 14 );
        const info = insertOrder.run( {
            order_no,
            user_id: req.user.uid,
            model: model || productId,
            variant: variant || 'N/A',
            unit_price: Number( price ?? Math.round( amount / 100 ) ),
            qty: Number( qty ?? 1 ),
            total: Number( total ?? Math.round( amount / 100 ) ),
            name: name || '',
            phone: phone || '',
            address: address || '',
            city: city || '',
            pincode: pincode || '',
            payment_mode: 'razorpay',
            status: 'created',
            razorpay_order_id: rpOrder.id
        } );

        res.json( { orderId: rpOrder.id, keyId: RAZORPAY_KEY_ID, currency: rpOrder.currency, amount: rpOrder.amount, id: info.lastInsertRowid } );
    } catch ( err )
    {
        console.error( 'Create-order (server) error:', err );
        res.status( 500 ).json( { error: 'Order creation failed (server)' } );
    }
} );

// Verify (AJAX from handler)
app.post( '/api/verify-payment', ( req, res ) =>
{
    const { razorpay_order_id, razorpay_payment_id, razorpay_signature } = req.body || {};
    if ( !razorpay_order_id || !razorpay_payment_id || !razorpay_signature )
    {
        return res.status( 400 ).json( { ok: false, error: 'Missing fields' } );
    }
    const body = `${ razorpay_order_id }|${ razorpay_payment_id }`;
    const expected = crypto.createHmac( 'sha256', RAZORPAY_KEY_SECRET ).update( body ).digest( 'hex' );
    const isValid = expected === razorpay_signature;

    updatePayment.run( { status: isValid ? 'paid' : 'failed', razorpay_payment_id, razorpay_signature, razorpay_order_id } );

    const row = getOrderByRz.get( razorpay_order_id );
    if ( !row ) return res.json( { ok: isValid, redirect: null } );
    return res.json( { ok: isValid, redirect: `${ FRONTEND_BASE }/review.html?id=${ row.id }` } );
} );

// Verify (redirect flow)
app.all( '/api/verify-return', ( req, res ) =>
{
    try
    {
        const p = { ...req.query, ...req.body };
        const { razorpay_order_id, razorpay_payment_id, razorpay_signature } = p;

        if ( !razorpay_order_id || !razorpay_payment_id || !razorpay_signature )
        {
            return res.redirect( `${ FRONTEND_BASE }/order.html?failed=1` );
        }

        const body = `${ razorpay_order_id }|${ razorpay_payment_id }`;
        const expected = crypto.createHmac( 'sha256', RAZORPAY_KEY_SECRET ).update( body ).digest( 'hex' );
        const isValid = expected === razorpay_signature;

        updatePayment.run( { status: isValid ? 'paid' : 'failed', razorpay_payment_id, razorpay_signature, razorpay_order_id } );

        const row = getOrderByRz.get( razorpay_order_id );
        if ( !row ) return res.redirect( `${ FRONTEND_BASE }/order.html?unknown=1` );

        const dest = isValid ? `${ FRONTEND_BASE }/review.html?id=${ row.id }` : `${ FRONTEND_BASE }/order.html?failed=1`;
        return res.redirect( dest );
    } catch ( err )
    {
        console.error( 'Verify-return error:', err );
        return res.redirect( `${ FRONTEND_BASE }/order.html?failed=1` );
    }
} );

/* -----------------------------------
   Root → index.html (already static)
----------------------------------- */
app.get( '/', ( _req, res ) =>
{
    res.sendFile( path.join( documentRoot, 'index.html' ) );
} );

/* -----------------------------------
   Start
----------------------------------- */
app.listen( PORT, () =>
{
    console.log( `✅ True Purity server running at ${ FRONTEND_BASE }` );
} );
