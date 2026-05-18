'use client';
import { useEffect, useRef, useState } from 'react';

// These are NEXT_PUBLIC_ vars — safe to use client-side
const CLIENT_ID   = process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID ?? '';
const API_KEY     = process.env.NEXT_PUBLIC_GOOGLE_API_KEY ?? '';
const ROOT_FOLDER = process.env.NEXT_PUBLIC_GOOGLE_DRIVE_ROOT_FOLDER_ID ?? '';
const SCOPES      = 'https://www.googleapis.com/auth/drive.file';

declare global {
  interface Window {
    gapi: any;
    google: any;
  }
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

type UploadStatus = 'idle' | 'loading-api' | 'auth' | 'creating-folder' | 'uploading' | 'done' | 'error';

function normaliseName(s: string): string {
  return s.trim().replace(/\//g, '-').replace(/\s+/g, ' ');
}

function dateOnly(iso: string): string {
  return iso.split('T')[0] || new Date().toISOString().split('T')[0];
}

async function ensureFolder(
  accessToken: string,
  parentId: string,
  name: string,
): Promise<string> {
  const search = await fetch(
    `https://www.googleapis.com/drive/v3/files?q=${encodeURIComponent(
      `name='${name}' and '${parentId}' in parents and mimeType='application/vnd.google-apps.folder' and trashed=false`
    )}&fields=files(id)`,
    { headers: { Authorization: `Bearer ${accessToken}` } },
  );
  const searchData = await search.json();
  if (searchData.files?.length > 0) {
    return searchData.files[0].id as string;
  }
  const create = await fetch('https://www.googleapis.com/drive/v3/files', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      name,
      mimeType: 'application/vnd.google-apps.folder',
      parents: [parentId],
    }),
  });
  const createData = await create.json();
  if (!createData.id) throw new Error(`Failed to create folder "${name}": ${JSON.stringify(createData)}`);
  return createData.id as string;
}

