--
-- PostgreSQL database dump
--

\restrict CumrIv8ex8Wi8xqm7DxvbbPAzz7C4acEfC7TUCXO2S8W2PRELK7WpuKSeMCyxGu

-- Dumped from database version 18.3
-- Dumped by pg_dump version 18.3

SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET transaction_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;

SET default_tablespace = '';

SET default_table_access_method = heap;

--
-- Name: absensi; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.absensi (
    id bigint NOT NULL,
    siswa_id bigint NOT NULL,
    tanggal date NOT NULL,
    status character varying(255) DEFAULT 'Hadir'::character varying NOT NULL,
    keterangan character varying(255),
    kelas character varying(255),
    diinput_oleh character varying(255),
    diinput_via character varying(255) DEFAULT 'online'::character varying NOT NULL,
    device_id character varying(255),
    synced_at timestamp(0) without time zone,
    created_at timestamp(0) without time zone,
    updated_at timestamp(0) without time zone,
    mapel character varying(255),
    class_id bigint,
    mapel_id bigint,
    attendance_status_id bigint,
    actor_user_id bigint,
    jadwal_id bigint,
    attendance_key character varying(255),
    CONSTRAINT absensi_diinput_via_check CHECK (((diinput_via)::text = ANY ((ARRAY['online'::character varying, 'offline_sync'::character varying])::text[]))),
    CONSTRAINT absensi_status_check CHECK (((status)::text = ANY ((ARRAY['Hadir'::character varying, 'Izin'::character varying, 'Sakit'::character varying, 'Alfa'::character varying])::text[])))
);


--
-- Name: absensi_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.absensi_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: absensi_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.absensi_id_seq OWNED BY public.absensi.id;


--
-- Name: academic_years; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.academic_years (
    id bigint NOT NULL,
    name character varying(20) NOT NULL,
    start_date date,
    end_date date,
    is_active boolean DEFAULT false NOT NULL,
    created_at timestamp(0) without time zone,
    updated_at timestamp(0) without time zone
);


--
-- Name: academic_years_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.academic_years_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: academic_years_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.academic_years_id_seq OWNED BY public.academic_years.id;


--
-- Name: admin_payment_security_settings; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.admin_payment_security_settings (
    id bigint NOT NULL,
    user_id bigint NOT NULL,
    face_enabled boolean DEFAULT false NOT NULL,
    fingerprint_enabled boolean DEFAULT false NOT NULL,
    verification_mode character varying(255) DEFAULT 'fingerprint_only'::character varying NOT NULL,
    biometric_required boolean DEFAULT false NOT NULL,
    face_registered_at timestamp(0) without time zone,
    fingerprint_registered_at timestamp(0) without time zone,
    last_verified_at timestamp(0) without time zone,
    last_verification_method character varying(255),
    last_payment_transaction_code character varying(255),
    last_device_label character varying(255),
    created_at timestamp(0) without time zone,
    updated_at timestamp(0) without time zone,
    pin_enabled boolean DEFAULT false NOT NULL,
    transaction_pin_hash character varying(255),
    pin_set_at timestamp(0) without time zone,
    CONSTRAINT admin_payment_security_settings_verification_mode_check CHECK (((verification_mode)::text = ANY (ARRAY['face_only'::text, 'fingerprint_only'::text, 'face_or_fingerprint'::text, 'face_primary_fingerprint_backup'::text])))
);


--
-- Name: admin_payment_security_settings_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.admin_payment_security_settings_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: admin_payment_security_settings_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.admin_payment_security_settings_id_seq OWNED BY public.admin_payment_security_settings.id;


--
-- Name: api_access_tokens; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.api_access_tokens (
    id bigint NOT NULL,
    user_id bigint NOT NULL,
    name character varying(255) DEFAULT 'mobile'::character varying NOT NULL,
    token_hash character varying(64) NOT NULL,
    last_used_at timestamp(0) without time zone,
    expires_at timestamp(0) without time zone,
    created_at timestamp(0) without time zone,
    updated_at timestamp(0) without time zone
);


--
-- Name: api_access_tokens_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.api_access_tokens_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: api_access_tokens_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.api_access_tokens_id_seq OWNED BY public.api_access_tokens.id;


--
-- Name: approval_statuses; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.approval_statuses (
    id bigint NOT NULL,
    code character varying(40) NOT NULL,
    name character varying(255) NOT NULL,
    created_at timestamp(0) without time zone,
    updated_at timestamp(0) without time zone
);


--
-- Name: approval_statuses_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.approval_statuses_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: approval_statuses_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.approval_statuses_id_seq OWNED BY public.approval_statuses.id;


--
-- Name: assessment_types; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.assessment_types (
    id bigint NOT NULL,
    code character varying(40) NOT NULL,
    name character varying(255) NOT NULL,
    created_at timestamp(0) without time zone,
    updated_at timestamp(0) without time zone
);


--
-- Name: assessment_types_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.assessment_types_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: assessment_types_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.assessment_types_id_seq OWNED BY public.assessment_types.id;


--
-- Name: attendance_statuses; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.attendance_statuses (
    id bigint NOT NULL,
    code character varying(30) NOT NULL,
    name character varying(255) NOT NULL,
    created_at timestamp(0) without time zone,
    updated_at timestamp(0) without time zone
);


--
-- Name: attendance_statuses_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.attendance_statuses_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: attendance_statuses_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.attendance_statuses_id_seq OWNED BY public.attendance_statuses.id;


--
-- Name: blood_types; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.blood_types (
    id bigint NOT NULL,
    code character varying(10) NOT NULL,
    name character varying(255) NOT NULL,
    created_at timestamp(0) without time zone,
    updated_at timestamp(0) without time zone
);


--
-- Name: blood_types_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.blood_types_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: blood_types_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.blood_types_id_seq OWNED BY public.blood_types.id;


--
-- Name: cache; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.cache (
    key character varying(255) NOT NULL,
    value text NOT NULL,
    expiration integer NOT NULL
);


--
-- Name: cache_locks; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.cache_locks (
    key character varying(255) NOT NULL,
    owner character varying(255) NOT NULL,
    expiration integer NOT NULL
);


--
-- Name: cities; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.cities (
    id bigint NOT NULL,
    province_id bigint,
    external_code character varying(30),
    name character varying(255) NOT NULL,
    created_at timestamp(0) without time zone,
    updated_at timestamp(0) without time zone
);


--
-- Name: cities_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.cities_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: cities_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.cities_id_seq OWNED BY public.cities.id;


--
-- Name: class_levels; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.class_levels (
    id bigint NOT NULL,
    code character varying(40) NOT NULL,
    name character varying(255) NOT NULL,
    sort_order smallint DEFAULT '0'::smallint NOT NULL,
    created_at timestamp(0) without time zone,
    updated_at timestamp(0) without time zone
);


--
-- Name: class_levels_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.class_levels_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: class_levels_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.class_levels_id_seq OWNED BY public.class_levels.id;


--
-- Name: classes; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.classes (
    id bigint NOT NULL,
    class_level_id bigint,
    code character varying(60) NOT NULL,
    name character varying(255) NOT NULL,
    gender_group character varying(10),
    category character varying(255),
    is_active boolean DEFAULT true NOT NULL,
    created_at timestamp(0) without time zone,
    updated_at timestamp(0) without time zone
);


--
-- Name: classes_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.classes_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: classes_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.classes_id_seq OWNED BY public.classes.id;


--
-- Name: days; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.days (
    id bigint NOT NULL,
    code character varying(20) NOT NULL,
    name character varying(255) NOT NULL,
    sort_order smallint DEFAULT '0'::smallint NOT NULL,
    created_at timestamp(0) without time zone,
    updated_at timestamp(0) without time zone
);


--
-- Name: days_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.days_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: days_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.days_id_seq OWNED BY public.days.id;


--
-- Name: districts; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.districts (
    id bigint NOT NULL,
    city_id bigint,
    external_code character varying(40),
    name character varying(255) NOT NULL,
    created_at timestamp(0) without time zone,
    updated_at timestamp(0) without time zone
);


--
-- Name: districts_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.districts_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: districts_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.districts_id_seq OWNED BY public.districts.id;


--
-- Name: document_settings; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.document_settings (
    id bigint NOT NULL,
    kepala_madin_nama character varying(255) DEFAULT 'Kepala Madin'::character varying NOT NULL,
    jabatan character varying(255) DEFAULT 'Kepala Madrasah Diniyah'::character varying NOT NULL,
    signature_mode character varying(255) DEFAULT 'kosong'::character varying NOT NULL,
    signature_path character varying(255),
    created_at timestamp(0) without time zone,
    updated_at timestamp(0) without time zone,
    payment_admin_name character varying(255) DEFAULT 'Petugas Administrasi'::character varying NOT NULL,
    payment_admin_title character varying(255) DEFAULT 'Petugas Administrasi'::character varying NOT NULL,
    payment_signature_mode character varying(255) DEFAULT 'kosong'::character varying NOT NULL,
    payment_signature_path character varying(255),
    document_logo_path character varying(255)
);


--
-- Name: document_settings_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.document_settings_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: document_settings_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.document_settings_id_seq OWNED BY public.document_settings.id;


--
-- Name: education_levels; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.education_levels (
    id bigint NOT NULL,
    code character varying(40) NOT NULL,
    name character varying(255) NOT NULL,
    created_at timestamp(0) without time zone,
    updated_at timestamp(0) without time zone
);


--
-- Name: education_levels_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.education_levels_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: education_levels_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.education_levels_id_seq OWNED BY public.education_levels.id;


--
-- Name: failed_jobs; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.failed_jobs (
    id bigint NOT NULL,
    uuid character varying(255) NOT NULL,
    connection text NOT NULL,
    queue text NOT NULL,
    payload text NOT NULL,
    exception text NOT NULL,
    failed_at timestamp(0) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);


--
-- Name: failed_jobs_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.failed_jobs_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: failed_jobs_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.failed_jobs_id_seq OWNED BY public.failed_jobs.id;


--
-- Name: guardian_profiles; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.guardian_profiles (
    id bigint NOT NULL,
    user_id bigint,
    name character varying(255) NOT NULL,
    phone character varying(30),
    address text,
    created_at timestamp(0) without time zone,
    updated_at timestamp(0) without time zone
);


--
-- Name: guardian_profiles_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.guardian_profiles_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: guardian_profiles_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.guardian_profiles_id_seq OWNED BY public.guardian_profiles.id;


--
-- Name: guardian_relationships; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.guardian_relationships (
    id bigint NOT NULL,
    code character varying(40) NOT NULL,
    name character varying(255) NOT NULL,
    created_at timestamp(0) without time zone,
    updated_at timestamp(0) without time zone
);


--
-- Name: guardian_relationships_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.guardian_relationships_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: guardian_relationships_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.guardian_relationships_id_seq OWNED BY public.guardian_relationships.id;


--
-- Name: guardian_student; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.guardian_student (
    guardian_profile_id bigint NOT NULL,
    siswa_id bigint NOT NULL,
    relationship character varying(40) DEFAULT 'wali'::character varying NOT NULL,
    is_primary boolean DEFAULT true NOT NULL,
    created_at timestamp(0) without time zone,
    updated_at timestamp(0) without time zone
);


--
-- Name: guru_izin; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.guru_izin (
    id bigint NOT NULL,
    guru_id bigint NOT NULL,
    tanggal_izin date NOT NULL,
    jenis_izin character varying(255),
    alasan text NOT NULL,
    keterangan text,
    status_pengajuan character varying(255) DEFAULT 'Diajukan'::character varying NOT NULL,
    created_at timestamp(0) without time zone,
    updated_at timestamp(0) without time zone,
    leave_type_id bigint,
    approval_status_id bigint
);


--
-- Name: guru_izin_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.guru_izin_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: guru_izin_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.guru_izin_id_seq OWNED BY public.guru_izin.id;


--
-- Name: hafalan; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.hafalan (
    id bigint NOT NULL,
    siswa_id bigint NOT NULL,
    juz integer,
    surah character varying(255),
    status character varying(255) DEFAULT 'Belum'::character varying NOT NULL,
    tanggal_setor date,
    penguji character varying(255),
    nilai_hafalan integer,
    keterangan text,
    created_at timestamp(0) without time zone,
    updated_at timestamp(0) without time zone,
    periode character varying(255),
    created_by bigint,
    updated_by bigint,
    created_by_role character varying(255),
    updated_by_role character varying(255),
    surah_id bigint,
    memorization_status_id bigint,
    examiner_id bigint,
    semester_id bigint,
    CONSTRAINT hafalan_status_check CHECK (((status)::text = ANY ((ARRAY['Belum'::character varying, 'Proses'::character varying, 'Selesai'::character varying])::text[])))
);


--
-- Name: hafalan_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.hafalan_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: hafalan_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.hafalan_id_seq OWNED BY public.hafalan.id;


--
-- Name: income_ranges; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.income_ranges (
    id bigint NOT NULL,
    code character varying(60) NOT NULL,
    name character varying(255) NOT NULL,
    min_amount integer,
    max_amount integer,
    created_at timestamp(0) without time zone,
    updated_at timestamp(0) without time zone
);


