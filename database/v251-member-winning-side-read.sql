-- v251 personal win/loss display for invited family only.
-- Existing matches RLS policy app_access_is_member() remains mandatory.
GRANT SELECT (winning_side) ON public.matches TO authenticated;