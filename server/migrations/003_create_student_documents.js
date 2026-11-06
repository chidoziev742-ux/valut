export async function up(pgm) {
  pgm.sql(`
    CREATE TABLE student_documents (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      title varchar(100) NOT NULL,
      original_filename varchar(255) NOT NULL,
      file_type varchar(5) NOT NULL,
      mime_type varchar(100) NOT NULL,
      file_size bigint NOT NULL,
      storage_object_path text NOT NULL,
      source varchar(20) NOT NULL DEFAULT 'device',
      page_count integer,
      category varchar(40) NOT NULL,
      academic_session varchar(40),
      archived_at timestamptz,
      created_at timestamptz NOT NULL DEFAULT now(),
      updated_at timestamptz NOT NULL DEFAULT now(),
      CONSTRAINT student_documents_title_check CHECK (length(btrim(title)) BETWEEN 1 AND 100),
      CONSTRAINT student_documents_filename_check CHECK (length(btrim(original_filename)) BETWEEN 1 AND 255),
      CONSTRAINT student_documents_type_check CHECK (file_type IN ('PDF', 'JPG', 'JPEG', 'PNG')),
      CONSTRAINT student_documents_mime_check CHECK (
        (file_type = 'PDF' AND mime_type = 'application/pdf') OR
        (file_type IN ('JPG', 'JPEG') AND mime_type = 'image/jpeg') OR
        (file_type = 'PNG' AND mime_type = 'image/png')
      ),
      CONSTRAINT student_documents_size_check CHECK (file_size BETWEEN 1 AND 52428800),
      CONSTRAINT student_documents_storage_path_check CHECK (
        storage_object_path LIKE user_id::text || '/%'
      ),
      CONSTRAINT student_documents_source_check CHECK (source IN ('device', 'camera')),
      CONSTRAINT student_documents_pages_check CHECK (page_count IS NULL OR page_count BETWEEN 1 AND 100),
      CONSTRAINT student_documents_category_check CHECK (
        category IN ('Personal Documents', 'Academic Records', 'Financial Documents',
                     'Course Materials', 'Certificates', 'Other')
      ),
      CONSTRAINT student_documents_academic_session_check CHECK (
        academic_session IS NULL OR length(academic_session) <= 40
      ),
      CONSTRAINT student_documents_storage_path_unique UNIQUE (storage_object_path)
    );

    CREATE INDEX student_documents_user_created_idx
      ON student_documents (user_id, created_at DESC);
    CREATE INDEX student_documents_user_category_idx
      ON student_documents (user_id, category, created_at DESC);
    CREATE INDEX student_documents_user_archive_idx
      ON student_documents (user_id, archived_at, created_at DESC);

    CREATE TRIGGER student_documents_set_updated_at
      BEFORE UPDATE ON student_documents
      FOR EACH ROW EXECUTE FUNCTION set_updated_at();

    ALTER TABLE student_documents ENABLE ROW LEVEL SECURITY;
  `);
}

export async function down(pgm) {
  pgm.sql(`
    DROP TRIGGER student_documents_set_updated_at ON student_documents;
    DROP TABLE student_documents;
  `);
}
