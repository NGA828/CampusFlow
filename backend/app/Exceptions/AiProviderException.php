<?php

namespace App\Exceptions;

use RuntimeException;

class AiProviderException extends RuntimeException
{
    public function __construct(
        string $message = 'The AI model is unavailable right now. Please try again shortly.',
        public readonly string $errorCode = 'AI_PROVIDER_UNAVAILABLE',
        public readonly int $status = 503,
    ) {
        parent::__construct($message);
    }
}
