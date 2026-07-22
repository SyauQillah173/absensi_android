package com.qomaruddin.absensi_skripsi

import android.content.Context
import android.net.ConnectivityManager
import android.net.NetworkCapabilities
import android.os.Handler
import android.os.Looper
import androidx.room.Dao
import androidx.room.Database
import androidx.room.Entity
import androidx.room.Insert
import androidx.room.OnConflictStrategy
import androidx.room.PrimaryKey
import androidx.room.Query
import androidx.room.Room
import androidx.room.RoomDatabase
import androidx.room.migration.Migration
import androidx.work.BackoffPolicy
import androidx.work.Constraints
import androidx.work.ExistingWorkPolicy
import androidx.work.ExistingPeriodicWorkPolicy
import androidx.work.NetworkType
import androidx.work.OneTimeWorkRequestBuilder
import androidx.work.PeriodicWorkRequestBuilder
import androidx.work.WorkManager
import androidx.work.Worker
import androidx.work.WorkerParameters
import io.flutter.embedding.engine.FlutterEngine
import io.flutter.plugin.common.MethodChannel
import net.zetetic.database.sqlcipher.SupportOpenHelperFactory
import org.json.JSONArray
import org.json.JSONObject
import androidx.sqlite.db.SupportSQLiteDatabase
import java.net.HttpURLConnection
import java.net.URL
import java.nio.charset.StandardCharsets
import java.util.concurrent.Executors
import java.util.concurrent.TimeUnit

@Entity(tableName = "guru")
data class GuruEntity(
    @PrimaryKey val id_guru: Long,
    val id_user: Long?,
    val nama_guru: String,
    val username: String?,
    val nip_nidm: String?,
    val nomor_hp: String?,
    val alamat: String?,
    val status_aktif: Boolean,
)

@Entity(tableName = "kelas")
data class KelasEntity(
    @PrimaryKey val id_kelas: Long,
    val id_guru: Long,
    val nama_kelas: String,
    val tingkat: Int,
    val status_aktif: Boolean,
)

@Entity(tableName = "santri")
data class SantriEntity(
    @PrimaryKey val id_santri: Long,
    val id_kelas: Long,
    val nisn: String,
    val nama_santri: String,
    val jenis_kelamin: String?,
    val tgl_lahir: String?,
    val alamat: String?,
    val nama_wali: String?,
    val nomor_wa_wali: String?,
    val status_aktif: Boolean,
)

@Entity(tableName = "mata_pelajaran")
data class MataPelajaranEntity(
    @PrimaryKey val id: Long,
    val nama: String,
    val kode: String?,
    val status: String,
)

@Entity(tableName = "presensi")
data class PresensiEntity(
    @PrimaryKey val local_id: String,
    val id_presensi: Long?,
    val operation_id: String,
    val id_guru: Long?,
    val id_kelas: Long,
    val mapel_id: Long?,
    val mapel: String?,
    val tanggal: String,
    val waktu_mulai: String,
    val waktu_selesai: String?,
    val catatan: String?,
    val sync_status: String,
    val sync_message: String?,
    val updated_at: String,
)

@Entity(
    tableName = "detail_presensi",
    primaryKeys = ["presensi_local_id", "id_santri"],
)
data class DetailPresensiEntity(
    val presensi_local_id: String,
    val id_santri: Long,
    val status_presensi: String,
    val keterangan: String?,
)

@Entity(tableName = "sync_outbox")
data class OutboxEntity(
    @PrimaryKey val operation_id: String,
    val entity_type: String,
    val method: String,
    val endpoint: String,
    val payload: String,
    val status: String,
    val retry_count: Int,
    val last_error: String?,
    val created_at: String,
)

@Entity(tableName = "app_logs")
data class AppLogEntity(
    @PrimaryKey(autoGenerate = true) val id: Long = 0,
    val category: String,
    val title: String,
    val message: String?,
    val status: String,
    val created_at: String,
)

data class HistoryRow(
    val local_id: String,
    val id_presensi: Long?,
    val id_kelas: Long,
    val nama_kelas: String,
    val id_guru: Long?,
    val nama_guru: String?,
    val mapel_id: Long?,
    val mapel: String?,
    val tanggal: String,
    val waktu_mulai: String,
    val catatan: String?,
    val sync_status: String,
    val hadir: Int,
    val sakit: Int,
    val izin: Int,
    val alpa: Int,
)

data class DetailRow(
    val id_santri: Long,
    val nisn: String,
    val nama_santri: String,
    val status_presensi: String,
    val keterangan: String?,
)

@Dao
interface ThesisDao {
    @Query("DELETE FROM guru")
    fun clearGuru()

    @Query("DELETE FROM kelas")
    fun clearKelas()

    @Query("DELETE FROM santri")
    fun clearSantri()

    @Query("DELETE FROM mata_pelajaran")
    fun clearMapel()

    @Insert(onConflict = OnConflictStrategy.REPLACE)
    fun insertGuru(rows: List<GuruEntity>)

    @Insert(onConflict = OnConflictStrategy.REPLACE)
    fun insertKelas(rows: List<KelasEntity>)

    @Insert(onConflict = OnConflictStrategy.REPLACE)
    fun insertSantri(rows: List<SantriEntity>)

    @Insert(onConflict = OnConflictStrategy.REPLACE)
    fun insertMapel(rows: List<MataPelajaranEntity>)

    @Insert(onConflict = OnConflictStrategy.REPLACE)
    fun insertPresensi(row: PresensiEntity)

    @Insert(onConflict = OnConflictStrategy.REPLACE)
    fun insertDetails(rows: List<DetailPresensiEntity>)

    @Insert(onConflict = OnConflictStrategy.REPLACE)
    fun insertOutbox(row: OutboxEntity)

    @Insert
    fun insertLog(row: AppLogEntity)

    @Query("SELECT * FROM guru WHERE status_aktif = 1 ORDER BY nama_guru")
    fun gurus(): List<GuruEntity>

