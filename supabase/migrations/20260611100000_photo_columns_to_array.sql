-- Migrate photo columns from single text to text[] to support multiple photos per slot
ALTER TABLE public.store_visit_captures
  ALTER COLUMN photo_store_front  TYPE text[] USING CASE WHEN photo_store_front  IS NULL THEN NULL ELSE ARRAY[photo_store_front]  END,
  ALTER COLUMN photo_stock_before TYPE text[] USING CASE WHEN photo_stock_before IS NULL THEN NULL ELSE ARRAY[photo_stock_before] END,
  ALTER COLUMN photo_stock_after  TYPE text[] USING CASE WHEN photo_stock_after  IS NULL THEN NULL ELSE ARRAY[photo_stock_after]  END,
  ALTER COLUMN photo_chart_before TYPE text[] USING CASE WHEN photo_chart_before IS NULL THEN NULL ELSE ARRAY[photo_chart_before] END,
  ALTER COLUMN photo_chart_after  TYPE text[] USING CASE WHEN photo_chart_after  IS NULL THEN NULL ELSE ARRAY[photo_chart_after]  END;
