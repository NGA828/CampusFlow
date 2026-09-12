<?php

namespace App\Exceptions;

use Exception;
use Symfony\Component\HttpFoundation\Response;

/**
 * A refusal that is a product rule rather than a failure: the queue is full, you are not near the
 * room, this ticket cannot move to that state yet, this idempotency key belongs to someone else.
 *
 * It carries a machine-readable `code` alongside the human sentence, so a client can react to the
 * rule (offer to retry, point the student at the door, surface "scan again") instead of pattern
 * matching on prose. Rendered to the CampusFlow envelope by the exception handler.
 */
class BusinessRuleException extends Exception
{
    /** @param array<string, mixed> $context */
    public function __construct(
        string $message,
        public readonly string $code = 'BUSINESS_RULE',
        public readonly int $status = Response::HTTP_UNPROCESSABLE_ENTITY,
        public readonly array $context = [],
    ) {
        parent::__construct($message);
    }

    /** @param array<string, mixed> $context */
    public static function make(string $message, string $code, int $status = 422, array $context = []): self
    {
        return new self($message, $code, $status, $context);
    }
}
