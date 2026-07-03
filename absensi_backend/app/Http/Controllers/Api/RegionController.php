<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

class RegionController extends Controller
{
    public function provinces(Request $request)
    {
        return $this->respond(
            DB::table('provinces')
                ->select('id', 'external_code as code', 'name')
                ->when($request->filled('q'), fn ($query) => $query->where('name', 'ilike', '%' . $request->q . '%'))
                ->orderBy('external_code')
                ->get()
        );
    }

    public function cities(Request $request)
    {
        $request->validate([
            'province_id' => 'nullable|integer|exists:provinces,id',
            'province_code' => 'nullable|string',
            'q' => 'nullable|string',
            'all' => 'nullable|boolean',
        ]);

        $provinceId = $request->integer('province_id') ?: null;
        if (!$provinceId && $request->filled('province_code')) {
            $provinceId = DB::table('provinces')
                ->where('external_code', $request->province_code)
                ->value('id');
        }

        return $this->respond(
            DB::table('cities')
                ->select('id', 'province_id', 'external_code as code', 'name')
                ->when($provinceId, fn ($query) => $query->where('province_id', $provinceId))
                ->when($request->filled('q'), fn ($query) => $query->where('name', 'ilike', '%' . $request->q . '%'))
                ->orderBy('external_code')
                ->limit($this->limit($request))
                ->get()
        );
    }

    public function districts(Request $request)
    {
        $request->validate([
            'city_id' => 'nullable|integer|exists:cities,id',
            'city_code' => 'nullable|string',
            'q' => 'nullable|string',
            'all' => 'nullable|boolean',
        ]);

        $cityId = $request->integer('city_id') ?: null;
        if (!$cityId && $request->filled('city_code')) {
            $cityId = DB::table('cities')
                ->where('external_code', $request->city_code)
                ->value('id');
        }

        return $this->respond(
            DB::table('districts')
                ->select('id', 'city_id', 'external_code as code', 'name')
                ->when($cityId, fn ($query) => $query->where('city_id', $cityId))
                ->when($request->filled('q'), fn ($query) => $query->where('name', 'ilike', '%' . $request->q . '%'))
                ->orderBy('external_code')
                ->limit($this->limit($request))
                ->get()
        );
    }

    public function villages(Request $request)
    {
        $request->validate([
            'district_id' => 'nullable|integer|exists:districts,id',
            'district_code' => 'nullable|string',
            'q' => 'nullable|string',
            'all' => 'nullable|boolean',
            'flat' => 'nullable|boolean',
        ]);

        $districtId = $request->integer('district_id') ?: null;
        if (!$districtId && $request->filled('district_code')) {
            $districtId = DB::table('districts')
                ->where('external_code', $request->district_code)
                ->value('id');
        }

        $query = DB::table('villages')
            ->when($districtId, fn ($query) => $query->where('villages.district_id', $districtId))
            ->when($request->filled('q'), fn ($query) => $query->where('villages.name', 'ilike', '%' . $request->q . '%'));

        if ($request->boolean('flat')) {
            $query
                ->join('districts', 'districts.id', '=', 'villages.district_id')
                ->join('cities', 'cities.id', '=', 'districts.city_id')
                ->join('provinces', 'provinces.id', '=', 'cities.province_id')
                ->select(
                    'villages.id',
                    'villages.district_id',
                    'villages.external_code as code',
                    'villages.name',
                    'villages.postal_code',
                    'districts.name as district_name',
                    'cities.name as city_name',
                    'provinces.name as province_name'
                );
        } else {
            $query->select('id', 'district_id', 'external_code as code', 'name', 'postal_code');
        }

        return $this->respond(
            $query
                ->orderBy('villages.external_code')
                ->limit($this->limit($request))
                ->get()
        );
    }

    private function respond($data)
    {
        return response()->json([
            'success' => true,
            'data' => $data,
        ]);
    }

    private function limit(Request $request): int
    {
        $limit = (int) $request->input('limit', 500);
        $max = $request->boolean('all') ? 100000 : 1000;
        return max(1, min($limit, $max));
    }
}
