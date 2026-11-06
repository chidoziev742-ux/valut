export async function up(pgm) {
  pgm.sql(`
    CREATE TABLE admin_audit_log (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      admin_user_id uuid NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
      target_user_id uuid NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
      action varchar(60) NOT NULL,
      previous_status varchar(20),
      next_status varchar(20),
      created_at timestamptz NOT NULL DEFAULT now(),
      CONSTRAINT admin_audit_log_action_check CHECK (action IN ('student_status_changed')),
      CONSTRAINT admin_audit_log_status_check CHECK (
        previous_status IN ('active', 'disabled') AND next_status IN ('active', 'disabled')
      )
    );

    CREATE INDEX admin_audit_log_target_created_idx
      ON admin_audit_log (target_user_id, created_at DESC);
    CREATE INDEX admin_audit_log_admin_created_idx
      ON admin_audit_log (admin_user_id, created_at DESC);

    ALTER TABLE admin_audit_log ENABLE ROW LEVEL SECURITY;
  `);
}

export async function down(pgm) {
  pgm.sql(`
    DROP TABLE admin_audit_log;
  `);
}
