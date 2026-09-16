<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\SoftDeletes;

class TimetableEntry extends Model
{
    use HasUuids, SoftDeletes;

    protected $table = 'timetable_entries';

    protected $fillable = [
        'course_id', 'term_code', 'room_id', 'lecturer_id', 'type',
        'day_of_week', 'starts_at', 'ends_at',
        'effective_from', 'effective_until', 'excluded_dates',
    ];

    protected function casts(): array
    {
        return [
            'day_of_week'     => 'integer',
            'effective_from'  => 'date',
            'effective_until' => 'date',
            'excluded_dates'  => 'array',
        ];
    }

    public function course()   { return $this->belongsTo(Course::class); }
    public function room()     { return $this->belongsTo(Room::class); }
    public function lecturer() { return $this->belongsTo(User::class,'lecturer_id'); }
    public function term()     { return $this->belongsTo(Term::class,'term_code','code'); }

    public function toApiArray(): array
    {
        $course   = $this->relationLoaded('course') ? $this->course : null;
        $room     = $this->relationLoaded('room')   ? $this->room   : null;
        $floor    = $room?->relationLoaded('floor') ? $room->floor  : null;
        $building = $floor?->relationLoaded('building') ? $floor->building : null;

        return [
            'id'              => $this->id,
            'course_id'       => $this->course_id,
            'course_code'     => $course?->code,
            'course_title'    => $course?->name,
            'course_name'     => $course?->name,
            'course_colour'   => null,
            'department'      => $course?->department,
            'term_code'       => $this->term_code,
            'room_id'         => $this->room_id,
            'room_code'       => $room?->code,
            'room_name'       => $room?->name,
            'building_code'   => $building?->code,
            'building_name'   => $building?->name,
            'floor_id'        => $floor?->id,
            'floor_name'      => $floor?->name,
            'floor_level'     => $floor?->level,
            'lecturer_id'     => $this->lecturer_id,
            'lecturer'        => $this->lecturer?->name,
            'type'            => $this->type,
            'session_type'    => $this->type,
            'day_of_week'     => $this->day_of_week,
            'starts_at'       => $this->starts_at,
            'ends_at'         => $this->ends_at,
            'effective_from'  => $this->effective_from?->toDateString(),
            'effective_until' => $this->effective_until?->toDateString(),
            'excluded_dates'  => $this->excluded_dates ?? [],
        ];
    }
}
