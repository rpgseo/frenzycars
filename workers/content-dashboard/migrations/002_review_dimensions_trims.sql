-- Nuevas columnas en review_candidates para dimensiones y trims editoriales
ALTER TABLE review_candidates ADD COLUMN dimensions_json TEXT;
ALTER TABLE review_candidates ADD COLUMN trims_json TEXT;
