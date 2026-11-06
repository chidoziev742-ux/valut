export async function up(pgm) {
  pgm.sql(`
    CREATE TABLE admin_communications (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      admin_user_id uuid NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
      subject varchar(120) NOT NULL,
      message text NOT NULL,
      recipient_mode varchar(20) NOT NULL,
      recipient_count integer NOT NULL,
      created_at timestamptz NOT NULL DEFAULT now(),
      CONSTRAINT admin_communications_subject_check CHECK (length(btrim(subject)) BETWEEN 1 AND 120),
      CONSTRAINT admin_communications_message_check CHECK (length(btrim(message)) BETWEEN 1 AND 2000),
      CONSTRAINT admin_communications_recipient_mode_check CHECK (recipient_mode IN ('all', 'selected')),
      CONSTRAINT admin_communications_recipient_count_check CHECK (recipient_count > 0)
    );

    CREATE TABLE admin_communication_recipients (
      communication_id uuid NOT NULL REFERENCES admin_communications(id) ON DELETE CASCADE,
      user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      created_at timestamptz NOT NULL DEFAULT now(),
      PRIMARY KEY (communication_id, user_id)
    );

    CREATE INDEX admin_communications_created_idx
      ON admin_communications (created_at DESC, id DESC);
    CREATE INDEX admin_communication_recipients_user_idx
      ON admin_communication_recipients (user_id, created_at DESC);

    ALTER TABLE admin_communications ENABLE ROW LEVEL SECURITY;
    ALTER TABLE admin_communication_recipients ENABLE ROW LEVEL SECURITY;
  `);
}

export async function down(pgm) {
  pgm.sql(`
    DROP TABLE admin_communication_recipients;
    DROP TABLE admin_communications;
  `);
}
