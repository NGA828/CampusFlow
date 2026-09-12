<?php

/*
|--------------------------------------------------------------------------
| CampusFlow product rules
|--------------------------------------------------------------------------
|
| Knobs that turn product policy into behaviour. Anything that changes who may
| do what lives here so a reviewer can read one file and see the whole policy,
| instead of hunting for `if ($user->role === …)` across the controllers.
|
*/

return [

    'access' => [

        /*
        | What a staff account with no rows in `staff_assignments` may operate.
        | 'campus' keeps an unprovisioned deployment usable during rollout;
        | 'none' locks operations to explicitly assigned staff and is the value a
        | production install should ship with once assignments exist.
        */
        'unassigned_staff_scope' => env('CAMPUSFLOW_UNASSIGNED_STAFF_SCOPE', 'campus'),

        /*
        | A student may hold one active room-queue ticket per queue. Widening this is a business
        | decision, not a UI decision, and the partial unique index mirrors it.
        */
        'one_active_ticket_per_queue' => true,

        /*
        | Check-in claims physical presence, so it is refused from a browser. Keep true.
        */
        'require_mobile_for_check_in' => (bool) env('CAMPUSFLOW_REQUIRE_MOBILE_CHECKIN', true),
    ],

    'platforms' => [
        // Which client kinds are recognised. Unknown clients keep their role's rights, never more.
        'allowed' => ['web', 'mobile', 'api'],
    ],

];