    @Query("SELECT * FROM kelas WHERE status_aktif = 1 ORDER BY tingkat, nama_kelas")
    fun classes(): List<KelasEntity>

    @Query("SELECT * FROM santri WHERE id_kelas = :classId AND status_aktif = 1 ORDER BY nama_santri")
    fun students(classId: Long): List<SantriEntity>

    @Query("SELECT * FROM santri WHERE status_aktif = 1 ORDER BY nama_santri")
    fun allStudents(): List<SantriEntity>

    @Query("SELECT * FROM mata_pelajaran WHERE status = 'Aktif' ORDER BY nama")
    fun mapels(): List<MataPelajaranEntity>

    @Query("SELECT MIN(id_guru) FROM guru")
    fun minGuruId(): Long?

    @Query("SELECT MIN(id_kelas) FROM kelas")
    fun minKelasId(): Long?

    @Query("SELECT MIN(id_santri) FROM santri")
    fun minSantriId(): Long?

    @Query("SELECT MIN(id) FROM mata_pelajaran")
    fun minMapelId(): Long?

    @Query("SELECT * FROM mata_pelajaran WHERE id = :id LIMIT 1")
    fun mapel(id: Long): MataPelajaranEntity?

    @Query("UPDATE guru SET status_aktif = 0 WHERE id_guru = :id")
    fun deactivateGuru(id: Long)

    @Query("UPDATE kelas SET status_aktif = 0 WHERE id_kelas = :id")
    fun deactivateKelas(id: Long)

    @Query("UPDATE santri SET status_aktif = 0 WHERE id_santri = :id")
    fun deactivateSantri(id: Long)

    @Query("UPDATE mata_pelajaran SET status = 'Nonaktif' WHERE id = :id")
    fun deactivateMapel(id: Long)

    @Query("DELETE FROM guru WHERE id_guru = :id")
    fun deleteGuruLocal(id: Long)

    @Query("DELETE FROM kelas WHERE id_kelas = :id")
    fun deleteKelasLocal(id: Long)

    @Query("DELETE FROM santri WHERE id_santri = :id")
    fun deleteSantriLocal(id: Long)

    @Query("DELETE FROM mata_pelajaran WHERE id = :id")
    fun deleteMapelLocal(id: Long)

    @Query("UPDATE guru SET id_guru = :serverId WHERE id_guru = :localId")
    fun replaceGuruLocalId(localId: Long, serverId: Long)

    @Query("UPDATE kelas SET id_kelas = :serverId WHERE id_kelas = :localId")
    fun replaceKelasLocalId(localId: Long, serverId: Long)

    @Query("UPDATE santri SET id_santri = :serverId WHERE id_santri = :localId")
    fun replaceSantriLocalId(localId: Long, serverId: Long)

    @Query("UPDATE mata_pelajaran SET id = :serverId WHERE id = :localId")
    fun replaceMapelLocalId(localId: Long, serverId: Long)

    @Query("SELECT * FROM sync_outbox WHERE status IN ('pending','failed','syncing') ORDER BY created_at")
    fun pending(): List<OutboxEntity>

    @Query("SELECT * FROM sync_outbox WHERE operation_id = :id AND status IN ('pending','failed','syncing') LIMIT 1")
    fun pendingByOperation(id: String): OutboxEntity?

    @Query("SELECT * FROM app_logs ORDER BY id DESC LIMIT :limit")
    fun appLogs(limit: Int): List<AppLogEntity>

    @Query("DELETE FROM app_logs")
    fun clearLogs()

    @Query("SELECT COUNT(*) FROM sync_outbox WHERE status != 'completed'")
    fun pendingCount(): Int

    @Query("SELECT COUNT(*) FROM sync_outbox WHERE status = 'failed'")
    fun failedCount(): Int

    @Query("SELECT COUNT(*) FROM sync_outbox WHERE status = 'syncing'")
    fun syncingCount(): Int

    @Query("SELECT last_error FROM sync_outbox WHERE status = 'failed' AND last_error IS NOT NULL ORDER BY created_at DESC LIMIT 1")
    fun latestSyncError(): String?

    @Query("UPDATE sync_outbox SET status=:status, last_error=:error, retry_count=retry_count+:retry WHERE operation_id=:id")
    fun updateOutbox(id: String, status: String, error: String?, retry: Int): Int

    @Query("UPDATE presensi SET sync_status=:status, sync_message=:message, id_presensi=COALESCE(:serverId, id_presensi) WHERE operation_id=:id")
    fun updatePresensi(id: String, status: String, message: String?, serverId: Long?)

    @Query("UPDATE presensi SET sync_status=:status, sync_message=:message WHERE operation_id=:id AND sync_status != 'completed'")
    fun updatePresensiIfNotCompleted(id: String, status: String, message: String?)

    @Query("DELETE FROM sync_outbox WHERE operation_id=:id")
    fun deleteOutbox(id: String)

    @Query("DELETE FROM sync_outbox WHERE entity_type = :entity AND method = 'POST' AND payload LIKE '%' || :needle || '%'")
    fun deleteLocalCreateOutbox(entity: String, needle: String)

    @Query("DELETE FROM detail_presensi WHERE presensi_local_id=:localId")
    fun deleteDetails(localId: String)

    @Query("DELETE FROM presensi WHERE local_id=:localId")
    fun deletePresensi(localId: String)

    @Query("SELECT * FROM presensi WHERE local_id=:localId LIMIT 1")
    fun presensi(localId: String): PresensiEntity?

    @Query(
        """SELECT * FROM presensi
        WHERE id_kelas=:classId AND tanggal=:date AND waktu_mulai=:startTime
        AND ((:mapelId IS NULL AND mapel_id IS NULL) OR mapel_id=:mapelId)
        ORDER BY updated_at DESC LIMIT 1""",
    )
    fun presensiByScope(classId: Long, mapelId: Long?, date: String, startTime: String): PresensiEntity?

    @Query(
        """SELECT * FROM presensi
        WHERE id_kelas=:classId AND tanggal=:date
        ORDER BY updated_at DESC LIMIT 1""",
    )
    fun presensiByClassDate(classId: Long, date: String): PresensiEntity?

