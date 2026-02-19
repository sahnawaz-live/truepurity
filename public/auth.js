// auth.js
( () =>
{
    const API_BASE = window.location.origin; // your Node server serves the site & API
    const authSlot = document.getElementById( 'authSlot' );

    function getToken () { return localStorage.getItem( 'tp_jwt' ) || ''; }
    function setToken ( t ) { t ? localStorage.setItem( 'tp_jwt', t ) : localStorage.removeItem( 'tp_jwt' ); }

    async function getMe ()
    {
        const t = getToken();
        if ( !t ) return null;
        try
        {
            const r = await fetch( `${ API_BASE }/api/me`, { headers: { Authorization: `Bearer ${ t }` } } );
            if ( !r.ok ) return null;
            return await r.json();
        } catch { return null; }
    }

    function renderLoggedOut ()
    {
        authSlot.innerHTML = `
      <a class="nav-link" href="#" data-bs-toggle="modal" data-bs-target="#loginModal">
        <i class="bi bi-box-arrow-in-right me-1"></i> Login
      </a>
    `;
    }

    function renderLoggedIn ( user )
    {
        const name = user?.name || user?.email?.split( '@' )[ 0 ] || 'Account';
        authSlot.innerHTML = `
      <a class="nav-link dropdown-toggle" href="#" role="button" data-bs-toggle="dropdown">
        <i class="bi bi-person-circle me-1"></i> ${ name }
      </a>
      <ul class="dropdown-menu dropdown-menu-end">
        <li><a class="dropdown-item" href="orders.html"><i class="bi bi-receipt me-2"></i>My Orders</a></li>
        <li><a class="dropdown-item" href="profile.html"><i class="bi bi-gear me-2"></i>Profile</a></li>
        <li><hr class="dropdown-divider"></li>
        <li><a class="dropdown-item text-danger" href="#" id="logoutBtn"><i class="bi bi-box-arrow-right me-2"></i>Logout</a></li>
      </ul>
    `;
        authSlot.querySelector( '#logoutBtn' ).addEventListener( 'click', ( e ) =>
        {
            e.preventDefault();
            setToken( '' );
            location.reload();
        } );
    }

    async function init ()
    {
        const me = await getMe();
        if ( me ) renderLoggedIn( me );
        else renderLoggedOut();

        // Login form handler (modal)
        const loginForm = document.getElementById( 'loginForm' );
        if ( loginForm )
        {
            loginForm.addEventListener( 'submit', async ( e ) =>
            {
                e.preventDefault();
                const fd = new FormData( loginForm );
                const payload = Object.fromEntries( fd.entries() );
                try
                {
                    const r = await fetch( `${ API_BASE }/api/auth/login`, {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify( payload )
                    } );
                    const data = await r.json();
                    if ( !r.ok ) throw new Error( data?.error || 'Login failed' );
                    setToken( data.token );
                    // Close modal
                    const modal = bootstrap.Modal.getInstance( document.getElementById( 'loginModal' ) ) ||
                        new bootstrap.Modal( document.getElementById( 'loginModal' ) );
                    modal.hide();
                    // Refresh navbar
                    const me2 = await getMe();
                    renderLoggedIn( me2 );
                } catch ( err )
                {
                    alert( err.message || 'Login failed' );
                }
            } );
        }
    }

    document.addEventListener( 'DOMContentLoaded', init );
} )();
