<?php

namespace App\Support;

use App\Models\Building;
use App\Models\Floor;
use App\Models\Room;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\Rule;

/** Storage-backed configuration rules; API authorization stays in middleware/controller. */
class CampusConfiguration
{
    public static function validate(Request $request, string $kind, ?Model $existing = null): array
    {
        $required = $existing ? ['sometimes', 'required'] : ['required'];
        $table = ['building' => 'buildings', 'floor' => 'floors', 'room' => 'rooms'][$kind];
        $unique = Rule::unique($table, 'code')->ignore($existing?->getKey());
        if ($kind === 'floor') $unique->where('building_id', $existing?->building_id ?? $request->input('building_id'));
        $rules = [
            'code' => [...$required, 'string', 'max:' . ($kind === 'room' ? 30 : 20), $unique],
            'name' => [...$required, 'string', 'max:' . ($kind === 'floor' ? 80 : 120)],
            'status' => 'sometimes|required|string|max:20',
        ];
        if ($kind === 'floor') {
            $rules += [
                'building_id' => $existing ? 'prohibited' : ['required', 'uuid', Rule::exists('buildings', 'id')->whereNull('deleted_at')],
                'level' => [...$required, 'integer', 'between:-2147483648,2147483647'],
                'plan_width_m' => 'nullable|numeric|min:0.01|max:999999.99',
                'plan_height_m' => 'nullable|numeric|min:0.01|max:999999.99',
                'plan_url' => 'nullable|string|max:500', 'plan_svg' => 'nullable|array',
                'plan_width' => 'prohibited', 'plan_height' => 'prohibited',
            ];
        } else {
            $rules += [
                'lat' => 'nullable|numeric|between:-90,90',
                'lng' => 'nullable|numeric|between:-180,180',
                'image_url' => 'nullable|string|max:500', 'is_public' => 'sometimes|boolean',
            ];
            if ($kind === 'building') {
                $rules += ['short_name' => 'nullable|string|max:40', 'description' => 'nullable|string', 'address' => 'nullable|string|max:200', 'footprint' => 'nullable|array', 'campus_name' => 'prohibited'];
            } else {
                $rules += [
                    'floor_id' => $existing ? 'prohibited' : ['required', 'uuid', Rule::exists('floors', 'id')->whereNull('deleted_at')],
                    'type' => 'sometimes|required|string|max:40', 'capacity' => 'sometimes|required|integer|between:0,2147483647',
                    'area_m2' => 'nullable|numeric|min:0.01|max:999999.99',
                    'plan_x' => 'nullable|numeric|between:-999999.9999,999999.9999',
                    'plan_y' => 'nullable|numeric|between:-999999.9999,999999.9999',
                    'features' => 'nullable|array', 'features.*' => 'string|max:100', 'requires_admission' => 'sometimes|boolean', 'access_rule' => 'nullable|array',
                    'building_id' => 'prohibited', 'room_type' => 'prohibited', 'plan_w' => 'prohibited', 'plan_h' => 'prohibited',
                ];
            }
        }
        return $request->validate($rules);
    }

    public static function create(string $kind, array $data): Model
    {
        return DB::transaction(function () use ($kind, $data) {
            // Parent creation/removal in this controller shares a row lock; a deleted parent cannot
            // be selected between validation and INSERT. Other reference writers need their own locks.
            if ($kind === 'floor') Building::whereKey($data['building_id'])->lockForUpdate()->firstOrFail();
            if ($kind === 'room') Floor::whereKey($data['floor_id'])->lockForUpdate()->firstOrFail();
            $class = ['building' => Building::class, 'floor' => Floor::class, 'room' => Room::class][$kind];
            return $class::create($data)->fresh();
        });
    }

    public static function remove(Model $model, string $kind): void
    {
        DB::transaction(function () use ($model, $kind) {
            $record = $model->newQuery()->lockForUpdate()->findOrFail($model->getKey());
            $column = $kind . '_id';
            $references = [
                'qr_nodes' => $column, 'navigation_nodes' => $column, 'geofences' => $column, 'user_positions' => $column,
            ];
            if ($kind === 'building') $references += ['floors' => 'building_id'];
            if ($kind === 'floor') $references += ['rooms' => 'floor_id', 'queue_tickets' => 'joined_floor_id', 'navigation_sessions' => 'current_floor_id'];
            if ($kind === 'room') $references += ['room_queues' => 'room_id', 'offices' => 'room_id', 'timetable_entries' => 'room_id', 'campus_events' => 'room_id', 'navigation_sessions' => 'to_room_id'];
            // Historical and soft-deleted references count too. Prefer a closed status for used places.
            foreach ($references as $table => $key) {
                abort_if(DB::table($table)->where($key, $record->getKey())->exists(), 409, 'This place has linked records. Use a closed status instead of removing it.');
            }
            abort_if(DB::table('staff_assignments')->where('scope_type', $kind)->where('scope_id', $record->getKey())->exists(), 409, 'This place has staff assignments. Review them before removal.');
            $record->delete();
        });
    }
}