    @Query(
        """SELECT d.id_santri, s.nisn, s.nama_santri, d.status_presensi, d.keterangan
        FROM detail_presensi d JOIN santri s ON s.id_santri=d.id_santri
        WHERE d.presensi_local_id=:localId ORDER BY s.nama_santri""",
    )
    fun attendanceDetails(localId: String): List<DetailRow>

    @Query(
        """SELECT p.local_id, p.id_presensi, p.id_kelas, k.nama_kelas, p.id_guru, g.nama_guru, p.mapel_id, p.mapel, p.tanggal, p.waktu_mulai, p.catatan, p.sync_status,
        SUM(CASE WHEN d.status_presensi='Hadir' THEN 1 ELSE 0 END) hadir,
        SUM(CASE WHEN d.status_presensi='Sakit' THEN 1 ELSE 0 END) sakit,
        SUM(CASE WHEN d.status_presensi='Izin' THEN 1 ELSE 0 END) izin,
        SUM(CASE WHEN d.status_presensi='Alpa' THEN 1 ELSE 0 END) alpa
        FROM presensi p JOIN kelas k ON k.id_kelas=p.id_kelas
        LEFT JOIN guru g ON g.id_guru=p.id_guru
        JOIN detail_presensi d ON d.presensi_local_id=p.local_id
        GROUP BY p.local_id ORDER BY p.tanggal DESC, p.waktu_mulai DESC""",
    )
    fun history(): List<HistoryRow>
}

@Database(
    entities = [
        GuruEntity::class,
        KelasEntity::class,
        SantriEntity::class,
        MataPelajaranEntity::class,
        PresensiEntity::class,
        DetailPresensiEntity::class,
        OutboxEntity::class,
        AppLogEntity::class,
    ],
    version = 3,
    exportSchema = true,
)
abstract class ThesisRoomDatabase : RoomDatabase() {
    abstract fun dao(): ThesisDao

    companion object {
        @Volatile private var instance: ThesisRoomDatabase? = null

        fun get(context: Context): ThesisRoomDatabase =
            instance ?: synchronized(this) {
                System.loadLibrary("sqlcipher")
                val factory = SupportOpenHelperFactory(
                    "presensi-skripsi-room-sqlcipher".toByteArray(StandardCharsets.UTF_8),
                )
                instance ?: Room.databaseBuilder(
                    context.applicationContext,
                    ThesisRoomDatabase::class.java,
                    context.getDatabasePath("presensi_skripsi_room_encrypted.db").absolutePath,
                ).openHelperFactory(factory)
                    .addMigrations(MIGRATION_1_2, MIGRATION_2_3)
                    .build().also { instance = it }
            }

        private val MIGRATION_1_2 = object : Migration(1, 2) {
            override fun migrate(database: SupportSQLiteDatabase) {
                database.execSQL(
                    "CREATE TABLE IF NOT EXISTS mata_pelajaran (id INTEGER NOT NULL, nama TEXT NOT NULL, kode TEXT, status TEXT NOT NULL, PRIMARY KEY(id))",
                )
                database.execSQL("ALTER TABLE presensi ADD COLUMN mapel_id INTEGER")
                database.execSQL("ALTER TABLE presensi ADD COLUMN mapel TEXT")
            }
        }

        private val MIGRATION_2_3 = object : Migration(2, 3) {
            override fun migrate(database: SupportSQLiteDatabase) {
                database.execSQL(
                    "CREATE TABLE IF NOT EXISTS app_logs (id INTEGER PRIMARY KEY AUTOINCREMENT NOT NULL, category TEXT NOT NULL, title TEXT NOT NULL, message TEXT, status TEXT NOT NULL, created_at TEXT NOT NULL)",
                )
            }
        }
    }
}