--
-- Name: income_ranges_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.income_ranges_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: income_ranges_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.income_ranges_id_seq OWNED BY public.income_ranges.id;


--
-- Name: jadwal; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.jadwal (
    id bigint NOT NULL,
    mapel_id bigint NOT NULL,
    guru character varying(255) NOT NULL,
    hari character varying(255) NOT NULL,
    jam_mulai time(0) without time zone NOT NULL,
    jam_selesai time(0) without time zone NOT NULL,
    sifir character varying(255),
    status character varying(255) DEFAULT 'Aktif'::character varying NOT NULL,
    created_at timestamp(0) without time zone,
    updated_at timestamp(0) without time zone,
    teacher_id bigint,
    day_id bigint,
    class_id bigint,
    CONSTRAINT jadwal_hari_check CHECK (((hari)::text = ANY ((ARRAY['Ahad'::character varying, 'Senin'::character varying, 'Selasa'::character varying, 'Rabu'::character varying, 'Kamis'::character varying, 'Jumat'::character varying, 'Sabtu'::character varying])::text[]))),
    CONSTRAINT jadwal_status_check CHECK (((status)::text = ANY ((ARRAY['Aktif'::character varying, 'Nonaktif'::character varying])::text[])))
);


--
-- Name: jadwal_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.jadwal_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: jadwal_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.jadwal_id_seq OWNED BY public.jadwal.id;


--
-- Name: job_batches; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.job_batches (
    id character varying(255) NOT NULL,
    name character varying(255) NOT NULL,
    total_jobs integer NOT NULL,
    pending_jobs integer NOT NULL,
    failed_jobs integer NOT NULL,
    failed_job_ids text NOT NULL,
    options text,
    cancelled_at integer,
    created_at integer NOT NULL,
    finished_at integer
);


--
-- Name: jobs; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.jobs (
    id bigint NOT NULL,
    queue character varying(255) NOT NULL,
    payload text NOT NULL,
    attempts smallint NOT NULL,
    reserved_at integer,
    available_at integer NOT NULL,
    created_at integer NOT NULL
);


--
-- Name: jobs_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.jobs_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: jobs_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.jobs_id_seq OWNED BY public.jobs.id;


--
-- Name: kegiatan; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.kegiatan (
    id bigint NOT NULL,
    uploaded_by bigint NOT NULL,
    judul character varying(255) NOT NULL,
    deskripsi text,
    tanggal date NOT NULL,
    created_at timestamp(0) without time zone,
    updated_at timestamp(0) without time zone,
    kelas character varying(255),
    class_id bigint
);


--
-- Name: kegiatan_foto; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.kegiatan_foto (
    id bigint NOT NULL,
    kegiatan_id bigint NOT NULL,
    file_path character varying(255) NOT NULL,
    caption character varying(255),
    created_at timestamp(0) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);


--
-- Name: kegiatan_foto_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.kegiatan_foto_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: kegiatan_foto_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.kegiatan_foto_id_seq OWNED BY public.kegiatan_foto.id;


--
-- Name: kegiatan_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.kegiatan_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: kegiatan_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.kegiatan_id_seq OWNED BY public.kegiatan.id;


--
-- Name: kelompok_belajar; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.kelompok_belajar (
    id bigint NOT NULL,
    nama character varying(255) NOT NULL,
    kategori character varying(255) NOT NULL,
    sifir character varying(255) NOT NULL,
    created_at timestamp(0) without time zone,
    updated_at timestamp(0) without time zone,
    class_id bigint
);


--
-- Name: kelompok_belajar_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.kelompok_belajar_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: kelompok_belajar_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.kelompok_belajar_id_seq OWNED BY public.kelompok_belajar.id;


--
-- Name: kelompok_belajar_siswa; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.kelompok_belajar_siswa (
    id bigint NOT NULL,
    kelompok_id bigint NOT NULL,
    siswa_id bigint NOT NULL,
    created_at timestamp(0) without time zone,
    updated_at timestamp(0) without time zone
);


--
-- Name: kelompok_belajar_siswa_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.kelompok_belajar_siswa_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: kelompok_belajar_siswa_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.kelompok_belajar_siswa_id_seq OWNED BY public.kelompok_belajar_siswa.id;


--
-- Name: leave_types; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.leave_types (
    id bigint NOT NULL,
    code character varying(40) NOT NULL,
    name character varying(255) NOT NULL,
    created_at timestamp(0) without time zone,
    updated_at timestamp(0) without time zone
);


--
-- Name: leave_types_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.leave_types_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: leave_types_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.leave_types_id_seq OWNED BY public.leave_types.id;


--
-- Name: mapel_guru; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.mapel_guru (
    id bigint NOT NULL,
    mapel_id bigint NOT NULL,
    user_id bigint NOT NULL,
    created_at timestamp(0) without time zone,
    updated_at timestamp(0) without time zone
);


--
-- Name: mapel_guru_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.mapel_guru_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: mapel_guru_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.mapel_guru_id_seq OWNED BY public.mapel_guru.id;


--
-- Name: mata_pelajaran; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.mata_pelajaran (
    id bigint NOT NULL,
    nama character varying(255) NOT NULL,
    kode character varying(10),
    status character varying(255) DEFAULT 'Aktif'::character varying NOT NULL,
    created_at timestamp(0) without time zone,
    updated_at timestamp(0) without time zone,
    CONSTRAINT mata_pelajaran_status_check CHECK (((status)::text = ANY ((ARRAY['Aktif'::character varying, 'Nonaktif'::character varying])::text[])))
);


--
-- Name: mata_pelajaran_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.mata_pelajaran_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: mata_pelajaran_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.mata_pelajaran_id_seq OWNED BY public.mata_pelajaran.id;


--
-- Name: materi; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.materi (
    id bigint NOT NULL,
    guru_id bigint NOT NULL,
    kelas character varying(255) NOT NULL,
    mapel character varying(255) NOT NULL,
    judul character varying(255) NOT NULL,
    deskripsi text,
    file_path character varying(255) NOT NULL,
    file_type character varying(255) DEFAULT 'foto'::character varying NOT NULL,
    tanggal date NOT NULL,
    created_at timestamp(0) without time zone,
    updated_at timestamp(0) without time zone,
    mapel_id bigint,
    class_id bigint,
    CONSTRAINT materi_file_type_check CHECK (((file_type)::text = ANY ((ARRAY['foto'::character varying, 'dokumen'::character varying])::text[])))
);


--
-- Name: materi_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.materi_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: materi_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.materi_id_seq OWNED BY public.materi.id;


--
-- Name: memorization_statuses; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.memorization_statuses (
    id bigint NOT NULL,
    code character varying(40) NOT NULL,
    name character varying(255) NOT NULL,
    created_at timestamp(0) without time zone,
    updated_at timestamp(0) without time zone
);


--
-- Name: memorization_statuses_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.memorization_statuses_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: memorization_statuses_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.memorization_statuses_id_seq OWNED BY public.memorization_statuses.id;


--
-- Name: migrations; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.migrations (
    id integer NOT NULL,
    migration character varying(255) NOT NULL,
    batch integer NOT NULL
);


--
-- Name: migrations_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.migrations_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: migrations_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.migrations_id_seq OWNED BY public.migrations.id;


--
-- Name: nilai; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.nilai (
    id bigint NOT NULL,
    siswa_id bigint NOT NULL,
    mapel_id bigint NOT NULL,
    jenis_ujian character varying(255) DEFAULT 'UTS'::character varying NOT NULL,
    nilai numeric(5,2) NOT NULL,
    semester character varying(255),
    created_at timestamp(0) without time zone,
    updated_at timestamp(0) without time zone,
    grade character varying(5),
    keterangan text,
    diinput_oleh character varying(255),
    tahun_ajaran character varying(255),
    created_by bigint,
    updated_by bigint,
    created_by_role character varying(255),
    updated_by_role character varying(255),
    assessment_type_id bigint,
    semester_id bigint,
    academic_year_id bigint,
    CONSTRAINT nilai_jenis_ujian_check CHECK (((jenis_ujian)::text = ANY ((ARRAY['UTS'::character varying, 'UAS'::character varying, 'Hafalan'::character varying, 'Tugas'::character varying, 'Harian'::character varying])::text[])))
);


--
-- Name: nilai_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.nilai_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: nilai_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.nilai_id_seq OWNED BY public.nilai.id;


--
-- Name: occupations; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.occupations (
    id bigint NOT NULL,
    code character varying(60) NOT NULL,
    name character varying(255) NOT NULL,
    created_at timestamp(0) without time zone,
    updated_at timestamp(0) without time zone
);


--
-- Name: occupations_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.occupations_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: occupations_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.occupations_id_seq OWNED BY public.occupations.id;


--
-- Name: offline_conflict_logs; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.offline_conflict_logs (
    id bigint NOT NULL,
    entity_type character varying(80) NOT NULL,
    entity_id bigint,
    client_key character varying(255),
    local_payload json,
    server_payload json,
    resolution_status character varying(40) DEFAULT 'pending'::character varying NOT NULL,
    resolved_by bigint,
    resolved_at timestamp(0) without time zone,
    created_at timestamp(0) without time zone,
    updated_at timestamp(0) without time zone
);


--
-- Name: offline_conflict_logs_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.offline_conflict_logs_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: offline_conflict_logs_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.offline_conflict_logs_id_seq OWNED BY public.offline_conflict_logs.id;


--
-- Name: password_reset_tokens; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.password_reset_tokens (
    email character varying(255) NOT NULL,
    token character varying(255) NOT NULL,
    created_at timestamp(0) without time zone
);


--
-- Name: payment_methods; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.payment_methods (
    id bigint NOT NULL,
    code character varying(50) NOT NULL,
    name character varying(255) NOT NULL,
    is_active boolean DEFAULT true NOT NULL,
    created_at timestamp(0) without time zone,
    updated_at timestamp(0) without time zone
);


--
-- Name: payment_methods_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.payment_methods_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: payment_methods_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.payment_methods_id_seq OWNED BY public.payment_methods.id;


--
-- Name: payment_period_types; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.payment_period_types (
    id bigint NOT NULL,
    code character varying(40) NOT NULL,
    name character varying(255) NOT NULL,
    created_at timestamp(0) without time zone,
    updated_at timestamp(0) without time zone
);


--
-- Name: payment_period_types_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.payment_period_types_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: payment_period_types_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.payment_period_types_id_seq OWNED BY public.payment_period_types.id;


--
-- Name: payment_statuses; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.payment_statuses (
    id bigint NOT NULL,
    code character varying(40) NOT NULL,
    name character varying(255) NOT NULL,
    created_at timestamp(0) without time zone,
    updated_at timestamp(0) without time zone
);


--
-- Name: payment_statuses_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.payment_statuses_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: payment_statuses_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.payment_statuses_id_seq OWNED BY public.payment_statuses.id;


--
-- Name: payment_transactions; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.payment_transactions (
    id bigint NOT NULL,
    kode_transaksi character varying(255) NOT NULL,
    siswa_id bigint NOT NULL,
    wali_id bigint,
    created_by_user_id bigint,
    updated_by_user_id bigint,
    atas_nama character varying(255) NOT NULL,
    via character varying(255) NOT NULL,
    jumlah_total integer DEFAULT 0 NOT NULL,
    total_item integer DEFAULT 0 NOT NULL,
    tanggal date NOT NULL,
    status character varying(255) DEFAULT 'Lunas'::character varying NOT NULL,
    keterangan text,
    biometric_required boolean DEFAULT false NOT NULL,
    biometric_verified_at timestamp(0) without time zone,
    biometric_verification_method character varying(255),
    biometric_verification_mode character varying(255),
    created_at timestamp(0) without time zone,
    updated_at timestamp(0) without time zone,
    payment_method_id bigint,
    payment_status_id bigint,
    CONSTRAINT payment_transactions_status_check CHECK (((status)::text = ANY ((ARRAY['Lunas'::character varying, 'Belum Lunas'::character varying, 'Menunggu'::character varying])::text[])))
);


--
-- Name: payment_transactions_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.payment_transactions_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: payment_transactions_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.payment_transactions_id_seq OWNED BY public.payment_transactions.id;


--
-- Name: payment_type_method; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.payment_type_method (
    payment_type_id bigint NOT NULL,
    payment_method_id bigint NOT NULL,
    created_at timestamp(0) without time zone,
    updated_at timestamp(0) without time zone
);


--
-- Name: payment_types; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.payment_types (
    id bigint NOT NULL,
    nama character varying(255) NOT NULL,
    deskripsi text,
    nominal_default integer DEFAULT 0 NOT NULL,
    periode character varying(255) DEFAULT 'sekali'::character varying NOT NULL,
    metode_pembayaran json,
    status character varying(255) DEFAULT 'Aktif'::character varying NOT NULL,
    created_at timestamp(0) without time zone,
    updated_at timestamp(0) without time zone,
    payment_period_type_id bigint,
    CONSTRAINT payment_types_periode_check CHECK (((periode)::text = ANY ((ARRAY['sekali'::character varying, 'bulanan'::character varying, 'tahunan'::character varying])::text[]))),
    CONSTRAINT payment_types_status_check CHECK (((status)::text = ANY ((ARRAY['Aktif'::character varying, 'Nonaktif'::character varying])::text[])))
);


