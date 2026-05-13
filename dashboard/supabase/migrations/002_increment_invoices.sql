-- RPC function called by processing pipeline to track monthly invoice usage
CREATE OR REPLACE FUNCTION increment_invoices_count(p_user_id UUID, p_count INT)
RETURNS VOID LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  UPDATE profiles
  SET invoices_this_month = invoices_this_month + p_count
  WHERE id = p_user_id;
END;
$$;

-- Unique constraint on email_connections needed for upsert onConflict
ALTER TABLE email_connections
  ADD CONSTRAINT email_connections_user_email_unique UNIQUE (user_id, email_address);
