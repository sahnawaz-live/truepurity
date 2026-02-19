
// reveal-on-scroll
const API_BASE = 'http://localhost:3001';

const io = new IntersectionObserver( ( entries ) =>
{
  entries.forEach( e => { if ( e.isIntersecting ) { e.target.classList.add( 'show' ); io.unobserve( e.target ); } } );
}, { threshold: 0.1 } );
document.querySelectorAll( '.reveal' ).forEach( el => io.observe( el ) );
document.getElementById( 'year' ).textContent = new Date().getFullYear();

// WhatsApp config + models
// WhatsApp + pricing
const waNumber = "918100141714";

// MRP per model (incl. taxes)
const MODEL_DETAILS = {
  "TP-Prime": { storage: "12 L", capacity: "15 L/hr", technology: "RO + UV Led + Basic UF + Copper + Basic Minerals", stages: "8 Stage", mrp: 11999 },
  "TP-ROYAL": { storage: "12 L", capacity: "18 L/hr", technology: "RO + UV Led + Basic UF + TDS + Copper + Minerals", stages: "9 Stage", mrp: 15990 },
  "TP-Elite": { storage: "15 L", capacity: "20 L/hr", technology: "RO + UV Led + UF + TDS + Copper + Alkaline", stages: "9 Stage", mrp: 23990 },

};

// Per-model discount (%)
const MODEL_DISCOUNT = {
  "TP-Prime": 50,
  "TP-ROYAL": 40,
  "TP-Elite": 40

};

// All 8 product variants (images in /assets)
const PRODUCTS = [
  { model: "TP-Prime", variant: "Prime Cabin White", img: "TP- PRIME CABIN.png" },
  { model: "TP-ROYAL", variant: "Royal Blue", img: "TP-ROYAL BLUE.png" },
  { model: "TP-ROYAL", variant: "Royal Black", img: "TP-ROYAL BLACK.png" },
  { model: "TP-ROYAL", variant: "Royal Transparent", img: "TP- ROYAL BLACK TRASPARENT.png" },
  { model: "TP-ROYAL", variant: "White Transparent", img: "TP-ROYAL WHITE.png" },


  { model: "TP-Elite", variant: "Elite Black", img: "TP-ELITE   BLACK.png" },
  { model: "TP-Elite", variant: "Elite Grey", img: "TP-ELITE   GREY.png" },
  { model: "TP-Elite", variant: "Elite White", img: "TP-ELITE   WHITE.png" },

];

const grid = document.getElementById( "product-grid" );

const ruIN = n => n.toLocaleString( "en-IN" );

function priceBlock ( mrp, sale, discountLabel )
{
  return `
    <div class="d-flex align-items-baseline gap-2 mb-2">
      <div class="h5 mb-0 text-danger">₹${ ruIN( sale ) }</div>
      <div class="text-secondary small"><s>₹${ ruIN( mrp ) }</s></div>
      <span class="badge bg-success ms-1">${ discountLabel }</span>
    </div>`;
}

function card ( item )
{
  const spec = MODEL_DETAILS[ item.model ];
  const off = MODEL_DISCOUNT[ item.model ] ?? 0;          // 40 / 50
  const sale = Math.round( spec.mrp * ( 1 - off / 100 ) );      // calc sale price

  const imgSrc = "assets/" + encodeURI( item.img );

  // Keep your existing Order + Free Test actions
  const orderLink = `order.html?model=${ encodeURIComponent( item.model ) }&variant=${ encodeURIComponent( item.variant ) }&price=${ sale }`;

  const orderMsg = encodeURIComponent( `Order Request:
Model: ${ item.model }
Variant: ${ item.variant }
Price: ₹${ sale }` );

  return `<div class="col-sm-6 col-lg-3">
    <div class="card product-card h-100">
      <img src="${ imgSrc }" class="card-img-top" alt="${ item.model } - ${ item.variant }">
      <div class="card-body d-flex flex-column">
        <h6 class="mb-1">${ item.model }</h6>
        <div class="text-secondary small mb-2">${ item.variant }</div>
        ${ priceBlock( spec.mrp, sale, `${ off }% OFF` ) }
        <ul class="small text-secondary ps-3 mb-3">
          <li><b>Storage:</b> ${ spec.storage }</li>
          <li><b>Filtration capacity:</b> ${ spec.capacity }</li>
          <li><b>Purifying Technology:</b> ${ spec.technology }</li>
          <li><b>Purification:</b> ${ spec.stages }</li>
        </ul>
        <div class="mt-auto d-grid gap-2">
          <!-- Order page (quantity + UPI payment) -->
          <a class="btn btn-brand" href="${ orderLink }">
            <i class="bi bi-bag-check me-1"></i> Order Now
          </a>
          <!-- Free Test: opens & pre-fills contact form (you already added the handler) -->
          <a class="btn btn-outline-brand free-test-btn" href="#contact"
             data-model="${ item.model }" data-variant="${ item.variant }">
            <i class="bi bi-droplet-half me-1"></i> Free Test
          </a>
        </div>
      </div>
    </div>
  </div>`;
}

// Render
document.getElementById( "product-grid" ).innerHTML = PRODUCTS.map( card ).join( "" );