--
-- Name: payment_types_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.payment_types_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: payment_types_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.payment_types_id_seq OWNED BY public.payment_types.id;


--
-- Name: pembayaran; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.pembayaran (
    id bigint NOT NULL,
    siswa_id bigint NOT NULL,
    atas_nama character varying(255) NOT NULL,
    jenis character varying(255) DEFAULT 'SPP Bulanan'::character varying NOT NULL,
    via character varying(255) DEFAULT 'Tunai'::character varying NOT NULL,
    jumlah integer NOT NULL,
    tanggal date NOT NULL,
    status character varying(255) DEFAULT 'Lunas'::character varying NOT NULL,
    periode_mulai character varying(255),
    periode_selesai character varying(255),
    keterangan text,
    created_at timestamp(0) without time zone,
    updated_at timestamp(0) without time zone,
    payment_type_id bigint,
    wali_id bigint,
    payment_transaction_id bigint,
    sort_order integer DEFAULT 0 NOT NULL,
    payment_method_id bigint,
    payment_status_id bigint,
    CONSTRAINT pembayaran_jenis_check CHECK (((jenis)::text = ANY ((ARRAY['SPP Bulanan'::character varying, 'Ujian Semester'::character varying, 'Buku & Kitab'::character varying, 'Daftar Ulang'::character varying, 'Lainnya'::character varying])::text[]))),
    CONSTRAINT pembayaran_status_check CHECK (((status)::text = ANY ((ARRAY['Lunas'::character varying, 'Belum Lunas'::character varying, 'Menunggu'::character varying])::text[]))),
    CONSTRAINT pembayaran_via_check CHECK (((via)::text = ANY ((ARRAY['Transfer Dana'::character varying, 'Bank BRI'::character varying, 'Bank Mandiri'::character varying, 'Bank BSI'::character varying, 'Bank BCA'::character varying, 'QRIS'::character varying, 'Tunai'::character varying])::text[])))
);


--
-- Name: pembayaran_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.pembayaran_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: pembayaran_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.pembayaran_id_seq OWNED BY public.pembayaran.id;


--
-- Name: penilaian_logs; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.penilaian_logs (
    id bigint NOT NULL,
    source_type character varying(255) NOT NULL,
    source_id bigint,
    siswa_id bigint,
    siswa_nama character varying(255) NOT NULL,
    kelas character varying(255),
    score_type character varying(255) NOT NULL,
    item_label character varying(255),
    score_value character varying(255),
    predicate character varying(255),
    period_label character varying(255),
    actor_id bigint,
    actor_name character varying(255),
    actor_role character varying(255),
    action character varying(255) NOT NULL,
    snapshot json,
    performed_at timestamp(0) without time zone,
    created_at timestamp(0) without time zone,
    updated_at timestamp(0) without time zone
);


--
-- Name: penilaian_logs_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.penilaian_logs_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: penilaian_logs_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.penilaian_logs_id_seq OWNED BY public.penilaian_logs.id;


--
-- Name: provinces; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.provinces (
    id bigint NOT NULL,
    external_code character varying(20),
    name character varying(255) NOT NULL,
    created_at timestamp(0) without time zone,
    updated_at timestamp(0) without time zone
);


--
-- Name: provinces_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.provinces_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: provinces_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.provinces_id_seq OWNED BY public.provinces.id;


--
-- Name: residence_types; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.residence_types (
    id bigint NOT NULL,
    code character varying(60) NOT NULL,
    name character varying(255) NOT NULL,
    created_at timestamp(0) without time zone,
    updated_at timestamp(0) without time zone
);


--
-- Name: residence_types_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.residence_types_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: residence_types_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.residence_types_id_seq OWNED BY public.residence_types.id;


--
-- Name: roles; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.roles (
    id bigint NOT NULL,
    code character varying(30) NOT NULL,
    name character varying(255) NOT NULL,
    created_at timestamp(0) without time zone,
    updated_at timestamp(0) without time zone
);


--
-- Name: roles_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.roles_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: roles_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.roles_id_seq OWNED BY public.roles.id;


--
-- Name: semesters; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.semesters (
    id bigint NOT NULL,
    academic_year_id bigint,
    code character varying(30) NOT NULL,
    name character varying(255) NOT NULL,
    is_active boolean DEFAULT false NOT NULL,
    created_at timestamp(0) without time zone,
    updated_at timestamp(0) without time zone
);


--
-- Name: semesters_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.semesters_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: semesters_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.semesters_id_seq OWNED BY public.semesters.id;


--
-- Name: sessions; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.sessions (
    id character varying(255) NOT NULL,
    user_id bigint,
    ip_address character varying(45),
    user_agent text,
    payload text NOT NULL,
    last_activity integer NOT NULL
);


--
-- Name: siswa; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.siswa (
    id bigint NOT NULL,
    nis character varying(20) NOT NULL,
    nisn character varying(20),
    nama character varying(255) NOT NULL,
    tempat_lahir character varying(255),
    tanggal_lahir date,
    jenis_kelamin character varying(255) DEFAULT 'L'::character varying NOT NULL,
    nama_wali character varying(255),
    no_telepon_wali character varying(20),
    kelas character varying(255),
    status character varying(255) DEFAULT 'Aktif'::character varying NOT NULL,
    created_at timestamp(0) without time zone,
    updated_at timestamp(0) without time zone,
    alamat character varying(255),
    asal_sekolah character varying(255),
    anak_ke character varying(255),
    jml_saudara character varying(255),
    nama_ayah character varying(255),
    nama_ibu character varying(255),
    pendidikan_ayah character varying(255),
    pendidikan_ibu character varying(255),
    pekerjaan_ayah character varying(255),
    pekerjaan_ibu character varying(255),
    alamat_ayah character varying(255),
    alamat_ibu character varying(255),
    no_ayah character varying(20),
    no_ibu character varying(20),
    nama_wali_keluarga character varying(255),
    pekerjaan_wali_keluarga character varying(255),
    alamat_wali_keluarga character varying(255),
    tanggal_masuk date,
    wali_id bigint,
    nama_panggilan character varying(255),
    nik character varying(16),
    no_kk character varying(16),
    no_akta character varying(255),
    dokumen_akta character varying(255),
    kewarganegaraan character varying(255) DEFAULT 'Indonesia'::character varying,
    provinsi character varying(255),
    kota character varying(255),
    kecamatan character varying(255),
    kelurahan character varying(255),
    kode_pos character varying(5),
    no_whatsapp character varying(20),
    email_siswa character varying(255),
    tahun_lulus character varying(4),
    tahun_akademik_masuk character varying(255),
    jenis_santri character varying(255),
    nik_ayah character varying(16),
    nik_ibu character varying(16),
    tempat_lahir_ayah character varying(255),
    tempat_lahir_ibu character varying(255),
    tanggal_lahir_ayah date,
    tanggal_lahir_ibu date,
    no_whatsapp_ayah character varying(20),
    no_whatsapp_ibu character varying(20),
    penghasilan_ayah character varying(255),
    penghasilan_ibu character varying(255),
    wali_sama_dengan character varying(255),
    tempat_tinggal character varying(255),
    transportasi character varying(255),
    tinggi_badan character varying(255),
    berat_badan character varying(255),
    golongan_darah character varying(255),
    foto_santri character varying(255),
    catatan_santri text,
    class_id bigint,
    student_status_id bigint,
    guardian_profile_id bigint,
    academic_year_id bigint,
    student_type_id bigint,
    province_id bigint,
    city_id bigint,
    district_id bigint,
    village_id bigint,
    father_education_id bigint,
    mother_education_id bigint,
    father_occupation_id bigint,
    father_income_id bigint,
    mother_occupation_id bigint,
    mother_income_id bigint,
    guardian_occupation_id bigint,
    guardian_relationship_id bigint,
    residence_type_id bigint,
    transport_mode_id bigint,
    blood_type_id bigint,
    CONSTRAINT siswa_jenis_kelamin_check CHECK (((jenis_kelamin)::text = ANY ((ARRAY['L'::character varying, 'P'::character varying])::text[]))),
    CONSTRAINT siswa_status_check CHECK (((status)::text = ANY ((ARRAY['Aktif'::character varying, 'Nonaktif'::character varying, 'Lulus'::character varying])::text[])))
);


--
-- Name: siswa_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.siswa_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: siswa_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.siswa_id_seq OWNED BY public.siswa.id;


--
-- Name: student_statuses; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.student_statuses (
    id bigint NOT NULL,
    code character varying(30) NOT NULL,
    name character varying(255) NOT NULL,
    created_at timestamp(0) without time zone,
    updated_at timestamp(0) without time zone
);


--
-- Name: student_statuses_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.student_statuses_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: student_statuses_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.student_statuses_id_seq OWNED BY public.student_statuses.id;


--
-- Name: student_types; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.student_types (
    id bigint NOT NULL,
    code character varying(40) NOT NULL,
    name character varying(255) NOT NULL,
    created_at timestamp(0) without time zone,
    updated_at timestamp(0) without time zone
);


--
-- Name: student_types_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.student_types_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: student_types_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.student_types_id_seq OWNED BY public.student_types.id;


--
-- Name: surahs; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.surahs (
    id bigint NOT NULL,
    number smallint NOT NULL,
    name character varying(255) NOT NULL,
    ayah_count smallint,
    created_at timestamp(0) without time zone,
    updated_at timestamp(0) without time zone
);


--
-- Name: surahs_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.surahs_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: surahs_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.surahs_id_seq OWNED BY public.surahs.id;


--
-- Name: sync_statuses; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.sync_statuses (
    id bigint NOT NULL,
    code character varying(40) NOT NULL,
    name character varying(255) NOT NULL,
    created_at timestamp(0) without time zone,
    updated_at timestamp(0) without time zone
);


--
-- Name: sync_statuses_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.sync_statuses_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: sync_statuses_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.sync_statuses_id_seq OWNED BY public.sync_statuses.id;


--
-- Name: teacher_categories; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.teacher_categories (
    id bigint NOT NULL,
    code character varying(40) NOT NULL,
    name character varying(255) NOT NULL,
    created_at timestamp(0) without time zone,
    updated_at timestamp(0) without time zone
);


--
-- Name: teacher_categories_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.teacher_categories_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: teacher_categories_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.teacher_categories_id_seq OWNED BY public.teacher_categories.id;


--
-- Name: teacher_profile_category; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.teacher_profile_category (
    teacher_profile_id bigint NOT NULL,
    teacher_category_id bigint NOT NULL,
    created_at timestamp(0) without time zone,
    updated_at timestamp(0) without time zone
);


--
-- Name: teacher_profile_unit; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.teacher_profile_unit (
    teacher_profile_id bigint NOT NULL,
    teacher_unit_id bigint NOT NULL,
    created_at timestamp(0) without time zone,
    updated_at timestamp(0) without time zone
);


--
-- Name: teacher_profiles; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.teacher_profiles (
    id bigint NOT NULL,
    user_id bigint NOT NULL,
    teacher_code character varying(40),
    address text,
    created_at timestamp(0) without time zone,
    updated_at timestamp(0) without time zone
);


--
-- Name: teacher_profiles_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.teacher_profiles_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: teacher_profiles_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.teacher_profiles_id_seq OWNED BY public.teacher_profiles.id;


--
-- Name: teacher_units; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.teacher_units (
    id bigint NOT NULL,
    name character varying(255) NOT NULL,
    created_at timestamp(0) without time zone,
    updated_at timestamp(0) without time zone
);


--
-- Name: teacher_units_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.teacher_units_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: teacher_units_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.teacher_units_id_seq OWNED BY public.teacher_units.id;


--
-- Name: transport_modes; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.transport_modes (
    id bigint NOT NULL,
    code character varying(60) NOT NULL,
    name character varying(255) NOT NULL,
    created_at timestamp(0) without time zone,
    updated_at timestamp(0) without time zone
);


--
-- Name: transport_modes_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.transport_modes_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: transport_modes_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.transport_modes_id_seq OWNED BY public.transport_modes.id;


--
-- Name: user_statuses; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.user_statuses (
    id bigint NOT NULL,
    code character varying(30) NOT NULL,
    name character varying(255) NOT NULL,
    created_at timestamp(0) without time zone,
    updated_at timestamp(0) without time zone
);


--
-- Name: user_statuses_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.user_statuses_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: user_statuses_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.user_statuses_id_seq OWNED BY public.user_statuses.id;


