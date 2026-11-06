export async function up(pgm) {
  pgm.sql(`
    CREATE TABLE student_notifications (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      title varchar(120) NOT NULL,
      message text NOT NULL,
      source varchar(20) NOT NULL,
      category varchar(40) NOT NULL,
      is_read boolean NOT NULL DEFAULT false,
      read_at timestamptz,
      action_destination varchar(200),
      event_key varchar(100),
      created_at timestamptz NOT NULL DEFAULT now(),
      CONSTRAINT student_notifications_title_check
        CHECK (length(btrim(title)) BETWEEN 1 AND 120),
      CONSTRAINT student_notifications_message_check
        CHECK (length(btrim(message)) BETWEEN 1 AND 2000),
      CONSTRAINT student_notifications_source_check
        CHECK (source IN ('system', 'personal', 'admin')),
      CONSTRAINT student_notifications_category_check
        CHECK (category ~ '^[a-z][a-z0-9_-]{0,39}$'),
      CONSTRAINT student_notifications_read_state_check
        CHECK (is_read = (read_at IS NOT NULL)),
      CONSTRAINT student_notifications_action_destination_check
        CHECK (
          action_destination IS NULL
          OR action_destination IN ('/profile', '/settings#account-info')
        ),
      CONSTRAINT student_notifications_event_key_check
        CHECK (event_key IS NULL OR (source = 'system' AND length(btrim(event_key)) BETWEEN 1 AND 100)),
      CONSTRAINT student_notifications_user_event_unique
        UNIQUE (user_id, event_key)
    );

    CREATE INDEX student_notifications_user_created_idx
      ON student_notifications (user_id, created_at DESC, id DESC);
    CREATE INDEX student_notifications_user_unread_idx
      ON student_notifications (user_id, created_at DESC)
      WHERE is_read = false;
    CREATE UNIQUE INDEX student_notifications_user_welcome_unique_idx
      ON student_notifications (user_id)
      WHERE category = 'welcome';

    ALTER TABLE student_notifications ENABLE ROW LEVEL SECURITY;
  `);
}

export async function down(pgm) {
  pgm.sql(`
    DROP TABLE student_notifications;
  `);
}
