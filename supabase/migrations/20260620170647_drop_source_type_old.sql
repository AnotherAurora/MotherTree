ALTER TABLE awakener_tag_manifestation
  ALTER COLUMN buff_target_type_restriction TYPE source_type 
  USING buff_target_type_restriction::text::source_type;

DROP TYPE source_type_old;