--
-- Name: users; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.users (
    id bigint NOT NULL,
    name character varying(255) NOT NULL,
    email character varying(255) NOT NULL,
    role character varying(255) DEFAULT 'admin'::character varying NOT NULL,
    nis character varying(255),
    nisn character varying(255),
    email_verified_at timestamp(0) without time zone,
    password character varying(255) NOT NULL,
    remember_token character varying(100),
    created_at timestamp(0) without time zone,
    updated_at timestamp(0) without time zone,
    foto_profil character varying(255),
    no_hp character varying(20),
    jenis_kelamin character varying(255),
    nik_user character varying(16),
    status character varying(255) DEFAULT 'Aktif'::character varying NOT NULL,
    kode_guru character varying(255),
    alamat text,
    unit_kerja json,
    kategori_guru json,
    password_default_encrypted text,
    password_current_encrypted text,
    password_changed_at timestamp(0) without time zone,
    role_id bigint,
    user_status_id bigint,
    CONSTRAINT users_jenis_kelamin_check CHECK (((jenis_kelamin)::text = ANY ((ARRAY['L'::character varying, 'P'::character varying])::text[]))),
    CONSTRAINT users_role_check CHECK (((role)::text = ANY ((ARRAY['admin'::character varying, 'guru'::character varying, 'wali'::character varying])::text[])))
);


--
-- Name: users_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.users_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: users_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.users_id_seq OWNED BY public.users.id;


--
-- Name: villages; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.villages (
    id bigint NOT NULL,
    district_id bigint,
    external_code character varying(50),
    name character varying(255) NOT NULL,
    postal_code character varying(10),
    created_at timestamp(0) without time zone,
    updated_at timestamp(0) without time zone
);


--
-- Name: villages_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.villages_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: villages_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.villages_id_seq OWNED BY public.villages.id;


--
-- Name: absensi id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.absensi ALTER COLUMN id SET DEFAULT nextval('public.absensi_id_seq'::regclass);


--
-- Name: academic_years id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.academic_years ALTER COLUMN id SET DEFAULT nextval('public.academic_years_id_seq'::regclass);


--
-- Name: admin_payment_security_settings id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.admin_payment_security_settings ALTER COLUMN id SET DEFAULT nextval('public.admin_payment_security_settings_id_seq'::regclass);


--
-- Name: api_access_tokens id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.api_access_tokens ALTER COLUMN id SET DEFAULT nextval('public.api_access_tokens_id_seq'::regclass);


--
-- Name: approval_statuses id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.approval_statuses ALTER COLUMN id SET DEFAULT nextval('public.approval_statuses_id_seq'::regclass);


--
-- Name: assessment_types id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.assessment_types ALTER COLUMN id SET DEFAULT nextval('public.assessment_types_id_seq'::regclass);


--
-- Name: attendance_statuses id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.attendance_statuses ALTER COLUMN id SET DEFAULT nextval('public.attendance_statuses_id_seq'::regclass);


--
-- Name: blood_types id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.blood_types ALTER COLUMN id SET DEFAULT nextval('public.blood_types_id_seq'::regclass);


--
-- Name: cities id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.cities ALTER COLUMN id SET DEFAULT nextval('public.cities_id_seq'::regclass);


--
-- Name: class_levels id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.class_levels ALTER COLUMN id SET DEFAULT nextval('public.class_levels_id_seq'::regclass);


--
-- Name: classes id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.classes ALTER COLUMN id SET DEFAULT nextval('public.classes_id_seq'::regclass);


--
-- Name: days id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.days ALTER COLUMN id SET DEFAULT nextval('public.days_id_seq'::regclass);


--
-- Name: districts id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.districts ALTER COLUMN id SET DEFAULT nextval('public.districts_id_seq'::regclass);


--
-- Name: document_settings id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.document_settings ALTER COLUMN id SET DEFAULT nextval('public.document_settings_id_seq'::regclass);


--
-- Name: education_levels id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.education_levels ALTER COLUMN id SET DEFAULT nextval('public.education_levels_id_seq'::regclass);


--
-- Name: failed_jobs id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.failed_jobs ALTER COLUMN id SET DEFAULT nextval('public.failed_jobs_id_seq'::regclass);


--
-- Name: guardian_profiles id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.guardian_profiles ALTER COLUMN id SET DEFAULT nextval('public.guardian_profiles_id_seq'::regclass);


--
-- Name: guardian_relationships id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.guardian_relationships ALTER COLUMN id SET DEFAULT nextval('public.guardian_relationships_id_seq'::regclass);


--
-- Name: guru_izin id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.guru_izin ALTER COLUMN id SET DEFAULT nextval('public.guru_izin_id_seq'::regclass);


--
-- Name: hafalan id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.hafalan ALTER COLUMN id SET DEFAULT nextval('public.hafalan_id_seq'::regclass);


--
-- Name: income_ranges id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.income_ranges ALTER COLUMN id SET DEFAULT nextval('public.income_ranges_id_seq'::regclass);


--
-- Name: jadwal id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.jadwal ALTER COLUMN id SET DEFAULT nextval('public.jadwal_id_seq'::regclass);


--
-- Name: jobs id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.jobs ALTER COLUMN id SET DEFAULT nextval('public.jobs_id_seq'::regclass);


--
-- Name: kegiatan id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.kegiatan ALTER COLUMN id SET DEFAULT nextval('public.kegiatan_id_seq'::regclass);


--
-- Name: kegiatan_foto id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.kegiatan_foto ALTER COLUMN id SET DEFAULT nextval('public.kegiatan_foto_id_seq'::regclass);


--
-- Name: kelompok_belajar id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.kelompok_belajar ALTER COLUMN id SET DEFAULT nextval('public.kelompok_belajar_id_seq'::regclass);


--
-- Name: kelompok_belajar_siswa id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.kelompok_belajar_siswa ALTER COLUMN id SET DEFAULT nextval('public.kelompok_belajar_siswa_id_seq'::regclass);


--
-- Name: leave_types id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.leave_types ALTER COLUMN id SET DEFAULT nextval('public.leave_types_id_seq'::regclass);


--
-- Name: mapel_guru id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.mapel_guru ALTER COLUMN id SET DEFAULT nextval('public.mapel_guru_id_seq'::regclass);


--
-- Name: mata_pelajaran id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.mata_pelajaran ALTER COLUMN id SET DEFAULT nextval('public.mata_pelajaran_id_seq'::regclass);


--
-- Name: materi id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.materi ALTER COLUMN id SET DEFAULT nextval('public.materi_id_seq'::regclass);


--
-- Name: memorization_statuses id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.memorization_statuses ALTER COLUMN id SET DEFAULT nextval('public.memorization_statuses_id_seq'::regclass);


--
-- Name: migrations id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.migrations ALTER COLUMN id SET DEFAULT nextval('public.migrations_id_seq'::regclass);


--
-- Name: nilai id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.nilai ALTER COLUMN id SET DEFAULT nextval('public.nilai_id_seq'::regclass);


--
-- Name: occupations id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.occupations ALTER COLUMN id SET DEFAULT nextval('public.occupations_id_seq'::regclass);


--
-- Name: offline_conflict_logs id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.offline_conflict_logs ALTER COLUMN id SET DEFAULT nextval('public.offline_conflict_logs_id_seq'::regclass);


--
-- Name: payment_methods id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.payment_methods ALTER COLUMN id SET DEFAULT nextval('public.payment_methods_id_seq'::regclass);


--
-- Name: payment_period_types id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.payment_period_types ALTER COLUMN id SET DEFAULT nextval('public.payment_period_types_id_seq'::regclass);


--
-- Name: payment_statuses id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.payment_statuses ALTER COLUMN id SET DEFAULT nextval('public.payment_statuses_id_seq'::regclass);


--
-- Name: payment_transactions id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.payment_transactions ALTER COLUMN id SET DEFAULT nextval('public.payment_transactions_id_seq'::regclass);


--
-- Name: payment_types id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.payment_types ALTER COLUMN id SET DEFAULT nextval('public.payment_types_id_seq'::regclass);


--
-- Name: pembayaran id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.pembayaran ALTER COLUMN id SET DEFAULT nextval('public.pembayaran_id_seq'::regclass);


--
-- Name: penilaian_logs id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.penilaian_logs ALTER COLUMN id SET DEFAULT nextval('public.penilaian_logs_id_seq'::regclass);


--
-- Name: provinces id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.provinces ALTER COLUMN id SET DEFAULT nextval('public.provinces_id_seq'::regclass);


--
-- Name: residence_types id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.residence_types ALTER COLUMN id SET DEFAULT nextval('public.residence_types_id_seq'::regclass);


--
-- Name: roles id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.roles ALTER COLUMN id SET DEFAULT nextval('public.roles_id_seq'::regclass);


--
-- Name: semesters id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.semesters ALTER COLUMN id SET DEFAULT nextval('public.semesters_id_seq'::regclass);


--
-- Name: siswa id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.siswa ALTER COLUMN id SET DEFAULT nextval('public.siswa_id_seq'::regclass);


--
-- Name: student_statuses id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.student_statuses ALTER COLUMN id SET DEFAULT nextval('public.student_statuses_id_seq'::regclass);


--
-- Name: student_types id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.student_types ALTER COLUMN id SET DEFAULT nextval('public.student_types_id_seq'::regclass);


--
-- Name: surahs id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.surahs ALTER COLUMN id SET DEFAULT nextval('public.surahs_id_seq'::regclass);


--
-- Name: sync_statuses id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.sync_statuses ALTER COLUMN id SET DEFAULT nextval('public.sync_statuses_id_seq'::regclass);


--
-- Name: teacher_categories id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.teacher_categories ALTER COLUMN id SET DEFAULT nextval('public.teacher_categories_id_seq'::regclass);


--
-- Name: teacher_profiles id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.teacher_profiles ALTER COLUMN id SET DEFAULT nextval('public.teacher_profiles_id_seq'::regclass);


--
-- Name: teacher_units id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.teacher_units ALTER COLUMN id SET DEFAULT nextval('public.teacher_units_id_seq'::regclass);


--
-- Name: transport_modes id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.transport_modes ALTER COLUMN id SET DEFAULT nextval('public.transport_modes_id_seq'::regclass);


--
-- Name: user_statuses id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_statuses ALTER COLUMN id SET DEFAULT nextval('public.user_statuses_id_seq'::regclass);


--
-- Name: users id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users ALTER COLUMN id SET DEFAULT nextval('public.users_id_seq'::regclass);


--
-- Name: villages id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.villages ALTER COLUMN id SET DEFAULT nextval('public.villages_id_seq'::regclass);


--
-- Name: absensi absensi_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.absensi
    ADD CONSTRAINT absensi_pkey PRIMARY KEY (id);


--
-- Name: academic_years academic_years_name_unique; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.academic_years
    ADD CONSTRAINT academic_years_name_unique UNIQUE (name);


--
-- Name: academic_years academic_years_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.academic_years
    ADD CONSTRAINT academic_years_pkey PRIMARY KEY (id);


--
-- Name: admin_payment_security_settings admin_payment_security_settings_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.admin_payment_security_settings
    ADD CONSTRAINT admin_payment_security_settings_pkey PRIMARY KEY (id);


--
-- Name: admin_payment_security_settings admin_payment_security_settings_user_id_unique; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.admin_payment_security_settings
    ADD CONSTRAINT admin_payment_security_settings_user_id_unique UNIQUE (user_id);


--
-- Name: api_access_tokens api_access_tokens_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.api_access_tokens
    ADD CONSTRAINT api_access_tokens_pkey PRIMARY KEY (id);


--
-- Name: api_access_tokens api_access_tokens_token_hash_unique; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.api_access_tokens
    ADD CONSTRAINT api_access_tokens_token_hash_unique UNIQUE (token_hash);


--
-- Name: approval_statuses approval_statuses_code_unique; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.approval_statuses
    ADD CONSTRAINT approval_statuses_code_unique UNIQUE (code);


--
-- Name: approval_statuses approval_statuses_name_unique; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.approval_statuses
    ADD CONSTRAINT approval_statuses_name_unique UNIQUE (name);


--
-- Name: approval_statuses approval_statuses_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.approval_statuses
    ADD CONSTRAINT approval_statuses_pkey PRIMARY KEY (id);


--
-- Name: assessment_types assessment_types_code_unique; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.assessment_types
    ADD CONSTRAINT assessment_types_code_unique UNIQUE (code);


--
-- Name: assessment_types assessment_types_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.assessment_types
    ADD CONSTRAINT assessment_types_pkey PRIMARY KEY (id);


--
-- Name: attendance_statuses attendance_statuses_code_unique; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.attendance_statuses
    ADD CONSTRAINT attendance_statuses_code_unique UNIQUE (code);


--
-- Name: attendance_statuses attendance_statuses_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.attendance_statuses
    ADD CONSTRAINT attendance_statuses_pkey PRIMARY KEY (id);


--
-- Name: blood_types blood_types_code_unique; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.blood_types
    ADD CONSTRAINT blood_types_code_unique UNIQUE (code);


--
-- Name: blood_types blood_types_name_unique; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.blood_types
    ADD CONSTRAINT blood_types_name_unique UNIQUE (name);


