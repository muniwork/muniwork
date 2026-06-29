


SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;


CREATE SCHEMA IF NOT EXISTS "public";


ALTER SCHEMA "public" OWNER TO "pg_database_owner";


COMMENT ON SCHEMA "public" IS 'standard public schema';



CREATE OR REPLACE FUNCTION "public"."set_updated_at"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
begin
  new.updated_at = now();
  return new;
end;
$$;


ALTER FUNCTION "public"."set_updated_at"() OWNER TO "postgres";

SET default_tablespace = '';

SET default_table_access_method = "heap";


CREATE TABLE IF NOT EXISTS "public"."gov_units_2025" (
    "CENSUS_ID_PID6" bigint NOT NULL,
    "UNIT_NAME" "text",
    "UNIT_TYPE" "text",
    "TITLE" "text",
    "ADDRESS1" "text",
    "ADDRESS2" "text",
    "CITY" "text",
    "STATE" "text",
    "ZIP" bigint,
    "ZIP4" "text",
    "WEB_ADDRESS" "text",
    "POLITICAL_CODE_DESCRIPTION" "text",
    "POPULATION" bigint,
    "POPULATION_SOURCE_YEAR" bigint,
    "FIPS_STATE" bigint,
    "FIPS_COUNTY" bigint,
    "FIPS_PLACE" bigint,
    "COUNTY_AREA_NAME" "text",
    "ACTIVE" "text"
);


ALTER TABLE "public"."gov_units_2025" OWNER TO "postgres";


COMMENT ON TABLE "public"."gov_units_2025" IS 'The file presents a snapshot view of the Census Bureau’s Governments Master Address File (GMAF), capturing all independent government units, dependent school districts, and public pension systems that were active as of the fiscal year ending June 30, 2025.';



CREATE TABLE IF NOT EXISTS "public"."job_ingestion_runs" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "job_source_id" "uuid" NOT NULL,
    "provider" "text" NOT NULL,
    "status" "text" NOT NULL,
    "started_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "completed_at" timestamp with time zone,
    "jobs_seen" integer DEFAULT 0 NOT NULL,
    "jobs_inserted" integer DEFAULT 0 NOT NULL,
    "jobs_updated" integer DEFAULT 0 NOT NULL,
    "jobs_closed" integer DEFAULT 0 NOT NULL,
    "error_message" "text",
    "metadata" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL,
    CONSTRAINT "job_ingestion_runs_jobs_closed_check" CHECK (("jobs_closed" >= 0)),
    CONSTRAINT "job_ingestion_runs_jobs_inserted_check" CHECK (("jobs_inserted" >= 0)),
    CONSTRAINT "job_ingestion_runs_jobs_seen_check" CHECK (("jobs_seen" >= 0)),
    CONSTRAINT "job_ingestion_runs_jobs_updated_check" CHECK (("jobs_updated" >= 0)),
    CONSTRAINT "job_ingestion_runs_status_check" CHECK (("status" = ANY (ARRAY['running'::"text", 'succeeded'::"text", 'failed'::"text", 'dry_run'::"text"])))
);


ALTER TABLE "public"."job_ingestion_runs" OWNER TO "postgres";


COMMENT ON TABLE "public"."job_ingestion_runs" IS 'Operational record of each job-source ingestion attempt.';



CREATE TABLE IF NOT EXISTS "public"."job_sources" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "organization_id" "uuid" NOT NULL,
    "source_type" "text" NOT NULL,
    "provider" "text",
    "source_url" "text" NOT NULL,
    "is_active" boolean DEFAULT true NOT NULL,
    "last_checked_at" timestamp with time zone,
    "last_successful_check_at" timestamp with time zone,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "public_url" "text"
);


ALTER TABLE "public"."job_sources" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."jobs" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "organization_id" "uuid" NOT NULL,
    "job_source_id" "uuid" NOT NULL,
    "external_id" "text" NOT NULL,
    "title" "text" NOT NULL,
    "location" "text",
    "department" "text",
    "employment_type" "text",
    "posted_at" timestamp with time zone,
    "closes_at" timestamp with time zone,
    "description_html" "text",
    "apply_url" "text",
    "status" "text" DEFAULT 'unknown'::"text" NOT NULL,
    "first_seen_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "last_seen_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "closed_at" timestamp with time zone,
    "source_payload" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "jobs_status_check" CHECK (("status" = ANY (ARRAY['open'::"text", 'closed'::"text", 'unknown'::"text"])))
);