class ThesisRoomBridge(
    private val context: Context,
    engine: FlutterEngine,
) {
    private val db = ThesisRoomDatabase.get(context)
    private val executor = Executors.newSingleThreadExecutor()
    private val main = Handler(Looper.getMainLooper())

    init {
        MethodChannel(engine.dartExecutor.binaryMessenger, "absensi_skripsi/room")
            .setMethodCallHandler { call, result ->
                executor.execute {
                    try {
                        val value = when (call.method) {
                            "initialize" -> {
                                schedulePeriodic()
                                true
                            }
                            "replaceBootstrap" -> replaceBootstrap(call.arguments as Map<*, *>)
                            "classes" -> db.dao().classes().map(::kelasMap)
                            "mapels" -> db.dao().mapels().map(::mapelMap)
                            "gurus" -> db.dao().gurus().map(::guruMap)
                            "students" -> db.dao().students((call.argument<Number>("classId")!!).toLong()).map(::santriMap)
                            "allStudents" -> allStudents()
                            "attendance" -> attendance(text(call.arguments as Map<*, *>, "localId"))
                            "attendanceByScope" -> attendanceByScope(call.arguments as Map<*, *>)
                            "saveAttendance" -> saveAttendance(call.arguments as Map<*, *>)
                            "updateAttendance" -> updateAttendance(call.arguments as Map<*, *>)
                            "deleteAttendance" -> deleteAttendance(call.arguments as Map<*, *>)
                            "saveMaster" -> saveMaster(call.arguments as Map<*, *>)
                            "deleteMaster" -> deleteMaster(call.arguments as Map<*, *>)
                            "addLog" -> addLog(call.arguments as Map<*, *>)
                            "appLogs" -> db.dao().appLogs(call.argument<Number>("limit")?.toInt() ?: 200).map(::appLogMap)
                            "clearLogs" -> {
                                db.dao().clearLogs()
                                addSystemLog("Log Pengujian", "Log pengujian dibersihkan oleh admin.", "log", "success")
                                true
                            }
                            "pendingCount" -> db.dao().pendingCount()
                            "syncStatus" -> syncStatus()
                            "history" -> db.dao().history().map(::historyMap)
                            "requestSync" -> {
                                scheduleOneOff()
                                true
                            }
                            "syncNow" -> {
                                scheduleOneOff()
                                val args = call.arguments as? Map<*, *>
                                val operationId = args?.get("operationId")?.toString()?.takeIf { it.isNotBlank() }
                                ThesisSyncRunner.sync(context, operationId)
                            }
                            "hasInternet" -> ThesisSyncRunner.hasInternet(context)
                            else -> null
                        }
                        main.post { result.success(value) }
                    } catch (error: Throwable) {
                        main.post { result.error("ROOM_ERROR", error.message, null) }
                    }
                }
            }
    }

    private fun replaceBootstrap(args: Map<*, *>): Boolean {
        val data = args["data"] as Map<*, *>
        val gurus = (data["guru"] as? List<*>)?.map {
            val row = it as Map<*, *>
            val user = row["user"] as? Map<*, *>
            GuruEntity(
                long(row, "id_guru"), nullableLong(row, "id_user"),
                text(row, "nama_guru"), user?.get("username")?.toString(),
                nullableText(row, "nip_nidm"), nullableText(row, "nomor_hp"),
                nullableText(row, "alamat"), bool(row, "status_aktif"),
            )
        } ?: emptyList()
        val classes = (data["kelas"] as? List<*>)?.map {
            val row = it as Map<*, *>
            KelasEntity(long(row, "id_kelas"), long(row, "id_guru"), text(row, "nama_kelas"), int(row, "tingkat"), bool(row, "status_aktif"))
        } ?: emptyList()
        val students = (data["santri"] as? List<*>)?.map {
            val row = it as Map<*, *>
            SantriEntity(
                long(row, "id_santri"), long(row, "id_kelas"), text(row, "nisn"),
                text(row, "nama_santri"), nullableText(row, "jenis_kelamin"),
                nullableText(row, "tgl_lahir"), nullableText(row, "alamat"),
                nullableText(row, "nama_wali"), nullableText(row, "nomor_wa_wali"),
                bool(row, "status_aktif"),
            )
        } ?: emptyList()
        val mapels = (data["mapel"] as? List<*>)?.map {
            val row = it as Map<*, *>
            MataPelajaranEntity(
                long(row, "id"),
                text(row, "nama"),
                nullableText(row, "kode"),
                nullableText(row, "status") ?: "Aktif",
            )
        } ?: emptyList()
        db.runInTransaction {
            db.dao().clearSantri()
            db.dao().clearKelas()
            db.dao().clearGuru()
            db.dao().clearMapel()
            db.dao().insertGuru(gurus)
            db.dao().insertKelas(classes)
            db.dao().insertSantri(students)
            db.dao().insertMapel(mapels)
        }
        addSystemLog(
            "Data master diperbarui",
            "Bootstrap server diterima: ${gurus.size} guru, ${classes.size} kelas, ${mapels.size} mapel, ${students.size} santri.",
            "sync",
            "success",
        )
        return true
    }

    private fun saveAttendance(args: Map<*, *>): String {
        val operationId = text(args, "operationId")
        val requestedMapelId = nullableLong(args, "mapelId")
        val existing = db.dao().presensiByScope(
            long(args, "classId"),
            requestedMapelId,
            text(args, "date"),
            text(args, "startTime"),
        ) ?: if (requestedMapelId == null) {
            db.dao().presensiByClassDate(long(args, "classId"), text(args, "date"))
        } else {
            null
        }
        if (existing != null) {
            val updateArgs = args.toMutableMap()
            updateArgs["localId"] = existing.local_id
            return updateAttendance(updateArgs)
        }
        val details = args["details"] as List<*>
        val payloadDetails = JSONArray()
        val entities = details.map {
            val row = it as Map<*, *>
            payloadDetails.put(JSONObject().apply {
                put("id_santri", long(row, "id_santri"))
                put("status_presensi", text(row, "status_presensi"))
                put("keterangan", row["keterangan"])
            })
            DetailPresensiEntity(operationId, long(row, "id_santri"), text(row, "status_presensi"), nullableText(row, "keterangan"))
        }
        val payload = JSONObject().apply {
            put("operation_id", operationId)
            put("id_kelas", long(args, "classId"))
            put("mapel_id", long(args, "mapelId"))
            put("mapel", nullableText(args, "mapel") ?: db.dao().mapel(long(args, "mapelId"))?.nama)
            put("tanggal", text(args, "date"))
            put("waktu_mulai", text(args, "startTime"))
            put("catatan", args["note"])
            put("allow_update", true)
            put("notify_all", true)
            put("detail", payloadDetails)
        }
        db.runInTransaction {
            db.dao().insertPresensi(
                PresensiEntity(
                    operationId, null, operationId, null, long(args, "classId"),
                    long(args, "mapelId"), nullableText(args, "mapel") ?: db.dao().mapel(long(args, "mapelId"))?.nama,
                    text(args, "date"), text(args, "startTime"), null,
                    nullableText(args, "note"), "pending", null, text(args, "updatedAt"),
                ),
            )
            db.dao().insertDetails(entities)
            db.dao().insertOutbox(
                OutboxEntity(operationId, "presensi", "POST", "/presensi", payload.toString(), "pending", 0, null, text(args, "updatedAt")),
            )
        }
        addSystemLog(
            "Presensi disimpan lokal",
            "Offline-first: presensi ${text(args, "date")} ${text(args, "startTime")} disimpan lokal dan masuk antrean sinkronisasi.",
            "presensi",
            "pending",
        )
        scheduleOneOff()
        return operationId
    }

    private fun attendance(localId: String): Map<String, Any?>? {
        val row = db.dao().presensi(localId) ?: return null
        return presensiMap(row) + mapOf(
            "detail" to db.dao().attendanceDetails(localId).map(::detailMap),
        )
    }

    private fun attendanceByScope(args: Map<*, *>): Map<String, Any?>? {
        val requestedMapelId = nullableLong(args, "mapelId")
        val row = db.dao().presensiByScope(
            long(args, "classId"),
            requestedMapelId,
            text(args, "date"),
            text(args, "startTime"),
        ) ?: if (requestedMapelId == null) {
            db.dao().presensiByClassDate(long(args, "classId"), text(args, "date"))
        } else {
            null
        } ?: return null
        return attendance(row.local_id)
    }

    private fun updateAttendance(args: Map<*, *>): String {
        val localId = text(args, "localId")
        val operationId = text(args, "operationId")
        val existing = db.dao().presensi(localId) ?: throw IllegalArgumentException("Data presensi tidak ditemukan.")
        val details = args["details"] as List<*>
        val payloadDetails = JSONArray()
        val entities = details.map {
            val row = it as Map<*, *>
            payloadDetails.put(JSONObject().apply {
                put("id_santri", long(row, "id_santri"))
                put("status_presensi", text(row, "status_presensi"))
                put("keterangan", row["keterangan"])
            })
            DetailPresensiEntity(localId, long(row, "id_santri"), text(row, "status_presensi"), nullableText(row, "keterangan"))
        }
        val payload = JSONObject().apply {
            put("operation_id", operationId)
            put("id_kelas", long(args, "classId"))
            put("mapel_id", long(args, "mapelId"))
            put("mapel", nullableText(args, "mapel") ?: db.dao().mapel(long(args, "mapelId"))?.nama)
            put("tanggal", text(args, "date"))
            put("waktu_mulai", text(args, "startTime"))
            put("catatan", args["note"])
            put("allow_update", true)
            put("notify_all", false)
            put("detail", payloadDetails)
        }
        val endpoint = if (existing.id_presensi != null) "/presensi/${existing.id_presensi}" else "/presensi"
        val method = if (existing.id_presensi != null) "PUT" else "POST"
        db.runInTransaction {
            db.dao().deleteOutbox(existing.operation_id)
            db.dao().insertPresensi(
                PresensiEntity(
                    localId, existing.id_presensi, operationId, existing.id_guru, long(args, "classId"),
                    long(args, "mapelId"), nullableText(args, "mapel") ?: db.dao().mapel(long(args, "mapelId"))?.nama,
                    text(args, "date"), text(args, "startTime"), null,
                    nullableText(args, "note"), "pending", null, text(args, "updatedAt"),
                ),
            )
            db.dao().deleteDetails(localId)
            db.dao().insertDetails(entities)
            db.dao().insertOutbox(
                OutboxEntity(operationId, "presensi", method, endpoint, payload.toString(), "pending", 0, null, text(args, "updatedAt")),
            )
        }
        addSystemLog(
            "Presensi diperbarui lokal",
            "Perubahan presensi disimpan lokal dan masuk antrean update server.",
            "presensi",
            "pending",
        )
        scheduleOneOff()
        return operationId
    }

    private fun deleteAttendance(args: Map<*, *>): Boolean {
        val localId = text(args, "localId")
        val operationId = text(args, "operationId")
        val updatedAt = text(args, "updatedAt")
        val existing = db.dao().presensi(localId) ?: return true
        db.runInTransaction {
            db.dao().deleteDetails(localId)
            db.dao().deletePresensi(localId)
            db.dao().deleteOutbox(existing.operation_id)
            if (existing.id_presensi != null) {
                db.dao().insertOutbox(
                    OutboxEntity(
                        operationId,
                        "presensi_delete",
                        "DELETE",
                        "/presensi/${existing.id_presensi}",
                        "{}",
                        "pending",
                        0,
                        null,
                        updatedAt,
                    ),
                )
            }
        }
        addSystemLog(
            "Presensi dibatalkan",
            if (existing.id_presensi != null) "Pembatalan presensi masuk antrean sinkronisasi server." else "Presensi lokal yang belum masuk server dihapus.",
            "presensi",
            "pending",
        )
        if (existing.id_presensi != null) scheduleOneOff()
        return true
    }

    private fun syncStatus(): Map<String, Any?> = mapOf(
        "pending" to db.dao().pendingCount(),
        "failed" to db.dao().failedCount(),
        "syncing" to db.dao().syncingCount(),
        "last_error" to db.dao().latestSyncError(),
    )

    private fun saveMaster(args: Map<*, *>): Map<String, Any?> {
        val entity = text(args, "entity")
        val operationId = text(args, "operationId")
        val data = args["data"] as Map<*, *>
        val updatedAt = text(args, "updatedAt")
        val existingId = nullableLong(data, idKey(entity))
        val id = existingId ?: nextLocalId(entity)
        val endpoint = if (existingId == null) "/$entity" else "/$entity/$id"
        val method = if (existingId == null) "POST" else "PUT"
        val payload = JSONObject().apply {
            put("operation_id", operationId)
            for ((key, value) in data) {
                if (key != null && value != null) put(key.toString(), value)
            }
            if (existingId == null) put(idKey(entity), id)
        }

        db.runInTransaction {
            when (entity) {
                "guru" -> db.dao().insertGuru(listOf(
                    GuruEntity(
                        id,
                        nullableLong(data, "id_user"),
                        text(data, "nama_guru"),
                        nullableText(data, "username"),
                        nullableText(data, "nip_nidm"),
                        nullableText(data, "nomor_hp"),
                        nullableText(data, "alamat"),
                        bool(data, "status_aktif", true),
                    ),
                ))
                "kelas" -> db.dao().insertKelas(listOf(
                    KelasEntity(
                        id,
                        long(data, "id_guru"),
                        text(data, "nama_kelas"),
                        int(data, "tingkat"),
                        bool(data, "status_aktif", true),
                    ),
                ))
                "santri" -> db.dao().insertSantri(listOf(
                    SantriEntity(
                        id,
                        long(data, "id_kelas"),
                        text(data, "nisn"),
                        text(data, "nama_santri"),
                        nullableText(data, "jenis_kelamin"),
                        nullableText(data, "tgl_lahir"),
                        nullableText(data, "alamat"),
                        nullableText(data, "nama_wali"),
                        nullableText(data, "nomor_wa_wali"),
                        bool(data, "status_aktif", true),
                    ),
                ))
                "mapel" -> db.dao().insertMapel(listOf(
                    MataPelajaranEntity(
                        id,
                        text(data, "nama"),
                        nullableText(data, "kode"),
                        nullableText(data, "status") ?: "Aktif",
                    ),
                ))
            }
            db.dao().insertOutbox(
                OutboxEntity(operationId, entity, method, endpoint, payload.toString(), "pending", 0, null, updatedAt),
            )
        }
        addSystemLog(
            "Data master disimpan lokal",
            "Perubahan data $entity disimpan lokal dan masuk antrean sinkronisasi.",
            "master",
            "pending",
        )
        scheduleOneOff()

        return mapOf(idKey(entity) to id, "operation_id" to operationId, "sync_status" to "pending")
    }

    private fun deleteMaster(args: Map<*, *>): Boolean {
        val entity = text(args, "entity")
        val id = long(args, "id")
        val operationId = text(args, "operationId")
        val updatedAt = text(args, "updatedAt")
        val localOnly = id < 0
        db.runInTransaction {
            when (entity) {
                "guru" -> if (localOnly) db.dao().deleteGuruLocal(id) else db.dao().deactivateGuru(id)
                "kelas" -> if (localOnly) db.dao().deleteKelasLocal(id) else db.dao().deactivateKelas(id)
                "santri" -> if (localOnly) db.dao().deleteSantriLocal(id) else db.dao().deactivateSantri(id)
                "mapel" -> if (localOnly) db.dao().deleteMapelLocal(id) else db.dao().deactivateMapel(id)
            }
            if (localOnly) {
                db.dao().deleteLocalCreateOutbox(entity, "\"${idKey(entity)}\":$id")
            } else {
                db.dao().insertOutbox(
                    OutboxEntity(operationId, entity, "DELETE", "/$entity/$id", "{}", "pending", 0, null, updatedAt),
                )
            }
        }
        addSystemLog(
            if (localOnly) "Data master lokal dihapus" else "Data master dinonaktifkan",
            if (localOnly) {
                "Data $entity masih lokal sehingga dihapus dari perangkat tanpa dikirim ke server."
            } else {
                "Data $entity masuk antrean hapus/nonaktif ke server."
            },
            "master",
            if (localOnly) "success" else "pending",
        )
        if (!localOnly) scheduleOneOff()
        return true
    }

    private fun addLog(args: Map<*, *>): Boolean {
        addSystemLog(
            text(args, "title"),
            nullableText(args, "message"),
            nullableText(args, "category") ?: "aplikasi",
            nullableText(args, "status") ?: "info",
        )
        return true
    }

    private fun addSystemLog(title: String, message: String?, category: String, status: String) {
        db.dao().insertLog(AppLogEntity(
            category = category,
            title = title,
            message = message,
            status = status,
            created_at = currentTimestamp(),
        ))
    }

    private fun nextLocalId(entity: String): Long {
        val min = when (entity) {
            "guru" -> db.dao().minGuruId()
            "kelas" -> db.dao().minKelasId()
            "santri" -> db.dao().minSantriId()
            "mapel" -> db.dao().minMapelId()
            else -> null
        } ?: 0
        return if (min < 0) min - 1 else -1
    }

    private fun idKey(entity: String) = when (entity) {
        "guru" -> "id_guru"
        "kelas" -> "id_kelas"
        "mapel" -> "id"
        else -> "id_santri"
    }

    private fun allStudents(): List<Map<String, Any?>> {
        val classes = db.dao().classes().associateBy { it.id_kelas }
        return db.dao().allStudents().map {
            santriMap(it) + mapOf("nama_kelas" to classes[it.id_kelas]?.nama_kelas)
        }
    }

    private fun scheduleOneOff() {
        val request = OneTimeWorkRequestBuilder<ThesisSyncWorker>()
            .setConstraints(Constraints.Builder().setRequiredNetworkType(NetworkType.CONNECTED).build())
            .setBackoffCriteria(BackoffPolicy.EXPONENTIAL, 10, TimeUnit.SECONDS)
            .build()
        WorkManager.getInstance(context).enqueueUniqueWork(
            "thesis-immediate-sync",
            ExistingWorkPolicy.REPLACE,
            request,
        )
        addSystemLog(
            "WorkManager dijadwalkan",
            "Sinkronisasi satu kali dibuat dengan syarat jaringan terhubung.",
            "workmanager",
            "info",
        )
    }

    private fun schedulePeriodic() {
        val request = PeriodicWorkRequestBuilder<ThesisSyncWorker>(15, TimeUnit.MINUTES)
            .setConstraints(Constraints.Builder().setRequiredNetworkType(NetworkType.CONNECTED).build())
            .build()
        WorkManager.getInstance(context).enqueueUniquePeriodicWork(
            "thesis-periodic-sync",
            ExistingPeriodicWorkPolicy.KEEP,
            request,
        )
        addSystemLog(
            "WorkManager periodik aktif",
            "Pengecekan sinkronisasi otomatis berjalan setiap 15 menit saat jaringan tersedia.",
            "workmanager",
            "info",
        )
    }
}