--
-- Name: blood_types blood_types_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.blood_types
    ADD CONSTRAINT blood_types_pkey PRIMARY KEY (id);


--
-- Name: cache_locks cache_locks_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.cache_locks
    ADD CONSTRAINT cache_locks_pkey PRIMARY KEY (key);


--
-- Name: cache cache_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.cache
    ADD CONSTRAINT cache_pkey PRIMARY KEY (key);


--
-- Name: cities cities_external_code_unique; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.cities
    ADD CONSTRAINT cities_external_code_unique UNIQUE (external_code);


--
-- Name: cities cities_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.cities
    ADD CONSTRAINT cities_pkey PRIMARY KEY (id);


--
-- Name: cities cities_province_id_name_unique; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.cities
    ADD CONSTRAINT cities_province_id_name_unique UNIQUE (province_id, name);


--
-- Name: class_levels class_levels_code_unique; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.class_levels
    ADD CONSTRAINT class_levels_code_unique UNIQUE (code);


--
-- Name: class_levels class_levels_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.class_levels
    ADD CONSTRAINT class_levels_pkey PRIMARY KEY (id);


--
-- Name: classes classes_code_unique; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.classes
    ADD CONSTRAINT classes_code_unique UNIQUE (code);


--
-- Name: classes classes_name_unique; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.classes
    ADD CONSTRAINT classes_name_unique UNIQUE (name);


--
-- Name: classes classes_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.classes
    ADD CONSTRAINT classes_pkey PRIMARY KEY (id);


--
-- Name: days days_code_unique; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.days
    ADD CONSTRAINT days_code_unique UNIQUE (code);


--
-- Name: days days_name_unique; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.days
    ADD CONSTRAINT days_name_unique UNIQUE (name);


--
-- Name: days days_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.days
    ADD CONSTRAINT days_pkey PRIMARY KEY (id);


--
-- Name: districts districts_city_id_name_unique; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.districts
    ADD CONSTRAINT districts_city_id_name_unique UNIQUE (city_id, name);


--
-- Name: districts districts_external_code_unique; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.districts
    ADD CONSTRAINT districts_external_code_unique UNIQUE (external_code);


--
-- Name: districts districts_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.districts
    ADD CONSTRAINT districts_pkey PRIMARY KEY (id);


--
-- Name: document_settings document_settings_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.document_settings
    ADD CONSTRAINT document_settings_pkey PRIMARY KEY (id);


--
-- Name: education_levels education_levels_code_unique; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.education_levels
    ADD CONSTRAINT education_levels_code_unique UNIQUE (code);


--
-- Name: education_levels education_levels_name_unique; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.education_levels
    ADD CONSTRAINT education_levels_name_unique UNIQUE (name);


--
-- Name: education_levels education_levels_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.education_levels
    ADD CONSTRAINT education_levels_pkey PRIMARY KEY (id);


--
-- Name: failed_jobs failed_jobs_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.failed_jobs
    ADD CONSTRAINT failed_jobs_pkey PRIMARY KEY (id);


--
-- Name: failed_jobs failed_jobs_uuid_unique; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.failed_jobs
    ADD CONSTRAINT failed_jobs_uuid_unique UNIQUE (uuid);


--
-- Name: guardian_profiles guardian_profiles_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.guardian_profiles
    ADD CONSTRAINT guardian_profiles_pkey PRIMARY KEY (id);


--
-- Name: guardian_profiles guardian_profiles_user_id_unique; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.guardian_profiles
    ADD CONSTRAINT guardian_profiles_user_id_unique UNIQUE (user_id);


--
-- Name: guardian_relationships guardian_relationships_code_unique; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.guardian_relationships
    ADD CONSTRAINT guardian_relationships_code_unique UNIQUE (code);


--
-- Name: guardian_relationships guardian_relationships_name_unique; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.guardian_relationships
    ADD CONSTRAINT guardian_relationships_name_unique UNIQUE (name);


--
-- Name: guardian_relationships guardian_relationships_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.guardian_relationships
    ADD CONSTRAINT guardian_relationships_pkey PRIMARY KEY (id);


--
-- Name: guardian_student guardian_student_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.guardian_student
    ADD CONSTRAINT guardian_student_pkey PRIMARY KEY (guardian_profile_id, siswa_id);


--
-- Name: guru_izin guru_izin_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.guru_izin
    ADD CONSTRAINT guru_izin_pkey PRIMARY KEY (id);


--
-- Name: hafalan hafalan_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.hafalan
    ADD CONSTRAINT hafalan_pkey PRIMARY KEY (id);


--
-- Name: income_ranges income_ranges_code_unique; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.income_ranges
    ADD CONSTRAINT income_ranges_code_unique UNIQUE (code);


--
-- Name: income_ranges income_ranges_name_unique; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.income_ranges
    ADD CONSTRAINT income_ranges_name_unique UNIQUE (name);


--
-- Name: income_ranges income_ranges_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.income_ranges
    ADD CONSTRAINT income_ranges_pkey PRIMARY KEY (id);


--
-- Name: jadwal jadwal_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.jadwal
    ADD CONSTRAINT jadwal_pkey PRIMARY KEY (id);


--
-- Name: job_batches job_batches_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.job_batches
    ADD CONSTRAINT job_batches_pkey PRIMARY KEY (id);


--
-- Name: jobs jobs_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.jobs
    ADD CONSTRAINT jobs_pkey PRIMARY KEY (id);


--
-- Name: kegiatan_foto kegiatan_foto_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.kegiatan_foto
    ADD CONSTRAINT kegiatan_foto_pkey PRIMARY KEY (id);


--
-- Name: kegiatan kegiatan_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.kegiatan
    ADD CONSTRAINT kegiatan_pkey PRIMARY KEY (id);


--
-- Name: kelompok_belajar kelompok_belajar_nama_unique; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.kelompok_belajar
    ADD CONSTRAINT kelompok_belajar_nama_unique UNIQUE (nama);


--
-- Name: kelompok_belajar kelompok_belajar_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.kelompok_belajar
    ADD CONSTRAINT kelompok_belajar_pkey PRIMARY KEY (id);


--
-- Name: kelompok_belajar_siswa kelompok_belajar_siswa_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.kelompok_belajar_siswa
    ADD CONSTRAINT kelompok_belajar_siswa_pkey PRIMARY KEY (id);


--
-- Name: leave_types leave_types_code_unique; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.leave_types
    ADD CONSTRAINT leave_types_code_unique UNIQUE (code);


--
-- Name: leave_types leave_types_name_unique; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.leave_types
    ADD CONSTRAINT leave_types_name_unique UNIQUE (name);


--
-- Name: leave_types leave_types_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.leave_types
    ADD CONSTRAINT leave_types_pkey PRIMARY KEY (id);


--
-- Name: mapel_guru mapel_guru_mapel_id_user_id_unique; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.mapel_guru
    ADD CONSTRAINT mapel_guru_mapel_id_user_id_unique UNIQUE (mapel_id, user_id);


--
-- Name: mapel_guru mapel_guru_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.mapel_guru
    ADD CONSTRAINT mapel_guru_pkey PRIMARY KEY (id);


--
-- Name: mata_pelajaran mata_pelajaran_kode_unique; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.mata_pelajaran
    ADD CONSTRAINT mata_pelajaran_kode_unique UNIQUE (kode);


--
-- Name: mata_pelajaran mata_pelajaran_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.mata_pelajaran
    ADD CONSTRAINT mata_pelajaran_pkey PRIMARY KEY (id);


--
-- Name: materi materi_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.materi
    ADD CONSTRAINT materi_pkey PRIMARY KEY (id);


--
-- Name: memorization_statuses memorization_statuses_code_unique; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.memorization_statuses
    ADD CONSTRAINT memorization_statuses_code_unique UNIQUE (code);


--
-- Name: memorization_statuses memorization_statuses_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.memorization_statuses
    ADD CONSTRAINT memorization_statuses_pkey PRIMARY KEY (id);


--
-- Name: migrations migrations_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.migrations
    ADD CONSTRAINT migrations_pkey PRIMARY KEY (id);


--
-- Name: nilai nilai_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.nilai
    ADD CONSTRAINT nilai_pkey PRIMARY KEY (id);


--
-- Name: occupations occupations_code_unique; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.occupations
    ADD CONSTRAINT occupations_code_unique UNIQUE (code);


--
-- Name: occupations occupations_name_unique; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.occupations
    ADD CONSTRAINT occupations_name_unique UNIQUE (name);


--
-- Name: occupations occupations_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.occupations
    ADD CONSTRAINT occupations_pkey PRIMARY KEY (id);


--
-- Name: offline_conflict_logs offline_conflict_logs_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.offline_conflict_logs
    ADD CONSTRAINT offline_conflict_logs_pkey PRIMARY KEY (id);


--
-- Name: password_reset_tokens password_reset_tokens_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.password_reset_tokens
    ADD CONSTRAINT password_reset_tokens_pkey PRIMARY KEY (email);


--
-- Name: payment_methods payment_methods_code_unique; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.payment_methods
    ADD CONSTRAINT payment_methods_code_unique UNIQUE (code);


--
-- Name: payment_methods payment_methods_name_unique; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.payment_methods
    ADD CONSTRAINT payment_methods_name_unique UNIQUE (name);


--
-- Name: payment_methods payment_methods_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.payment_methods
    ADD CONSTRAINT payment_methods_pkey PRIMARY KEY (id);


--
-- Name: payment_period_types payment_period_types_code_unique; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.payment_period_types
    ADD CONSTRAINT payment_period_types_code_unique UNIQUE (code);


--
-- Name: payment_period_types payment_period_types_name_unique; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.payment_period_types
    ADD CONSTRAINT payment_period_types_name_unique UNIQUE (name);


--
-- Name: payment_period_types payment_period_types_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.payment_period_types
    ADD CONSTRAINT payment_period_types_pkey PRIMARY KEY (id);


--
-- Name: payment_statuses payment_statuses_code_unique; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.payment_statuses
    ADD CONSTRAINT payment_statuses_code_unique UNIQUE (code);


--
-- Name: payment_statuses payment_statuses_name_unique; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.payment_statuses
    ADD CONSTRAINT payment_statuses_name_unique UNIQUE (name);


--
-- Name: payment_statuses payment_statuses_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.payment_statuses
    ADD CONSTRAINT payment_statuses_pkey PRIMARY KEY (id);


--
-- Name: payment_transactions payment_transactions_kode_transaksi_unique; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.payment_transactions
    ADD CONSTRAINT payment_transactions_kode_transaksi_unique UNIQUE (kode_transaksi);


--
-- Name: payment_transactions payment_transactions_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.payment_transactions
    ADD CONSTRAINT payment_transactions_pkey PRIMARY KEY (id);


--
-- Name: payment_type_method payment_type_method_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.payment_type_method
    ADD CONSTRAINT payment_type_method_pkey PRIMARY KEY (payment_type_id, payment_method_id);


--
-- Name: payment_types payment_types_nama_unique; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.payment_types
    ADD CONSTRAINT payment_types_nama_unique UNIQUE (nama);


--
-- Name: payment_types payment_types_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.payment_types
    ADD CONSTRAINT payment_types_pkey PRIMARY KEY (id);


--
-- Name: pembayaran pembayaran_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.pembayaran
    ADD CONSTRAINT pembayaran_pkey PRIMARY KEY (id);


--
-- Name: penilaian_logs penilaian_logs_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.penilaian_logs
    ADD CONSTRAINT penilaian_logs_pkey PRIMARY KEY (id);


--
-- Name: provinces provinces_external_code_unique; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.provinces
    ADD CONSTRAINT provinces_external_code_unique UNIQUE (external_code);


--
-- Name: provinces provinces_name_unique; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.provinces
    ADD CONSTRAINT provinces_name_unique UNIQUE (name);


--
-- Name: provinces provinces_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.provinces
    ADD CONSTRAINT provinces_pkey PRIMARY KEY (id);


--
-- Name: residence_types residence_types_code_unique; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.residence_types
    ADD CONSTRAINT residence_types_code_unique UNIQUE (code);


--
-- Name: residence_types residence_types_name_unique; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.residence_types
    ADD CONSTRAINT residence_types_name_unique UNIQUE (name);


--
-- Name: residence_types residence_types_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.residence_types
    ADD CONSTRAINT residence_types_pkey PRIMARY KEY (id);


--
-- Name: roles roles_code_unique; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.roles
    ADD CONSTRAINT roles_code_unique UNIQUE (code);


--
-- Name: roles roles_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.roles
    ADD CONSTRAINT roles_pkey PRIMARY KEY (id);


--
-- Name: semesters semesters_academic_year_id_code_unique; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.semesters
    ADD CONSTRAINT semesters_academic_year_id_code_unique UNIQUE (academic_year_id, code);


--
-- Name: semesters semesters_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.semesters
    ADD CONSTRAINT semesters_pkey PRIMARY KEY (id);


--
-- Name: sessions sessions_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.sessions
    ADD CONSTRAINT sessions_pkey PRIMARY KEY (id);


