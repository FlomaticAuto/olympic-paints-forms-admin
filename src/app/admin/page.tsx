import { redirect } from 'next/navigation';

// /admin has no UI of its own — send users straight to the forms list.
export default function AdminRoot() {
  redirect('/admin/forms');
}
