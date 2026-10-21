export async function up(pgm) {
  pgm.sql(`
    CREATE TABLE users (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      email_normalized varchar(254) NOT NULL,
      password_hash text NOT NULL,
      role varchar(20) NOT NULL DEFAULT 'student',
      status varchar(20) NOT NULL DEFAULT 'active',
      email_verified_at timestamptz,
      created_at timestamptz NOT NULL DEFAULT now(),
      updated_at timestamptz NOT NULL DEFAULT now(),
      CONSTRAINT users_email_normalized_unique UNIQUE (email_normalized),
      CONSTRAINT users_email_normalized_check CHECK (
        email_normalized = lower(btrim(email_normalized)) AND
        length(email_normalized) BETWEEN 3 AND 254
      ),
      CONSTRAINT users_password_hash_nonempty_check CHECK (length(btrim(password_hash)) > 0),
      CONSTRAINT users_role_check CHECK (role IN ('student', 'admin')),
      CONSTRAINT users_status_check CHECK (status IN ('active', 'disabled'))
    );

    CREATE TABLE student_profiles (
      user_id uuid PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
      full_name varchar(120) NOT NULL,
      university varchar(120),
      faculty varchar(120),
      department varchar(120),
      programme varchar(120),
      study_year varchar(40),
      academic_session varchar(40),
      created_at timestamptz NOT NULL DEFAULT now(),
      updated_at timestamptz NOT NULL DEFAULT now(),
      CONSTRAINT student_profiles_full_name_check CHECK (
        length(btrim(full_name)) BETWEEN 1 AND 120
      )
    );

    CREATE TABLE auth_sessions (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      refresh_token_hash text NOT NULL,
      expires_at timestamptz NOT NULL,
      revoked_at timestamptz,
      replaced_by_session_id uuid,
      last_used_at timestamptz,
      created_at timestamptz NOT NULL DEFAULT now(),
      updated_at timestamptz NOT NULL DEFAULT now(),
      CONSTRAINT auth_sessions_id_user_id_unique UNIQUE (id, user_id),
      CONSTRAINT auth_sessions_refresh_token_hash_unique UNIQUE (refresh_token_hash),
      CONSTRAINT auth_sessions_refresh_token_hash_nonempty_check CHECK (
        length(btrim(refresh_token_hash)) > 0
      ),
      CONSTRAINT auth_sessions_expiry_check CHECK (expires_at > created_at),
      CONSTRAINT auth_sessions_replaced_by_same_user_fk
        FOREIGN KEY (replaced_by_session_id, user_id)
        REFERENCES auth_sessions (id, user_id)
        ON DELETE NO ACTION
        DEFERRABLE INITIALLY DEFERRED,
      CONSTRAINT auth_sessions_not_self_replaced_check CHECK (
        replaced_by_session_id IS NULL OR replaced_by_session_id <> id
      )
    );

    CREATE TABLE password_reset_tokens (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      token_hash text NOT NULL,
      expires_at timestamptz NOT NULL,
      used_at timestamptz,
      invalidated_at timestamptz,
      created_at timestamptz NOT NULL DEFAULT now(),
      CONSTRAINT password_reset_tokens_hash_unique UNIQUE (token_hash),
      CONSTRAINT password_reset_tokens_hash_nonempty_check CHECK (length(btrim(token_hash)) > 0),
      CONSTRAINT password_reset_tokens_expiry_check CHECK (expires_at > created_at)
    );

    CREATE INDEX auth_sessions_user_active_idx
      ON auth_sessions (user_id, expires_at)
      WHERE revoked_at IS NULL;
    CREATE INDEX auth_sessions_expiry_idx
      ON auth_sessions (expires_at);
    CREATE INDEX password_reset_tokens_user_idx
      ON password_reset_tokens (user_id);
    CREATE INDEX password_reset_tokens_active_expiry_idx
      ON password_reset_tokens (expires_at)
      WHERE used_at IS NULL AND invalidated_at IS NULL;
    CREATE UNIQUE INDEX password_reset_tokens_one_outstanding_per_user_idx
      ON password_reset_tokens (user_id)
      WHERE used_at IS NULL AND invalidated_at IS NULL;

    CREATE FUNCTION set_updated_at()
    RETURNS trigger
    LANGUAGE plpgsql
    AS $$
    BEGIN
      NEW.updated_at = now();
      RETURN NEW;
    END;
    $$;

    CREATE TRIGGER users_set_updated_at
      BEFORE UPDATE ON users
      FOR EACH ROW EXECUTE FUNCTION set_updated_at();
    CREATE TRIGGER student_profiles_set_updated_at
      BEFORE UPDATE ON student_profiles
      FOR EACH ROW EXECUTE FUNCTION set_updated_at();
    CREATE TRIGGER auth_sessions_set_updated_at
      BEFORE UPDATE ON auth_sessions
      FOR EACH ROW EXECUTE FUNCTION set_updated_at();

    -- RLS without policies denies row access only for roles subject to RLS.
    -- Table grants are separate, privileged roles and table owners may bypass RLS,
    -- and the Express runtime role's grants/bypass behavior must be reviewed.
    ALTER TABLE users ENABLE ROW LEVEL SECURITY;
    ALTER TABLE student_profiles ENABLE ROW LEVEL SECURITY;
    ALTER TABLE auth_sessions ENABLE ROW LEVEL SECURITY;
    ALTER TABLE password_reset_tokens ENABLE ROW LEVEL SECURITY;
  `);
}

export async function down(pgm) {
  pgm.sql(`
    DROP TRIGGER auth_sessions_set_updated_at ON auth_sessions;
    DROP TRIGGER student_profiles_set_updated_at ON student_profiles;
    DROP TRIGGER users_set_updated_at ON users;
    DROP FUNCTION set_updated_at();
    DROP TABLE password_reset_tokens;
    DROP TABLE auth_sessions;
    DROP TABLE student_profiles;
    DROP TABLE users;
  `);
}
