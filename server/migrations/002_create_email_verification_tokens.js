export async function up(pgm) {
  pgm.sql(`
    CREATE TABLE email_verification_tokens (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      token_hash varchar(64) NOT NULL,
      expires_at timestamptz NOT NULL,
      used_at timestamptz,
      invalidated_at timestamptz,
      created_at timestamptz NOT NULL DEFAULT now(),
      CONSTRAINT email_verification_tokens_hash_unique UNIQUE (token_hash),
      CONSTRAINT email_verification_tokens_hash_format_check CHECK (
        token_hash ~ '^[0-9a-f]{64}$'
      ),
      CONSTRAINT email_verification_tokens_expiry_check CHECK (
        expires_at > created_at
      )
    );

    CREATE INDEX email_verification_tokens_user_idx
      ON email_verification_tokens (user_id);
    CREATE INDEX email_verification_tokens_active_expiry_idx
      ON email_verification_tokens (expires_at)
      WHERE used_at IS NULL AND invalidated_at IS NULL;
    CREATE UNIQUE INDEX email_verification_tokens_one_outstanding_per_user_idx
      ON email_verification_tokens (user_id)
      WHERE used_at IS NULL AND invalidated_at IS NULL;

    ALTER TABLE email_verification_tokens ENABLE ROW LEVEL SECURITY;
  `);
}

export async function down(pgm) {
  pgm.sql(`
    DROP TABLE email_verification_tokens;
  `);
}
