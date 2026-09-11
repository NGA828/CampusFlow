<?php

namespace App\Http\Controllers;

use App\Models\Office;
use App\Models\OfficeEvent;
use App\Models\OfficeServiceWindow;
use App\Models\OfficeTicket;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;

class OfficeController extends Controller
{
    /**
     * List all offices with live status and active ticket count.
     */
    public function index(): JsonResponse
    {
        $offices = Office::where('status', 'active')
            ->with(['serviceWindows' => function ($query) {
                $query->where('status', 'active');
            }])
            ->get();

        $data = $offices->map(function ($office) {
            $waitingCount = OfficeTicket::where('office_id', $office->id)
                ->where('status', 'waiting')
                ->count();

            $servingCount = OfficeTicket::where('office_id', $office->id)
                ->where('status', 'in_service')
                ->count();

            $array = $office->toArray();
            $array['waiting_tickets'] = $waitingCount;
            $array['serving_tickets'] = $servingCount;
            $array['estimated_wait_minutes'] = $office->avg_service_minutes * $waitingCount;
            return $array;
        });

        return response()->json([
            'success' => true,
            'data'    => $data,
        ]);
    }

    /**
     * Show single office detail.
     */
    public function show(Office $office): JsonResponse
    {
        $office->load(['serviceWindows']);
        $waitingCount = OfficeTicket::where('office_id', $office->id)->where('status', 'waiting')->count();
        $servingCount = OfficeTicket::where('office_id', $office->id)->where('status', 'in_service')->count();

        $data = $office->toArray();
        $data['waiting_tickets'] = $waitingCount;
        $data['serving_tickets'] = $servingCount;
        $data['estimated_wait_minutes'] = $office->avg_service_minutes * $waitingCount;

        return response()->json([
            'success' => true,
            'data'    => $data,
        ]);
    }

    /**
     * Take an office ticket.
     */
    public function createTicket(Request $request, Office $office): JsonResponse
    {
        $request->validate([
            'service_type' => 'nullable|string|max:100',
            'subject'      => 'nullable|string|max:255',
            'notes'        => 'nullable|string|max:500',
        ]);

        $user = $request->user();

        return DB::transaction(function () use ($request, $user, $office) {
            // Lock office to prevent race conditions in ticket numbering
            $lockedOffice = Office::where('id', $office->id)->lockForUpdate()->first();

            $existing = OfficeTicket::where('office_id', $office->id)
                ->where('user_id', $user->id)
                ->whereIn('status', ['waiting', 'called', 'approaching', 'in_service'])
                ->first();

            if ($existing) {
                return response()->json([
                    'success' => false,
                    'message' => 'You already have an active ticket for this office',
                    'data'    => ['ticket' => $existing->toApiArray()],
                ], 409);
            }

            $prefix = strtoupper(substr($office->code ?? 'OFF', 0, 3));
            $todayCount = OfficeTicket::where('office_id', $office->id)
                ->whereDate('created_at', now()->today())
                ->count();

            $ticketNum = $prefix . '-' . sprintf('%03d', $todayCount + 1);
            $idempotencyKey = 'OFFICE-' . $user->id . '-' . $office->id . '-' . time();
            $subject = $request->input('subject') ?? $request->input('service_type') ?? 'General Inquiry';

            $ticket = OfficeTicket::create([
                'office_id'       => $office->id,
                'user_id'         => $user->id,
                'ticket_number'   => $ticketNum,
                'subject'         => $subject,
                'status'          => 'waiting',
                'idempotency_key' => $idempotencyKey,
                'notes'           => $request->input('notes'),
            ]);

            OfficeEvent::create([
                'ticket_id'  => $ticket->id,
                'type'       => 'created',
                'metadata'   => ['ticket_number' => $ticketNum, 'user_id' => $user->id],
                'created_at' => now(),
            ]);

            return response()->json([
                'success' => true,
                'message' => 'Office ticket issued successfully',
                'data'    => ['ticket' => $ticket->toApiArray()],
            ], 201);
        });
    }

    /**
     * Call ticket at window (Staff action).
     */
    public function callTicket(Request $request, string $ticketId): JsonResponse
    {
        $request->validate([
            'service_window_id' => 'required|uuid|exists:office_service_windows,id',
        ]);

        $user = $request->user();
        if (!in_array($user->role, ['admin', 'staff'])) {
            return response()->json(['success' => false, 'message' => 'Forbidden'], 403);
        }

        $ticket = OfficeTicket::findOrFail($ticketId);

        DB::transaction(function () use ($ticket, $request, $user) {
            $ticket->update([
                'window_id' => $request->input('service_window_id'),
                'status'    => 'called',
                'called_at' => now(),
            ]);

            OfficeEvent::create([
                'ticket_id'  => $ticket->id,
                'type'       => 'called',
                'metadata'   => ['window_id' => $request->input('service_window_id'), 'called_by' => $user->id],
                'created_at' => now(),
            ]);
        });

        return response()->json([
            'success' => true,
            'message' => 'Office ticket called to window',
            'data'    => ['ticket' => $ticket->fresh()->toApiArray()],
        ]);
    }

    /**
     * Complete ticket (Staff action).
     */
    public function completeTicket(Request $request, string $ticketId): JsonResponse
    {
        $user = $request->user();
        if (!in_array($user->role, ['admin', 'staff'])) {
            return response()->json(['success' => false, 'message' => 'Forbidden'], 403);
        }

        $ticket = OfficeTicket::findOrFail($ticketId);

        DB::transaction(function () use ($ticket, $user) {
            $ticket->update([
                'status'       => 'completed',
                'completed_at' => now(),
            ]);

            OfficeEvent::create([
                'ticket_id'  => $ticket->id,
                'type'       => 'completed',
                'metadata'   => ['completed_by' => $user->id],
                'created_at' => now(),
            ]);
        });

        return response()->json([
            'success' => true,
            'message' => 'Office ticket completed',
            'data'    => ['ticket' => $ticket->fresh()->toApiArray()],
        ]);
    }

    /**
     * Cancel ticket.
     */
    public function cancelTicket(Request $request, string $ticketId): JsonResponse
    {
        $user = $request->user();
        $ticket = OfficeTicket::findOrFail($ticketId);

        if ($ticket->user_id !== $user->id && !in_array($user->role, ['admin', 'staff'])) {
            return response()->json(['success' => false, 'message' => 'Unauthorized action'], 403);
        }

        DB::transaction(function () use ($ticket, $user) {
            $ticket->update([
                'status'       => 'cancelled',
                'cancelled_at' => now(),
                'cancelled_by' => ($ticket->user_id === $user->id) ? 'user' : 'staff',
            ]);

            OfficeEvent::create([
                'ticket_id'  => $ticket->id,
                'type'       => 'cancelled',
                'metadata'   => ['cancelled_by' => $user->id],
                'created_at' => now(),
            ]);
        });

        return response()->json([
            'success' => true,
            'message' => 'Office ticket cancelled',
            'data'    => ['ticket' => $ticket->fresh()->toApiArray()],
        ]);
    }

    /**
     * Get user's office tickets.
     */
    public function myOfficeTickets(Request $request): JsonResponse
    {
        $tickets = OfficeTicket::where('user_id', $request->user()->id)
            ->with(['office'])
            ->orderBy('created_at', 'desc')
            ->get();

        return response()->json([
            'success' => true,
            'data'    => $tickets->map(fn($t) => $t->toApiArray()),
        ]);
    }
}
