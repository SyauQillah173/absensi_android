<?php

namespace App\Models;

use App\Services\ReferenceResolver;
use Illuminate\Database\Eloquent\Model;

class Siswa extends Model
{
    protected $table = 'siswa';

    protected $fillable = [
        'nis', 'nisn', 'nama', 'nama_panggilan', 'tempat_lahir', 'tanggal_lahir',
        'jenis_kelamin', 'nik', 'no_kk', 'no_akta', 'dokumen_akta',
        'nama_wali', 'no_telepon_wali', 'kelas', 'class_id', 'status', 'student_status_id',
        'wali_id', 'guardian_profile_id',
        'alamat', 'kewarganegaraan', 'provinsi', 'kota', 'kecamatan', 'kelurahan',
        'province_id', 'city_id', 'district_id', 'village_id',
        'kode_pos', 'no_whatsapp', 'email_siswa',
        'asal_sekolah', 'sekolah_formal', 'school_origin_id', 'previous_asal_sekolah', 'previous_school_origin_id',
        'tahun_lulus', 'tahun_akademik_masuk', 'tahun_akademik_masuk_formal', 'academic_year_id',
        'jenis_santri', 'student_type_id',
        'anak_ke', 'jml_saudara',
        'nama_ayah', 'nik_ayah', 'tempat_lahir_ayah', 'tanggal_lahir_ayah',
        'nama_ibu', 'nik_ibu', 'tempat_lahir_ibu', 'tanggal_lahir_ibu',
        'pendidikan_ayah', 'father_education_id', 'pendidikan_ibu', 'mother_education_id',
        'pekerjaan_ayah', 'father_occupation_id', 'penghasilan_ayah', 'father_income_id',
        'pekerjaan_ibu', 'mother_occupation_id', 'penghasilan_ibu', 'mother_income_id',
        'alamat_ayah', 'alamat_ibu', 'alamat_lengkap_ayah', 'alamat_lengkap_ibu',
        'province_id_ayah', 'city_id_ayah', 'district_id_ayah', 'village_id_ayah', 'kode_pos_ayah',
        'province_id_ibu', 'city_id_ibu', 'district_id_ibu', 'village_id_ibu', 'kode_pos_ibu',
        'no_ayah', 'no_whatsapp_ayah', 'no_ibu', 'no_whatsapp_ibu',
        'wali_whatsapp_number', 'notification_whatsapp_enabled', 'notification_app_enabled',
        'nama_wali_keluarga', 'pekerjaan_wali_keluarga', 'guardian_occupation_id',
        'alamat_wali_keluarga', 'wali_sama_dengan', 'guardian_relationship_id', 'tanggal_masuk',
        'tempat_tinggal', 'residence_type_id', 'transportasi', 'transport_mode_id',
        'status_mondok', 'boarding_room_id', 'komplek', 'kamar',
        'tanggal_diterima_pondok', 'tanggal_diterima_sekolah',
        'tinggi_badan', 'berat_badan', 'golongan_darah', 'blood_type_id',
        'foto_santri', 'catatan_santri',
    ];

    public function wali()
    {
        return $this->belongsTo(User::class, 'wali_id');
    }

    public function kelasRef()
    {
        return $this->belongsTo(SchoolClass::class, 'class_id');
    }

    public function boardingRoom()
    {
        return $this->belongsTo(BoardingRoom::class, 'boarding_room_id');
    }

    public function santriPondok()
    {
        return $this->hasOne(SantriPondok::class, 'siswa_id');
    }

    public function statusRef()
    {
        return $this->belongsTo(StudentStatus::class, 'student_status_id');
    }

    public function schoolOrigin()
    {
        return $this->belongsTo(SchoolOrigin::class, 'school_origin_id');
    }

    public function previousSchoolOrigin()
    {
        return $this->belongsTo(SchoolOrigin::class, 'previous_school_origin_id');
    }

    public function guardianProfile()
    {
        return $this->belongsTo(GuardianProfile::class);
    }

    public function province()
    {
        return $this->belongsTo(Province::class);
    }

    public function city()
    {
        return $this->belongsTo(City::class);
    }

