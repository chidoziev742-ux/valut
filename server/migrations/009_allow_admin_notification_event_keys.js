export async function up(pgm) {
  pgm.sql(`
    ALTER TABLE student_notifications
      DROP CONSTRAINT student_notifications_event_key_check;
    ALTER TABLE student_notifications
      ADD CONSTRAINT student_notifications_event_key_check
      CHECK (
        event_key IS NULL
        OR (
          source IN ('system', 'admin')
          AND length(btrim(event_key)) BETWEEN 1 AND 100
        )
      );
  `);
}

export async function down(pgm) {
  pgm.sql(`
    ALTER TABLE student_notifications
      DROP CONSTRAINT student_notifications_event_key_check;
    ALTER TABLE student_notifications
      ADD CONSTRAINT student_notifications_event_key_check
      CHECK (event_key IS NULL OR (source = 'system' AND length(btrim(event_key)) BETWEEN 1 AND 100));
  `);
}
