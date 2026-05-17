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
  | 'date'
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
  order:       number;
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

// Minimal Database type for the Supabase generic client.
// Extend if you add more tables.
export interface Database {
  public: {
    Tables: {
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