--
-- Name: siswa siswa_nis_unique; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.siswa
    ADD CONSTRAINT siswa_nis_unique UNIQUE (nis);


--
-- Name: siswa siswa_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.siswa
    ADD CONSTRAINT siswa_pkey PRIMARY KEY (id);


--
-- Name: student_statuses student_statuses_code_unique; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.student_statuses
    ADD CONSTRAINT student_statuses_code_unique UNIQUE (code);


--
-- Name: student_statuses student_statuses_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.student_statuses
    ADD CONSTRAINT student_statuses_pkey PRIMARY KEY (id);


--
-- Name: student_types student_types_code_unique; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.student_types
    ADD CONSTRAINT student_types_code_unique UNIQUE (code);


--
-- Name: student_types student_types_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.student_types
    ADD CONSTRAINT student_types_pkey PRIMARY KEY (id);


--
-- Name: surahs surahs_name_unique; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.surahs
    ADD CONSTRAINT surahs_name_unique UNIQUE (name);


--
-- Name: surahs surahs_number_unique; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.surahs
    ADD CONSTRAINT surahs_number_unique UNIQUE (number);


--
-- Name: surahs surahs_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.surahs
    ADD CONSTRAINT surahs_pkey PRIMARY KEY (id);


--
-- Name: sync_statuses sync_statuses_code_unique; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.sync_statuses
    ADD CONSTRAINT sync_statuses_code_unique UNIQUE (code);


--
-- Name: sync_statuses sync_statuses_name_unique; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.sync_statuses
    ADD CONSTRAINT sync_statuses_name_unique UNIQUE (name);


--
-- Name: sync_statuses sync_statuses_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.sync_statuses
    ADD CONSTRAINT sync_statuses_pkey PRIMARY KEY (id);


--
-- Name: teacher_categories teacher_categories_code_unique; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.teacher_categories
    ADD CONSTRAINT teacher_categories_code_unique UNIQUE (code);


--
-- Name: teacher_categories teacher_categories_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.teacher_categories
    ADD CONSTRAINT teacher_categories_pkey PRIMARY KEY (id);


--
-- Name: teacher_profile_category teacher_profile_category_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.teacher_profile_category
    ADD CONSTRAINT teacher_profile_category_pkey PRIMARY KEY (teacher_profile_id, teacher_category_id);


--
-- Name: teacher_profile_unit teacher_profile_unit_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.teacher_profile_unit
    ADD CONSTRAINT teacher_profile_unit_pkey PRIMARY KEY (teacher_profile_id, teacher_unit_id);


--
-- Name: teacher_profiles teacher_profiles_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.teacher_profiles
    ADD CONSTRAINT teacher_profiles_pkey PRIMARY KEY (id);


--
-- Name: teacher_profiles teacher_profiles_teacher_code_unique; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.teacher_profiles
    ADD CONSTRAINT teacher_profiles_teacher_code_unique UNIQUE (teacher_code);


--
-- Name: teacher_profiles teacher_profiles_user_id_unique; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.teacher_profiles
    ADD CONSTRAINT teacher_profiles_user_id_unique UNIQUE (user_id);


--
-- Name: teacher_units teacher_units_name_unique; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.teacher_units
    ADD CONSTRAINT teacher_units_name_unique UNIQUE (name);


--
-- Name: teacher_units teacher_units_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.teacher_units
    ADD CONSTRAINT teacher_units_pkey PRIMARY KEY (id);


--
-- Name: transport_modes transport_modes_code_unique; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.transport_modes
    ADD CONSTRAINT transport_modes_code_unique UNIQUE (code);


--
-- Name: transport_modes transport_modes_name_unique; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.transport_modes
    ADD CONSTRAINT transport_modes_name_unique UNIQUE (name);


--
-- Name: transport_modes transport_modes_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.transport_modes
    ADD CONSTRAINT transport_modes_pkey PRIMARY KEY (id);


--
-- Name: user_statuses user_statuses_code_unique; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_statuses
    ADD CONSTRAINT user_statuses_code_unique UNIQUE (code);


--
-- Name: user_statuses user_statuses_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_statuses
    ADD CONSTRAINT user_statuses_pkey PRIMARY KEY (id);


--
-- Name: users users_email_unique; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_email_unique UNIQUE (email);


--
-- Name: users users_kode_guru_unique; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_kode_guru_unique UNIQUE (kode_guru);


--
-- Name: users users_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_pkey PRIMARY KEY (id);


--
-- Name: villages villages_district_id_name_unique; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.villages
    ADD CONSTRAINT villages_district_id_name_unique UNIQUE (district_id, name);


--
-- Name: villages villages_external_code_unique; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.villages
    ADD CONSTRAINT villages_external_code_unique UNIQUE (external_code);


--
-- Name: villages villages_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.villages
    ADD CONSTRAINT villages_pkey PRIMARY KEY (id);


--
-- Name: absensi_normalized_lookup_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX absensi_normalized_lookup_idx ON public.absensi USING btree (siswa_id, tanggal, class_id, mapel_id);


--
-- Name: absensi_attendance_key_unique; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX absensi_attendance_key_unique ON public.absensi USING btree (attendance_key) WHERE (attendance_key IS NOT NULL);


--
-- Name: absensi_scope_lookup_index; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX absensi_scope_lookup_index ON public.absensi USING btree (tanggal, class_id, mapel_id, jadwal_id, siswa_id);


--
-- Name: absensi_tanggal_class_id_mapel_id_index; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX absensi_tanggal_class_id_mapel_id_index ON public.absensi USING btree (tanggal, class_id, mapel_id);


--
-- Name: academic_years_is_active_index; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX academic_years_is_active_index ON public.academic_years USING btree (is_active);


--
-- Name: api_access_tokens_user_id_expires_at_index; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX api_access_tokens_user_id_expires_at_index ON public.api_access_tokens USING btree (user_id, expires_at);


--
-- Name: cache_expiration_index; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX cache_expiration_index ON public.cache USING btree (expiration);


--
-- Name: cache_locks_expiration_index; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX cache_locks_expiration_index ON public.cache_locks USING btree (expiration);


--
-- Name: cities_name_index; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX cities_name_index ON public.cities USING btree (name);


--
-- Name: classes_class_level_id_is_active_index; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX classes_class_level_id_is_active_index ON public.classes USING btree (class_level_id, is_active);


--
-- Name: classes_is_active_index; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX classes_is_active_index ON public.classes USING btree (is_active);


--
-- Name: districts_name_index; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX districts_name_index ON public.districts USING btree (name);


--
-- Name: guardian_profiles_phone_index; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX guardian_profiles_phone_index ON public.guardian_profiles USING btree (phone);


--
-- Name: guru_izin_guru_id_approval_status_id_index; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX guru_izin_guru_id_approval_status_id_index ON public.guru_izin USING btree (guru_id, approval_status_id);


--
-- Name: guru_izin_guru_id_tanggal_izin_index; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX guru_izin_guru_id_tanggal_izin_index ON public.guru_izin USING btree (guru_id, tanggal_izin);


--
-- Name: guru_izin_status_pengajuan_index; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX guru_izin_status_pengajuan_index ON public.guru_izin USING btree (status_pengajuan);


--
-- Name: hafalan_normalized_lookup_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX hafalan_normalized_lookup_idx ON public.hafalan USING btree (siswa_id, surah_id, memorization_status_id);


--
-- Name: jadwal_mapel_id_class_id_status_index; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX jadwal_mapel_id_class_id_status_index ON public.jadwal USING btree (mapel_id, class_id, status);


--
-- Name: jadwal_teacher_id_day_id_class_id_index; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX jadwal_teacher_id_day_id_class_id_index ON public.jadwal USING btree (teacher_id, day_id, class_id);


--
-- Name: jobs_queue_index; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX jobs_queue_index ON public.jobs USING btree (queue);


--
-- Name: kegiatan_kelas_index; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX kegiatan_kelas_index ON public.kegiatan USING btree (kelas);


--
-- Name: kegiatan_tanggal_index; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX kegiatan_tanggal_index ON public.kegiatan USING btree (tanggal);


--
-- Name: kegiatan_uploaded_by_class_id_index; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX kegiatan_uploaded_by_class_id_index ON public.kegiatan USING btree (uploaded_by, class_id);


--
-- Name: kelompok_belajar_sifir_kategori_index; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX kelompok_belajar_sifir_kategori_index ON public.kelompok_belajar USING btree (sifir, kategori);


--
-- Name: mata_pelajaran_status_index; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX mata_pelajaran_status_index ON public.mata_pelajaran USING btree (status);


--
-- Name: materi_guru_id_class_id_mapel_id_index; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX materi_guru_id_class_id_mapel_id_index ON public.materi USING btree (guru_id, class_id, mapel_id);


--
-- Name: materi_kelas_mapel_index; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX materi_kelas_mapel_index ON public.materi USING btree (kelas, mapel);


--
-- Name: materi_mapel_id_index; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX materi_mapel_id_index ON public.materi USING btree (mapel_id);


--
-- Name: materi_tanggal_index; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX materi_tanggal_index ON public.materi USING btree (tanggal);


--
-- Name: nilai_normalized_lookup_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX nilai_normalized_lookup_idx ON public.nilai USING btree (siswa_id, mapel_id, semester_id, assessment_type_id);


--
-- Name: offline_conflict_logs_client_key_index; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX offline_conflict_logs_client_key_index ON public.offline_conflict_logs USING btree (client_key);


--
-- Name: offline_conflict_logs_entity_type_entity_id_index; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX offline_conflict_logs_entity_type_entity_id_index ON public.offline_conflict_logs USING btree (entity_type, entity_id);


--
-- Name: offline_conflict_logs_resolution_status_index; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX offline_conflict_logs_resolution_status_index ON public.offline_conflict_logs USING btree (resolution_status);


--
-- Name: payment_methods_is_active_index; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX payment_methods_is_active_index ON public.payment_methods USING btree (is_active);


--
-- Name: payment_transactions_normalized_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX payment_transactions_normalized_idx ON public.payment_transactions USING btree (siswa_id, tanggal, payment_status_id);


--
-- Name: payment_types_payment_period_type_id_status_index; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX payment_types_payment_period_type_id_status_index ON public.payment_types USING btree (payment_period_type_id, status);


--
-- Name: pembayaran_normalized_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX pembayaran_normalized_idx ON public.pembayaran USING btree (siswa_id, payment_type_id, payment_status_id);


--
-- Name: penilaian_logs_actor_id_actor_role_index; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX penilaian_logs_actor_id_actor_role_index ON public.penilaian_logs USING btree (actor_id, actor_role);


--
-- Name: penilaian_logs_siswa_id_score_type_index; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX penilaian_logs_siswa_id_score_type_index ON public.penilaian_logs USING btree (siswa_id, score_type);


--
-- Name: penilaian_logs_source_type_source_id_index; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX penilaian_logs_source_type_source_id_index ON public.penilaian_logs USING btree (source_type, source_id);


--
-- Name: semesters_is_active_index; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX semesters_is_active_index ON public.semesters USING btree (is_active);


--
-- Name: sessions_last_activity_index; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX sessions_last_activity_index ON public.sessions USING btree (last_activity);


--
-- Name: sessions_user_id_index; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX sessions_user_id_index ON public.sessions USING btree (user_id);


--
-- Name: siswa_class_id_student_status_id_index; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX siswa_class_id_student_status_id_index ON public.siswa USING btree (class_id, student_status_id);


--
-- Name: siswa_father_occupation_id_mother_occupation_id_index; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX siswa_father_occupation_id_mother_occupation_id_index ON public.siswa USING btree (father_occupation_id, mother_occupation_id);


--
-- Name: siswa_nisn_unique_not_blank; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX siswa_nisn_unique_not_blank ON public.siswa USING btree (nisn) WHERE ((nisn IS NOT NULL) AND ((nisn)::text <> ''::text));


--
-- Name: siswa_province_id_city_id_district_id_index; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX siswa_province_id_city_id_district_id_index ON public.siswa USING btree (province_id, city_id, district_id);


--
-- Name: users_role_status_index; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX users_role_status_index ON public.users USING btree (role, status);


--
-- Name: villages_name_index; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX villages_name_index ON public.villages USING btree (name);


--
-- Name: absensi absensi_actor_user_id_foreign; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.absensi
    ADD CONSTRAINT absensi_actor_user_id_foreign FOREIGN KEY (actor_user_id) REFERENCES public.users(id) ON DELETE SET NULL;


--
-- Name: absensi absensi_attendance_status_id_foreign; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.absensi
    ADD CONSTRAINT absensi_attendance_status_id_foreign FOREIGN KEY (attendance_status_id) REFERENCES public.attendance_statuses(id) ON DELETE SET NULL;


--
-- Name: absensi absensi_class_id_foreign; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.absensi
    ADD CONSTRAINT absensi_class_id_foreign FOREIGN KEY (class_id) REFERENCES public.classes(id) ON DELETE SET NULL;