object ThesisSyncRunner {
    fun hasInternet(context: Context): Boolean {
        val manager = context.getSystemService(Context.CONNECTIVITY_SERVICE) as ConnectivityManager
        val network = manager.activeNetwork ?: return false
        val capabilities = manager.getNetworkCapabilities(network) ?: return false
        return capabilities.hasCapability(NetworkCapabilities.NET_CAPABILITY_INTERNET) &&
            capabilities.hasCapability(NetworkCapabilities.NET_CAPABILITY_VALIDATED)
    }

    fun sync(context: Context, operationId: String? = null): Map<String, Any> {
        val dao = ThesisRoomDatabase.get(context).dao()
        if (!hasInternet(context)) {
            insertSystemLog(
                dao,
                "Sinkronisasi menunggu internet",
                "Jaringan belum valid. Data tetap pending dan akan dikirim otomatis saat online.",
                "offline-first",
                "pending",
            )
            return mapOf("online" to false, "synced" to 0, "failed" to 0, "pending" to dao.pendingCount())
        }

        val prefs = context.getSharedPreferences("FlutterSharedPreferences", Context.MODE_PRIVATE)
        val session = prefs.getString("flutter.thesis_session", null)
            ?: run {
                insertSystemLog(dao, "Sinkronisasi dilewati", "Sesi login belum tersedia.", "sync", "info")
                return mapOf("online" to true, "synced" to 0, "pending" to dao.pendingCount())
            }
        val token = JSONObject(session).optString("token")
        if (token.isBlank()) {
            insertSystemLog(dao, "Sinkronisasi dilewati", "Token login kosong atau tidak valid.", "sync", "info")
            return mapOf("online" to true, "synced" to 0, "pending" to dao.pendingCount())
        }

        var synced = 0
        var failed = 0
        var deferred = 0
        val pendingItems = operationId
            ?.let { dao.pendingByOperation(it)?.let(::listOf) ?: emptyList() }
            ?: dao.pending()
        insertSystemLog(
            dao,
            "Sinkronisasi dimulai",
            if (operationId == null) {
                "Menyiapkan ${pendingItems.size} data antrean untuk dikirim ke server."
            } else {
                "Menyiapkan presensi aktif untuk langsung dikirim ke server."
            },
            "sync",
            "info",
        )
        for (queuedItem in pendingItems) {
            val item = dao.pendingByOperation(queuedItem.operation_id) ?: continue
            try {
                if (isLocalOnlyDelete(item)) {
                    dao.deleteOutbox(item.operation_id)
                    synced += 1
                    insertSystemLog(
                        dao,
                        "Sinkronisasi master lokal dibersihkan",
                        "${item.entity_type} lokal belum memiliki id server, antrean hapus dibatalkan.",
                        "master",
                        "success",
                    )
                    continue
                }
                if (dao.updateOutbox(item.operation_id, "syncing", null, 0) == 0) continue
                if (item.entity_type == "presensi") {
                    dao.updatePresensiIfNotCompleted(item.operation_id, "syncing", null)
                }
                val connection = URL("https://absensi-android-skripsi.vercel.app/api${item.endpoint}").openConnection() as HttpURLConnection
                connection.requestMethod = item.method
                connection.connectTimeout = 15000
                connection.readTimeout = 45000
                connection.doOutput = true
                connection.setRequestProperty("Accept", "application/json")
                connection.setRequestProperty("Authorization", "Bearer $token")
                connection.setRequestProperty("Content-Type", "application/json")
                connection.outputStream.use { it.write(item.payload.toByteArray()) }
                val stream = if (connection.responseCode in 200..299) connection.inputStream else connection.errorStream
                val response = stream?.bufferedReader()?.use { it.readText() }.orEmpty()
                if (connection.responseCode !in 200..299) {
                    val message = runCatching {
                        JSONObject(response).optString("message")
                    }.getOrNull()?.takeIf { it.isNotBlank() } ?: "Sinkronisasi ditolak server."
                    throw IllegalStateException("HTTP ${connection.responseCode}: $message")
                }
                if (item.entity_type == "presensi") {
                    val serverId = JSONObject(response).optJSONObject("data")?.optLong("id_presensi")
                    dao.updatePresensi(item.operation_id, "completed", null, serverId)
                    insertSystemLog(
                        dao,
                        "Presensi masuk server",
                        "Online-first aktif: presensi diterima server dan notifikasi WhatsApp diproses backend.",
                        "whatsapp",
                        "success",
                    )
                } else {
                    reconcileMasterLocalId(dao, item, response)
                    insertSystemLog(dao, "Sinkronisasi data berhasil", "${item.entity_type} berhasil dikirim ke server.", "sync", "success")
                }
                dao.deleteOutbox(item.operation_id)
                synced += 1
            } catch (error: Throwable) {
                if (dao.pendingByOperation(item.operation_id) == null) continue
                val transient = isTransientSyncError(error)
                if (transient) {
                    deferred += 1
                } else {
                    failed += 1
                }
                val nextStatus = if (transient) "pending" else "failed"
                dao.updateOutbox(item.operation_id, nextStatus, error.message, 1)
                if (item.entity_type == "presensi") {
                    dao.updatePresensiIfNotCompleted(item.operation_id, nextStatus, error.message)
                }
                insertSystemLog(
                    dao,
                    if (transient) "Sinkronisasi tertunda" else "Sinkronisasi gagal",
                    error.message ?: "Server belum menerima data.",
                    "sync",
                    if (transient) "pending" else "failed",
                )
            }
        }
        insertSystemLog(
            dao,
            "Sinkronisasi selesai",
            "Berhasil $synced data, tertunda $deferred data, gagal $failed data, sisa pending ${dao.pendingCount()} data.",
            "sync",
            if (failed > 0) "failed" else "success",
        )
        return mapOf("online" to true, "synced" to synced, "deferred" to deferred, "failed" to failed, "pending" to dao.pendingCount())
    }

