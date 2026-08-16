DO $$
DECLARE
	invalid_roles text;
BEGIN
	SELECT string_agg(format('%s=%L', "id", "default_role"), ', ' ORDER BY "id")
	INTO invalid_roles
	FROM "auth"."user"
	WHERE NULLIF(btrim("default_role"), '') IS NOT NULL
		AND btrim("default_role") NOT IN ('dev', 'qa', 'tester', 'admin');

	IF invalid_roles IS NOT NULL THEN
		RAISE EXCEPTION 'Invalid auth.user default_role values: %', invalid_roles;
	END IF;
END
$$;
--> statement-breakpoint
UPDATE "auth"."user"
SET "username" = NULLIF(btrim("username"), '')
WHERE "username" IS DISTINCT FROM NULLIF(btrim("username"), '');
--> statement-breakpoint
UPDATE "auth"."user"
SET "default_role" = NULLIF(btrim("default_role"), '');
--> statement-breakpoint
DO $$
DECLARE
	affected_user_ids text;
BEGIN
	WITH ranked AS (
		SELECT
			"id",
			row_number() OVER (PARTITION BY "username" ORDER BY "id") AS position
		FROM "auth"."user"
		WHERE "username" IS NOT NULL
	), cleared AS (
		UPDATE "auth"."user" AS users
		SET "username" = NULL
		FROM ranked
		WHERE users."id" = ranked."id"
			AND ranked.position > 1
		RETURNING users."id"
	)
	SELECT string_agg("id", ', ' ORDER BY "id")
	INTO affected_user_ids
	FROM cleared;

	IF affected_user_ids IS NOT NULL THEN
		RAISE NOTICE 'Cleared duplicate usernames for auth.user IDs: %', affected_user_ids;
	END IF;
END
$$;