--
-- Name: absensi absensi_jadwal_id_foreign; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.absensi
    ADD CONSTRAINT absensi_jadwal_id_foreign FOREIGN KEY (jadwal_id) REFERENCES public.jadwal(id) ON DELETE SET NULL;


--
-- Name: absensi absensi_mapel_id_foreign; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.absensi
    ADD CONSTRAINT absensi_mapel_id_foreign FOREIGN KEY (mapel_id) REFERENCES public.mata_pelajaran(id) ON DELETE SET NULL;


--
-- Name: absensi absensi_siswa_id_foreign; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.absensi
    ADD CONSTRAINT absensi_siswa_id_foreign FOREIGN KEY (siswa_id) REFERENCES public.siswa(id) ON DELETE CASCADE;


--
-- Name: admin_payment_security_settings admin_payment_security_settings_user_id_foreign; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.admin_payment_security_settings
    ADD CONSTRAINT admin_payment_security_settings_user_id_foreign FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- Name: api_access_tokens api_access_tokens_user_id_foreign; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.api_access_tokens
    ADD CONSTRAINT api_access_tokens_user_id_foreign FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- Name: cities cities_province_id_foreign; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.cities
    ADD CONSTRAINT cities_province_id_foreign FOREIGN KEY (province_id) REFERENCES public.provinces(id) ON DELETE SET NULL;


--
-- Name: classes classes_class_level_id_foreign; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.classes
    ADD CONSTRAINT classes_class_level_id_foreign FOREIGN KEY (class_level_id) REFERENCES public.class_levels(id) ON DELETE SET NULL;


--
-- Name: districts districts_city_id_foreign; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.districts
    ADD CONSTRAINT districts_city_id_foreign FOREIGN KEY (city_id) REFERENCES public.cities(id) ON DELETE SET NULL;


--
-- Name: guardian_profiles guardian_profiles_user_id_foreign; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.guardian_profiles
    ADD CONSTRAINT guardian_profiles_user_id_foreign FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE SET NULL;


--
-- Name: guardian_student guardian_student_guardian_profile_id_foreign; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.guardian_student
    ADD CONSTRAINT guardian_student_guardian_profile_id_foreign FOREIGN KEY (guardian_profile_id) REFERENCES public.guardian_profiles(id) ON DELETE CASCADE;


--
-- Name: guardian_student guardian_student_siswa_id_foreign; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.guardian_student
    ADD CONSTRAINT guardian_student_siswa_id_foreign FOREIGN KEY (siswa_id) REFERENCES public.siswa(id) ON DELETE CASCADE;


--
-- Name: guru_izin guru_izin_approval_status_id_foreign; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.guru_izin
    ADD CONSTRAINT guru_izin_approval_status_id_foreign FOREIGN KEY (approval_status_id) REFERENCES public.approval_statuses(id) ON DELETE SET NULL;


