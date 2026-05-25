'use client';
/**
 * /auth/callback
 *
 * Registered as the MSAL redirect URI in Azure App Registration.
 * Handles the auth code redirect from Microsoft, stores the token in
 * sessionStorage, then sends the user back to the page they came from
 * (stored in sessionStorage under 'od_return_url' before the redirect).
 */
import { useEffect, useState } from 'react';
import * as msal from '@azure/msal-browser';

const CLIENT_ID = process.env.NEXT_PUBLIC_MSAL_CLIENT_ID ?? '';
const AUTHORITY = 'https://login.microsoftonline.com/consumers';

export default function AuthCallback() {
  const [message, setMessage] = useState('Completing sign-in…');

  useEffect(() => {
    if (!CLIENT_ID) {
      setMessage('OneDrive not configured.');
      return;
    }

    (async () => {
      try {
        const instance = new msal.PublicClientApplication({
          auth: {
            clientId:    CLIENT_ID,
            authority:   AUTHORITY,
            redirectUri: window.location.origin + '/auth/callback',
          },
          cache: { cacheLocation: 'sessionStorage', storeAuthStateInCookie: false },
        });

        await instance.initialize();
        await instance.handleRedirectPromise();

        // Return to the page that triggered sign-in
        const returnUrl = sessionStorage.getItem('od_return_url') || '/';
        sessionStorage.removeItem('od_return_url');
        window.location.replace(returnUrl);
      } catch (err) {
        setMessage('Sign-in failed. Please close this page and try again.');
        console.error(err);
      }
    })();
  }, []);

  return (
    <div style={{
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      height: '100vh', background: '#0D0D0B', color: '#B8CCE8',
      fontFamily: 'Barlow, sans-serif', fontSize: '18px',
    }}>
      {message}
    </div>
  );
}
