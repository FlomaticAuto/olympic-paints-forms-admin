'use client';
import { useEffect, useRef, useState } from 'react';
import * as msal from '@azure/msal-browser';

const CLIENT_ID  = process.env.NEXT_PUBLIC_MSAL_CLIENT_ID ?? '';
const GRAPH_BASE = 'https://graph.microsoft.com/v1.0';
// Personal Microsoft accounts use 'consumers' as the authority tenant
const AUTHORITY  = `https://login.microsoftonline.com/consumers`;
const SCOPES     = ['Files.ReadWrite'];

// Root folder name in OneDrive — created automatically if it doesn't exist
const ROOT_FOLDER_NAME = 'Olympic Paints — Merchandising Visits';

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

/** Get or initialise the MSAL singleton */
function getMsalInstance(): msal.PublicClientApplication {
  if (!window._msalInstance) {
    window._msalInstance = new msal.PublicClientApplication({
      auth: {
        clientId:   CLIENT_ID,
        authority:  AUTHORITY,
        redirectUri: window.location.origin,
      },
      cache: { cacheLocation: 'sessionStorage' },
    });
  }
  return window._msalInstance;
}

/**
 * Acquire an access token silently, falling back to a popup if needed.
 * Returns null if the user cancels or an error occurs.
 */
async function acquireToken(): Promise<string | null> {
  const instance = getMsalInstance();
  await instance.initialize();

  const accounts = instance.getAllAccounts();
  const request  = { scopes: SCOPES, account: accounts[0] };

  try {
    const result = await instance.acquireTokenSilent(request);
    return result.accessToken;
  } catch {
    try {
      const result = await instance.acquireTokenPopup({ scopes: SCOPES });
      return result.accessToken;
    } catch {
      return null;
    }
  }
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
      : body
        ? JSON.stringify(body)
        : undefined,
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(`Graph ${method} ${path} → ${res.status}: ${JSON.stringify(err)}`);
  }
  // 204 No Content has no body
  if (res.status === 204) return null;
  return res.json();
}

/**
 * Ensure a folder exists at the given path under /me/drive/root.
 * Creates each segment if missing. Returns the driveItem id of the leaf folder.
 *
 * Path example: "Olympic Paints — Merchandising Visits/Bhadresh/Kit Kat/2026-05-25"
 */
async function ensureFolderPath(token: string, segments: string[]): Promise<string> {
  let parentId = 'root';

  for (const name of segments) {
    // Check if child folder already exists
    const encoded = encodeURIComponent(name);
    let folderId: string | null = null;

    try {
      const children = await graphRequest(
        'GET',
        `/me/drive/items/${parentId}/children?$filter=name eq '${encoded}' and folder ne null&$select=id,name`,
        token,
      );
      const match = (children.value ?? []).find(
        (item: any) => item.name.toLowerCase() === name.toLowerCase(),
      );
      if (match) folderId = match.id;
    } catch {
      // If filtering fails (some Graph versions), fall through to create
    }

    if (!folderId) {
      const created = await graphRequest(
        'POST',
        `/me/drive/items/${parentId}/children`,
        token,
        {
          name,
          folder: {},
          '@microsoft.graph.conflictBehavior': 'rename',
        },
        'application/json',
      );
      folderId = created.id;
    }

    parentId = folderId!;
  }

  return parentId;
}

/**
 * Upload a File to a OneDrive folder (simple upload, max ~4 MB per file).
 * For larger files an upload session would be needed, but visit photos are
 * typically under 4 MB each.
 */
async function uploadFile(token: string, folderId: string, file: File): Promise<void> {
  const encodedName = encodeURIComponent(file.name);
  await graphRequest(
    'PUT',
    `/me/drive/items/${folderId}:/${encodedName}:/content`,
    token,
    await file.arrayBuffer(),
    file.type || 'application/octet-stream',
  );
}

/**
 * Create a read-only sharing link for a folder and return the webUrl.
 * Falls back to the driveItem webUrl if sharing link creation fails.
 */
async function getFolderUrl(token: string, folderId: string): Promise<string> {
  // First get the direct webUrl from the folder item
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
  const fileInputRef                  = useRef<HTMLInputElement>(null);
  const msalReadyRef                  = useRef(false);

  // Pre-initialise MSAL on mount so the first upload tap is fast
  useEffect(() => {
    if (msalReadyRef.current || !CLIENT_ID) return;
    msalReadyRef.current = true;
    try {
      getMsalInstance().initialize().catch(() => {/* ignore pre-init errors */});
    } catch {/* ignore */}
  }, []);

  const missingContext = !repName.trim() || !storeName.trim();

  function handleButtonClick() {
    if (missingContext || !CLIENT_ID) return;
    fileInputRef.current?.click();
  }

  async function handleFilesSelected(e: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files ?? []);
    if (files.length === 0) return;

    setStatus('auth');
    setErrorMsg('');
    setUploadCount(0);
    setTotalFiles(files.length);

    // Reset input so same files can be re-selected after an error
    e.target.value = '';

    try {
      const token = await acquireToken();
      if (!token) {
        setStatus('error');
        setErrorMsg('Sign-in cancelled or failed. Tap to try again.');
        return;
      }

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

      {/* Hidden native file input — triggered programmatically */}
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        multiple
        style={{ position: 'absolute', width: 1, height: 1, opacity: 0, pointerEvents: 'none' }}
        onChange={handleFilesSelected}
      />

      {!missingContext && status !== 'done' && (
        <button
          type="button"
          className="od-btn"
          onClick={handleButtonClick}
          disabled={status !== 'idle' && status !== 'error'}
        >
          {status === 'idle'            && '📤 Upload to OneDrive'}
          {status === 'auth'            && 'Signing in to Microsoft…'}
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
