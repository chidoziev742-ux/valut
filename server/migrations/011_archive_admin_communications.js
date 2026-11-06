export async function up(pgm) {
  pgm.sql(`
    ALTER TABLE admin_communications
      ADD COLUMN archived_at timestamptz;

    CREATE INDEX admin_communications_active_created_idx
      ON admin_communications (created_at DESC, id DESC)
      WHERE archived_at IS NULL;

    ALTER TABLE admin_audit_log
      ALTER COLUMN target_user_id DROP NOT NULL,
      ADD COLUMN target_communication_id uuid REFERENCES admin_communications(id) ON DELETE RESTRICT;

    ALTER TABLE admin_audit_log
      DROP CONSTRAINT admin_audit_log_action_check,
      DROP CONSTRAINT admin_audit_log_status_check,
      ADD CONSTRAINT admin_audit_log_action_check
        CHECK (action IN ('student_status_changed', 'communication_archived', 'communication_restored')),
      ADD CONSTRAINT admin_audit_log_status_check
        CHECK (
          (action = 'student_status_changed'
            AND previous_status IN ('active', 'disabled')
            AND next_status IN ('active', 'disabled'))
          OR
          (action IN ('communication_archived', 'communication_restored')
            AND previous_status IS NULL AND next_status IS NULL)
        ),
      ADD CONSTRAINT admin_audit_log_target_check
        CHECK (
          (action = 'student_status_changed' AND target_user_id IS NOT NULL AND target_communication_id IS NULL)
          OR
          (action IN ('communication_archived', 'communication_restored')
            AND target_user_id IS NULL AND target_communication_id IS NOT NULL)
        );
  `);
}

export async function down(pgm) {
  pgm.sql(`
    ALTER TABLE admin_audit_log
      DROP CONSTRAINT admin_audit_log_target_check,
      DROP CONSTRAINT admin_audit_log_action_check,
      DROP CONSTRAINT admin_audit_log_status_check,
      DROP COLUMN target_communication_id,
      ALTER COLUMN target_user_id SET NOT NULL,
      ADD CONSTRAINT admin_audit_log_action_check
        CHECK (action IN ('student_status_changed')),
      ADD CONSTRAINT admin_audit_log_status_check CHECK (
        previous_status IN ('active', 'disabled') AND next_status IN ('active', 'disabled')
      ),
      ADD CONSTRAINT admin_audit_log_target_check
        CHECK (target_user_id IS NOT NULL);

    DROP INDEX admin_communications_active_created_idx;
    ALTER TABLE admin_communications DROP COLUMN archived_at;
  `);
}
