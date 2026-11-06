export async function up(pgm) {
  pgm.sql(`
    CREATE TABLE student_folders (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      name varchar(60) NOT NULL,
      created_at timestamptz NOT NULL DEFAULT now(),
      updated_at timestamptz NOT NULL DEFAULT now(),
      CONSTRAINT student_folders_name_check CHECK (
        length(btrim(name)) BETWEEN 1 AND 60
      )
    );

    CREATE UNIQUE INDEX student_folders_user_name_unique_idx
      ON student_folders (user_id, lower(btrim(name)));
    CREATE INDEX student_folders_user_created_idx
      ON student_folders (user_id, created_at, id);

    CREATE TRIGGER student_folders_set_updated_at
      BEFORE UPDATE ON student_folders
      FOR EACH ROW EXECUTE FUNCTION set_updated_at();

    ALTER TABLE student_documents
      ADD COLUMN folder_id uuid
      REFERENCES student_folders(id) ON DELETE SET NULL;
    CREATE INDEX student_documents_user_folder_created_idx
      ON student_documents (user_id, folder_id, created_at DESC);

    ALTER TABLE student_folders ENABLE ROW LEVEL SECURITY;
  `);
}

export async function down(pgm) {
  pgm.sql(`
    DROP INDEX student_documents_user_folder_created_idx;
    ALTER TABLE student_documents DROP CONSTRAINT student_documents_folder_id_fkey;
    ALTER TABLE student_documents DROP COLUMN folder_id;
    DROP TRIGGER student_folders_set_updated_at ON student_folders;
    DROP TABLE student_folders;
  `);
}