ALTER TABLE "public"."jobs" OWNER TO "postgres";


COMMENT ON TABLE "public"."jobs" IS 'Normalized job listings collected from public employer sources.';



CREATE TABLE IF NOT EXISTS "public"."organization_retirement" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "organization_id" "uuid" NOT NULL,
    "plan_name" "text" NOT NULL,
    "status" "text" NOT NULL,
    "eligible_groups" "text"[] DEFAULT '{}'::"text"[] NOT NULL,
    "source_url" "text" NOT NULL,
    "source_date" "date",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "organization_retirement_status_check" CHECK (("status" = ANY (ARRAY['current'::"text", 'legacy_only'::"text"])))
);


ALTER TABLE "public"."organization_retirement" OWNER TO "postgres";


COMMENT ON TABLE "public"."organization_retirement" IS 'Retirement plans and systems available to an organization, with source-backed current or legacy-only status.';



COMMENT ON COLUMN "public"."organization_retirement"."eligible_groups" IS 'Optional employee groups covered by the source, for example general, police, fire, or elected. Empty means not specified by the source.';



CREATE TABLE IF NOT EXISTS "public"."organization_sources" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "organization_id" "uuid" NOT NULL,
    "source_name" "text" NOT NULL,
    "source_table" "text",
    "source_record_id" "text" NOT NULL,
    "source_year" integer,
    "is_primary" boolean DEFAULT false NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."organization_sources" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."organizations" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "official_name" "text" NOT NULL,
    "organization_type" "text",
    "state_code" "text",
    "official_website" "text",
    "slug" "text"
);


ALTER TABLE "public"."organizations" OWNER TO "postgres";


COMMENT ON TABLE "public"."organizations" IS 'Canonical entity table';



CREATE OR REPLACE VIEW "public"."organizations_without_active_job_sources" WITH ("security_invoker"='true') AS
 SELECT "official_name",
    "organization_type",
    "state_code",
    "slug",
    "official_website"
   FROM "public"."organizations" "o"
  WHERE (("state_code" = 'FL'::"text") AND (NOT (EXISTS ( SELECT 1
           FROM "public"."job_sources" "js"
          WHERE (("js"."organization_id" = "o"."id") AND ("js"."is_active" = true))))))
  ORDER BY "organization_type", "official_name";


ALTER VIEW "public"."organizations_without_active_job_sources" OWNER TO "postgres";


ALTER TABLE ONLY "public"."gov_units_2025"
    ADD CONSTRAINT "Govt Units 2025_pkey" PRIMARY KEY ("CENSUS_ID_PID6");



ALTER TABLE ONLY "public"."job_ingestion_runs"
    ADD CONSTRAINT "job_ingestion_runs_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."job_sources"
    ADD CONSTRAINT "job_sources_organization_source_url_key" UNIQUE ("organization_id", "source_url");



ALTER TABLE ONLY "public"."job_sources"
    ADD CONSTRAINT "job_sources_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."jobs"
    ADD CONSTRAINT "jobs_job_source_external_id_key" UNIQUE ("job_source_id", "external_id");



ALTER TABLE ONLY "public"."jobs"
    ADD CONSTRAINT "jobs_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."organization_retirement"
    ADD CONSTRAINT "organization_retirement_organization_id_plan_name_key" UNIQUE ("organization_id", "plan_name");



ALTER TABLE ONLY "public"."organization_retirement"
    ADD CONSTRAINT "organization_retirement_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."organization_sources"
    ADD CONSTRAINT "organization_sources_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."organizations"
    ADD CONSTRAINT "organizations_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."organizations"
    ADD CONSTRAINT "organizations_slug_key" UNIQUE ("slug");



CREATE INDEX "job_ingestion_runs_by_source_started_idx" ON "public"."job_ingestion_runs" USING "btree" ("job_source_id", "started_at" DESC);



CREATE INDEX "job_ingestion_runs_by_status_started_idx" ON "public"."job_ingestion_runs" USING "btree" ("status", "started_at" DESC);



CREATE INDEX "job_sources_active_idx" ON "public"."job_sources" USING "btree" ("is_active") WHERE ("is_active" = true);



CREATE INDEX "job_sources_organization_id_idx" ON "public"."job_sources" USING "btree" ("organization_id");



CREATE INDEX "jobs_by_source_status_idx" ON "public"."jobs" USING "btree" ("job_source_id", "status");



