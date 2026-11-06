export async function up(pgm) {
  pgm.sql(`
    CREATE TABLE student_academic_records (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      record_type varchar(40) NOT NULL,
      title varchar(100) NOT NULL,
      institution varchar(100) NOT NULL,
      programme varchar(100) NOT NULL,
      academic_session varchar(100) NOT NULL,
      semester varchar(60),
      level varchar(60),
      details text,
      created_at timestamptz NOT NULL DEFAULT now(),
      updated_at timestamptz NOT NULL DEFAULT now(),
      CONSTRAINT student_academic_records_type_check
        CHECK (record_type IN ('Programme information', 'Semester result', 'Course record')),
      CONSTRAINT student_academic_records_title_check
        CHECK (length(btrim(title)) BETWEEN 1 AND 100),
      CONSTRAINT student_academic_records_institution_check
        CHECK (length(btrim(institution)) BETWEEN 1 AND 100),
      CONSTRAINT student_academic_records_programme_check
        CHECK (length(btrim(programme)) BETWEEN 1 AND 100),
      CONSTRAINT student_academic_records_session_check
        CHECK (length(btrim(academic_session)) BETWEEN 1 AND 100),
      CONSTRAINT student_academic_records_semester_check
        CHECK (semester IS NULL OR length(btrim(semester)) BETWEEN 1 AND 60),
      CONSTRAINT student_academic_records_semester_result_check
        CHECK (record_type <> 'Semester result' OR (semester IS NOT NULL AND length(btrim(semester)) BETWEEN 1 AND 60)),
      CONSTRAINT student_academic_records_level_check
        CHECK (level IS NULL OR length(btrim(level)) BETWEEN 1 AND 60),
      CONSTRAINT student_academic_records_details_check
        CHECK (details IS NULL OR length(details) <= 1000)
    );

    CREATE INDEX student_academic_records_user_created_idx
      ON student_academic_records (user_id, created_at DESC, id);

    CREATE TRIGGER student_academic_records_set_updated_at
      BEFORE UPDATE ON student_academic_records
      FOR EACH ROW EXECUTE FUNCTION set_updated_at();

    ALTER TABLE student_academic_records ENABLE ROW LEVEL SECURITY;
  `);
}

export async function down(pgm) {
  pgm.sql(`
    DROP TRIGGER student_academic_records_set_updated_at ON student_academic_records;
    DROP TABLE student_academic_records;
  `);
}