--
-- Name: guru_izin guru_izin_guru_id_foreign; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.guru_izin
    ADD CONSTRAINT guru_izin_guru_id_foreign FOREIGN KEY (guru_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- Name: guru_izin guru_izin_leave_type_id_foreign; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.guru_izin
    ADD CONSTRAINT guru_izin_leave_type_id_foreign FOREIGN KEY (leave_type_id) REFERENCES public.leave_types(id) ON DELETE SET NULL;


--
-- Name: hafalan hafalan_created_by_foreign; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.hafalan
    ADD CONSTRAINT hafalan_created_by_foreign FOREIGN KEY (created_by) REFERENCES public.users(id) ON DELETE SET NULL;


--
-- Name: hafalan hafalan_examiner_id_foreign; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.hafalan
    ADD CONSTRAINT hafalan_examiner_id_foreign FOREIGN KEY (examiner_id) REFERENCES public.users(id) ON DELETE SET NULL;


--
-- Name: hafalan hafalan_memorization_status_id_foreign; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.hafalan
    ADD CONSTRAINT hafalan_memorization_status_id_foreign FOREIGN KEY (memorization_status_id) REFERENCES public.memorization_statuses(id) ON DELETE SET NULL;


--
-- Name: hafalan hafalan_semester_id_foreign; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.hafalan
    ADD CONSTRAINT hafalan_semester_id_foreign FOREIGN KEY (semester_id) REFERENCES public.semesters(id) ON DELETE SET NULL;


--
-- Name: hafalan hafalan_siswa_id_foreign; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.hafalan
    ADD CONSTRAINT hafalan_siswa_id_foreign FOREIGN KEY (siswa_id) REFERENCES public.siswa(id) ON DELETE CASCADE;


--
-- Name: hafalan hafalan_surah_id_foreign; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.hafalan
    ADD CONSTRAINT hafalan_surah_id_foreign FOREIGN KEY (surah_id) REFERENCES public.surahs(id) ON DELETE SET NULL;


--
-- Name: hafalan hafalan_updated_by_foreign; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.hafalan
    ADD CONSTRAINT hafalan_updated_by_foreign FOREIGN KEY (updated_by) REFERENCES public.users(id) ON DELETE SET NULL;


--
-- Name: jadwal jadwal_class_id_foreign; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.jadwal
    ADD CONSTRAINT jadwal_class_id_foreign FOREIGN KEY (class_id) REFERENCES public.classes(id) ON DELETE SET NULL;


--
-- Name: jadwal jadwal_day_id_foreign; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.jadwal
    ADD CONSTRAINT jadwal_day_id_foreign FOREIGN KEY (day_id) REFERENCES public.days(id) ON DELETE SET NULL;


--
-- Name: jadwal jadwal_mapel_id_foreign; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.jadwal
    ADD CONSTRAINT jadwal_mapel_id_foreign FOREIGN KEY (mapel_id) REFERENCES public.mata_pelajaran(id) ON DELETE CASCADE;


--
-- Name: jadwal jadwal_teacher_id_foreign; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.jadwal
    ADD CONSTRAINT jadwal_teacher_id_foreign FOREIGN KEY (teacher_id) REFERENCES public.users(id) ON DELETE SET NULL;


--
-- Name: kegiatan kegiatan_class_id_foreign; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.kegiatan
    ADD CONSTRAINT kegiatan_class_id_foreign FOREIGN KEY (class_id) REFERENCES public.classes(id) ON DELETE SET NULL;


--
-- Name: kegiatan_foto kegiatan_foto_kegiatan_id_foreign; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.kegiatan_foto
    ADD CONSTRAINT kegiatan_foto_kegiatan_id_foreign FOREIGN KEY (kegiatan_id) REFERENCES public.kegiatan(id) ON DELETE CASCADE;


--
-- Name: kegiatan kegiatan_uploaded_by_foreign; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.kegiatan
    ADD CONSTRAINT kegiatan_uploaded_by_foreign FOREIGN KEY (uploaded_by) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- Name: kelompok_belajar kelompok_belajar_class_id_foreign; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.kelompok_belajar
    ADD CONSTRAINT kelompok_belajar_class_id_foreign FOREIGN KEY (class_id) REFERENCES public.classes(id) ON DELETE SET NULL;


--
-- Name: kelompok_belajar_siswa kelompok_belajar_siswa_kelompok_id_foreign; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.kelompok_belajar_siswa
    ADD CONSTRAINT kelompok_belajar_siswa_kelompok_id_foreign FOREIGN KEY (kelompok_id) REFERENCES public.kelompok_belajar(id) ON DELETE CASCADE;


--
-- Name: kelompok_belajar_siswa kelompok_belajar_siswa_siswa_id_foreign; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.kelompok_belajar_siswa
    ADD CONSTRAINT kelompok_belajar_siswa_siswa_id_foreign FOREIGN KEY (siswa_id) REFERENCES public.siswa(id) ON DELETE CASCADE;


--
-- Name: mapel_guru mapel_guru_mapel_id_foreign; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.mapel_guru
    ADD CONSTRAINT mapel_guru_mapel_id_foreign FOREIGN KEY (mapel_id) REFERENCES public.mata_pelajaran(id) ON DELETE CASCADE;


--
-- Name: mapel_guru mapel_guru_user_id_foreign; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.mapel_guru
    ADD CONSTRAINT mapel_guru_user_id_foreign FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- Name: materi materi_class_id_foreign; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.materi
    ADD CONSTRAINT materi_class_id_foreign FOREIGN KEY (class_id) REFERENCES public.classes(id) ON DELETE SET NULL;


--
-- Name: materi materi_guru_id_foreign; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.materi
    ADD CONSTRAINT materi_guru_id_foreign FOREIGN KEY (guru_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- Name: materi materi_mapel_id_foreign; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.materi
    ADD CONSTRAINT materi_mapel_id_foreign FOREIGN KEY (mapel_id) REFERENCES public.mata_pelajaran(id) ON DELETE SET NULL;


--
-- Name: nilai nilai_academic_year_id_foreign; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.nilai
    ADD CONSTRAINT nilai_academic_year_id_foreign FOREIGN KEY (academic_year_id) REFERENCES public.academic_years(id) ON DELETE SET NULL;


--
-- Name: nilai nilai_assessment_type_id_foreign; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.nilai
    ADD CONSTRAINT nilai_assessment_type_id_foreign FOREIGN KEY (assessment_type_id) REFERENCES public.assessment_types(id) ON DELETE SET NULL;


--
-- Name: nilai nilai_created_by_foreign; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.nilai
    ADD CONSTRAINT nilai_created_by_foreign FOREIGN KEY (created_by) REFERENCES public.users(id) ON DELETE SET NULL;


--
-- Name: nilai nilai_mapel_id_foreign; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.nilai
    ADD CONSTRAINT nilai_mapel_id_foreign FOREIGN KEY (mapel_id) REFERENCES public.mata_pelajaran(id) ON DELETE CASCADE;


--
-- Name: nilai nilai_semester_id_foreign; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.nilai
    ADD CONSTRAINT nilai_semester_id_foreign FOREIGN KEY (semester_id) REFERENCES public.semesters(id) ON DELETE SET NULL;


--
-- Name: nilai nilai_siswa_id_foreign; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.nilai
    ADD CONSTRAINT nilai_siswa_id_foreign FOREIGN KEY (siswa_id) REFERENCES public.siswa(id) ON DELETE CASCADE;


--
-- Name: nilai nilai_updated_by_foreign; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.nilai
    ADD CONSTRAINT nilai_updated_by_foreign FOREIGN KEY (updated_by) REFERENCES public.users(id) ON DELETE SET NULL;


--
-- Name: offline_conflict_logs offline_conflict_logs_resolved_by_foreign; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.offline_conflict_logs
    ADD CONSTRAINT offline_conflict_logs_resolved_by_foreign FOREIGN KEY (resolved_by) REFERENCES public.users(id) ON DELETE SET NULL;


--
-- Name: payment_transactions payment_transactions_created_by_user_id_foreign; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.payment_transactions
    ADD CONSTRAINT payment_transactions_created_by_user_id_foreign FOREIGN KEY (created_by_user_id) REFERENCES public.users(id) ON DELETE SET NULL;


--
-- Name: payment_transactions payment_transactions_payment_method_id_foreign; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.payment_transactions
    ADD CONSTRAINT payment_transactions_payment_method_id_foreign FOREIGN KEY (payment_method_id) REFERENCES public.payment_methods(id) ON DELETE SET NULL;


--
-- Name: payment_transactions payment_transactions_payment_status_id_foreign; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.payment_transactions
    ADD CONSTRAINT payment_transactions_payment_status_id_foreign FOREIGN KEY (payment_status_id) REFERENCES public.payment_statuses(id) ON DELETE SET NULL;


--
-- Name: payment_transactions payment_transactions_siswa_id_foreign; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.payment_transactions
    ADD CONSTRAINT payment_transactions_siswa_id_foreign FOREIGN KEY (siswa_id) REFERENCES public.siswa(id) ON DELETE CASCADE;


--
-- Name: payment_transactions payment_transactions_updated_by_user_id_foreign; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.payment_transactions
    ADD CONSTRAINT payment_transactions_updated_by_user_id_foreign FOREIGN KEY (updated_by_user_id) REFERENCES public.users(id) ON DELETE SET NULL;


--
-- Name: payment_transactions payment_transactions_wali_id_foreign; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.payment_transactions
    ADD CONSTRAINT payment_transactions_wali_id_foreign FOREIGN KEY (wali_id) REFERENCES public.users(id) ON DELETE SET NULL;


--
-- Name: payment_type_method payment_type_method_payment_method_id_foreign; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.payment_type_method
    ADD CONSTRAINT payment_type_method_payment_method_id_foreign FOREIGN KEY (payment_method_id) REFERENCES public.payment_methods(id) ON DELETE CASCADE;


--
-- Name: payment_type_method payment_type_method_payment_type_id_foreign; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.payment_type_method
    ADD CONSTRAINT payment_type_method_payment_type_id_foreign FOREIGN KEY (payment_type_id) REFERENCES public.payment_types(id) ON DELETE CASCADE;


--
-- Name: payment_types payment_types_payment_period_type_id_foreign; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.payment_types
    ADD CONSTRAINT payment_types_payment_period_type_id_foreign FOREIGN KEY (payment_period_type_id) REFERENCES public.payment_period_types(id) ON DELETE SET NULL;


--
-- Name: pembayaran pembayaran_payment_method_id_foreign; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.pembayaran
    ADD CONSTRAINT pembayaran_payment_method_id_foreign FOREIGN KEY (payment_method_id) REFERENCES public.payment_methods(id) ON DELETE SET NULL;


--
-- Name: pembayaran pembayaran_payment_status_id_foreign; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.pembayaran
    ADD CONSTRAINT pembayaran_payment_status_id_foreign FOREIGN KEY (payment_status_id) REFERENCES public.payment_statuses(id) ON DELETE SET NULL;


--
-- Name: pembayaran pembayaran_payment_transaction_id_foreign; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.pembayaran
    ADD CONSTRAINT pembayaran_payment_transaction_id_foreign FOREIGN KEY (payment_transaction_id) REFERENCES public.payment_transactions(id) ON DELETE CASCADE;


--
-- Name: pembayaran pembayaran_payment_type_id_foreign; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.pembayaran
    ADD CONSTRAINT pembayaran_payment_type_id_foreign FOREIGN KEY (payment_type_id) REFERENCES public.payment_types(id) ON DELETE SET NULL;


--
-- Name: pembayaran pembayaran_siswa_id_foreign; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.pembayaran
    ADD CONSTRAINT pembayaran_siswa_id_foreign FOREIGN KEY (siswa_id) REFERENCES public.siswa(id) ON DELETE CASCADE;


--
-- Name: pembayaran pembayaran_wali_id_foreign; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.pembayaran
    ADD CONSTRAINT pembayaran_wali_id_foreign FOREIGN KEY (wali_id) REFERENCES public.users(id) ON DELETE SET NULL;


--
-- Name: semesters semesters_academic_year_id_foreign; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.semesters
    ADD CONSTRAINT semesters_academic_year_id_foreign FOREIGN KEY (academic_year_id) REFERENCES public.academic_years(id) ON DELETE SET NULL;


--
-- Name: siswa siswa_academic_year_id_foreign; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.siswa
    ADD CONSTRAINT siswa_academic_year_id_foreign FOREIGN KEY (academic_year_id) REFERENCES public.academic_years(id) ON DELETE SET NULL;


--
-- Name: siswa siswa_blood_type_id_foreign; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.siswa
    ADD CONSTRAINT siswa_blood_type_id_foreign FOREIGN KEY (blood_type_id) REFERENCES public.blood_types(id) ON DELETE SET NULL;


--
-- Name: siswa siswa_city_id_foreign; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.siswa
    ADD CONSTRAINT siswa_city_id_foreign FOREIGN KEY (city_id) REFERENCES public.cities(id) ON DELETE SET NULL;


--
-- Name: siswa siswa_class_id_foreign; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.siswa
    ADD CONSTRAINT siswa_class_id_foreign FOREIGN KEY (class_id) REFERENCES public.classes(id) ON DELETE SET NULL;


--
-- Name: siswa siswa_district_id_foreign; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.siswa
    ADD CONSTRAINT siswa_district_id_foreign FOREIGN KEY (district_id) REFERENCES public.districts(id) ON DELETE SET NULL;


--
-- Name: siswa siswa_father_education_id_foreign; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.siswa
    ADD CONSTRAINT siswa_father_education_id_foreign FOREIGN KEY (father_education_id) REFERENCES public.education_levels(id) ON DELETE SET NULL;


--
-- Name: siswa siswa_father_income_id_foreign; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.siswa
    ADD CONSTRAINT siswa_father_income_id_foreign FOREIGN KEY (father_income_id) REFERENCES public.income_ranges(id) ON DELETE SET NULL;


--
-- Name: siswa siswa_father_occupation_id_foreign; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.siswa
    ADD CONSTRAINT siswa_father_occupation_id_foreign FOREIGN KEY (father_occupation_id) REFERENCES public.occupations(id) ON DELETE SET NULL;


--
-- Name: siswa siswa_guardian_occupation_id_foreign; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.siswa
    ADD CONSTRAINT siswa_guardian_occupation_id_foreign FOREIGN KEY (guardian_occupation_id) REFERENCES public.occupations(id) ON DELETE SET NULL;


--
-- Name: siswa siswa_guardian_profile_id_foreign; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.siswa
    ADD CONSTRAINT siswa_guardian_profile_id_foreign FOREIGN KEY (guardian_profile_id) REFERENCES public.guardian_profiles(id) ON DELETE SET NULL;


--
-- Name: siswa siswa_guardian_relationship_id_foreign; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.siswa
    ADD CONSTRAINT siswa_guardian_relationship_id_foreign FOREIGN KEY (guardian_relationship_id) REFERENCES public.guardian_relationships(id) ON DELETE SET NULL;


--
-- Name: siswa siswa_mother_education_id_foreign; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.siswa
    ADD CONSTRAINT siswa_mother_education_id_foreign FOREIGN KEY (mother_education_id) REFERENCES public.education_levels(id) ON DELETE SET NULL;


--
-- Name: siswa siswa_mother_income_id_foreign; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.siswa
    ADD CONSTRAINT siswa_mother_income_id_foreign FOREIGN KEY (mother_income_id) REFERENCES public.income_ranges(id) ON DELETE SET NULL;


--
-- Name: siswa siswa_mother_occupation_id_foreign; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.siswa
    ADD CONSTRAINT siswa_mother_occupation_id_foreign FOREIGN KEY (mother_occupation_id) REFERENCES public.occupations(id) ON DELETE SET NULL;


--
-- Name: siswa siswa_province_id_foreign; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.siswa
    ADD CONSTRAINT siswa_province_id_foreign FOREIGN KEY (province_id) REFERENCES public.provinces(id) ON DELETE SET NULL;


--
-- Name: siswa siswa_residence_type_id_foreign; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.siswa
    ADD CONSTRAINT siswa_residence_type_id_foreign FOREIGN KEY (residence_type_id) REFERENCES public.residence_types(id) ON DELETE SET NULL;


--
-- Name: siswa siswa_student_status_id_foreign; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.siswa
    ADD CONSTRAINT siswa_student_status_id_foreign FOREIGN KEY (student_status_id) REFERENCES public.student_statuses(id) ON DELETE SET NULL;


--
-- Name: siswa siswa_student_type_id_foreign; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.siswa
    ADD CONSTRAINT siswa_student_type_id_foreign FOREIGN KEY (student_type_id) REFERENCES public.student_types(id) ON DELETE SET NULL;


--
-- Name: siswa siswa_transport_mode_id_foreign; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.siswa
    ADD CONSTRAINT siswa_transport_mode_id_foreign FOREIGN KEY (transport_mode_id) REFERENCES public.transport_modes(id) ON DELETE SET NULL;


--
-- Name: siswa siswa_village_id_foreign; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.siswa
    ADD CONSTRAINT siswa_village_id_foreign FOREIGN KEY (village_id) REFERENCES public.villages(id) ON DELETE SET NULL;


--
-- Name: siswa siswa_wali_id_foreign; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.siswa
    ADD CONSTRAINT siswa_wali_id_foreign FOREIGN KEY (wali_id) REFERENCES public.users(id) ON DELETE SET NULL;


--
-- Name: teacher_profile_category teacher_profile_category_teacher_category_id_foreign; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.teacher_profile_category
    ADD CONSTRAINT teacher_profile_category_teacher_category_id_foreign FOREIGN KEY (teacher_category_id) REFERENCES public.teacher_categories(id) ON DELETE CASCADE;


--
-- Name: teacher_profile_category teacher_profile_category_teacher_profile_id_foreign; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.teacher_profile_category
    ADD CONSTRAINT teacher_profile_category_teacher_profile_id_foreign FOREIGN KEY (teacher_profile_id) REFERENCES public.teacher_profiles(id) ON DELETE CASCADE;


--
-- Name: teacher_profile_unit teacher_profile_unit_teacher_profile_id_foreign; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.teacher_profile_unit
    ADD CONSTRAINT teacher_profile_unit_teacher_profile_id_foreign FOREIGN KEY (teacher_profile_id) REFERENCES public.teacher_profiles(id) ON DELETE CASCADE;


--
-- Name: teacher_profile_unit teacher_profile_unit_teacher_unit_id_foreign; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.teacher_profile_unit
    ADD CONSTRAINT teacher_profile_unit_teacher_unit_id_foreign FOREIGN KEY (teacher_unit_id) REFERENCES public.teacher_units(id) ON DELETE CASCADE;


--
-- Name: teacher_profiles teacher_profiles_user_id_foreign; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.teacher_profiles
    ADD CONSTRAINT teacher_profiles_user_id_foreign FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- Name: users users_role_id_foreign; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_role_id_foreign FOREIGN KEY (role_id) REFERENCES public.roles(id) ON DELETE SET NULL;


--
-- Name: users users_user_status_id_foreign; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_user_status_id_foreign FOREIGN KEY (user_status_id) REFERENCES public.user_statuses(id) ON DELETE SET NULL;


--
-- Name: villages villages_district_id_foreign; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.villages
    ADD CONSTRAINT villages_district_id_foreign FOREIGN KEY (district_id) REFERENCES public.districts(id) ON DELETE SET NULL;


--
-- PostgreSQL database dump complete
--

\unrestrict CumrIv8ex8Wi8xqm7DxvbbPAzz7C4acEfC7TUCXO2S8W2PRELK7WpuKSeMCyxGu

--
-- PostgreSQL database dump
--

\restrict d6T782akULMHQQo7K9BvfCAzlcrBokpdRS3iqZe6Tx1RsCft5VnneS5lMshdUfa

-- Dumped from database version 18.3
-- Dumped by pg_dump version 18.3

SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET transaction_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;

--
-- Data for Name: migrations; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.migrations (id, migration, batch) FROM stdin;
1	0001_01_01_000000_create_users_table	1
2	0001_01_01_000001_create_cache_table	1
3	0001_01_01_000002_create_jobs_table	1
4	2025_02_18_000001_create_siswa_table	1
5	2025_02_18_000002_create_mata_pelajaran_table	1
6	2025_02_18_000003_create_jadwal_table	1
7	2025_02_18_000004_create_absensi_table	1
8	2025_02_18_000005_create_pembayaran_table	1
9	2025_02_18_000006_create_kelompok_belajar_table	1
10	2025_02_18_000007_create_nilai_table	1
11	2025_02_23_000001_add_extra_columns_to_siswa_table	1
12	2026_02_26_214729_add_mapel_to_absensi_table	1
13	2026_03_01_000001_add_wali_id_to_siswa_table	1
14	2026_03_11_000001_add_phase22_columns_to_siswa_table	1
15	2026_03_11_000002_add_profile_columns_to_users_table	1
16	2026_03_11_000003_create_materi_table	1
17	2026_03_11_000004_create_kegiatan_table	1
18	2026_03_18_000001_create_mapel_guru_table	1
19	2026_03_18_000002_add_fields_to_nilai_table	1
20	2026_03_18_000003_create_hafalan_table	1
21	2026_04_02_130001_add_status_to_users_table	1
22	2026_04_08_000001_add_guru_fields_to_users_table	1
23	2026_04_08_000002_create_payment_types_table	1
24	2026_04_08_000003_add_payment_links_to_pembayaran_table	1
25	2026_04_09_000001_add_mapel_id_to_materi_table	1
26	2026_04_09_000002_add_kelas_to_kegiatan_table	1
27	2026_04_10_000001_add_audit_fields_to_nilai_table	1
28	2026_04_10_000002_add_audit_fields_to_hafalan_table	1
29	2026_04_10_000003_create_penilaian_logs_table	1
30	2026_04_10_000004_create_document_settings_table	1
31	2026_04_14_000001_add_payment_fields_to_document_settings_table	1
32	2026_04_18_000001_add_operational_password_tracking_to_users_table	1
33	2026_04_19_000001_add_ahad_to_jadwal_hari_constraint	1
34	2026_04_19_000002_create_guru_izin_table	1
35	2026_04_20_000001_add_lulus_to_siswa_status_constraint	1
36	2026_04_23_000001_create_payment_transactions_table	1
37	2026_04_23_000002_add_payment_transaction_columns_to_pembayaran_table	1
38	2026_04_23_000003_create_admin_payment_security_settings_table	1
39	2026_04_23_000004_allow_fingerprint_only_payment_security_mode	1
40	2026_04_23_000005_add_transaction_pin_to_admin_payment_security_settings	1
41	2026_04_25_000001_create_api_access_tokens_table	1
42	2026_04_25_000002_add_document_logo_to_document_settings_table	1
43	2026_04_26_000001_create_normalized_master_schema	1
44	2026_04_26_000002_create_student_reference_and_region_schema	1
\.


--
-- Name: migrations_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public.migrations_id_seq', 44, true);


--
-- PostgreSQL database dump complete
--

\unrestrict d6T782akULMHQQo7K9BvfCAzlcrBokpdRS3iqZe6Tx1RsCft5VnneS5lMshdUfa