export default function DrivePickerField({
  fieldId, label, required, repName, storeName, visitDate, value, onChange,
}: Props) {
  const [status, setStatus]           = useState<UploadStatus>('idle');
  const [uploadCount, setUploadCount] = useState(0);
  const [errorMsg, setErrorMsg]       = useState('');
  const pickerInited                  = useRef(false);

  useEffect(() => {
    if (pickerInited.current) return;
    pickerInited.current = true;

    const loadGapi = () =>
      new Promise<void>((resolve) => {
        const s = document.createElement('script');
        s.src = 'https://apis.google.com/js/api.js';
        s.onload = () => window.gapi.load('picker', resolve);
        document.head.appendChild(s);
      });

    const loadGis = () =>
      new Promise<void>((resolve) => {
        const s = document.createElement('script');
        s.src = 'https://accounts.google.com/gsi/client';
        s.onload = () => resolve();
        document.head.appendChild(s);
      });

    Promise.all([loadGapi(), loadGis()]).catch(() => {});
  }, []);

  const missingContext = !repName.trim() || !storeName.trim();

  async function handleUpload() {
    if (missingContext) return;
    if (!CLIENT_ID || !API_KEY || !ROOT_FOLDER) {
      setStatus('error');
      setErrorMsg('Google Drive is not configured. Contact Quintus.');
      return;
    }

    setStatus('auth');
    setErrorMsg('');

    const tokenClient = window.google.accounts.oauth2.initTokenClient({
      client_id: CLIENT_ID,
      scope: SCOPES,
      callback: async (tokenResponse: any) => {
        if (tokenResponse.error) {
          setStatus('error');
          setErrorMsg(`Auth failed: ${tokenResponse.error}`);
          return;
        }
        await runPickerAndUpload(tokenResponse.access_token);
      },
    });
    tokenClient.requestAccessToken({ prompt: '' });
  }

  async function runPickerAndUpload(accessToken: string) {
    return new Promise<void>((resolve) => {
      const pickerCallback = async (data: any) => {
        if (data.action !== window.google.picker.Action.PICKED) {
          setStatus('idle');
          resolve();
          return;
        }
        const files: any[] = data[window.google.picker.Response.DOCUMENTS];
        if (!files || files.length === 0) {
          setStatus('idle');
          resolve();
          return;
        }

        try {
          setStatus('creating-folder');

          const rep   = normaliseName(repName);
          const store = normaliseName(storeName);
          const date  = dateOnly(visitDate || new Date().toISOString());

          const repFolderId   = await ensureFolder(accessToken, ROOT_FOLDER, rep);
          const storeFolderId = await ensureFolder(accessToken, repFolderId, store);
          const dateFolderId  = await ensureFolder(accessToken, storeFolderId, date);

          setStatus('uploading');
          let uploaded = 0;
          for (const doc of files) {
            const fileId    = doc[window.google.picker.Document.ID];
            const parentId  = doc[window.google.picker.Document.PARENT_ID] || '';
            await fetch(
              `https://www.googleapis.com/drive/v3/files/${fileId}?addParents=${dateFolderId}&removeParents=${parentId}&fields=id`,
              {
                method: 'PATCH',
                headers: { Authorization: `Bearer ${accessToken}` },
              },
            );
            uploaded++;
            setUploadCount(uploaded);
          }

          const folderUrl = `https://drive.google.com/drive/folders/${dateFolderId}`;
          onChange(folderUrl);
          setStatus('done');
        } catch (err) {
          setStatus('error');
          setErrorMsg(err instanceof Error ? err.message : 'Upload failed');
        }
        resolve();
      };

      const picker = new window.google.picker.PickerBuilder()
        .addView(new window.google.picker.DocsUploadView().setIncludeFolders(false))
        .addView(new window.google.picker.PhotosView())
        .setOAuthToken(accessToken)
        .setDeveloperKey(API_KEY)
        .setCallback(pickerCallback)
        .setTitle(`${label} — select photos`)
        .enableFeature(window.google.picker.Feature.MULTISELECT_ENABLED)
        .build();
      picker.setVisible(true);
    });
  }

  return (
    <div className="field" id={`drive-field-${fieldId}`}>
      <span className="label">{label}{required && ' *'}</span>

      {missingContext && (
        <p className="drive-hint">Fill in Store Name and Servicing Rep first</p>
      )}

      {!missingContext && status !== 'done' && (
        <button
          type="button"
          className="drive-btn"
          onClick={handleUpload}
          disabled={status !== 'idle' && status !== 'error'}
        >
          {status === 'idle'            && '📤 Upload to Google Drive'}
          {status === 'auth'            && 'Waiting for Google sign-in…'}
          {status === 'creating-folder' && 'Creating folder…'}
          {status === 'uploading'       && `Uploading… (${uploadCount} done)`}
          {status === 'error'           && '⚠ Retry upload'}
        </button>
      )}

      {status === 'done' && value && (
        <div className="drive-done">
          <span>✓ Photos uploaded</span>
          <a href={value} target="_blank" rel="noreferrer" className="drive-link">
            View folder ↗
          </a>
        </div>
      )}

      {status === 'error' && errorMsg && (
        <p className="drive-error">{errorMsg}</p>
      )}

      <input type="hidden" name={fieldId} value={value} />

      <style jsx>{`
        .drive-btn {
          display: flex; align-items: center; justify-content: center;
          width: 100%; min-height: 44px; padding: 12px 14px;
          background: #0D2040; color: #B8CCE8;
          border: 1px dashed rgba(107,158,208,0.5); border-radius: 8px;
          font-size: 15px; font-family: Barlow, sans-serif; cursor: pointer;
          transition: border-color 0.15s, color 0.15s;
        }
        .drive-btn:hover:not(:disabled) { border-color: #F5C400; color: #F5C400; }
        .drive-btn:disabled { opacity: 0.6; cursor: not-allowed; }
        .drive-done {
          display: flex; align-items: center; gap: 12px;
          padding: 12px 14px; background: rgba(45,140,122,0.12);
          border: 1px solid rgba(45,140,122,0.30); border-radius: 8px;
          color: #C8EDE7; font-size: 14px;
        }
        .drive-link { color: #F5C400; font-weight: 600; text-decoration: none; }
        .drive-link:hover { text-decoration: underline; }
        .drive-hint { color: #6B9ED0; font-size: 13px; margin: 4px 0 0; }
        .drive-error { color: #FDDCDC; font-size: 13px; margin: 6px 0 0; }
      `}</style>
    </div>
  );
}
