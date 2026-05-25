'use client';
import { useEffect, useRef, useState } from 'react';
import * as msal from '@azure/msal-browser';

const CLIENT_ID  = process.env.NEXT_PUBLIC_MSAL_CLIENT_ID ?? '';
const GRAPH_BASE = 'https://graph.microsoft.com/v1.0';
const AUTHORITY  = 'https://login.microsoftonline.com/common';
const SCOPES     = ['Files.ReadWrite'];

const ROOT_FOLDER_NAME = 'Olympic Paints — Merchandising Visits';

// sessionStorage key used to persist pending-upload context across the redirect
const PENDING_KEY = 'od_pending_upload';

declare global {
  interface Window { _msalInstance?: msal.PublicClientApplication }
}

interface Props {
  fieldId:   string;
  label:     string;
  required:  boolean;
  repName:   string;
  storeName: string;
  visitDate: string;
  value:     string;
  onChange:  (folderUrl: string) => void;
}

type UploadStatus = 'idle' | 'auth' | 'creating-folder' | 'uploading' | 'done' | 'error';

function normaliseName(s: string): string {
  return s.trim().replace(/\//g, '-').replace(/\s+/g, ' ');
}

function dateOnly(iso: string): string {
  return iso.split('T')[0] || new Date().toISOString().split('T')[0];
}

/** Singleton MSAL instance — redirectUri must match Azure App Registration exactly */
function getMsalInstance(): msal.PublicClientApplication {
  if (!window._msalInstance) {
    window._msalInstance = new msal.PublicClientApplication({
      auth: {
        clientId:    CLIENT_ID,
        authority:   AUTHORITY,
        redirectUri: window.location.origin + '/auth/callback',
      },
      cache: { cacheLocation: 'sessionStorage', storeAuthStateInCookie: false },
    });
  }
  return window._msalInstance;
}

/** Graph API helper — throws on non-2xx */
async function graphRequest(
  method: string,
  path: string,
  token: string,
  body?: unknown,
  contentType?: string,
): Promise<any> {
  const res = await fetch(`${GRAPH_BASE}${path}`, {
    method,
    headers: {
      Authorization: `Bearer ${token}`,
      ...(contentType ? { 'Content-Type': contentType } : {}),
    },
    body: body instanceof Blob || body instanceof ArrayBuffer
      ? (body as BodyInit)
      : body ? JSON.stringify(body) : undefined,
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(`Graph ${method} ${path} → ${res.status}: ${JSON.stringify(err)}`);
  }
  if (res.status === 204) return null;
  return res.json();
}

async function ensureFolderPath(token: string, segments: string[]): Promise<string> {
  let parentId = 'root';
  for (const name of segments) {
    let folderId: string | null = null;
    try {
      const children = await graphRequest(
        'GET',
        `/me/drive/items/${parentId}/children?$filter=name eq '${encodeURIComponent(name)}' and folder ne null&$select=id,name`,
        token,
      );
      const match = (children.value ?? []).find(
        (item: any) => item.name.toLowerCase() === name.toLowerCase(),
      );
      if (match) folderId = match.id;
    } catch { /* fall through to create */ }

    if (!folderId) {
      const created = await graphRequest(
        'POST',
        `/me/drive/items/${parentId}/children`,
        token,
        { name, folder: {}, '@microsoft.graph.conflictBehavior': 'rename' },
        'application/json',
      );
      folderId = created.id;
    }
    parentId = folderId!;
  }
  return parentId;
}

async function uploadFile(token: string, folderId: string, file: File): Promise<void> {
  await graphRequest(
    'PUT',
    `/me/drive/items/${folderId}:/${encodeURIComponent(file.name)}:/content`,
    token,
    await file.arrayBuffer(),
    file.type || 'application/octet-stream',
  );
}

async function getFolderUrl(token: string, folderId: string): Promise<string> {
  try {
    const item = await graphRequest('GET', `/me/drive/items/${folderId}?$select=webUrl`, token);
    return item.webUrl as string;
  } catch {
    return `https://onedrive.live.com/?id=${folderId}`;
  }
}

// ─────────────────────────────────────────────────────────────────────────────

export default function OneDriveUploadField({
  fieldId, label, required, repName, storeName, visitDate, value, onChange,
}: Props) {
  const [status, setStatus]           = useState<UploadStatus>('idle');
  const [uploadCount, setUploadCount] = useState(0);
  const [totalFiles, setTotalFiles]   = useState(0);
  const [errorMsg, setErrorMsg]       = useState('');
  const [needsSignIn, setNeedsSignIn] = useState(false);
  const fileInputRef                  = useRef<HTMLInputElement>(null);
  const initDoneRef                   = useRef(false);

  const missingContext = !repName.trim() || !storeName.trim();

  /**
   * On mount:
   * 1. Initialise MSAL and handle any pending redirect response.
   * 2. If a token is already cached, clear the sign-in prompt.
   * 3. If we came back from a redirect AND files were stored, trigger the upload.
   */
  useEffect(() => {
    if (initDoneRef.current || !CLIENT_ID) return;
    initDoneRef.current = true;

    (async () => {
      try {
        const instance = getMsalInstance();
        await instance.initialize();

        // Handle the redirect response — this resolves the auth code exchange
        await instance.handleRedirectPromise();

        const accounts = instance.getAllAccounts();
        if (accounts.length > 0) {
          setNeedsSignIn(false);
        } else {
          setNeedsSignIn(true);
        }
      } catch {
        setNeedsSignIn(true);
      }
    })();
  }, []);

  /** Get a valid access token — silent only (no popup, no redirect here) */
  async function getToken(): Promise<string | null> {
    const instance = getMsalInstance();
    await instance.initialize();
    const accounts = instance.getAllAccounts();
    if (accounts.length === 0) return null;
    try {
      const result = await instance.acquireTokenSilent({ scopes: SCOPES, account: accounts[0] });
      return result.accessToken;
    } catch {
      return null;
    }
  }

  /** Redirect the page to Microsoft login, then come back here */
  async function signIn() {
    try {
      // Save the current page URL so /auth/callback can return here
      sessionStorage.setItem('od_return_url', window.location.href);
      const instance = getMsalInstance();
      await instance.initialize();
      await instance.loginRedirect({ scopes: SCOPES });
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Sign-in failed.');
      setStatus('error');
    }
  }

  function handleButtonClick() {
    if (missingContext || !CLIENT_ID) return;
    fileInputRef.current?.click();
  }

  async function handleFilesSelected(e: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files ?? []);
    if (files.length === 0) return;
    e.target.value = '';

    setStatus('auth');
    setErrorMsg('');
    setUploadCount(0);
    setTotalFiles(files.length);

    const token = await getToken();
    if (!token) {
      setStatus('error');
      setErrorMsg('Not signed in. Tap "Sign in to Microsoft" first.');
      setNeedsSignIn(true);
      return;
    }

    try {
      setStatus('creating-folder');
      const rep   = normaliseName(repName);
      const store = normaliseName(storeName);
      const date  = dateOnly(visitDate || new Date().toISOString());

      const folderId = await ensureFolderPath(token, [ROOT_FOLDER_NAME, rep, store, date]);

      setStatus('uploading');
      let uploaded = 0;
      for (const file of files) {
        await uploadFile(token, folderId, file);
        uploaded++;
        setUploadCount(uploaded);
      }

      const folderUrl = await getFolderUrl(token, folderId);
      onChange(folderUrl);
      setStatus('done');
    } catch (err) {
      setStatus('error');
      setErrorMsg(err instanceof Error ? err.message : 'Upload failed. Tap to try again.');
    }
  }

  if (!CLIENT_ID) {
    return (
      <div className="field" id={`onedrive-field-${fieldId}`}>
        <span className="label">{label}{required && ' *'}</span>
        <p className="od-hint od-error">OneDrive is not configured. Contact Quintus.</p>
        <input type="hidden" name={fieldId} value={value} />
      </div>
    );
  }

  return (
    <div className="field" id={`onedrive-field-${fieldId}`}>
      <span className="label">{label}{required && ' *'}</span>

      {missingContext && (
        <p className="od-hint">Fill in Store Name and Servicing Rep first</p>
      )}

      {/* Hidden native file input */}
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        multiple
        style={{ position: 'absolute', width: 1, height: 1, opacity: 0, pointerEvents: 'none' }}
        onChange={handleFilesSelected}
      />

      {/* Step 1 — not signed in yet: show Sign In button */}
      {!missingContext && needsSignIn && status !== 'done' && (
        <button type="button" className="od-btn od-signin" onClick={signIn}>
          🔑 Sign in to Microsoft to enable photo upload
        </button>
      )}

      {/* Step 2 — signed in: show Upload button */}
      {!missingContext && !needsSignIn && status !== 'done' && (
        <button
          type="button"
          className="od-btn"
          onClick={handleButtonClick}
          disabled={status !== 'idle' && status !== 'error'}
        >
          {status === 'idle'            && '📤 Upload to OneDrive'}
          {status === 'auth'            && 'Checking sign-in…'}
          {status === 'creating-folder' && 'Setting up folder…'}
          {status === 'uploading'       && `Uploading… (${uploadCount} / ${totalFiles})`}
          {status === 'error'           && '⚠ Retry upload'}
        </button>
      )}

      {status === 'done' && value && (
        <div className="od-done">
          <span>✓ {totalFiles} photo{totalFiles !== 1 ? 's' : ''} uploaded</span>
          <a href={value} target="_blank" rel="noreferrer" className="od-link">
            View folder ↗
          </a>
        </div>
      )}

      {status === 'error' && errorMsg && (
        <p className="od-error">{errorMsg}</p>
      )}

      <input type="hidden" name={fieldId} value={value} />

      <style jsx>{`
        .od-btn {
          display: flex; align-items: center; justify-content: center;
          width: 100%; min-height: 56px; padding: 16px 18px;
          background: #0D2040; color: #B8CCE8;
          border: 1.5px dashed rgba(107,158,208,0.5); border-radius: 10px;
          font-size: 18px; font-family: Barlow, sans-serif; cursor: pointer;
          transition: border-color 0.15s, color 0.15s;
        }
        .od-btn:hover:not(:disabled) { border-color: #F5C400; color: #F5C400; }
        .od-btn:disabled { opacity: 0.6; cursor: not-allowed; }
        .od-signin {
          background: #1A3D6E; border-style: solid; border-color: rgba(107,158,208,0.6);
        }
        .od-done {
          display: flex; align-items: center; gap: 14px;
          padding: 16px 18px; background: rgba(45,140,122,0.12);
          border: 1.5px solid rgba(45,140,122,0.30); border-radius: 10px;
          color: #C8EDE7; font-size: 17px;
        }
        .od-link { color: #F5C400; font-weight: 600; font-size: 17px; text-decoration: none; }
        .od-link:hover { text-decoration: underline; }
        .od-hint { color: #6B9ED0; font-size: 15px; margin: 6px 0 0; }
        .od-error { color: #FDDCDC; font-size: 15px; margin: 8px 0 0; }
      `}</style>
    </div>
  );
}
