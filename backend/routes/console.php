<?php

use Illuminate\Foundation\Inspiring;
use Illuminate\Support\Facades\Artisan;
use Illuminate\Support\Facades\Schedule;

Artisan::command('inspire', function () {
    $this->comment(Inspiring::quote());
})->purpose('Display an inspiring quote');

// A queue worker and the Laravel scheduler must be running in every deployed environment.
// Without this minute sweep, the ticket deadlines shown in the apps are informational only.
Schedule::command('campusflow:tickets:expire')
    ->everyMinute()
    ->withoutOverlapping();