    public function district()
    {
        return $this->belongsTo(District::class);
    }

    public function village()
    {
        return $this->belongsTo(Village::class);
    }

    public function absensi()
    {
        return $this->hasMany(Absensi::class);
    }

    public function absensiSholat()
    {
        return $this->hasMany(AbsensiSholat::class);
    }

    public function absensiNgaji()
    {
        return $this->hasMany(AbsensiNgaji::class);
    }

    public function pembayaran()
    {
        return $this->hasMany(Pembayaran::class);
    }

    public function paymentBills()
    {
        return $this->hasMany(PaymentBill::class);
    }

    public function tahunAjaran()
    {
        return $this->hasMany(SiswaTahunAjaran::class, 'siswa_id');
    }

    public function nilai()
    {
        return $this->hasMany(Nilai::class);
    }

    public function kelompokBelajar()
    {
        return $this->belongsToMany(KelompokBelajar::class, 'kelompok_belajar_siswa', 'siswa_id', 'kelompok_id');
    }

    protected static function booted(): void
    {
        static::saving(function (Siswa $siswa): void {
            $resolver = app(ReferenceResolver::class);

            // 1. Status Sync
            if ($siswa->isDirty('student_status_id') && $siswa->student_status_id) {
                $siswa->status = $resolver->studentStatusName($siswa->student_status_id) ?? $siswa->status;
            } elseif ($siswa->isDirty('status') || !$siswa->student_status_id) {
                $statusId = $resolver->studentStatusId($siswa->status);
                if ($statusId) {
                    $siswa->student_status_id = $statusId;
                    $siswa->status = $resolver->studentStatusName($statusId) ?? $siswa->status;
                }
            }

            // 2. Class / Madin Sync
            if ($siswa->isDirty('class_id') && $siswa->class_id) {
                $siswa->kelas = $resolver->className($siswa->class_id) ?? $siswa->kelas;
            } elseif ($siswa->isDirty('kelas') || !$siswa->class_id) {
                $classId = $resolver->classId($siswa->kelas, false);
                if ($classId) {
                    $siswa->class_id = $classId;
                    $siswa->kelas = $resolver->className($classId) ?? $siswa->kelas;
                } else {
                    $siswa->class_id = null;
                    $siswa->kelas = null;
                }
            }

            // 3. Academic Year Sync
            if ($siswa->isDirty('academic_year_id') && $siswa->academic_year_id) {
                $siswa->tahun_akademik_masuk = $resolver->academicYearName($siswa->academic_year_id) ?? $siswa->tahun_akademik_masuk;
            } elseif ($siswa->isDirty('tahun_akademik_masuk') || !$siswa->academic_year_id) {
                $siswa->academic_year_id = $resolver->academicYearId($siswa->tahun_akademik_masuk) ?? $siswa->academic_year_id;
            }

            // 4. Student Type Sync
            if ($siswa->isDirty('student_type_id') && $siswa->student_type_id) {
                $siswa->jenis_santri = $resolver->nameById('student_types', $siswa->student_type_id) ?? $siswa->jenis_santri;
            } elseif ($siswa->isDirty('jenis_santri') || !$siswa->student_type_id) {
                $siswa->student_type_id = $resolver->studentTypeId($siswa->jenis_santri) ?? $siswa->student_type_id;
            }

            // 5. School Origin Sync
            if ($siswa->isDirty('school_origin_id') && $siswa->school_origin_id) {
                $siswa->asal_sekolah = $resolver->schoolOriginName($siswa->school_origin_id) ?? $siswa->asal_sekolah;
            } elseif ($siswa->isDirty('asal_sekolah') || !$siswa->school_origin_id) {
                $siswa->school_origin_id = $resolver->schoolOriginId($siswa->asal_sekolah) ?? $siswa->school_origin_id;
            }

            if ($siswa->isDirty('previous_school_origin_id') && $siswa->previous_school_origin_id) {
                $siswa->previous_asal_sekolah = $resolver->schoolOriginName($siswa->previous_school_origin_id) ?? $siswa->previous_asal_sekolah;
            } elseif ($siswa->isDirty('previous_asal_sekolah') || !$siswa->previous_school_origin_id) {
                $siswa->previous_school_origin_id = $resolver->schoolOriginId($siswa->previous_asal_sekolah) ?? $siswa->previous_school_origin_id;
            }

            // 6. Region Sync
            if ($siswa->isDirty('province_id') && $siswa->province_id) {
                $siswa->provinsi = $resolver->nameById('provinces', $siswa->province_id) ?? $siswa->provinsi;
            } elseif ($siswa->isDirty('provinsi') || !$siswa->province_id) {
                $siswa->province_id = $resolver->provinceId($siswa->provinsi) ?? $siswa->province_id;
                $siswa->provinsi = $siswa->province_id ? $resolver->nameById('provinces', $siswa->province_id) : null;
            }

            if ($siswa->isDirty('city_id') && $siswa->city_id) {
                $siswa->kota = $resolver->nameById('cities', $siswa->city_id) ?? $siswa->kota;
            } elseif ($siswa->isDirty('kota') || !$siswa->city_id) {
                $siswa->city_id = $resolver->cityId($siswa->kota, $siswa->province_id) ?? $siswa->city_id;
                $siswa->kota = $siswa->city_id ? $resolver->nameById('cities', $siswa->city_id) : null;
            }

            if ($siswa->isDirty('district_id') && $siswa->district_id) {
                $siswa->kecamatan = $resolver->nameById('districts', $siswa->district_id) ?? $siswa->kecamatan;
            } elseif ($siswa->isDirty('kecamatan') || !$siswa->district_id) {
                $siswa->district_id = $resolver->districtId($siswa->kecamatan, $siswa->city_id) ?? $siswa->district_id;
                $siswa->kecamatan = $siswa->district_id ? $resolver->nameById('districts', $siswa->district_id) : null;
            }

            if ($siswa->isDirty('village_id') && $siswa->village_id) {
                $siswa->kelurahan = $resolver->nameById('villages', $siswa->village_id) ?? $siswa->kelurahan;
            } elseif ($siswa->isDirty('kelurahan') || !$siswa->village_id) {
                $siswa->village_id = $resolver->villageId($siswa->kelurahan, $siswa->district_id) ?? $siswa->village_id;
                $siswa->kelurahan = $siswa->village_id ? $resolver->nameById('villages', $siswa->village_id) : null;
            }

            // 7. Parent & Other References
            if ($siswa->isDirty('father_education_id') && $siswa->father_education_id) {
                $siswa->pendidikan_ayah = $resolver->nameById('education_levels', $siswa->father_education_id) ?? $siswa->pendidikan_ayah;
            } elseif ($siswa->isDirty('pendidikan_ayah') || !$siswa->father_education_id) {
                $siswa->father_education_id = $resolver->educationLevelId($siswa->pendidikan_ayah) ?? $siswa->father_education_id;
            }

            if ($siswa->isDirty('mother_education_id') && $siswa->mother_education_id) {
                $siswa->pendidikan_ibu = $resolver->nameById('education_levels', $siswa->mother_education_id) ?? $siswa->pendidikan_ibu;
            } elseif ($siswa->isDirty('pendidikan_ibu') || !$siswa->mother_education_id) {
                $siswa->mother_education_id = $resolver->educationLevelId($siswa->pendidikan_ibu) ?? $siswa->mother_education_id;
            }

            if ($siswa->isDirty('father_occupation_id') && $siswa->father_occupation_id) {
                $siswa->pekerjaan_ayah = $resolver->nameById('occupations', $siswa->father_occupation_id) ?? $siswa->pekerjaan_ayah;
            } elseif ($siswa->isDirty('pekerjaan_ayah') || !$siswa->father_occupation_id) {
                $siswa->father_occupation_id = $resolver->occupationId($siswa->pekerjaan_ayah) ?? $siswa->father_occupation_id;
            }

            if ($siswa->isDirty('mother_occupation_id') && $siswa->mother_occupation_id) {
                $siswa->pekerjaan_ibu = $resolver->nameById('occupations', $siswa->mother_occupation_id) ?? $siswa->pekerjaan_ibu;
            } elseif ($siswa->isDirty('pekerjaan_ibu') || !$siswa->mother_occupation_id) {
                $siswa->mother_occupation_id = $resolver->occupationId($siswa->pekerjaan_ibu) ?? $siswa->mother_occupation_id;
            }

            if ($siswa->isDirty('guardian_occupation_id') && $siswa->guardian_occupation_id) {
                $siswa->pekerjaan_wali_keluarga = $resolver->nameById('occupations', $siswa->guardian_occupation_id) ?? $siswa->pekerjaan_wali_keluarga;
            } elseif ($siswa->isDirty('pekerjaan_wali_keluarga') || !$siswa->guardian_occupation_id) {
                $siswa->guardian_occupation_id = $resolver->occupationId($siswa->pekerjaan_wali_keluarga) ?? $siswa->guardian_occupation_id;
            }

            if ($siswa->isDirty('father_income_id') && $siswa->father_income_id) {
                $siswa->penghasilan_ayah = $resolver->nameById('income_ranges', $siswa->father_income_id) ?? $siswa->penghasilan_ayah;
            } elseif ($siswa->isDirty('penghasilan_ayah') || !$siswa->father_income_id) {
                $siswa->father_income_id = $resolver->incomeRangeId($siswa->penghasilan_ayah) ?? $siswa->father_income_id;
            }

            if ($siswa->isDirty('mother_income_id') && $siswa->mother_income_id) {
                $siswa->penghasilan_ibu = $resolver->nameById('income_ranges', $siswa->mother_income_id) ?? $siswa->penghasilan_ibu;
            } elseif ($siswa->isDirty('penghasilan_ibu') || !$siswa->mother_income_id) {
                $siswa->mother_income_id = $resolver->incomeRangeId($siswa->penghasilan_ibu) ?? $siswa->mother_income_id;
            }

            if ($siswa->isDirty('guardian_relationship_id') && $siswa->guardian_relationship_id) {
                $siswa->wali_sama_dengan = $resolver->nameById('guardian_relationships', $siswa->guardian_relationship_id) ?? $siswa->wali_sama_dengan;
            } elseif ($siswa->isDirty('wali_sama_dengan') || !$siswa->guardian_relationship_id) {
                $siswa->guardian_relationship_id = $resolver->guardianRelationshipId($siswa->wali_sama_dengan) ?? $siswa->guardian_relationship_id;
            }

            if ($siswa->isDirty('residence_type_id') && $siswa->residence_type_id) {
                $siswa->tempat_tinggal = $resolver->nameById('residence_types', $siswa->residence_type_id) ?? $siswa->tempat_tinggal;
            } elseif ($siswa->isDirty('tempat_tinggal') || !$siswa->residence_type_id) {
                $siswa->residence_type_id = $resolver->residenceTypeId($siswa->tempat_tinggal) ?? $siswa->residence_type_id;
            }

            if ($siswa->isDirty('transport_mode_id') && $siswa->transport_mode_id) {
                $siswa->transportasi = $resolver->nameById('transport_modes', $siswa->transport_mode_id) ?? $siswa->transportasi;
            } elseif ($siswa->isDirty('transportasi') || !$siswa->transport_mode_id) {
                $siswa->transport_mode_id = $resolver->transportModeId($siswa->transportasi) ?? $siswa->transport_mode_id;
            }

            if ($siswa->isDirty('blood_type_id') && $siswa->blood_type_id) {
                $siswa->golongan_darah = $resolver->nameById('blood_types', $siswa->blood_type_id) ?? $siswa->golongan_darah;
            } elseif ($siswa->isDirty('golongan_darah') || !$siswa->blood_type_id) {
                $siswa->blood_type_id = $resolver->bloodTypeId($siswa->golongan_darah) ?? $siswa->blood_type_id;
            }

            // 8. Boarding Room
            if ($siswa->boarding_room_id) {
                $room = BoardingRoom::query()
                    ->with('complex:id,name')
                    ->find($siswa->boarding_room_id);
                $siswa->kamar = $room?->name ?? $siswa->kamar;
                $siswa->komplek = $room?->complex?->name ?? $siswa->komplek;
            }
        });
    }
}
