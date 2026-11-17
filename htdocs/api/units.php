<?php
require __DIR__ . '/db.php';
json_out(db()->query('SELECT id, name, cost, hp, atk, spd, ep, ult, bond1, bond2, pos FROM units ORDER BY id')->fetchAll());
