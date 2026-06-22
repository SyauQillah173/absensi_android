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
        ]);

        $districtId = $request->integer('district_id') ?: null;
        if (!$districtId && $request->filled('district_code')) {
            $districtId = DB::table('districts')
                ->where('external_code', $request->district_code)
                ->value('id');
        }

        return $this->respond(
            DB::table('villages')
                ->select('id', 'district_id', 'external_code as code', 'name', 'postal_code')
                ->when($districtId, fn ($query) => $query->where('district_id', $districtId))
                ->when($request->filled('q'), fn ($query) => $query->where('name', 'ilike', '%' . $request->q . '%'))
                ->orderBy('external_code')
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
        return max(1, min($limit, 1000));
    }
}
