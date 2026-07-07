package com.qomaruddin.absensi_skripsi

import android.content.Context
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
import androidx.work.BackoffPolicy
import androidx.work.Constraints
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

@Entity(tableName = "presensi")
data class PresensiEntity(
    @PrimaryKey val local_id: String,
    val id_presensi: Long?,
    val operation_id: String,
    val id_guru: Long?,
    val id_kelas: Long,
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

data class HistoryRow(
    val local_id: String,
    val nama_kelas: String,
    val tanggal: String,
    val waktu_mulai: String,
    val sync_status: String,
    val hadir: Int,
    val sakit: Int,
    val izin: Int,
    val alpa: Int,
)

@Dao
interface ThesisDao {
    @Query("DELETE FROM guru")
    fun clearGuru()

    @Query("DELETE FROM kelas")
    fun clearKelas()

    @Query("DELETE FROM santri")
    fun clearSantri()

    @Insert(onConflict = OnConflictStrategy.REPLACE)
    fun insertGuru(rows: List<GuruEntity>)

    @Insert(onConflict = OnConflictStrategy.REPLACE)
    fun insertKelas(rows: List<KelasEntity>)

    @Insert(onConflict = OnConflictStrategy.REPLACE)
    fun insertSantri(rows: List<SantriEntity>)

    @Insert(onConflict = OnConflictStrategy.REPLACE)
    fun insertPresensi(row: PresensiEntity)

    @Insert(onConflict = OnConflictStrategy.REPLACE)
    fun insertDetails(rows: List<DetailPresensiEntity>)

    @Insert(onConflict = OnConflictStrategy.REPLACE)
    fun insertOutbox(row: OutboxEntity)

    @Query("SELECT * FROM guru WHERE status_aktif = 1 ORDER BY nama_guru")
    fun gurus(): List<GuruEntity>

    @Query("SELECT * FROM kelas WHERE status_aktif = 1 ORDER BY tingkat, nama_kelas")
    fun classes(): List<KelasEntity>

    @Query("SELECT * FROM santri WHERE id_kelas = :classId AND status_aktif = 1 ORDER BY nama_santri")
    fun students(classId: Long): List<SantriEntity>

    @Query("SELECT * FROM santri WHERE status_aktif = 1 ORDER BY nama_santri")
    fun allStudents(): List<SantriEntity>

    @Query("SELECT MIN(id_guru) FROM guru")
    fun minGuruId(): Long?

    @Query("SELECT MIN(id_kelas) FROM kelas")
    fun minKelasId(): Long?

    @Query("SELECT MIN(id_santri) FROM santri")
    fun minSantriId(): Long?

    @Query("UPDATE guru SET status_aktif = 0 WHERE id_guru = :id")
    fun deactivateGuru(id: Long)

    @Query("UPDATE kelas SET status_aktif = 0 WHERE id_kelas = :id")
    fun deactivateKelas(id: Long)

    @Query("UPDATE santri SET status_aktif = 0 WHERE id_santri = :id")
    fun deactivateSantri(id: Long)

    @Query("SELECT * FROM sync_outbox WHERE status IN ('pending','failed','syncing') ORDER BY created_at")
    fun pending(): List<OutboxEntity>

    @Query("SELECT COUNT(*) FROM sync_outbox WHERE status != 'completed'")
    fun pendingCount(): Int

    @Query("UPDATE sync_outbox SET status=:status, last_error=:error, retry_count=retry_count+:retry WHERE operation_id=:id")
    fun updateOutbox(id: String, status: String, error: String?, retry: Int)

    @Query("UPDATE presensi SET sync_status=:status, sync_message=:message, id_presensi=:serverId WHERE operation_id=:id")
    fun updatePresensi(id: String, status: String, message: String?, serverId: Long?)

    @Query("DELETE FROM sync_outbox WHERE operation_id=:id")
    fun deleteOutbox(id: String)

    @Query(
        """SELECT p.local_id, k.nama_kelas, p.tanggal, p.waktu_mulai, p.sync_status,
        SUM(CASE WHEN d.status_presensi='Hadir' THEN 1 ELSE 0 END) hadir,
        SUM(CASE WHEN d.status_presensi='Sakit' THEN 1 ELSE 0 END) sakit,
        SUM(CASE WHEN d.status_presensi='Izin' THEN 1 ELSE 0 END) izin,
        SUM(CASE WHEN d.status_presensi='Alpa' THEN 1 ELSE 0 END) alpa
        FROM presensi p JOIN kelas k ON k.id_kelas=p.id_kelas
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
        PresensiEntity::class,
        DetailPresensiEntity::class,
        OutboxEntity::class,
    ],
    version = 1,
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
                ).openHelperFactory(factory).build().also { instance = it }
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
                            "gurus" -> db.dao().gurus().map(::guruMap)
                            "students" -> db.dao().students((call.argument<Number>("classId")!!).toLong()).map(::santriMap)
                            "allStudents" -> allStudents()
                            "saveAttendance" -> saveAttendance(call.arguments as Map<*, *>)
                            "saveMaster" -> saveMaster(call.arguments as Map<*, *>)
                            "deleteMaster" -> deleteMaster(call.arguments as Map<*, *>)
                            "pendingCount" -> db.dao().pendingCount()
                            "history" -> db.dao().history().map(::historyMap)
                            "requestSync" -> {
                                scheduleOneOff()
                                true
                            }
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
        db.runInTransaction {
            db.dao().clearSantri()
            db.dao().clearKelas()
            db.dao().clearGuru()
            db.dao().insertGuru(gurus)
            db.dao().insertKelas(classes)
            db.dao().insertSantri(students)
        }
        return true
    }

    private fun saveAttendance(args: Map<*, *>): String {
        val operationId = text(args, "operationId")
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
            put("tanggal", text(args, "date"))
            put("waktu_mulai", text(args, "startTime"))
            put("catatan", args["note"])
            put("allow_update", true)
            put("detail", payloadDetails)
        }
        db.runInTransaction {
            db.dao().insertPresensi(
                PresensiEntity(
                    operationId, null, operationId, null, long(args, "classId"),
                    text(args, "date"), text(args, "startTime"), null,
                    nullableText(args, "note"), "pending", null, text(args, "updatedAt"),
                ),
            )
            db.dao().insertDetails(entities)
            db.dao().insertOutbox(
                OutboxEntity(operationId, "presensi", "POST", "/presensi", payload.toString(), "pending", 0, null, text(args, "updatedAt")),
            )
        }
        scheduleOneOff()
        return operationId
    }

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
            }
            db.dao().insertOutbox(
                OutboxEntity(operationId, entity, method, endpoint, payload.toString(), "pending", 0, null, updatedAt),
            )
        }
        scheduleOneOff()

        return mapOf(idKey(entity) to id, "operation_id" to operationId, "sync_status" to "pending")
    }

    private fun deleteMaster(args: Map<*, *>): Boolean {
        val entity = text(args, "entity")
        val id = long(args, "id")
        val operationId = text(args, "operationId")
        val updatedAt = text(args, "updatedAt")
        db.runInTransaction {
            when (entity) {
                "guru" -> db.dao().deactivateGuru(id)
                "kelas" -> db.dao().deactivateKelas(id)
                "santri" -> db.dao().deactivateSantri(id)
            }
            db.dao().insertOutbox(
                OutboxEntity(operationId, entity, "DELETE", "/$entity/$id", "{}", "pending", 0, null, updatedAt),
            )
        }
        scheduleOneOff()
        return true
    }

    private fun nextLocalId(entity: String): Long {
        val min = when (entity) {
            "guru" -> db.dao().minGuruId()
            "kelas" -> db.dao().minKelasId()
            "santri" -> db.dao().minSantriId()
            else -> null
        } ?: 0
        return if (min < 0) min - 1 else -1
    }

    private fun idKey(entity: String) = when (entity) {
        "guru" -> "id_guru"
        "kelas" -> "id_kelas"
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
        WorkManager.getInstance(context).enqueue(request)
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
    }
}

class ThesisSyncWorker(context: Context, params: WorkerParameters) : Worker(context, params) {
    override fun doWork(): Result {
        val dao = ThesisRoomDatabase.get(applicationContext).dao()
        val prefs = applicationContext.getSharedPreferences("FlutterSharedPreferences", Context.MODE_PRIVATE)
        val session = prefs.getString("flutter.thesis_session", null) ?: return Result.failure()
        val token = JSONObject(session).optString("token")
        if (token.isBlank()) return Result.failure()

        for (item in dao.pending()) {
            try {
                dao.updateOutbox(item.operation_id, "syncing", null, 0)
                dao.updatePresensi(item.operation_id, "syncing", null, null)
                val connection = URL("https://absensi-android-skripsi.vercel.app/api${item.endpoint}").openConnection() as HttpURLConnection
                connection.requestMethod = item.method
                connection.connectTimeout = 15000
                connection.readTimeout = 20000
                connection.doOutput = true
                connection.setRequestProperty("Authorization", "Bearer $token")
                connection.setRequestProperty("Content-Type", "application/json")
                connection.outputStream.use { it.write(item.payload.toByteArray()) }
                val stream = if (connection.responseCode in 200..299) connection.inputStream else connection.errorStream
                val response = stream?.bufferedReader()?.use { it.readText() }.orEmpty()
                if (connection.responseCode !in 200..299) throw IllegalStateException(JSONObject(response).optString("message", "Sinkronisasi ditolak server."))
                if (item.entity_type == "presensi") {
                    val serverId = JSONObject(response).optJSONObject("data")?.optLong("id_presensi")
                    dao.updatePresensi(item.operation_id, "completed", null, serverId)
                }
                dao.deleteOutbox(item.operation_id)
            } catch (error: Throwable) {
                dao.updateOutbox(item.operation_id, "failed", error.message, 1)
                if (item.entity_type == "presensi") {
                    dao.updatePresensi(item.operation_id, "failed", error.message, null)
                }
                return Result.retry()
            }
        }
        return Result.success()
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

private fun historyMap(row: HistoryRow): Map<String, Any?> = mapOf(
    "local_id" to row.local_id, "nama_kelas" to row.nama_kelas, "tanggal" to row.tanggal,
    "waktu_mulai" to row.waktu_mulai, "sync_status" to row.sync_status,
    "hadir" to row.hadir, "sakit" to row.sakit, "izin" to row.izin, "alpa" to row.alpa,
)

private fun text(row: Map<*, *>, key: String) = row[key]?.toString() ?: ""
private fun nullableText(row: Map<*, *>, key: String) = row[key]?.toString()?.takeIf { it.isNotBlank() }
private fun long(row: Map<*, *>, key: String) = (row[key] as? Number)?.toLong() ?: row[key].toString().toLong()
private fun nullableLong(row: Map<*, *>, key: String) = (row[key] as? Number)?.toLong() ?: row[key]?.toString()?.toLongOrNull()
private fun int(row: Map<*, *>, key: String) = (row[key] as? Number)?.toInt() ?: row[key].toString().toInt()
private fun bool(row: Map<*, *>, key: String) = row[key] == true || row[key] == 1 || row[key]?.toString() == "1"
private fun bool(row: Map<*, *>, key: String, default: Boolean) = if (row.containsKey(key)) bool(row, key) else default
