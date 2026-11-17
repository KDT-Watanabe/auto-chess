<?php
require __DIR__ . '/db.php';
$pdo = db();
if ($_SERVER['REQUEST_METHOD'] === 'POST') {
    $in = json_decode(file_get_contents('php://input'), true) ?: [];
    $name = mb_substr(trim((string)($in['name'] ?? '')), 0, 20) ?: '名無し';
    $round = max(1, min(999, (int)($in['round'] ?? 1)));
    $st = $pdo->prepare('INSERT INTO scores (name, round_reached) VALUES (?, ?)');
    $st->execute([$name, $round]);
}
json_out($pdo->query('SELECT name, round_reached FROM scores ORDER BY round_reached DESC, id ASC LIMIT 10')->fetchAll());