    private fun isLocalOnlyDelete(item: OutboxEntity): Boolean =
        item.method.equals("DELETE", ignoreCase = true) &&
            item.endpoint.substringAfterLast('/').toLongOrNull()?.let { it < 0 } == true

    private fun reconcileMasterLocalId(dao: ThesisDao, item: OutboxEntity, response: String) {
        if (!item.method.equals("POST", ignoreCase = true)) return
        val payload = runCatching { JSONObject(item.payload) }.getOrNull() ?: return
        val localId = payload.optLong(masterIdKey(item.entity_type), 0)
        if (localId >= 0) return

        val data = runCatching { JSONObject(response).optJSONObject("data") }.getOrNull() ?: return
        val serverId = data.optLong(masterIdKey(item.entity_type), 0)
        if (serverId <= 0) return

        when (item.entity_type) {
            "guru" -> dao.replaceGuruLocalId(localId, serverId)
            "kelas" -> dao.replaceKelasLocalId(localId, serverId)
            "santri" -> dao.replaceSantriLocalId(localId, serverId)
            "mapel" -> dao.replaceMapelLocalId(localId, serverId)
        }
    }

    private fun masterIdKey(entity: String): String = when (entity) {
        "guru" -> "id_guru"
        "kelas" -> "id_kelas"
        "santri" -> "id_santri"
        "mapel" -> "id"
        else -> "id"
    }

