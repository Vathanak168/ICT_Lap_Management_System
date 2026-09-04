-- ==========================================
-- SECURITY DEFINER FUNCTION FOR ADMIN CHECK
-- ==========================================
-- This function checks if the current user is an admin.
-- It uses SECURITY DEFINER to bypass RLS and avoid infinite recursion.
CREATE OR REPLACE FUNCTION is_admin()
RETURNS BOOLEAN
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM profiles
    WHERE id = auth.uid() AND role = 'admin'
  );
END;
$$ LANGUAGE plpgsql;


-- ==========================================
-- FIX 1: Prevent Branch Hijacking in Profiles
-- ==========================================
-- We use a trigger to prevent non-admins from changing their branch column
CREATE OR REPLACE FUNCTION prevent_branch_update()
RETURNS TRIGGER 
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.branch IS DISTINCT FROM OLD.branch THEN
    IF NOT is_admin() THEN
      RAISE EXCEPTION 'ការផ្លាស់ប្តូរសាខាមិនត្រូវបានអនុញ្ញាតទេ (Branch update not allowed).';
    END IF;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS check_branch_update ON profiles;
CREATE TRIGGER check_branch_update
BEFORE UPDATE ON profiles
FOR EACH ROW
EXECUTE FUNCTION prevent_branch_update();


-- ==========================================
-- FIX 2: Restrict Profile Information Leakage
-- ==========================================
-- Drop the overly permissive select policy
DROP POLICY IF EXISTS "Allow public read access to profiles" ON profiles;

-- Users can only see their own profile
CREATE POLICY "Users can see own profile" ON profiles
  FOR SELECT USING (auth.uid() = id);

-- Admins can see all profiles
CREATE POLICY "Admins can see all profiles" ON profiles
  FOR SELECT USING (is_admin());

-- Create a secure RPC so the Registration page can still check available branches
-- without exposing personal data (names, emails) to anonymous users.
CREATE OR REPLACE FUNCTION get_taken_branches()
RETURNS TABLE(branch TEXT) 
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY SELECT p.branch FROM profiles p WHERE p.role IN ('teacher', 'admin') AND p.branch IS NOT NULL;
END;
$$ LANGUAGE plpgsql;

-- Allow anyone to call the RPC
GRANT EXECUTE ON FUNCTION get_taken_branches() TO anon, authenticated;


-- ==========================================
-- FIX 3: Academic Years Integrity
-- ==========================================
-- Drop the overly permissive policies
DROP POLICY IF EXISTS "Allow authenticated users full access to academic_years" ON academic_years;
DROP POLICY IF EXISTS "Allow public read access to academic_years" ON academic_years;

-- Everyone can READ academic years
CREATE POLICY "Anyone can read academic years" ON academic_years
  FOR SELECT USING (true);

-- Only admins can INSERT, UPDATE, DELETE academic years
CREATE POLICY "Admins can modify academic years" ON academic_years
  FOR ALL TO authenticated
  USING (is_admin())
  WITH CHECK (is_admin());


-- ==========================================
-- FIX 4: Mini Apps Access Control
-- ==========================================
-- Drop the overly permissive policy
DROP POLICY IF EXISTS "Allow authenticated users full access to mini_apps" ON mini_apps;

-- Everyone can READ mini apps
CREATE POLICY "Anyone can read mini apps" ON mini_apps
  FOR SELECT USING (true);

-- Only admins can manage (INSERT, UPDATE, DELETE) mini apps
CREATE POLICY "Admins can manage mini apps" ON mini_apps
  FOR ALL TO authenticated
  USING (is_admin())
  WITH CHECK (is_admin());
