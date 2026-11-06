export async function up(pgm) {
  pgm.sql(`
    ALTER TABLE admin_communications
      ADD COLUMN channel varchar(20) NOT NULL DEFAULT 'in_app';

    ALTER TABLE admin_communications
      ADD CONSTRAINT admin_communications_channel_check
      CHECK (channel IN ('in_app', 'email', 'both'));

    CREATE TABLE admin_communication_email_deliveries (
      communication_id uuid NOT NULL REFERENCES admin_communications(id) ON DELETE CASCADE,
      user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      recipient_email varchar(320) NOT NULL,
      status varchar(20) NOT NULL DEFAULT 'pending',
      provider_message_id varchar(200),
      error_message varchar(500),
      attempt_count integer NOT NULL DEFAULT 0,
      sent_at timestamptz,
      updated_at timestamptz NOT NULL DEFAULT now(),
      PRIMARY KEY (communication_id, user_id),
      CONSTRAINT admin_communication_email_status_check
        CHECK (status IN ('pending', 'sending', 'sent', 'failed')),
      CONSTRAINT admin_communication_email_attempts_check
        CHECK (attempt_count >= 0),
      CONSTRAINT admin_communication_email_sent_state_check
        CHECK (status <> 'sent' OR sent_at IS NOT NULL)
    );

    CREATE INDEX admin_communication_email_pending_idx
      ON admin_communication_email_deliveries (status, updated_at)
      WHERE status IN ('pending', 'failed');
    CREATE INDEX admin_communication_email_user_idx
      ON admin_communication_email_deliveries (user_id, updated_at DESC);

    ALTER TABLE admin_communication_email_deliveries ENABLE ROW LEVEL SECURITY;
  `);
}

export async function down(pgm) {
  pgm.sql(`
    DROP TABLE admin_communication_email_deliveries;
    ALTER TABLE admin_communications DROP CONSTRAINT admin_communications_channel_check;
    ALTER TABLE admin_communications DROP COLUMN channel;
  `);
}