    private fun isTransientSyncError(error: Throwable): Boolean {
        val text = (error.message ?: error.toString()).lowercase()
        return text.contains("timeout")
            || text.contains("timed out")
            || text.contains("http 5")
            || text.contains("server")
            || text.contains("connection reset")
            || text.contains("failed to connect")
            || text.contains("unable to resolve host")
            || text.contains("network")
            || text.contains("unexpected end")
    }
}

class ThesisSyncWorker(context: Context, params: WorkerParameters) : Worker(context, params) {
    override fun doWork(): Result {
        if (!ThesisSyncRunner.hasInternet(applicationContext)) {
            insertSystemLog(
                ThesisRoomDatabase.get(applicationContext).dao(),
                "Internet belum tersedia",
                "WorkManager menunda sinkronisasi sampai jaringan aktif.",
                "offline-first",
                "pending",
            )
            return Result.retry()
        }
        return try {
            val result = ThesisSyncRunner.sync(applicationContext)
            if ((result["failed"] as? Int ?: 0) > 0) Result.retry() else Result.success()
        } catch (_: Throwable) {
            Result.retry()
        }
    }
}

private fun guruMap(row: GuruEntity): Map<String, Any?> = mapOf(
    "id_guru" to row.id_guru, "id_user" to row.id_user, "nama_guru" to row.nama_guru,
    "username" to row.username, "nip_nidm" to row.nip_nidm, "nomor_hp" to row.nomor_hp,
    "alamat" to row.alamat, "status_aktif" to row.status_aktif,
)

