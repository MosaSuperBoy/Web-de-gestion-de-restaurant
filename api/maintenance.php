<?php

declare(strict_types=1);

header('Content-Type: application/json; charset=utf-8');
header('Cache-Control: no-store, private');
header('X-Content-Type-Options: nosniff');
header('Referrer-Policy: no-referrer');

function respond(int $status, array $body): void
{
    http_response_code($status);
    echo json_encode($body, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
    exit;
}

$method = $_SERVER['REQUEST_METHOD'] ?? '';
if (!in_array($method, ['GET', 'POST'], true)) {
    header('Allow: GET, POST');
    respond(405, ['error' => 'Méthode non autorisée.']);
}

if ($method === 'POST') {
    $https = isset($_SERVER['HTTPS']) && $_SERVER['HTTPS'] !== '' && strtolower((string) $_SERVER['HTTPS']) !== 'off';
    $remoteAddress = (string) ($_SERVER['REMOTE_ADDR'] ?? '');
    if (!$https && !in_array($remoteAddress, ['127.0.0.1', '::1'], true)) {
        respond(400, ['error' => 'Une connexion HTTPS est obligatoire pour modifier ce réglage.']);
    }
}

$configPath = __DIR__ . '/maintenance-config.php';
if (!is_file($configPath)) {
    error_log('Shop maintenance API is not configured: api/maintenance-config.php is missing.');
    respond(503, ['error' => 'Le mode maintenance n’est pas encore configuré sur le serveur.']);
}

$config = require $configPath;
if (!is_array($config)
    || !isset($config['database_dsn'], $config['database_user'], $config['database_password'], $config['admin_password_hash'])
    || !is_string($config['database_dsn']) || $config['database_dsn'] === ''
    || !is_string($config['database_user']) || $config['database_user'] === ''
    || !is_string($config['database_password'])
    || !is_string($config['admin_password_hash']) || $config['admin_password_hash'] === '') {
    error_log('Shop maintenance API configuration is invalid.');
    respond(503, ['error' => 'La configuration du mode maintenance est invalide.']);
}

try {
    $database = new PDO(
        $config['database_dsn'],
        $config['database_user'],
        $config['database_password'],
        [
            PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION,
            PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
            PDO::ATTR_EMULATE_PREPARES => false
        ]
    );

    if ($method === 'GET') {
        $statement = $database->query('SELECT enabled FROM shop_maintenance WHERE id = 1');
        $row = $statement->fetch();
        if (!$row) {
            respond(503, ['error' => 'La table de maintenance n’est pas initialisée.']);
        }
        respond(200, ['enabled' => (bool) $row['enabled']]);
    }

    $requestBody = file_get_contents('php://input', false, null, 0, 4097);
    if ($requestBody === false || strlen($requestBody) > 4096) {
        respond(413, ['error' => 'La requête est absente ou trop volumineuse.']);
    }
    try {
        $payload = json_decode($requestBody, true, 16, JSON_THROW_ON_ERROR);
    } catch (JsonException $error) {
        respond(400, ['error' => 'La requête JSON est invalide.']);
    }
    if (!is_array($payload) || !is_bool($payload['enabled'] ?? null)
        || !is_string($payload['password'] ?? null) || $payload['password'] === ''
        || strlen($payload['password']) > 1024) {
        respond(400, ['error' => 'Les données de maintenance sont incomplètes.']);
    }

    $clientAddress = (string) ($_SERVER['REMOTE_ADDR'] ?? 'unknown');
    $clientHash = hash('sha256', $clientAddress);
    $database->beginTransaction();
    $insertAttempt = $database->prepare('INSERT IGNORE INTO shop_maintenance_auth_attempts (ip_hash) VALUES (?)');
    $insertAttempt->execute([$clientHash]);
    $readAttempt = $database->prepare(
        'SELECT failed_attempts, GREATEST(TIMESTAMPDIFF(SECOND, UTC_TIMESTAMP(), locked_until), 0) AS remaining_seconds
         FROM shop_maintenance_auth_attempts WHERE ip_hash = ? FOR UPDATE'
    );
    $readAttempt->execute([$clientHash]);
    $attempt = $readAttempt->fetch();
    $remainingSeconds = (int) ($attempt['remaining_seconds'] ?? 0);
    if ($remainingSeconds > 0) {
        $database->commit();
        header('Retry-After: ' . $remainingSeconds);
        respond(429, ['error' => 'Trop de tentatives. Réessayez après le délai indiqué.']);
    }

    if (!password_verify($payload['password'], $config['admin_password_hash'])) {
        $failedAttempts = min(65535, (int) ($attempt['failed_attempts'] ?? 0) + 1);
        $lockedUntil = $failedAttempts >= 5 ? gmdate('Y-m-d H:i:s', time() + 60) : null;
        $updateAttempt = $database->prepare(
            'UPDATE shop_maintenance_auth_attempts
             SET failed_attempts = ?, locked_until = ? WHERE ip_hash = ?'
        );
        $updateAttempt->execute([$failedAttempts, $lockedUntil, $clientHash]);
        $database->commit();
        respond(401, ['error' => 'Le mot de passe serveur est incorrect.']);
    }

    $updateMaintenance = $database->prepare('UPDATE shop_maintenance SET enabled = ? WHERE id = 1');
    $updateMaintenance->execute([$payload['enabled'] ? 1 : 0]);
    $resetAttempt = $database->prepare(
        'UPDATE shop_maintenance_auth_attempts SET failed_attempts = 0, locked_until = NULL WHERE ip_hash = ?'
    );
    $resetAttempt->execute([$clientHash]);
    $database->commit();
    respond(200, ['enabled' => $payload['enabled']]);
} catch (PDOException $error) {
    if (isset($database) && $database instanceof PDO && $database->inTransaction()) {
        $database->rollBack();
    }
    error_log('Shop maintenance database error: ' . $error->getMessage());
    respond(503, ['error' => 'Le service de maintenance est temporairement indisponible.']);
} catch (Throwable $error) {
    if (isset($database) && $database instanceof PDO && $database->inTransaction()) {
        $database->rollBack();
    }
    error_log('Shop maintenance API error: ' . $error->getMessage());
    respond(500, ['error' => 'Impossible de modifier le mode maintenance.']);
}