CREATE INDEX "jobs_open_by_organization_idx" ON "public"."jobs" USING "btree" ("organization_id", "posted_at" DESC) WHERE ("status" = 'open'::"text");



CREATE INDEX "jobs_recently_seen_idx" ON "public"."jobs" USING "btree" ("last_seen_at" DESC);



CREATE INDEX "organization_retirement_organization_id_idx" ON "public"."organization_retirement" USING "btree" ("organization_id");



CREATE OR REPLACE TRIGGER "job_sources_set_updated_at" BEFORE UPDATE ON "public"."job_sources" FOR EACH ROW EXECUTE FUNCTION "public"."set_updated_at"();



CREATE OR REPLACE TRIGGER "jobs_set_updated_at" BEFORE UPDATE ON "public"."jobs" FOR EACH ROW EXECUTE FUNCTION "public"."set_updated_at"();



CREATE OR REPLACE TRIGGER "organizations_set_updated_at" BEFORE UPDATE ON "public"."organizations" FOR EACH ROW EXECUTE FUNCTION "public"."set_updated_at"();



ALTER TABLE ONLY "public"."job_ingestion_runs"
    ADD CONSTRAINT "job_ingestion_runs_job_source_id_fkey" FOREIGN KEY ("job_source_id") REFERENCES "public"."job_sources"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."job_sources"
    ADD CONSTRAINT "job_sources_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."jobs"
    ADD CONSTRAINT "jobs_job_source_id_fkey" FOREIGN KEY ("job_source_id") REFERENCES "public"."job_sources"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."jobs"
    ADD CONSTRAINT "jobs_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."organization_retirement"
    ADD CONSTRAINT "organization_retirement_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."organization_sources"
    ADD CONSTRAINT "organization_sources_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE CASCADE;



ALTER TABLE "public"."gov_units_2025" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."job_ingestion_runs" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."job_sources" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."jobs" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."organization_retirement" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."organization_sources" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."organizations" ENABLE ROW LEVEL SECURITY;


GRANT USAGE ON SCHEMA "public" TO "postgres";
GRANT USAGE ON SCHEMA "public" TO "anon";
GRANT USAGE ON SCHEMA "public" TO "authenticated";
GRANT USAGE ON SCHEMA "public" TO "service_role";



GRANT ALL ON FUNCTION "public"."set_updated_at"() TO "anon";
GRANT ALL ON FUNCTION "public"."set_updated_at"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."set_updated_at"() TO "service_role";



GRANT ALL ON TABLE "public"."gov_units_2025" TO "anon";
GRANT ALL ON TABLE "public"."gov_units_2025" TO "authenticated";
GRANT ALL ON TABLE "public"."gov_units_2025" TO "service_role";



GRANT ALL ON TABLE "public"."job_ingestion_runs" TO "anon";
GRANT ALL ON TABLE "public"."job_ingestion_runs" TO "authenticated";
GRANT ALL ON TABLE "public"."job_ingestion_runs" TO "service_role";



GRANT ALL ON TABLE "public"."job_sources" TO "anon";
GRANT ALL ON TABLE "public"."job_sources" TO "authenticated";
GRANT ALL ON TABLE "public"."job_sources" TO "service_role";



GRANT ALL ON TABLE "public"."jobs" TO "anon";
GRANT ALL ON TABLE "public"."jobs" TO "authenticated";
GRANT ALL ON TABLE "public"."jobs" TO "service_role";



GRANT ALL ON TABLE "public"."organization_retirement" TO "anon";
GRANT ALL ON TABLE "public"."organization_retirement" TO "authenticated";
GRANT ALL ON TABLE "public"."organization_retirement" TO "service_role";



GRANT ALL ON TABLE "public"."organization_sources" TO "anon";
GRANT ALL ON TABLE "public"."organization_sources" TO "authenticated";
GRANT ALL ON TABLE "public"."organization_sources" TO "service_role";



GRANT ALL ON TABLE "public"."organizations" TO "anon";
GRANT ALL ON TABLE "public"."organizations" TO "authenticated";
GRANT ALL ON TABLE "public"."organizations" TO "service_role";



GRANT ALL ON TABLE "public"."organizations_without_active_job_sources" TO "anon";
GRANT ALL ON TABLE "public"."organizations_without_active_job_sources" TO "authenticated";
GRANT ALL ON TABLE "public"."organizations_without_active_job_sources" TO "service_role";



ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "service_role";






ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "service_role";






ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "service_role";







