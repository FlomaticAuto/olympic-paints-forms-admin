// Shared TypeScript types for the form management system.
// Mirrors the Supabase schema defined in the SQL migration.

export type FieldType =
  | 'text'
  | 'textarea'
  | 'number'
  | 'email'
  | 'tel'
  | 'select'
  | 'radio'
  | 'checkbox'
  | 'checkbox_grid'  // multi-select tick grid — options rendered in 2-col layout, default is comma-separated pre-ticked values
  | 'date'
  | 'time'
  | 'datetime-local'
  | 'file'        // image/document upload — stored in Supabase Storage, URL(s) saved in data
  | 'html'        // static content rendered between inputs (section headers, intro text)
  | 'hidden';     // carries URL prefill into submission.data without rendering

export interface FormField {
  id:          string;
  type:        FieldType;
  label:       string;
  placeholder?: string;
  required?:   boolean;
  options?:    string[];   // for select / radio / checkbox
  default?:    string;     // pre-selected value (select/radio) or pre-filled text
  html?:       string;     // rendered when type === 'html' (sanitized in FormRenderer)
  drive?:      boolean;    // when true, use OneDriveUploadField (MSAL/Graph) instead of native file input
  order:       number;
}

// Runtime-only: FormRenderer enriches OneDrive file fields with sibling values for folder naming.
// Not stored in Supabase — only used during form rendering.
export interface EnrichedDriveField extends FormField {
  _repName:   string;
  _storeName: string;
  _visitDate: string;
}

export interface FormSchema {
  id:           string;
  title:        string;
  description:  string | null;
  schema:       FormField[];
  created_by:   string | null;
  active_from:  string;
  active_until: string | null;
  is_archived:  boolean;
  created_at:   string;
}

export interface FormSubmission {
  id:           string;
  form_id:      string;
  submitted_by: string | null;
  data:         Record<string, unknown>;
  submitted_at: string;
  metadata:     Record<string, unknown> | null;
}

export interface FormRespondent {
  id:           string;
  form_id:      string;
  email:        string;
  submitted_at: string | null;
  created_at:   string;
}

export interface StoreVisitBooking {
  id:             string;
  report_ref:     string;
  booked_by:      string;
  store_id:       string | null;
  store_name:     string;
  store_code:     string | null;
  store_address:  string | null;
  address_source: string | null;
  purpose:        string;
  tasks:          string[];
  merchandiser:   string;
  manager_name:   string;
  visit_date:     string | null;
  visit_time:     string | null;
  description:    string | null;
  booking_status: string;
  created_at:     string;
}

export interface Store {
  id:      string;
  name:    string;
  code:    string | null;
  address: string | null;
  town:    string | null;
  area:    string | null;
}

// Minimal Database type for the Supabase generic client.
// Extend if you add more tables.
export interface Database {
  public: {
    Tables: {
      store_visit_bookings: {
        Row:    StoreVisitBooking;
        Insert: Omit<StoreVisitBooking, 'id' | 'created_at'> & { id?: string; created_at?: string };
        Update: Partial<Omit<StoreVisitBooking, 'id'>>;
      };
      stores: {
        Row:    Store;
        Insert: Omit<Store, 'id'> & { id?: string };
        Update: Partial<Omit<Store, 'id'>>;
      };
      form_schemas: {
        Row:    FormSchema;
        Insert: Omit<FormSchema, 'id' | 'created_at'> & { id?: string; created_at?: string };
        Update: Partial<Omit<FormSchema, 'id'>>;
      };
      form_submissions: {
        Row:    FormSubmission;
        Insert: Omit<FormSubmission, 'id' | 'submitted_at'> & { id?: string; submitted_at?: string };
        Update: never;
      };
      form_respondents: {
        Row:    FormRespondent;
        Insert: Omit<FormRespondent, 'id' | 'created_at'> & { id?: string; created_at?: string };
        Update: Pick<FormRespondent, 'submitted_at'>;
      };
    };
    Functions: {
      archive_expired_forms: { Args: Record<never, never>; Returns: void };
    };
  };
}