/* ===== Contact Form: WhatsApp / Email send ===== */
( function ()
{
  const WA_NUMBER = "918100141714";                 // your WhatsApp number (no +)
  const SUPPORT_EMAIL = "Truepurityro@gmail.com";     // your support email

  const form = document.getElementById( 'queryForm' );
  const emailBtn = document.getElementById( 'emailBtn' );

  // Helpers
  const getData = ( f ) => Object.fromEntries( new FormData( f ).entries() );
  const ru = ( s ) => ( s || "" ).toString().trim();

  function buildMessage ( data )
  {
    return `New Website Query:
Name: ${ ru( data.name ) }
Phone: ${ ru( data.phone ) }
City: ${ ru( data.city ) || "-" }
Model: ${ ru( data.model ) || "-" }
Preferred: ${ ru( data.pref ) || "-" } | Best time: ${ ru( data.time ) || "Anytime" }

Message:
${ ru( data.message ) }`;
  }

  function validateForm ()
  {
    if ( !form.checkValidity() )
    {
      form.classList.add( 'was-validated' );
      return false;
    }
    // Honeypot (spam)
    if ( form.company && ru( form.company.value ) !== "" ) return false;
    return true;
  }

  // Submit → WhatsApp
  form.addEventListener( 'submit', function ( e )
  {
    e.preventDefault();
    if ( !validateForm() ) return;

    const data = getData( form );
    const text = buildMessage( data );

    const link = `https://wa.me/${ WA_NUMBER }?text=${ encodeURIComponent( text ) }`;
    window.open( link, '_blank', 'noopener' );

    form.reset();
    form.classList.remove( 'was-validated' );
  } );

  // Click → Email
  emailBtn.addEventListener( 'click', function ()
  {
    if ( !validateForm() ) return;

    const data = getData( form );
    const subject = `Website Query from ${ ru( data.name ) } (${ ru( data.phone ) })`;
    const body = buildMessage( data );

    const mailto = `mailto:${ encodeURIComponent( SUPPORT_EMAIL ) }?subject=${ encodeURIComponent( subject ) }&body=${ encodeURIComponent( body ) }`;
    // Use location so mobile clients (Gmail app/Outlook) pick it up reliably
    window.location.href = mailto;
  } );
} )();


/* ===== Free Test: Prefill form from product card ===== */
( function ()
{
  const form = document.getElementById( 'queryForm' );
  if ( !form ) return;

  const modelSelect = form.querySelector( 'select[name="model"]' );
  const msgBox = form.querySelector( 'textarea[name="message"]' );
  const nameInput = form.querySelector( 'input[name="name"]' );
  const prefWA = form.querySelector( '#prefWA' );   // radio for WhatsApp (optional)

  // Delegate clicks for dynamically rendered buttons
  document.addEventListener( 'click', function ( e )
  {
    const btn = e.target.closest( '.free-test-btn' );
    if ( !btn ) return;

    // Prevent native anchor jump; we'll smooth scroll ourselves
    e.preventDefault();

    const model = btn.getAttribute( 'data-model' ) || '';
    const variant = btn.getAttribute( 'data-variant' ) || '';

    // 1) Select the model in the dropdown (if present)
    if ( modelSelect )
    {
      // Try to match option text (your options are "TP‑Prime", "TP‑ROYAL", "TP‑Elite")
      const target = Array.from( modelSelect.options ).find(
        o => o.text.toLowerCase().replace( /\s+/g, '' ) === model.toLowerCase().replace( /\s+/g, '' )
      );
      if ( target ) modelSelect.value = target.value;
    }

    // 2) Prefill a helpful message
    if ( msgBox )
    {
      msgBox.value =
        `Free Water Test Request:
Model: ${ model } (${ variant })
Please contact me to schedule a convenient time.`;
    }

    // 3) Nudge preferred contact to WhatsApp (optional)
    if ( prefWA ) prefWA.checked = true;

    // 4) Smooth scroll to the contact section & focus name
    const contact = document.getElementById( 'contact' );
    if ( contact && contact.scrollIntoView )
    {
      contact.scrollIntoView( { behavior: 'smooth', block: 'start' } );
    }
    // Small delay so focus happens after scroll on mobile
    setTimeout( () => { nameInput?.focus(); }, 400 );
  } );
} )();

// check token to decide login/logout
( function ()
{
  const authLink = document.getElementById( "authLink" );
  const token = localStorage.getItem( "tp_token" );
  const user = localStorage.getItem( "tp_user" );

  if ( token && user )
  {
    // logged in
    authLink.textContent = "Logout";
    authLink.href = "#";
    authLink.addEventListener( "click", e =>
    {
      e.preventDefault();
      localStorage.removeItem( "tp_token" );
      localStorage.removeItem( "tp_user" );
      location.href = "index.html"; // refresh to update navbar
    } );
  } else
  {
    // not logged in
    authLink.textContent = "Login";
    authLink.href = "login.html";
  }
} )();

// ===== Temporarily route "Order Now" to WhatsApp (site-wide safeguard) =====
( function ()
{
  const WA = "918100141714"; // your WhatsApp number (no +)
  // Delegate clicks so it also catches dynamically rendered cards
  document.addEventListener( 'click', function ( e )
  {
    const btn = e.target.closest( '.btn.btn-brand' ); // your "Order Now" button class
    if ( !btn ) return;

    // Try to extract model/variant/price from the card around the button
    const card = btn.closest( '.product-card' );
    const model = card?.querySelector( 'h6' )?.textContent?.trim() || 'Model';
    const variant = card?.querySelector( '.text-secondary.small' )?.textContent?.trim() || 'Variant';
    const price = card?.querySelector( '.h5' )?.textContent?.trim() || '';

    // Build WhatsApp message
    const msg = `Order request via website:
Model: ${ model }
Variant: ${ variant }
Shown price: ${ price }

Please confirm availability and delivery.`;
    // Open WA and stop the original link to order.html
    e.preventDefault();
    window.open( `https://wa.me/${ WA }?text=${ encodeURIComponent( msg ) }`, '_blank', 'noopener' );
  }, true );
} )();