private fun kelasMap(row: KelasEntity): Map<String, Any?> = mapOf(
    "id_kelas" to row.id_kelas, "id_guru" to row.id_guru, "nama_kelas" to row.nama_kelas,
    "tingkat" to row.tingkat, "status_aktif" to row.status_aktif,
)

private fun santriMap(row: SantriEntity): Map<String, Any?> = mapOf(
    "id_santri" to row.id_santri, "id_kelas" to row.id_kelas, "nisn" to row.nisn,
    "nama_santri" to row.nama_santri, "jenis_kelamin" to row.jenis_kelamin,
    "tgl_lahir" to row.tgl_lahir, "alamat" to row.alamat, "nama_wali" to row.nama_wali,
    "nomor_wa_wali" to row.nomor_wa_wali, "status_aktif" to row.status_aktif,
)

private fun mapelMap(row: MataPelajaranEntity): Map<String, Any?> = mapOf(
    "id" to row.id, "nama" to row.nama, "kode" to row.kode, "status" to row.status,
)

private fun presensiMap(row: PresensiEntity): Map<String, Any?> = mapOf(
    "local_id" to row.local_id, "id_presensi" to row.id_presensi, "operation_id" to row.operation_id,
    "id_guru" to row.id_guru, "id_kelas" to row.id_kelas, "mapel_id" to row.mapel_id, "mapel" to row.mapel, "tanggal" to row.tanggal,
    "waktu_mulai" to row.waktu_mulai, "waktu_selesai" to row.waktu_selesai,
    "catatan" to row.catatan, "sync_status" to row.sync_status, "sync_message" to row.sync_message,
)

private fun detailMap(row: DetailRow): Map<String, Any?> = mapOf(
    "id_santri" to row.id_santri, "nisn" to row.nisn, "nama_santri" to row.nama_santri,
    "status_presensi" to row.status_presensi, "keterangan" to row.keterangan,
)

private fun historyMap(row: HistoryRow): Map<String, Any?> = mapOf(
    "local_id" to row.local_id, "id_presensi" to row.id_presensi, "id_kelas" to row.id_kelas,
    "nama_kelas" to row.nama_kelas, "id_guru" to row.id_guru, "nama_guru" to row.nama_guru, 
    "mapel_id" to row.mapel_id, "mapel" to row.mapel, "tanggal" to row.tanggal,
    "waktu_mulai" to row.waktu_mulai, "catatan" to row.catatan, "sync_status" to row.sync_status,
    "hadir" to row.hadir, "sakit" to row.sakit, "izin" to row.izin, "alpa" to row.alpa,
)

private fun appLogMap(row: AppLogEntity): Map<String, Any?> = mapOf(
    "id" to row.id,
    "category" to row.category,
    "title" to row.title,
    "message" to row.message,
    "status" to row.status,
    "created_at" to row.created_at,
)

private fun insertSystemLog(dao: ThesisDao, title: String, message: String?, category: String, status: String) {
    dao.insertLog(AppLogEntity(
        category = category,
        title = title,
        message = message,
        status = status,
        created_at = currentTimestamp(),
    ))
}

private fun currentTimestamp(): String =
    java.text.SimpleDateFormat("yyyy-MM-dd HH:mm:ss", java.util.Locale.US).format(java.util.Date())

private fun text(row: Map<*, *>, key: String) = row[key]?.toString() ?: ""
private fun nullableText(row: Map<*, *>, key: String) = row[key]?.toString()?.takeIf { it.isNotBlank() }
private fun long(row: Map<*, *>, key: String) = (row[key] as? Number)?.toLong() ?: row[key].toString().toLong()
private fun nullableLong(row: Map<*, *>, key: String) = (row[key] as? Number)?.toLong() ?: row[key]?.toString()?.toLongOrNull()
private fun int(row: Map<*, *>, key: String) = (row[key] as? Number)?.toInt() ?: row[key].toString().toInt()
private fun bool(row: Map<*, *>, key: String) = row[key] == true || row[key] == 1 || row[key]?.toString() == "1"
private fun bool(row: Map<*, *>, key: String, default: Boolean) = if (row.containsKey(key)) bool(row, key) else default
