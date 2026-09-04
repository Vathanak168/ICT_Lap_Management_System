-- ==============================================================================
-- ADMIN FUNCTION: Change User Password
-- Description: Allows administrators to change any user's (teacher/admin) password.
-- Usage: Run this script in your Supabase SQL Editor (https://supabase.com/dashboard)
-- ==============================================================================

-- 1. Ensure pgcrypto extension is active in extensions schema
CREATE EXTENSION IF NOT EXISTS pgcrypto WITH SCHEMA extensions;

-- 2. Create the admin_change_user_password function
CREATE OR REPLACE FUNCTION admin_change_user_password(target_user_id UUID, new_password TEXT)
RETURNS JSONB
SECURITY DEFINER
SET search_path = public, auth, extensions
AS $$
DECLARE
  caller_role TEXT;
  target_email TEXT;
BEGIN
  -- Verify caller is logged in
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'សូមចូលគណនីជាមុនសិន (Not authenticated).';
  END IF;

  -- Check if caller is admin
  SELECT role INTO caller_role FROM public.profiles WHERE id = auth.uid();
  IF caller_role != 'admin' THEN
    RAISE EXCEPTION 'មានតែ Admin ប៉ុណ្ណោះដែលអាចប្តូរពាក្យសម្ងាត់អ្នកដទៃបាន (Only administrators can change user passwords).';
  END IF;

  -- Validate password length
  IF length(new_password) < 6 THEN
    RAISE EXCEPTION 'ពាក្យសម្ងាត់ត្រូវមានយ៉ាងហោចណាស់ ៦ ខ្ទង់ (Password must be at least 6 characters).';
  END IF;

  -- Update encrypted password in auth.users
  UPDATE auth.users
  SET encrypted_password = extensions.crypt(new_password, extensions.gen_salt('bf')),
      updated_at = NOW()
  WHERE id = target_user_id
  RETURNING email INTO target_email;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'រកមិនឃើញគណនីអ្នកប្រើប្រាស់នេះទេ (User not found).';
  END IF;

  RETURN jsonb_build_object(
    'success', true, 
    'message', 'បានប្តូរពាក្យសម្ងាត់ដោយជោគជ័យ!',
    'email', target_email
  );
END;
$$ LANGUAGE plpgsql;

-- 3. Grant execute permission to authenticated users
GRANT EXECUTE ON FUNCTION admin_change_user_password(UUID, TEXT) TO authenticated;
